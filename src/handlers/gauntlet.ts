import type { Context } from '@devvit/public-api';
import type { GauntletState, GauntletSection, SegmentData } from '../types/index.js';

const GAUNTLET_KEY = 'gauntlet:current';

const STARTER_TILES = [
  // A simple 3-platform opener: flat ground, a gap, a raised platform
  { x: 0, y: 11, type: 'ground' }, { x: 1, y: 11, type: 'ground' },
  { x: 2, y: 11, type: 'ground' }, { x: 3, y: 11, type: 'ground' },
  { x: 4, y: 11, type: 'ground' },
  // gap at x=5
  { x: 6, y: 10, type: 'ground' }, { x: 7, y: 10, type: 'ground' },
  { x: 8, y: 10, type: 'ground' },
  // gap at x=9
  { x: 10, y: 11, type: 'ground' }, { x: 11, y: 11, type: 'ground' },
  { x: 12, y: 11, type: 'ground' }, { x: 13, y: 11, type: 'ground' },
  { x: 14, y: 11, type: 'ground' }, { x: 15, y: 11, type: 'ground' },
  // flag at end
  { x: 15, y: 10, type: 'flag' },
];

async function initGauntlet(ctx: Context): Promise<GauntletState> {
  const state: GauntletState = {
    seasonId: 1,
    sections: [{
      tiles: STARTER_TILES,
      width: 16,
      proposerId: 'system',
      proposerName: 'TRAPLINE',
      addedAt: Date.now(),
    }],
    updatedAt: Date.now(),
  };
  await ctx.redis.set(GAUNTLET_KEY, JSON.stringify(state));
  return state;
}

export async function getGauntlet(ctx: Context): Promise<GauntletState> {
  const raw = await ctx.redis.get(GAUNTLET_KEY);
  if (!raw) return initGauntlet(ctx);
  return JSON.parse(raw) as GauntletState;
}

export async function appendSection(
  ctx: Context,
  segment: SegmentData,
  proposerId: string,
  proposerName: string
): Promise<GauntletState> {
  const state = await getGauntlet(ctx);
  const section: GauntletSection = {
    tiles: segment.tiles,
    width: segment.width,
    proposerId,
    proposerName,
    addedAt: Date.now(),
  };
  state.sections.push(section);
  state.updatedAt = Date.now();
  await ctx.redis.set(GAUNTLET_KEY, JSON.stringify(state));
  return state;
}

export async function archiveGauntlet(ctx: Context): Promise<void> {
  const state = await getGauntlet(ctx);
  await ctx.redis.set(`gauntlet:archive:${state.seasonId}`, JSON.stringify(state));
  const fresh: GauntletState = {
    seasonId: state.seasonId + 1,
    sections: [state.sections[0]], // keep the starter
    updatedAt: Date.now(),
  };
  await ctx.redis.set(GAUNTLET_KEY, JSON.stringify(fresh));
}

// ── Proposal round (rolling, not date-keyed, so the nightly promoter is
//    immune to UTC-boundary off-by-one bugs). Votes live in a sorted set
//    keyed by proposal id; the payload lives in a parallel hash. ──
const PROPOSAL_VOTES_KEY = 'gauntlet:proposals:open';
const PROPOSAL_DATA_KEY = 'gauntlet:proposal_data';
const MAX_SECTIONS_PER_SEASON = 20;

export interface ProposalSummary {
  id: string;
  proposerName: string;
  tileCount: number;
  votes: number;
}

export async function submitGauntletProposal(
  ctx: Context,
  proposerId: string,
  proposerName: string,
  segment: SegmentData
): Promise<string> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await ctx.redis.hSet(PROPOSAL_DATA_KEY, {
    [id]: JSON.stringify({ proposerId, proposerName, segment, submittedAt: Date.now() }),
  });
  // Proposer's own vote seeds the score at 1.
  await ctx.redis.zAdd(PROPOSAL_VOTES_KEY, { score: 1, member: id });
  return id;
}

export async function upvoteProposal(ctx: Context, proposalId: string): Promise<number> {
  // Only counts if the proposal still exists in the data hash.
  const exists = await ctx.redis.hGet(PROPOSAL_DATA_KEY, proposalId);
  if (!exists) return 0;
  return ctx.redis.zIncrBy(PROPOSAL_VOTES_KEY, proposalId, 1);
}

export async function listProposals(ctx: Context, limit = 10): Promise<ProposalSummary[]> {
  const ranked = await ctx.redis.zRange(PROPOSAL_VOTES_KEY, 0, limit - 1, { by: 'score', reverse: true });
  if (!ranked.length) return [];
  const dataRaw = await ctx.redis.hGetAll(PROPOSAL_DATA_KEY);
  const out: ProposalSummary[] = [];
  for (const r of ranked) {
    const raw = dataRaw[r.member];
    if (!raw) continue;
    const p = JSON.parse(raw) as { proposerName: string; segment: SegmentData };
    out.push({ id: r.member, proposerName: p.proposerName, tileCount: p.segment.tiles.length, votes: r.score });
  }
  return out;
}

/** Promote the highest-voted proposal into the live Gauntlet, then clear the round. */
export async function promoteTopProposal(ctx: Context): Promise<GauntletSection | null> {
  const top = await ctx.redis.zRange(PROPOSAL_VOTES_KEY, 0, 0, { by: 'score', reverse: true });
  if (!top.length) return null;
  const winnerId = top[0].member;
  const raw = await ctx.redis.hGet(PROPOSAL_DATA_KEY, winnerId);
  if (!raw) return null;
  const p = JSON.parse(raw) as { proposerId: string; proposerName: string; segment: SegmentData };

  const state = await appendSection(ctx, p.segment, p.proposerId, p.proposerName);

  // Clear the round so the next night starts fresh.
  await ctx.redis.del(PROPOSAL_VOTES_KEY);
  await ctx.redis.del(PROPOSAL_DATA_KEY);

  // Roll to a new season once the course gets long.
  if (state.sections.length >= MAX_SECTIONS_PER_SEASON) {
    await archiveGauntlet(ctx);
  }
  return state.sections[state.sections.length - 1];
}

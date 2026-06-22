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

export async function submitGauntletProposal(
  ctx: Context,
  proposerId: string,
  proposerName: string,
  segment: SegmentData
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `gauntlet:proposals:${today}`;
  await ctx.redis.zAdd(key, {
    score: 1,
    member: JSON.stringify({ proposerId, proposerName, segment, submittedAt: Date.now() }),
  });
  await ctx.redis.expire(key, 48 * 60 * 60);
}

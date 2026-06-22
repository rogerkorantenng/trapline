import type { Context } from '@devvit/public-api';
import type { LeaderboardEntry } from '../types/index.js';

const BOARD_SIZE = 50;

export async function submitRun(
  ctx: Context,
  courseId: string,
  userId: string,
  username: string,
  timeMs: number,
  deathCount: number
): Promise<void> {
  // Score encodes: lower time = better. Pack as (deathCount * 1e9 + timeMs) so fewer deaths always wins.
  const score = deathCount * 1_000_000_000 + timeMs;
  const key = `lb:${courseId}`;
  await ctx.redis.zAdd(key, { score, member: userId });

  // Store human-readable data alongside
  await ctx.redis.hSet(`lb_meta:${courseId}`, {
    [userId]: JSON.stringify({ username, timeMs, deathCount }),
  });
}

export async function getLeaderboard(
  ctx: Context,
  courseId: string,
  medals: { bronze: number; silver: number; gold: number; author: number }
): Promise<LeaderboardEntry[]> {
  const key = `lb:${courseId}`;
  const members = await ctx.redis.zRange(key, 0, BOARD_SIZE - 1, { by: 'rank' });
  if (!members.length) return [];

  const metaRaw = await ctx.redis.hGetAll(`lb_meta:${courseId}`);

  return members.map((member, i) => {
    const meta = metaRaw[member] ? JSON.parse(metaRaw[member]) : { username: member, timeMs: 0, deathCount: 0 };
    const timeMs: number = meta.timeMs;
    let medal: LeaderboardEntry['medal'] = null;
    if (timeMs <= medals.author) medal = 'author';
    else if (timeMs <= medals.gold) medal = 'gold';
    else if (timeMs <= medals.silver) medal = 'silver';
    else if (timeMs <= medals.bronze) medal = 'bronze';
    return { userId: member, username: meta.username, timeMs, deathCount: meta.deathCount, rank: i + 1, medal };
  });
}

export async function getTopGhost(ctx: Context, courseId: string): Promise<string | null> {
  const key = `ghost:${courseId}`;
  return ctx.redis.get(key);
}

export async function saveGhost(ctx: Context, courseId: string, replayJson: string): Promise<void> {
  await ctx.redis.set(`ghost:${courseId}`, replayJson, { expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
}

export async function getPersonalBest(ctx: Context, courseId: string, userId: string): Promise<number | null> {
  const metaRaw = await ctx.redis.hGet(`lb_meta:${courseId}`, userId);
  if (!metaRaw) return null;
  const meta = JSON.parse(metaRaw);
  return meta.timeMs as number;
}

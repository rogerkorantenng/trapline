import type { Context } from '@devvit/public-api';
import type { GraveMarker } from '../types/index.js';

const MAX_MARKERS = 300;

export async function recordDeath(
  ctx: Context,
  courseId: string,
  userId: string,
  x: number,
  y: number,
  taunt?: string
): Promise<void> {
  const key = `graves:${courseId}`;
  const marker: GraveMarker = { x, y, taunt, userId };
  await ctx.redis.zAdd(key, { score: Date.now(), member: JSON.stringify(marker) });
  const count = await ctx.redis.zCard(key);
  if (count > MAX_MARKERS) {
    await ctx.redis.zRemRangeByRank(key, 0, count - MAX_MARKERS - 1);
  }
}

export async function getGraveyard(ctx: Context, courseId: string): Promise<GraveMarker[]> {
  const key = `graves:${courseId}`;
  const entries = await ctx.redis.zRange(key, 0, -1, { by: 'rank' });
  return entries.map((e) => JSON.parse(e.member) as GraveMarker);
}

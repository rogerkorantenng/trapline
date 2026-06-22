import type { Context } from '@devvit/public-api';
import type { CourseData } from '../types/index.js';

const COURSE_LIST_KEY = 'courses:index';
const MAX_COURSES = 200;

export async function saveCourse(ctx: Context, course: CourseData): Promise<void> {
  await ctx.redis.set(`course:${course.id}`, JSON.stringify(course));
  // Add to sorted index by creation time
  await ctx.redis.zAdd(COURSE_LIST_KEY, { score: course.createdAt, member: course.id });
  // Trim to max
  const count = await ctx.redis.zCard(COURSE_LIST_KEY);
  if (count > MAX_COURSES) {
    await ctx.redis.zRemRangeByRank(COURSE_LIST_KEY, 0, count - MAX_COURSES - 1);
  }
}

export async function getCourse(ctx: Context, courseId: string): Promise<CourseData | null> {
  const raw = await ctx.redis.get(`course:${courseId}`);
  return raw ? (JSON.parse(raw) as CourseData) : null;
}

export async function listCourses(ctx: Context, limit = 20): Promise<CourseData[]> {
  // Return newest first
  const ids = await ctx.redis.zRange(COURSE_LIST_KEY, -limit, -1, { by: 'rank' });
  if (!ids.length) return [];
  const courses: CourseData[] = [];
  for (const id of ids.reverse()) {
    const raw = await ctx.redis.get(`course:${id}`);
    if (raw) courses.push(JSON.parse(raw) as CourseData);
  }
  return courses;
}

export async function getDailyCourse(ctx: Context): Promise<CourseData | null> {
  // Daily course key rotates by UTC date
  const today = new Date().toISOString().slice(0, 10);
  const dailyId = await ctx.redis.get(`daily:${today}`);
  if (!dailyId) return null;
  return getCourse(ctx, dailyId);
}

export async function setDailyCourse(ctx: Context, courseId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await ctx.redis.set(`daily:${today}`, courseId, {
    expiration: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });
}

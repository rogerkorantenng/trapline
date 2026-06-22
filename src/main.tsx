import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import type { WebViewMessage } from './types/index.js';
import { submitRun, getLeaderboard, getTopGhost, saveGhost, getPersonalBest } from './handlers/leaderboard.js';
import { saveCourse, getCourse, listCourses, getDailyCourse, pickAndSetDaily } from './handlers/courses.js';
import { recordDeath, getGraveyard } from './handlers/graveyard.js';
import {
  getGauntlet,
  submitGauntletProposal,
  listProposals,
  upvoteProposal,
  promoteTopProposal,
} from './handlers/gauntlet.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// ── Scheduled jobs (registered, then armed via the AppInstall/AppUpgrade
//    triggers and lazily on INIT so existing installs pick them up too). ──
const JOB_DAILY = 'daily-rotate';
const JOB_GAUNTLET = 'gauntlet-advance';

// JobContext/TriggerContext expose redis + scheduler but omit `ui`; the redis
// handlers only touch `redis`, so widening to Context here is safe at runtime.
Devvit.addSchedulerJob({
  name: JOB_DAILY,
  onRun: async (_event, context) => {
    await pickAndSetDaily(context as unknown as Context);
  },
});

Devvit.addSchedulerJob({
  name: JOB_GAUNTLET,
  onRun: async (_event, context) => {
    await promoteTopProposal(context as unknown as Context);
  },
});

/** Idempotently (re)arm the cron jobs. Cancels any stale duplicates first. */
async function ensureJobs(context: { scheduler: Context['scheduler'] }): Promise<void> {
  const existing = await context.scheduler.listJobs();
  const wanted: Record<string, string> = { [JOB_DAILY]: '5 0 * * *', [JOB_GAUNTLET]: '15 0 * * *' };
  // Cancel everything we manage so we never stack duplicates on upgrade.
  for (const job of existing) {
    if (job.name in wanted) await context.scheduler.cancelJob(job.id);
  }
  for (const [name, cron] of Object.entries(wanted)) {
    await context.scheduler.runJob({ name, cron });
  }
}

Devvit.addTrigger({ event: 'AppInstall', onEvent: async (_e, context) => ensureJobs(context) });
Devvit.addTrigger({ event: 'AppUpgrade', onEvent: async (_e, context) => ensureJobs(context) });

function postMsg(ctx: Context, payload: unknown): void {
  ctx.ui.webView.postMessage('trapline-webview', JSON.parse(JSON.stringify(payload)));
}

Devvit.addMenuItem({
  label: 'Create TRAPLINE Game',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title: 'TRAPLINE — Build & race death courses',
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#0a0a0f">
          <text size="xxlarge" weight="bold" color="#e8ff47">TRAPLINE</text>
          <text size="medium" color="#888888">Loading...</text>
        </vstack>
      ),
    });
    context.ui.navigateTo(post);
  },
});

Devvit.addCustomPostType({
  name: 'TRAPLINE',
  height: 'tall',
  render: (context) => {
    const handleMessage = async (rawMsg: unknown) => {
      const msg = rawMsg as WebViewMessage;
      const userId = context.userId ?? 'anon';
      // Logged-out users all share context.userId === undefined; fall back to a
      // client-supplied stable anon id so their PBs/board entries don't collide.
      const idFor = (anonId?: string): string => context.userId ?? anonId ?? 'anon';

      switch (msg.type) {
        case 'INIT': {
          // Best-effort: make sure scheduled jobs are armed for older installs too.
          ensureJobs(context).catch(() => {});
          const user = await context.reddit.getCurrentUser();
          const username = user?.username ?? 'Anonymous';
          const gauntlet = await getGauntlet(context);
          const daily = await getDailyCourse(context);
          postMsg(context, { type: 'INIT_RESPONSE', data: { username, userId, gauntlet, daily } });
          break;
        }

        case 'SUBMIT_RUN': {
          const { courseId, timeMs, deathCount, replayData, anonId } = msg.data;
          const runnerId = idFor(anonId);
          const user = await context.reddit.getCurrentUser();
          const username = user?.username ?? 'Anonymous';
          const course = await getCourse(context, courseId);
          if (!course) break;

          const prevBest = await getPersonalBest(context, courseId, runnerId);
          await submitRun(context, courseId, runnerId, username, timeMs, deathCount);

          if (prevBest === null || timeMs < prevBest) {
            await saveGhost(context, courseId, JSON.stringify(replayData));
          }

          const board = await getLeaderboard(context, courseId, course.medals);
          const ghostRaw = await getTopGhost(context, courseId);
          postMsg(context, {
            type: 'RUN_SUBMITTED',
            data: { board, ghost: ghostRaw ? JSON.parse(ghostRaw) : null },
          });
          break;
        }

        case 'GET_LEADERBOARD': {
          const { courseId } = msg.data;
          const course = await getCourse(context, courseId);
          if (!course) break;
          const board = await getLeaderboard(context, courseId, course.medals);
          postMsg(context, { type: 'LEADERBOARD_DATA', data: { board } });
          break;
        }

        case 'GET_GHOST': {
          const { courseId } = msg.data;
          const ghostRaw = await getTopGhost(context, courseId);
          postMsg(context, {
            type: 'GHOST_DATA',
            data: { ghost: ghostRaw ? JSON.parse(ghostRaw) : null },
          });
          break;
        }

        case 'SAVE_COURSE': {
          const { course } = msg.data;
          course.authorId = userId;
          const user = await context.reddit.getCurrentUser();
          course.authorName = user?.username ?? 'Anonymous';
          course.createdAt = Date.now();
          await saveCourse(context, course);
          postMsg(context, { type: 'COURSE_SAVED', data: { courseId: course.id } });
          break;
        }

        case 'GET_COURSE': {
          const { courseId } = msg.data;
          const course = await getCourse(context, courseId);
          postMsg(context, { type: 'COURSE_DATA', data: { course } });
          break;
        }

        case 'LIST_COURSES': {
          const courses = await listCourses(context, 20);
          postMsg(context, { type: 'COURSES_LIST', data: { courses } });
          break;
        }

        case 'GET_GAUNTLET': {
          const gauntlet = await getGauntlet(context);
          postMsg(context, { type: 'GAUNTLET_DATA', data: { gauntlet } });
          break;
        }

        case 'PROPOSE_GAUNTLET': {
          const { segment, proposerName } = msg.data;
          const proposalId = await submitGauntletProposal(context, userId, proposerName, segment);
          postMsg(context, { type: 'PROPOSAL_SAVED', data: { proposalId } });
          break;
        }

        case 'GET_PROPOSALS': {
          const proposals = await listProposals(context, 10);
          postMsg(context, { type: 'PROPOSALS_LIST', data: { proposals } });
          break;
        }

        case 'UPVOTE_PROPOSAL': {
          const votes = await upvoteProposal(context, msg.data.proposalId);
          postMsg(context, { type: 'PROPOSAL_VOTED', data: { proposalId: msg.data.proposalId, votes } });
          break;
        }

        case 'SHARE_RUN': {
          const { courseTitle, timeMs, deathCount, medal } = msg.data;
          if (!context.postId) {
            postMsg(context, { type: 'SHARE_RESULT', data: { ok: false, reason: 'no-post' } });
            break;
          }
          const user = await context.reddit.getCurrentUser();
          const who = user?.username ? `u/${user.username}` : 'A racer';
          const medalLine = medal && medal !== 'FINISH' ? ` — ${medal} medal` : '';
          const deathLine = deathCount === 0 ? 'no deaths ✨' : `${deathCount} death${deathCount === 1 ? '' : 's'}`;
          const text =
            `🏁 ${who} cleared **${courseTitle}** in **${(timeMs / 1000).toFixed(3)}s**${medalLine} (${deathLine}).\n\n` +
            `Think you can go faster? Open the post and race it. — TRAPLINE`;
          try {
            await context.reddit.submitComment({ id: context.postId, text });
            postMsg(context, { type: 'SHARE_RESULT', data: { ok: true } });
          } catch (e) {
            postMsg(context, { type: 'SHARE_RESULT', data: { ok: false, reason: 'error' } });
          }
          break;
        }

        case 'RECORD_DEATH': {
          const { courseId, x, y, taunt } = msg.data;
          await recordDeath(context, courseId, userId, x, y, taunt);
          break;
        }

        case 'GET_DEATH_GRAVEYARD': {
          const { courseId } = msg.data;
          const markers = await getGraveyard(context, courseId);
          postMsg(context, { type: 'GRAVEYARD_DATA', data: { markers } });
          break;
        }

        case 'GET_DAILY_COURSE': {
          const daily = await getDailyCourse(context);
          postMsg(context, { type: 'DAILY_COURSE_DATA', data: { course: daily } });
          break;
        }
      }
    };

    return (
      <vstack height="100%" width="100%">
        <webview
          id="trapline-webview"
          url="index.html"
          width="100%"
          height="100%"
          onMessage={handleMessage}
        />
      </vstack>
    );
  },
});

export default Devvit;

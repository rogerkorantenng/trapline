import { Devvit, useState } from '@devvit/public-api';
import type { WebViewMessage } from './types/index.js';
import { submitRun, getLeaderboard, getTopGhost, saveGhost, getPersonalBest } from './handlers/leaderboard.js';
import { saveCourse, getCourse, listCourses, getDailyCourse } from './handlers/courses.js';
import { recordDeath, getGraveyard } from './handlers/graveyard.js';
import { getGauntlet, submitGauntletProposal } from './handlers/gauntlet.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

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
    const [webviewVisible, setWebviewVisible] = useState(false);

    if (!webviewVisible) {
      return (
        <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#0a0a0f">
          <vstack alignment="center middle" padding="large" gap="medium">
            <text size="xxlarge" weight="bold" color="#e8ff47">TRAPLINE</text>
            <text size="medium" color="#aaaaaa">Build death courses. Race ghosts. Survive the Gauntlet.</text>
            <spacer size="medium" />
            <button appearance="primary" size="large" onPress={() => setWebviewVisible(true)}>
              PLAY
            </button>
          </vstack>
        </vstack>
      );
    }

    const handleMessage = async (rawMsg: unknown) => {
      const msg = rawMsg as WebViewMessage;
      const userId = context.userId ?? 'anon';

      switch (msg.type) {
        case 'INIT': {
          const user = await context.reddit.getCurrentUser();
          const username = user?.username ?? 'Anonymous';
          const gauntlet = await getGauntlet(context);
          const daily = await getDailyCourse(context);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'INIT_RESPONSE',
            data: { username, userId, gauntlet, daily },
          });
          break;
        }

        case 'SUBMIT_RUN': {
          const { courseId, timeMs, deathCount, replayData } = msg.data;
          const user = await context.reddit.getCurrentUser();
          const username = user?.username ?? 'Anonymous';
          const course = await getCourse(context, courseId);
          if (!course) break;

          const prevBest = await getPersonalBest(context, courseId, userId);
          await submitRun(context, courseId, userId, username, timeMs, deathCount);

          // Save ghost only if this is a new personal best
          if (prevBest === null || timeMs < prevBest) {
            await saveGhost(context, courseId, JSON.stringify(replayData));
          }

          const board = await getLeaderboard(context, courseId, course.medals);
          const ghost = await getTopGhost(context, courseId);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'RUN_SUBMITTED',
            data: { board, ghost: ghost ? JSON.parse(ghost) : null },
          });
          break;
        }

        case 'GET_LEADERBOARD': {
          const { courseId } = msg.data;
          const course = await getCourse(context, courseId);
          if (!course) break;
          const board = await getLeaderboard(context, courseId, course.medals);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'LEADERBOARD_DATA',
            data: { board },
          });
          break;
        }

        case 'GET_GHOST': {
          const { courseId } = msg.data;
          const ghost = await getTopGhost(context, courseId);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'GHOST_DATA',
            data: { ghost: ghost ? JSON.parse(ghost) : null },
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
          context.ui.webView.postMessage('trapline-webview', {
            type: 'COURSE_SAVED',
            data: { courseId: course.id },
          });
          break;
        }

        case 'GET_COURSE': {
          const { courseId } = msg.data;
          const course = await getCourse(context, courseId);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'COURSE_DATA',
            data: { course },
          });
          break;
        }

        case 'LIST_COURSES': {
          const courses = await listCourses(context, 20);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'COURSES_LIST',
            data: { courses },
          });
          break;
        }

        case 'GET_GAUNTLET': {
          const gauntlet = await getGauntlet(context);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'GAUNTLET_DATA',
            data: { gauntlet },
          });
          break;
        }

        case 'PROPOSE_GAUNTLET': {
          const { segment, proposerName } = msg.data;
          await submitGauntletProposal(context, userId, proposerName, segment);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'PROPOSAL_SAVED',
            data: {},
          });
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
          context.ui.webView.postMessage('trapline-webview', {
            type: 'GRAVEYARD_DATA',
            data: { markers },
          });
          break;
        }

        case 'GET_DAILY_COURSE': {
          const daily = await getDailyCourse(context);
          context.ui.webView.postMessage('trapline-webview', {
            type: 'DAILY_COURSE_DATA',
            data: { course: daily },
          });
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

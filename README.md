# TRAPLINE

Build trap courses. Race them. Leave your mark where you wiped out.

TRAPLINE is a precision platformer that runs inside a Reddit post. Every course in the game was made by another player using the built-in editor. The game has no levels of its own — it only exists because the community keeps building it.

- **Play it:** [r/trapline_game_dev](https://www.reddit.com/r/trapline_game_dev/)
- **App listing:** https://developers.reddit.com/apps/trapline-game

---

## What it is

You open a post and race short, hard obstacle courses to the finish flag as fast as you can. Each course keeps a leaderboard and a ghost replay of whoever holds the record. You are not chasing a clock — you are chasing a real person's exact line through the level.

When you wipe out, you leave a marker and a one-line taunt at that spot. The next player sees the whole history of where people came unstuck before they even get there. Three wipeouts in the same place and the game marks it as a danger zone.

Finish a course and you can post your result as a real Reddit comment on the thread — your time, your medal, right there in the feed for anyone to challenge.

## Building a course

The editor is built into the post. Tap BUILD from the menu, paint a course out of tiles, name it, and publish. It goes live in the Community tab immediately.

| Tile | What it does |
|------|-------------|
| ⬛ Ground / ▬ Platform | Solid footing |
| █ Wall | Solid block, good for wall-jump sections |
| ▲ Spike / ⚙ Saw | Touch either and you wipe out |
| 👾 Goomba | Moving enemy — stomp it from above or go around |
| 🔼 Spring | Launches you into the air |
| ◌ Vanish | Disappears after you touch it once |
| ⬇ Crusher | Slams down from above |
| 🚩 Finish | Every course needs one |

The canvas extends as far right as you feel like building — no column limit. On publish the course is checked for solvability, assigned a difficulty, and given calibrated medal times based on its length.

## What keeps people coming back

A daily course is picked automatically every night. New course, new race, no intervention needed.

The Gauntlet is one long course the whole subreddit builds together. Anyone can propose the next section, everyone votes, and each night the top-voted piece gets added to the end. The course gets longer every day on its own. The leaderboard from yesterday still counts.

Every course has Bronze, Silver, Gold, and Author medal targets. The Author time is the creator's direct challenge to whoever races it. There is always a faster line to find.

## How it's built

The runner is Phaser. The whole game loop runs as a `Phaser.Scene` — custom physics with acceleration, friction, terminal velocity, wall mechanics, and corner correction so you stop catching on ledges you obviously cleared. Ghost replays record position and state every frame and play back in real time for the next racer. Screen shake on wipeout, camera flash on finish, tweened overlays for the countdown and celebration. The editor is vanilla canvas with no engine — it does not need a game loop, and keeping it separate meant it could be worked on without touching the runner.

Everything persistent lives in Redis: courses, leaderboards, ghosts, wipeout markers, the Gauntlet state, daily rotation. Two scheduled Devvit jobs run nightly — one rotates the daily course, one promotes the top-voted Gauntlet segment. They re-arm themselves on install and upgrade so older installs keep working without manual intervention.

The Devvit app is a custom post type with a web view. The browser and server communicate over a typed message layer, and all Reddit API calls (post creation, comment submission, user lookup) go through Devvit's server context.

```
src/
  main.tsx              Devvit app — post type, menu action, RPC handlers, cron jobs
  handlers/
    courses.ts          save/list courses, daily rotation
    leaderboard.ts      per-course boards, ghost replays, personal bests
    gauntlet.ts         community mega-course, proposals, voting
    graveyard.ts        wipeout markers and taunts
  types/index.ts        shared message and data types
webroot/
  index.html            all screens
  app.js                client routing, RPC client, onboarding guide
  gamerunner.js         Phaser scene — physics, ghosts, wipeouts, results
  gameeditor.js         canvas course editor
  constants.js          tile definitions, physics values, medal calibration
  localstate.js         personal bests and run history (localStorage)
  rpc.js                postMessage RPC layer
  seeded-courses.js     built-in starter courses
```

## Running locally

You need the [Devvit CLI](https://developers.reddit.com/docs/) and a Reddit account that moderates a test subreddit.

```bash
npm install
npm run playtest <your-subreddit>   # live reload against a real subreddit
npm run upload                       # publish a new version
```

To create a playable post: install the app on a subreddit, then use the subreddit menu **••• → Create TRAPLINE Game**.

## License

[MIT](./LICENSE) © 2026 Flat_Lawfulness8889

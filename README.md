# TRAPLINE

**Build and race trap courses on Reddit.**

TRAPLINE is a precision platformer where the community is the level designer. Snap together a gauntlet of spikes, saws, springs and vanishing tiles, then race it for the fastest clean run. Every course is built by a player, every wipeout leaves a mark, and there's a fresh challenge waiting every single day.

Built for Reddit's *Games with a Hook* hackathon on [Devvit](https://developers.reddit.com/) (Devvit Web) with [Phaser](https://phaser.io/).

- **App listing:** https://developers.reddit.com/apps/trapline-game
- **Play it:** a live TRAPLINE post in [r/trapline_game_dev](https://www.reddit.com/r/trapline_game_dev/)

---

## The hook

TRAPLINE is designed around reasons to come back tomorrow, not just finish once today:

- **Daily course** — a community course is promoted as *the* daily challenge every UTC midnight. New course, new race, every day.
- **The Gauntlet** — one ever-growing community mega-course. Players propose the next segment, everyone upvotes, and each day the top-voted segment is appended to the live Gauntlet. The course you raced yesterday is longer today.
- **Ghosts & leaderboards** — every course keeps a per-course leaderboard and a *ghost replay* of the current best run. You're never racing alone; you're racing the record holder's exact line.
- **Wipeout markers** — every time you wipe out, you leave a marker and a taunt at the spot. The next racer sees exactly where everyone before them came unstuck.
- **Medals** — every course is auto-calibrated to Bronze / Silver / Gold / Author times. There's always a tighter line to chase.

## How to play

1. Open a TRAPLINE post and hit **PLAY**.
2. **Run** (← →), **Jump**, and **Dash** through the course to the 🚩 finish flag. The movement is built for flow — variable-height jumps, air control, wall-slides and wall-jumps, dashes, coyote time and jump buffering for forgiving, expressive platforming.
3. Beat the clock. Land a medal. Then **↗ SHARE** your run as a comment to call out the next challenger.
4. Tap **BUILD** to open the editor and make your own course — then **publish** it to the community and race it yourself.

Works with keyboard on desktop and on-screen controls on mobile.

## Build a course

The in-app editor is a tile painter with everything you need to make a nasty, fair course:

| Tile | Behaviour |
|------|-----------|
| ⬛ Ground / ▬ Platform | Solid footing |
| ▲ Spike / ⚙ Saw | Static hazards |
| 👾 Goomba | Moving enemy |
| 🔼 Spring | Launches you up |
| ◌ Vanish | Disappears after you touch it |
| ⬇ Crusher | Slams down |
| █ Wall | Wall-jump surface |
| 🚩 Finish | The goal |

Courses extend **forward as far as you want to build** — pan right and keep going. On publish, the course is validated for solvability (reachable finish, jumpable gaps), assigned a difficulty, and given calibrated medal times based on its length.

## How it maps to the sub-challenges

- **Best Use of Phaser** — the runner is a hand-tuned Phaser game: custom physics (acceleration, friction, terminal velocity, wall mechanics), ghost replay rendering, particles, screen shake, and a wipeout-marker system, all inside an Interactive Post.
- **Best Use of Retention Mechanics** — daily course rotation and the daily-advancing Gauntlet are driven by scheduled Devvit jobs, so the content changes on its own every day whether or not you're watching.
- **Best Use of User Contributions** — courses, Gauntlet segments, votes, wipeout taunts, and shared run comments are all player-generated. The game has no content of its own without the community.

## Tech

- **Devvit Web** — Interactive Post hosting a web view (`src/main.tsx`), messaging between the post and the game over a typed RPC layer.
- **Phaser** — the game runner (`webroot/gamerunner.js`).
- **HTML5 Canvas** — the course editor (`webroot/gameeditor.js`), no engine dependency.
- **Redis** — courses, leaderboards, ghosts, wipeout markers, the Gauntlet, and daily rotation.
- **Scheduled jobs** — `daily-rotate` (pick the daily course) and `gauntlet-advance` (promote the top-voted segment), armed idempotently on install/upgrade.

### Project structure

```
src/
  main.tsx              Devvit app: custom post, menu action, RPC handlers, cron jobs
  handlers/
    courses.ts          save/list courses, daily course rotation
    leaderboard.ts      per-course leaderboards, ghost replays, personal bests
    gauntlet.ts         the growing community gauntlet + proposals/voting
    graveyard.ts        wipeout markers and taunts
  types/index.ts        shared message + data types
webroot/
  index.html            screens (menu, game, editor, results, gauntlet)
  app.js                client app / screen routing / RPC client
  gamerunner.js         Phaser runner (physics, ghosts, wipeouts, results)
  gameeditor.js         canvas course editor
  constants.js          tiles, physics tuning, medals
  ...                   audio, local state, seeded courses
```

## Development

Requires the [Devvit CLI](https://developers.reddit.com/docs/) and a Reddit account that is a moderator of a test subreddit.

```bash
npm install
npm run playtest <your-test-subreddit>   # live-reload against a real subreddit
npm run upload                            # publish a new app version
```

To put a playable post in a subreddit: install the app, then use the subreddit's **••• → "Create TRAPLINE Game"** menu action.

## License

[MIT](./LICENSE) © 2026 Flat_Lawfulness8889

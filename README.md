# TRAPLINE

A precision platformer where every level was built by someone else in the same Reddit post.

You race short, brutal courses to the finish flag as fast as you can. Each one has a leaderboard and a ghost — a real-time replay of whoever holds the record. You're not chasing a timer. You're chasing the exact path the current record holder took through the level.

Wipe out and you leave a marker and a taunt at that spot. The next player sees everyone who failed there before them. Three wipeouts in the same place and the game calls it a danger zone. Finish and you can post your result as a Reddit comment on the thread — your time and medal, right in the feed.

**Play:** [r/trapline_game_dev](https://www.reddit.com/r/trapline_game_dev/) · **App:** https://developers.reddit.com/apps/trapline-game

---

## Building courses

Hit BUILD from the menu. You get a tile editor that lives inside the post — no external tool. Paint your course, name it, publish it. It shows up in the Community tab straight away for anyone to race.

The canvas keeps going right as far as you want to build. On publish the course gets checked for solvability and assigned medal times calibrated to how long it is.

The tiles:

| | |
|--|--|
| ⬛ Ground · ▬ Platform | solid footing |
| █ Wall | solid block, good for wall-jump corridors |
| ▲ Spike · ⚙ Saw | instant wipeout on contact |
| 👾 Goomba | patrols back and forth — stomp from above or go around |
| 🔼 Spring | launches you high |
| ◌ Vanish | disappears after the first touch |
| ⬇ Crusher | slams down from above |
| 🚩 Finish | one per course, place it last |

## Why people come back

Every night a community course is picked as the daily challenge automatically. No manual work, just a new race each morning.

The Gauntlet is one course the whole subreddit builds together. Anyone proposes the next section, everyone votes, and the top pick gets added to the end each night. The course you raced yesterday is longer today. The leaderboard carries over.

Every course has Bronze, Silver, Gold, and Author medal targets. The Author time is the creator's direct challenge. There's always a tighter line to chase.

## How it's put together

The game runner is a Phaser scene. Physics is written by hand: acceleration, friction, terminal velocity, wall mechanics, corner correction. The ghost records position and state every frame and replays it live for whoever races next. Screen shake on wipeout, camera flash on finish, tweened overlays for the countdown. The editor is plain canvas — it doesn't need a game loop and keeping it separate meant changes there never touched the runner.

Courses, leaderboards, ghosts, wipeout markers, the Gauntlet, and daily rotation all live in Redis. Two scheduled jobs run each night — one rotates the daily course, one promotes the top-voted Gauntlet segment. They re-arm on install and upgrade so existing installs don't go stale.

```
src/
  main.tsx              Devvit post type, RPC handlers, cron jobs
  handlers/
    courses.ts          course storage, daily rotation
    leaderboard.ts      leaderboards, ghost replays, personal bests
    gauntlet.ts         community mega-course, proposals, voting
    graveyard.ts        wipeout markers and taunts
webroot/
  gamerunner.js         Phaser scene
  gameeditor.js         canvas editor
  app.js                screen routing, onboarding, RPC client
```

## Running it locally

Needs the [Devvit CLI](https://developers.reddit.com/docs/) and a Reddit account that moderates a test subreddit.

```bash
npm install
npm run playtest <your-subreddit>
npm run upload
```

To get a playable post: install the app, then use the subreddit menu **••• → Create TRAPLINE Game**.

## License

[MIT](./LICENSE) © 2026 Flat_Lawfulness8889

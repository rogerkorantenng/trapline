# TRAPLINE — Devpost submission

**Tagline**
A Reddit platformer where the community builds every level, sets every record, and leaves taunts at every spot you'll wipe out.

## Inspiration

I kept asking why a few Reddit games stick and most don't last a week. The ones that survive aren't usually about the core mechanic. They're about what other people did with it yesterday: the level someone else made, the time you're trying to beat, the argument in the comments after a brutal section. So I built the platforming to be the simple part and spent the real time on everything surrounding it.

The taunt idea came from watching people lose their minds at hard platformers online. The best part is always what people write in the replies after a punishing spot. I wanted that reaction to live inside the level instead of underneath it in a comment thread. That one idea ended up shaping the whole game.

## What it does

TRAPLINE runs inside a Reddit post. You race short, hard obstacle courses for the fastest clean run. Every course was made by another player in the same post. The editor is right there. You paint a course out of tiles, name it, publish it, and it goes live for everyone in the subreddit. No separate tool, no external link.

**The user contributions are the whole game.** Here is what players actually create:

**Courses.** The built-in tile editor lets anyone paint a course from ground, spikes, saws, springs, crushers, vanishing platforms, and walls. Build as far right as you want. Publish and it is immediately in the Community tab for anyone to race. The course gets auto-calibrated medal times (Bronze, Silver, Gold, Author) based on how long it is, so you do not have to guess.

**Runs and records.** Every course keeps a per-course leaderboard and a ghost replay of the current best run. Your run is recorded frame by frame as you play. The next racer does not chase a clock — they chase your exact line through the level. When someone beats you, they become the ghost.

**Wipeout markers and taunts.** Every time you wipe out, you leave a small marker and a one-line taunt at that exact spot. The next player opens the level and sees the whole graveyard of where everyone before them came unstuck. Wipe out in the same spot three times and the game marks it as a danger zone. The taunts are short, but they are always funnier in context.

**Run comments.** After you finish a course and get a result, you can share it as a real Reddit comment on the post. It posts your time, medal, and wipeout count directly to the thread. Anyone scrolling the subreddit sees it and can click through to race.

**The Gauntlet.** One course the whole subreddit builds together. You propose the next chunk, everyone votes, and every night the top-voted segment gets bolted onto the end. The course you raced yesterday is longer this morning. It never resets.

## How I built it — and where Phaser actually lives

The app is Devvit Web. The Reddit post hosts a web view, and a typed message layer handles everything between the browser and the server (Redis on the backend, scheduled jobs for the daily rotation and nightly Gauntlet advance).

Phaser is the runner. Not a wrapper, not a helper — the entire game loop runs as a `Phaser.Scene`. I use Phaser's `Graphics` objects for every tile, player, ghost, wipeout marker, saw animation, crusher, and particle effect. The camera follows the player with `setBounds`, flashes on finish, shakes on wipeout. Tweens handle the countdown pop-in, the wipeout overlay scale animation, the confetti burst, and the celebration text. The HUD (timer, wipeout count, pause button) is pinned with `setScrollFactor(0)`. When I needed timing that couldn't trust Phaser's scaled time (the wipeout freeze frame), I dropped down to `Date.now()` and `setTimeout` — but the rest runs through the scene lifecycle.

The editor is deliberately not Phaser. It is vanilla canvas with a grid and a tile painter. A tile editor does not need a game loop, and keeping it separate meant I could iterate on it without touching the runner at all.

Movement I wrote by hand because feel was the whole game: variable jump height, coyote time, a jump buffer, wall slides and wall jumps, a dash, and corner correction so you stop catching on ledges you obviously cleared. The ghost system records position, velocity, and state every frame and replays it at the same timestamps for the next racer.

## Challenges

Input was the first serious fight. Key events were not registering inside the Devvit web view, so I moved the listener to the window level and stopped relying on Phaser's input focus. Touch required its own path — jump is tap-anywhere on mobile because a D-pad would have eaten too much screen.

The game froze on the "GO!" countdown early in development because I called a camera tint method that does not exist in this build of Phaser. One unhandled throw inside `update()` kills the RAF loop and freezes everything. I wrapped the risky scene calls, deleted the bad ones, and added a top-level try/catch around `update()` to prevent any future mistake from taking the whole frame loop down.

Medal calibration was its own problem. A five-second course and a three-minute course cannot share the same gold time. I derive the Bronze/Silver/Gold/Author targets from course length at publish, calibrated so a clean first run usually gets Bronze and the Author time is genuinely hard.

`window.confirm()` is silently blocked in Devvit's sandboxed iframe — it just returns false. Found that when the delete button on community courses appeared to do nothing. Replaced with an inline YES/NO confirmation that appends to the card.

## What I'm proud of

The movement. It took longer than everything else combined and the difference between good and bad platformer movement is subtle enough that most people cannot say why it feels wrong when it does. Coyote time, input buffering, corner correction — none of them are impressive on their own. Take them all out and the game feels awful and you cannot quite say why.

The Gauntlet working end to end. It is one shared object that grows because strangers keep adding to it, driven entirely by votes and a nightly cron job. I did not touch it after setting it up and it still advances. Watching a course get longer overnight without me doing anything was exactly what I wanted.

And that the full loop — build a course, publish it, race someone else's course, leave a marker, share a run to the comments — all happens inside a single Reddit post on a phone.

## What I learned

A lot about where Devvit's Redis is straightforward and where it gets awkward. `zRange` returns `{ member, score }` objects, not strings — I wasted time on a bug where every community course lookup silently returned nothing because I was using the object directly as a Redis key. That kind of thing does not show up until you have real data.

Also that `window.confirm()`, `localStorage`, and a few other browser APIs you reach for automatically are unavailable or broken in a sandboxed iframe. I hit each one at a different point in development.

## What's next

Better course discovery — right now the newest 20 courses show, which means good ones disappear fast. Sorting by rating or plays would help. A way to view the current record ghost without finishing the course first. More editor tiles, because every player who starts building immediately asks for the one block I did not include.

## Built with

devvit, reddit, phaser, javascript, typescript, redis, html5-canvas

## Links

- App listing: https://developers.reddit.com/apps/trapline-game
- Demo: live TRAPLINE post in r/trapline_game_dev

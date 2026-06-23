# TRAPLINE — Devpost submission

**Tagline**
A Reddit platformer where the community builds every level, sets every record, and leaves taunts at every spot you'll wipe out.

## Inspiration

The games that stick on Reddit aren't usually about the core mechanic. They're about what other people did with it yesterday. The level someone else made. The time you're trying to beat. The argument in the comments after a brutal section. Minecraft isn't popular because placing blocks is fun. It's popular because of what people build with those blocks and the stories that come out of it. I wanted to make something that worked the same way — where the platforming is just the material and the community is the architect.

The taunt idea came from watching people lose their minds at hard platformers online. The funniest part is always the replies after a punishing spot. I wanted that reaction to live inside the level instead of underneath it in a comment thread. That one idea ended up shaping everything else.

## What it does

TRAPLINE runs inside a Reddit post. Think Minecraft, but instead of building a house, you build a trap course and then watch the subreddit try to beat it. The editor is right there in the post. You paint tiles, name it, publish it, and it goes live immediately. No separate tool, no external link. Without the community, there is nothing to play.

**Courses.** The built-in tile editor lets anyone paint a course from ground, spikes, saws, springs, crushers, vanishing platforms, and walls. Build as far right as you want. Publish and it appears in the Community tab immediately, with auto-calibrated medal times based on how long it is.

**Runs and records.** Every course keeps a per-course leaderboard and a ghost replay of the current best run. Your run is recorded frame by frame. The next racer doesn't chase a clock — they chase your exact line through the level. When someone beats you, they become the ghost.

**Wipeout markers and taunts.** Every time you wipe out, you leave a marker and a one-line taunt at that spot. The next player sees the whole history of where people came unstuck before they even start. Three wipeouts in the same place and the game marks it as a danger zone.

**Run comments.** After you finish a course, you can share your result as a real Reddit comment — time, medal, and wipeout count posted directly to the thread. Anyone scrolling sees it and can click through to race.

**The Gauntlet.** One course the whole subreddit builds together. You propose the next chunk, everyone votes, and every night the top-voted segment gets added to the end. The course you raced yesterday is longer this morning. It never resets.

## How I built it — and where Phaser actually lives

The app is Devvit Web. The Reddit post hosts a web view and a typed message layer handles everything between the browser and the server.

Phaser is the runner. Not a wrapper, not a helper — the entire game loop runs as a `Phaser.Scene`. I use Phaser's `Graphics` objects for every tile, player, ghost, wipeout marker, saw animation, crusher, and particle effect. The camera follows the player with `setBounds`, flashes on finish, shakes on wipeout. Tweens handle the countdown pop-in, the wipeout overlay, the confetti burst, and the celebration text. The HUD is pinned with `setScrollFactor(0)`. When I needed timing that couldn't trust Phaser's scaled time for the wipeout freeze frame, I dropped to `Date.now()` and `setTimeout` — but the rest runs through the scene lifecycle.

The editor is deliberately not Phaser. It is vanilla canvas with a tile painter. A tile editor does not need a game loop, and keeping it separate meant I could work on it without touching the runner.

Movement I wrote by hand because feel was the whole game: variable jump height, coyote time, a jump buffer, wall slides and wall jumps, a dash, and corner correction so you stop catching on ledges you obviously cleared. The ghost records position, velocity, and state every frame and replays it at the same timestamps for the next racer.

## Challenges

Input was the first fight. Key events were not registering inside the Devvit web view, so I moved the listener to the window level and stopped relying on Phaser's input focus. Touch required its own path — jump is tap-anywhere on mobile because a D-pad would have taken too much screen.

The game froze on the "GO!" countdown early on because I called a camera tint method that does not exist in this build of Phaser. One unhandled throw inside `update()` kills the RAF loop and freezes everything. I wrapped the risky scene calls and added a top-level try/catch to prevent any future mistake from taking the whole frame loop down.

Medal calibration was its own problem. A five-second course and a three-minute course cannot share the same gold time. I derive the targets from course length at publish, calibrated so a clean first run usually gets Bronze and the Author time is genuinely hard.

`window.confirm()` is silently blocked in Devvit's sandboxed iframe — it just returns false. Found that when the delete button on community courses appeared to do nothing. Replaced it with an inline YES/NO confirmation that appends to the card.

## What I'm proud of

The movement. It took longer than everything else combined and the difference between good and bad platformer feel is subtle enough that most people can't say why it's wrong when it is. Coyote time, input buffering, corner correction — none of them are impressive alone. Take them all out and the game feels awful and you can't quite say why.

The Gauntlet working end to end. It is one shared object that grows because strangers keep adding to it, driven by votes and a nightly cron job. I did not touch it after setting it up and it still advances. Watching a course get longer overnight without me doing anything was exactly what I wanted to build.

And that the full loop — build a course, publish it, race someone else's course, leave a marker, share a run to the comments — all fits inside a single Reddit post on a phone.

## What I learned

`zRange` in Devvit's Redis returns `{ member, score }` objects, not strings. I spent real time on a bug where every community course lookup silently returned nothing because I was using the object directly as a Redis key. That kind of thing does not show up until you have real data in the system.

Also that `window.confirm()` and a handful of other browser APIs you reach for automatically are blocked or broken in a sandboxed iframe. I hit a different one at each stage of development.

## What's next

Better course discovery — right now the newest 20 courses show, which means good ones disappear fast. A way to browse the record ghost without finishing a course first. More editor tiles, because every player who starts building immediately asks for the one block that isn't there.

## Built with

devvit, reddit, phaser, javascript, typescript, redis, html5-canvas

## Links

- App listing: https://developers.reddit.com/apps/trapline-game
- Demo: live TRAPLINE post in r/trapline_game_dev

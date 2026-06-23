# TRAPLINE — Devpost submission

**Tagline**
A Reddit platformer where the players build the traps, set the records, and leave taunts where you'll wipe out.

## Inspiration

I kept asking why a few Reddit games stick and most die in a week. The ones that last usually aren't about the mechanic. They're about what someone else did with it yesterday: the level they made, the time you're chasing, the fight in the comments. So I made the platforming the easy part and spent the real effort on everything around it, like whose course this is and where everyone keeps falling apart. The taunt thing came straight from watching people lose their minds at hard platformers. The funniest stuff is always in the replies after a mean section. I wanted that to live inside the level instead of underneath it.

## What it does

TRAPLINE runs inside a Reddit post. You race short, mean obstacle courses for the fastest clean run, except every course was made by another player. The editor is in the post too. You paint a course out of tiles (ground, spikes, saws, springs, crushers, vanishing platforms), publish it, and it goes live for the subreddit. Each course remembers a leaderboard and a ghost of the current best run, so you're chasing a real person's exact line instead of a clock. Wipe out and you leave a little marker and a one-line taunt right where it happened. The next person sees the whole history of where people choked before they got there.

The return loop is the actual point. A daily course gets chosen for you every night. And then there's the Gauntlet, which is one long course the subreddit builds together. You propose the next chunk, people vote, and the winner gets bolted onto the end every day. The course you struggled with yesterday is longer this morning. On top of that, every course has medal times from Bronze up to Author, plus the record ghost, so there's always a specific thing to beat.

## How I built it

It's a Devvit Web app. The post hosts a web view, and the game and server pass typed messages back and forth. The runner is Phaser, and I wrote the movement by hand because feel was the whole game. Variable jump height, coyote time, a jump buffer, wall slides and jumps, a dash, corner correction so you stop catching on ledges you obviously cleared. Ghosts are just frames recorded as you run, replayed for whoever races next. The editor doesn't use an engine at all, it's canvas painting onto a grid that keeps going as far right as you feel like building. Everything persistent sits in Redis: courses, boards, ghosts, wipeout markers. Two scheduled jobs do the daily work, one rotating the daily course and one promoting the top-voted Gauntlet piece, and they re-arm on install and upgrade so old installs don't go stale.

## Challenges I ran into

Input was the first thing that nearly broke me. Key presses weren't registering inside the web view, so I gave up on Phaser's focus and listened for keys at the window level. Touch fought back too, so on mobile jump is just tap anywhere. Then the game flat-out froze on the "GO!" countdown one build, because I'd called a camera tint that doesn't exist in this version of Phaser, and one thrown error inside the update loop takes the entire frame loop down with it. Wrapped the risky bits, deleted the bad calls, done. Medals were their own headache, since a ten-second course and a two-minute course can't share a gold time, so I derive the targets from how long the course is when you publish it.

## Accomplishments I'm proud of

Honestly, the movement. It feels right, and that took longer than everything else combined. The Gauntlet working is the other one. It's a single thing that grows because strangers keep adding to it, and seeing a course get longer overnight without me touching it was exactly what I was after. And the whole thing fits in a post and plays fine on a phone, which I wasn't sure would happen.

## What I learned

A ton about Devvit Web, the message model between the post and the server, and the spots where Redis is great and the spots where it gets annoying once you want real leaderboards and per-course state. Mostly though, game feel turned out to be a pile of tiny mercy systems doing quiet work. Coyote time, input buffering, corner correction. None of them impress anyone on their own. Rip them all out and the game feels awful, and you can't quite say why.

## What's next

Course collections and weekly themes. A way to spectate the top ghost. Better discovery so the good courses don't drown as new ones show up. More tiles for the editor, because the moment people start building they immediately want the one block you didn't give them.

## Built with

devvit, reddit, phaser, javascript, typescript, redis, html5-canvas

## Links

- App listing: https://developers.reddit.com/apps/trapline-game
- Demo: a live TRAPLINE post in r/trapline_game_dev

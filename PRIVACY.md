# Privacy Policy

**TRAPLINE** — Last updated: June 2026

This policy explains what data TRAPLINE collects, how it's used, and how long it's kept.

## What we collect

TRAPLINE only collects data that is directly necessary for the game to function.

**From Reddit (via Devvit):**
- Your Reddit username — displayed on leaderboards and course credits
- Your Reddit user ID — used internally to link your scores and courses to your account

We never see your email address, password, or any account information beyond username and user ID.

**From gameplay:**
- Courses you publish (tile layout, course name, difficulty)
- Your run times and wipeout counts per course
- Ghost replay frames (position and movement state per frame) for record-setting runs
- Wipeout markers and the taunt text you choose when you wipe out
- Your votes on Gauntlet segment proposals

All of this is stored in Devvit's Redis infrastructure, which is scoped to this app and subreddit.

## What we don't collect

- Email addresses
- IP addresses
- Device identifiers
- Browsing or activity data outside this app
- Payment information
- Any data from users who are not logged in to Reddit

## How data is used

Your username and scores appear on leaderboards visible to other players. Your ghost replay is shown to other players racing the same course while you hold the record. Wipeout markers and taunts are shown at the location where you wiped out on a course. Courses you publish appear in the Community tab for others to race.

We do not sell, share, or transfer your data to any third party. We do not use your data for advertising.

## Data retention

Course data, leaderboard entries, and ghost replays are kept for as long as the app is installed on a subreddit. The community course list is capped at 200 entries — older courses are removed automatically as new ones are added. Wipeout markers are capped at 300 per course. Daily course rotation keys expire after 48 hours.

If you delete a course you published, it is removed from Redis immediately.

## Third-party services

TRAPLINE runs on Reddit's Devvit platform and uses Devvit's Redis for storage. Reddit's own privacy policy applies to your Reddit account and activity on the platform: https://www.reddit.com/policies/privacy-policy

## Children

TRAPLINE does not knowingly collect data from anyone under the minimum age required to use Reddit in their country. If you are under that age, do not use this app.

## Changes

If this policy changes in a material way, we'll update the date at the top of this file. Continued use of the app after changes means you accept the updated policy.

## Contact

Questions about this policy: contact u/Flat_Lawfulness8889 on Reddit or open an issue at https://github.com/rogerkorantenng/trapline.

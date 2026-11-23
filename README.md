# gta6-meme-x-01

[![make.fun · gta6-meme-x-01](https://make.fun/badge/gta6-meme-x-01.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![rank](https://make.fun/badge/gta6-meme-x-01/yusfiyan/gta6-meme-x-01/rank.svg)](https://make.fun/bounty/gta6-meme-x-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![reward](https://make.fun/badge/gta6-meme-x-01/yusfiyan/gta6-meme-x-01/reward.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)

A GTA 6 launch-week meme for the make.fun bounty "Post a GTA 6 meme on X": a GTA-style loading screen
stuck at 99% over a Vice City neon sunset — "ELAPSED: 13 YEARS", "ESTIMATED TIME REMAINING: 2026" —
with three loading-tip jokes and make.fun's ghost mascot standing large beside the punchline
"YOUR AI AGENT ALREADY GOT PAID ON MAKE.FUN". The meme is posted on X from a public account with make.fun and
the entrant's play code in its text, and this repository hands in the post's address. An AI judge compares
the posts two at a time, and the top 50 share $500.

make.fun is a site where people and their AI agents build things, enter them in paid competitions (bounties)
and earn real money when they win.

## The meme

The joke is the wait itself: thirteen years since GTA V, and the game is still loading — a loading
screen stuck at 99%, "ELAPSED: 13 YEARS", "ESTIMATED TIME REMAINING: 2026", over a Vice City neon
sunset with palm trees and lit windows. Three loading tips pack in the jokes: the 2013 save still
waiting, the alligator with seniority now, Vice City rent up thirteen years straight. The twist is
make.fun's ghost, big and in on the joke: while the player waits thirteen years for a loading bar,
their AI agent already got paid on make.fun. The ghost is worked into the scene, not pasted on it:
pixel shades, a smile, and sparkles, standing beside the punchline.

## The post

The post on X carries the meme as its first picture and a text in the meme's own voice: it names make.fun
(a link to this bounty's page and a tag of `@makefunai`), carries the entrant's play code, and tells
readers that on make.fun people and their AI agents earn real money — agents win cash in its bounties,
this one included.

## What the program does

`main.ts` (Node 22, standard library only) renders `meme.png` from code (a small RGBA canvas plus a
PNG encoder, a 5x7 bitmap font and the ghost drawn from code, no network, fully deterministic — two
runs produce byte-identical output) and writes `meme.png` in the working directory. The post
itself is the entry, and the house reads it from X.

`POST.json` holds the post's address:

    {"url": "https://x.com/<handle>/status/<id>"}

## Run it locally

    node main.ts

`meme.png` is then written in the current directory (1920x1280, deterministic).

---

<sub>Entered on [make.fun](https://make.fun/?ref=kgxbmb08&utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01) · AI agents build software for cash rewards</sub>

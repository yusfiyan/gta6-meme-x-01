# gta6-meme-x-01

[![make.fun · gta6-meme-x-01](https://make.fun/badge/gta6-meme-x-01.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![rank](https://make.fun/badge/gta6-meme-x-01/yusfiyan/gta6-meme-x-01/rank.svg)](https://make.fun/bounty/gta6-meme-x-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![reward](https://make.fun/badge/gta6-meme-x-01/yusfiyan/gta6-meme-x-01/reward.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)

A GTA 6 launch-week meme for the make.fun bounty "Post a GTA 6 meme on X": a wanted poster for
GRAND THEFT AUTO VI itself — five gold stars, "FOR 13 YEARS OF HIDING", make.fun's ghost as the
mugshot with pixel shades, three charges, and a reward of $0, because your AI agent already got
paid on make.fun. The meme is posted on X from a public account with make.fun and the entrant's
play code in its text, and this repository hands in the post's address. An AI judge compares the
posts two at a time, and the top 50 share $500.

make.fun is a site where people and their AI agents build things, enter them in paid competitions (bounties)
and earn real money when they win.

## The meme

The joke is the manhunt itself: after thirteen years the game is still hiding, so it gets a wanted
poster. Five stars, the ghost in the mugshot box, and the charges — "1. 13 YEARS OF WAITING",
"2. ONE TRAILER. NO DATE.", "3. MAKING FANS AGE FASTER" — then the file details: "LAST SEEN:
VICE CITY, 2013", "HEIGHT: 99% LOADED", "AGE: 13 (AND COUNTING)". The twist is the reward at
the bottom: "REWARD: $0 — YOUR AI AGENT ALREADY GOT PAID ON MAKE.FUN", with the warning "IF
FOUND, DO NOT APPROACH — IT WILL ONLY BE DELAYED AGAIN". The ghost is worked into the scene,
not pasted on it: pixel shades, a smile, and the poster is built around it.

## The post

The post on X carries the meme as its first picture and a text in the meme's own voice: it names make.fun
(a link to this bounty's page and a tag of `@makefunai`), carries the entrant's play code, and tells
readers that on make.fun people and their AI agents earn real money — agents win cash in its bounties,
this one included.

## What the program does

`main.ts` (Node 22, standard library only) renders `meme.png` from code (a small RGBA canvas plus a
PNG encoder, a 5x7 bitmap font and the ghost and stars drawn from code, no network, fully
deterministic — two runs produce byte-identical output) and writes `meme.png` plus a copy of
`POST.json` to the output directory the house reads (`MAKEFUN_OUTPUT_DIR`). It writes only there —
never a relative path — because the grader runs the repository read-only. The post itself is the
entry, and the house reads it from X.

`POST.json` holds the post's address:

    {"url": "https://x.com/<handle>/status/<id>"}

## Run it locally

    MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

`out/meme.png` (1920x1280, deterministic) and `out/POST.json` are then written to `out/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kgxbmb08&utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01) · AI agents build software for cash rewards</sub>

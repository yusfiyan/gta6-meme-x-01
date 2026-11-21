// gta6-meme-x-01 entry (Node 22, standard library only).
//
// The entry is the X post itself: an AI-made GTA 6 meme, posted from a
// public account with make.fun (a link or written out) and/or a tag of
// @makefunai and the entrant's play code in its text. This program does
// the one mechanical job the gate needs: it copies POST.json from the
// repository root to /output/POST.json, where the house reads the post's
// address and then reads the post from X. Nothing this program writes
// about the post is judged.
//
// POST.json as shipped here holds a placeholder address, so the gate
// refuses it as it stands (valid 0). Replace it with the real post
// address before submitting.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

// The gate only accepts POST.json when it is a JSON object naming an X
// post's address, so check the shape before copying: a malformed file
// should fail here with a clear error instead of being copied through
// and refused later. The bytes written out are the file's own bytes,
// unchanged, so the two runs still write the same output.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  const raw = readFileSync(join(BOT_DIR, 'POST.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { url?: unknown }).url !== 'string') {
    throw new Error('POST.json must be a JSON object with a string "url" field');
  }
  writeFileSync(join(OUTPUT_DIR, 'POST.json'), raw);
} catch (err) {
  console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

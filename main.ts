// gta6-meme-x-01 entry (Node 22, standard library only) — RESUBMIT meme.
//
// The entry is the X post itself: an AI-made GTA 6 meme, posted from a
// public account with make.fun (a link or written out) and/or a tag of
// @makefunai and the entrant's play code in its text. This program renders
// the meme from scratch — a pure-code drawing, no assets, no network — and
// writes it out as meme.png (1920x1280), then does the one mechanical job
// the gate needs: it copies POST.json from the repository root to
// /output/POST.json, where the house reads the post's address and then
// reads the post from X.
//
// The meme: a GTA "WASTED" death screen over a Leonida dusk skyline.
// "WASTED" in huge outlined letters, "13 YEARS WAITING FOR GTA 6"
// underneath, and the make.fun ghost large at the bottom holding its star
// coin next to "YOUR AI AGENT ALREADY GOT PAID ON MAKE.FUN". The joke is
// specific to GTA 6 (13 years since GTA V, Leonida, Jason & Lucia's wait)
// and make.fun is big in the picture, not a corner detail.
//
// Everything is deterministic: fixed palette, fixed layout, no clock, no
// random numbers (window lights come from a hash of their grid position).
// Two runs write byte-identical PNGs.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// That writes ./meme.png (the file to post) and out/POST.json.

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1920;
const H = 1280;

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

type RGB = [number, number, number];

const BLACK: RGB = [10, 10, 12];
const WHITE: RGB = [242, 237, 228];
const MAGENTA: RGB = [204, 30, 127];
const PINK: RGB = [232, 67, 147];

// ---------------------------------------------------------------- canvas

const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function blendPixel(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  px[i] = Math.round(px[i] * (1 - a) + c[0] * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + c[1] * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + c[2] * a);
  px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W - 1, Math.ceil(x + w) - 1);
  const y1 = Math.min(H - 1, Math.ceil(y + h) - 1);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) setPixel(xx, yy, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  const rr = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr) setPixel(x, y, c);
    }
  }
}

function fillPolygon(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1p] = pts[i]!;
      const [x2, y2p] = pts[(i + 1) % pts.length]!;
      if ((y1p <= y && y2p > y) || (y2p <= y && y1p > y)) {
        xs.push(x1 + ((y - y1p) * (x2 - x1)) / (y2p - y1p));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]!));
      const xb = Math.min(W - 1, Math.floor(xs[k + 1]!));
      for (let x = xa; x <= xb; x++) setPixel(x, y, c);
    }
  }
}

function scalePointsAbout(
  pts: Array<[number, number]>,
  cx: number,
  cy: number,
  s: number,
): Array<[number, number]> {
  return pts.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s]);
}

/** N-point star (alternating outer/inner radius), first point straight up. */
function starPoints(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  points = 5,
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ---------------------------------------------------------------- PNG out

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0; // filter: None
    Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Classic 5-wide, 7-tall bitmap glyphs, one string per row, '#' = ink.
// Only A-Z, 0-9 and a little punctuation; everything the meme says is
// uppercase, so there is no lowercase set.

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const BLANK_GLYPH = FONT[' ']!;

function glyphOf(ch: string): string[] {
  return FONT[ch] ?? BLANK_GLYPH;
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawTextRaw(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = glyphOf(ch);
    for (let row = 0; row < 7; row++) {
      const bits = g[row]!;
      for (let col = 0; col < 5; col++) {
        if (bits[col] === '1') {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

/** Text with a thick outline (drawn at 8 offsets, then filled on top). */
function drawText(
  s: string,
  x: number,
  y: number,
  scale: number,
  fg: RGB,
  outline: RGB | null,
  ow = 0,
): void {
  if (outline && ow > 0) {
    const offs: Array<[number, number]> = [
      [-ow, 0],
      [ow, 0],
      [0, -ow],
      [0, ow],
      [-ow, -ow],
      [ow, -ow],
      [-ow, ow],
      [ow, ow],
    ];
    for (const [dx, dy] of offs) drawTextRaw(s, x + dx, y + dy, scale, outline);
  }
  drawTextRaw(s, x, y, scale, fg);
}

function drawTextCentered(
  s: string,
  y: number,
  scale: number,
  fg: RGB,
  outline: RGB | null,
  ow = 0,
): void {
  drawText(s, Math.round((W - textWidth(s, scale)) / 2), y, scale, fg, outline, ow);
}

// ---------------------------------------------------------------- the ghost
// The make.fun ghost, drawn from its mark (press/mark-1024.png): white
// body with a thick black outline, two four-point sparkle eyes, a wavy
// hem, and a magenta coin with a white star held out at its side.

function ghostOutlinePoints(x: number, y: number, w: number, h: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const cx = x + w / 2;
  const cyTop = y + h * 0.4;
  const r = w / 2;
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI + (i / N) * Math.PI;
    pts.push([cx + r * Math.cos(a), cyTop + r * Math.sin(a) * 0.9]);
  }
  pts.push([x + w, y + h * 0.84]);
  // Wavy hem, right to left: each scallop is a smooth half-sine arc
  // rising off the baseline and back, not a straight zigzag.
  const waves = 3;
  const segW = w / waves;
  for (let k = 0; k < waves; k++) {
    const xStart = x + w - k * segW;
    const xEnd = x + w - (k + 1) * segW;
    const steps = 8;
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      pts.push([
        xStart + (xEnd - xStart) * u,
        y + h * 0.84 - Math.sin(u * Math.PI) * h * 0.14,
      ]);
    }
  }
  pts.push([x, cyTop]);
  return pts;
}

function drawGhost(x: number, y: number, w: number, h: number): void {
  const body = ghostOutlinePoints(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h * 0.45;
  // Thick black outline: the same silhouette, slightly enlarged, behind.
  fillPolygon(scalePointsAbout(body, cx, cy, 1.07), BLACK);
  fillPolygon(body, WHITE);
  // Four-point sparkle eyes.
  const eyeR = w * 0.085;
  fillPolygon(starPoints(x + w * 0.38, y + h * 0.42, eyeR, eyeR * 0.26, 4), BLACK);
  fillPolygon(starPoints(x + w * 0.63, y + h * 0.42, eyeR, eyeR * 0.26, 4), BLACK);
  // Hand: white fist with a black ring, at the body's right edge.
  const handX = x + w * 0.9;
  const handY = y + h * 0.68;
  const handR = w * 0.075;
  fillCircle(handX, handY, handR * 1.3, BLACK);
  fillCircle(handX, handY, handR, WHITE);
  // The star coin, held up beside the ghost.
  const coinX = x + w * 0.99;
  const coinY = y + h * 0.5;
  const coinR = w * 0.17;
  fillCircle(coinX, coinY, coinR * 1.14, BLACK);
  fillCircle(coinX, coinY, coinR, MAGENTA);
  fillPolygon(starPoints(coinX, coinY, coinR * 0.58, coinR * 0.24, 5), WHITE);
}

// ---------------------------------------------------------------- the scene

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

// Leonida dusk: deep violet up top, magenta mid-sky, orange at the horizon.
const SKY_STOPS: Array<[number, RGB]> = [
  [0, [28, 15, 56]],
  [350, [92, 29, 88]],
  [600, [184, 50, 104]],
  [780, [255, 138, 61]],
];

function drawSky(): void {
  for (let y = 0; y < 780; y++) {
    let c: RGB = SKY_STOPS[0]![1];
    for (let s = 0; s < SKY_STOPS.length - 1; s++) {
      const [y1, c1] = SKY_STOPS[s]!;
      const [y2, c2] = SKY_STOPS[s + 1]!;
      if (y >= y1 && y <= y2) {
        c = lerpColor(c1, c2, (y - y1) / (y2 - y1));
        break;
      }
    }
    fillRect(0, y, W, 1, c);
  }
}

function drawSun(): void {
  // High in the clear sky at top-right, clear of WASTED and the skyline.
  const cx = 1700;
  const cy = 130;
  const glow: RGB = [255, 154, 77];
  fillCircle(cx, cy, 130, glow);
  for (let y = cy - 130; y <= cy + 130; y++) {
    for (let x = cx - 130; x <= cx + 130; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= 130 * 130) blendPixel(x, y, glow, 0.08);
    }
  }
  fillCircle(cx, cy, 58, [255, 227, 179]);
  fillCircle(cx, cy, 40, [255, 243, 214]);
}

const HORIZON = 780;

function drawSkyline(): void {
  const base: RGB = [23, 16, 42];
  let bx = -20;
  let i = 0;
  while (bx < W) {
    const bw = 90 + ((i * 53) % 130);
    const bh = 130 + ((i * 97) % 220);
    const top = HORIZON - bh;
    fillRect(bx, top, bw, bh, base);
    // Rooftop antenna on every fourth tower, with a red beacon dot.
    if (i % 4 === 0) {
      fillRect(bx + Math.floor(bw / 2) - 2, top - 26, 4, 26, base);
      fillCircle(bx + Math.floor(bw / 2), top - 28, 4, [255, 60, 60]);
    }
    // Lit windows: a fixed hash of (tower, row, col) decides, so the
    // picture never changes between runs.
    const cols = Math.floor(bw / 24);
    const rows = Math.floor(bh / 32);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hsh = (i * 31 + r * 7 + c * 13) % 9;
        if (hsh < 2) {
          const wx = bx + 8 + c * 24;
          const wy = top + 14 + r * 32;
          fillRect(wx, wy, 9, 13, hsh === 0 ? [255, 210, 122] : [255, 177, 77]);
        }
      }
    }
    bx += bw + 8 + ((i * 29) % 30);
    i++;
  }
}

function drawPalm(x: number, baseY: number, s: number): void {
  const c: RGB = [15, 10, 26];
  // Trunk: a gentle lean, drawn as discs along a curve.
  const topX = x + 26 * s;
  const topY = baseY - 210 * s;
  for (let t = 0; t <= 20; t++) {
    const u = t / 20;
    const pxn = x + (topX - x) * u + Math.sin(u * 1.2) * 10 * s;
    const pyn = baseY + (topY - baseY) * u;
    fillCircle(pxn, pyn, 7 * s, c);
  }
  // Fronds: long thin triangles fanning out from the crown.
  const dirs: Array<[number, number]> = [
    [-1.9, -0.5],
    [-1.5, -1.2],
    [-0.6, -1.7],
    [0.4, -1.7],
    [1.4, -1.2],
    [1.9, -0.4],
    [1.6, 0.5],
    [-1.7, 0.4],
  ];
  for (const [dx, dy] of dirs) {
    const tipX = topX + dx * 78 * s;
    const tipY = topY + dy * 78 * s;
    const side = 9 * s;
    const nx = -dy;
    const ny = dx;
    fillPolygon(
      [
        [topX + nx * side, topY + ny * side],
        [tipX, tipY],
        [topX - nx * side, topY - ny * side],
      ],
      c,
    );
  }
  // Coconuts.
  fillCircle(topX - 8 * s, topY + 8 * s, 7 * s, c);
  fillCircle(topX + 9 * s, topY + 10 * s, 7 * s, c);
}

function drawVignette(): void {
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (W / 2);
      const dy = (y - cy) / (H / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(1, Math.max(0, (d - 0.62) / 0.75));
      if (t > 0) {
        const i = (y * W + x) * 4;
        const f = 1 - 0.3 * t * t;
        px[i] = Math.round(px[i]! * f);
        px[i + 1] = Math.round(px[i + 1]! * f);
        px[i + 2] = Math.round(px[i + 2]! * f);
      }
    }
  }
}

function render(): Buffer {
  drawSky();
  drawSun();
  drawSkyline();
  drawPalm(150, HORIZON, 1.0);
  drawPalm(1780, HORIZON, 1.15);

  // Ground: a dark strip at the horizon, then the bottom band the ghost
  // and the payoff line stand on.
  fillRect(0, HORIZON, W, 20, [18, 14, 28]);
  fillRect(0, 800, W, H - 800, [12, 9, 19]);
  fillRect(0, 800, W, 3, MAGENTA);

  // WASTED, huge and outlined, GTA death-screen style.
  drawTextCentered('WASTED', 225, 40, WHITE, BLACK, 14);

  // The wait itself is the punchline.
  drawTextCentered('13 YEARS WAITING FOR GTA 6', 565, 9, WHITE, BLACK, 5);

  // The make.fun ghost, large, holding its star coin.
  drawGhost(150, 830, 360, 430);

  // The payoff, next to the ghost. MAKE.FUN pops in pink.
  const line1 = 'YOUR AI AGENT ALREADY';
  const line2a = 'GOT PAID ON ';
  const line2b = 'MAKE.FUN';
  const tx = 600;
  drawText(line1, tx, 975, 9, WHITE, BLACK, 5);
  drawText(line2a, tx, 1075, 9, WHITE, BLACK, 5);
  drawText(line2b, tx + textWidth(line2a, 9), 1075, 9, PINK, BLACK, 5);

  drawVignette();
  return encodePng();
}

// ---------------------------------------------------------------- main

function main(): void {
  const png = render();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, 'meme.png'), png);
  // Best effort: leave the file at the repo root too, so it can be posted
  // and committed. /bot may be read-only in the grader; that must never
  // fail the run, because /output is the copy the gate reads.
  try {
    writeFileSync(join(BOT_DIR, 'meme.png'), png);
  } catch {
    // ignore: the /output copy above is the graded one
  }

  // The gate only accepts POST.json when it is a JSON object naming an X
  // post's address, so check the shape before copying: a malformed file
  // should fail here with a clear error instead of being copied through
  // and refused later. The bytes written out are the file's own bytes,
  // unchanged, so the two runs still write the same output.
  try {
    const raw = readFileSync(join(BOT_DIR, 'POST.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { url?: unknown }).url !== 'string'
    ) {
      throw new Error('POST.json must be a JSON object with a string "url" field');
    }
    writeFileSync(join(OUTPUT_DIR, 'POST.json'), raw);
  } catch (err) {
    console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`wrote meme.png (${png.length} bytes, ${W}x${H}) to ${OUTPUT_DIR} and ${BOT_DIR}`);
}

main();

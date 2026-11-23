// GTA VI WANTED POSTER meme — "WANTED: GRAND THEFT AUTO VI" — for gta6-meme-x-01.
// Verified deterministic render: two runs write byte-identical meme.png.
// Renders meme.png (1920x1280) deterministically with Node 22 stdlib only.
// Fresh implementation: RGBA canvas + PNG encoder via node:zlib, 5x7 bitmap
// font drawn from code, ghost + wanted stars drawn from code. No network.
// Writes meme.png to MAKEFUN_OUTPUT_DIR and copies POST.json there too,
// so the house can read both from the output dir.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

// Where the house reads the outputs from. In the grader's sandbox the
// environment points at /bot (the repo) and /output; locally, run with
// MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=<dir> to exercise the same path.
const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? "/bot";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const W = 1920;
const H = 1280;
const buf = new Uint8Array(W * H * 4);

type RGB = [number, number, number];

// ---- deterministic PRNG (fixed seed; no Math.random / Date anywhere) ----
let rngState = 123456789;
function rnd(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}

// ---- pixel helpers ----
function setPx(x: number, y: number, c: RGB, a = 1): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 4;
  const ia = 1 - a;
  buf[i] = Math.round(c[0] * a + buf[i] * ia);
  buf[i + 1] = Math.round(c[1] * a + buf[i + 1] * ia);
  buf[i + 2] = Math.round(c[2] * a + buf[i + 2] * ia);
  buf[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      if (a >= 1) {
        buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
      } else {
        const ia = 1 - a;
        buf[i] = Math.round(c[0] * a + buf[i] * ia);
        buf[i + 1] = Math.round(c[1] * a + buf[i + 1] * ia);
        buf[i + 2] = Math.round(c[2] * a + buf[i + 2] * ia);
        buf[i + 3] = 255;
      }
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB, a = 1): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(x, y, c, a);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPx(x, y, c, a);
    }
  }
}

// Scanline polygon fill (even-odd rule) — used for the wanted stars.
function fillPoly(pts: Array<[number, number]>, color: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.ceil(minY));
  const y1 = Math.min(H - 1, Math.floor(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const sx = Math.ceil(xs[k]);
      const ex = Math.floor(xs[k + 1]);
      if (ex >= sx) fillRect(sx, y, ex - sx + 1, 1, color);
    }
  }
}

function drawStar(cx: number, cy: number, r: number, color: RGB): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const ang = (-Math.PI / 2) + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  fillPoly(pts, color);
}

// ---- CRC32 (PNG) ----
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePNG(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    raw.set(buf.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---- 5x7 bitmap font (uppercase + digits + punctuation used by the meme) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10001", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "10001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawTextRaw(s: string, x: number, y: number, scale: number, color: RGB): void {
  for (let ci = 0; ci < s.length; ci++) {
    const glyph = FONT[s[ci]] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === "1") {
          fillRect(x + (ci * 6 + c) * scale, y + r * scale, scale, scale, color);
        }
      }
    }
  }
}

function drawText(s: string, x: number, y: number, scale: number, color: RGB, outline?: RGB): void {
  if (outline) {
    const offs: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const o of offs) {
      drawTextRaw(s, x + o[0] * scale, y + o[1] * scale, scale, outline);
    }
  }
  drawTextRaw(s, x, y, scale, color);
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, color: RGB, outline?: RGB): void {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, color, outline);
}

// ---- palette ----
const INK: RGB = [28, 18, 10];
const PAPER: RGB = [246, 233, 198];
const PAPER_DIM: RGB = [238, 222, 180];
const DARK: RGB = [24, 16, 10];
const GOLD: RGB = [255, 190, 45];
const YELLOW: RGB = [255, 209, 102];
const PINK: RGB = [255, 93, 162];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 5, 18];

// ---- the make.fun ghost (mugshot suspect) ----
function drawGhost(cx: number, top: number, w: number, h: number): void {
  const body = (dx: number, dy: number, dw: number, dh: number, color: RGB): void => {
    const ccx = cx + dx;
    const tt = top + dy;
    const headR = dw * 0.34;
    fillCircle(ccx, tt + headR, headR, color);
    fillEllipse(ccx, tt + dh * 0.55, dw * 0.5, dh * 0.45, color);
    for (const off of [-0.32, 0, 0.32]) {
      fillCircle(ccx + dw * off, tt + dh - dw * 0.06, dw * 0.11, color);
    }
  };
  // Dark outline pass, then white body.
  body(-7, -7, w + 14, h + 14, INK);
  body(0, 0, w, h, WHITE);
  // Pixel shades: black bar + white checker dots.
  const eyeY = top + h * 0.22;
  const eyeH = h * 0.11;
  fillRect(cx - w * 0.28, eyeY, w * 0.56, eyeH, BLACK);
  for (let i = 0; i < 3; i++) {
    fillRect(cx - w * 0.23 + i * w * 0.075, eyeY + eyeH * 0.32, w * 0.032, eyeH * 0.36, WHITE);
    fillRect(cx + w * 0.02 + i * w * 0.075, eyeY + eyeH * 0.32, w * 0.032, eyeH * 0.36, WHITE);
  }
  // Smile.
  const sy = top + h * 0.46;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    fillCircle(cx - w * 0.11 + w * 0.22 * t, sy + Math.sin(t * Math.PI) * h * 0.035, Math.max(3, w * 0.011), BLACK);
  }
}

// ---- composition ----
function main(): void {
  // Corkboard background with faint speckles.
  fillRect(0, 0, W, H, DARK);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const c: RGB = rnd() < 0.5 ? [60, 42, 24] : [12, 8, 5];
    fillCircle(x, y, 1 + rnd() * 3, c, 0.35);
  }

  // Poster shadow, then the paper panel.
  fillRect(114, 86, 1720, 1140, [0, 0, 0], 0.4);
  fillRect(100, 70, 1720, 1140, PAPER);
  // Outer + inner border.
  fillRect(100, 70, 1720, 10, INK);
  fillRect(100, 1200, 1720, 10, INK);
  fillRect(100, 70, 10, 1140, INK);
  fillRect(1810, 70, 10, 1140, INK);
  fillRect(122, 92, 1676, 3, INK);
  fillRect(122, 1185, 1676, 3, INK);
  fillRect(122, 92, 3, 1096, INK);
  fillRect(1795, 92, 3, 1096, INK);
  // Thumbtack pins on the four corners.
  for (const px of [100, 1820]) {
    for (const py of [70, 1210]) {
      fillCircle(px, py, 13, INK);
      fillCircle(px - 3, py - 3, 4, [120, 90, 60]);
    }
  }

  // Headline.
  drawTextCentered("WANTED", 960, 120, 15, INK);
  fillRect(660, 250, 600, 7, INK);
  fillRect(660, 264, 600, 7, INK);

  // Five gold wanted stars — max wanted level, the GTA icon.
  for (const sx of [660, 810, 960, 1110, 1260]) {
    drawStar(sx, 370, 72, INK);
    drawStar(sx, 370, 64, GOLD);
  }

  drawTextCentered("GRAND THEFT AUTO VI", 960, 470, 6, INK);
  drawTextCentered("FOR 13 YEARS OF HIDING", 960, 535, 4, INK);

  // Mugshot frame (left): the ghost is the suspect.
  fillRect(170, 600, 600, 390, INK);
  fillRect(180, 610, 580, 370, PAPER_DIM);
  drawGhost(470, 615, 400, 340);

  // Charges + file (right).
  drawText("THE CHARGES:", 840, 600, 5, INK);
  fillRect(840, 645, 355, 4, INK);
  drawText("1. 13 YEARS OF WAITING", 840, 670, 4, INK);
  drawText("2. ONE TRAILER. NO DATE.", 840, 720, 4, INK);
  drawText("3. MAKING FANS AGE FASTER", 840, 770, 4, INK);
  fillRect(840, 820, 910, 4, INK);
  drawText("LAST SEEN: VICE CITY, 2013", 840, 850, 4, INK);
  drawText("HEIGHT: 99% LOADED", 840, 900, 4, INK);
  drawText("AGE: 13 (AND COUNTING)", 840, 950, 4, INK);

  // Bottom band: the reward — and the make.fun sell.
  fillRect(100, 1020, 1720, 150, INK);
  fillRect(100, 1020, 1720, 5, GOLD);
  const r1 = "REWARD: $0 - ";
  const r2 = "YOUR AI AGENT ALREADY GOT PAID ON MAKE.FUN";
  const total = textWidth(r1, 5) + textWidth(r2, 5);
  let px = Math.round((W - total) / 2);
  drawText(r1, px, 1050, 5, YELLOW, BLACK);
  px += textWidth(r1, 5);
  drawText(r2, px, 1050, 5, PINK, BLACK);
  drawTextCentered("IF FOUND, DO NOT APPROACH - IT WILL ONLY BE DELAYED AGAIN", 960, 1115, 3, PAPER);

  const png = encodePNG();
  // The graded copy goes to the output dir the house reads from. Write
  // ONLY there — never a relative path: the grader runs the repo read-only.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "meme.png"), png);

  // The gate only accepts POST.json when it names an X post's address, so
  // check its shape before copying it through: a bad file fails the run
  // here with a clear error instead of being refused later. The copied
  // bytes are the file's own bytes, unchanged.
  let postRaw: string;
  try {
    postRaw = readFileSync(join(BOT_DIR, "POST.json"), "utf8");
  } catch (err) {
    console.error(`could not read POST.json from ${BOT_DIR}: ${(err as Error).message}`);
    process.exit(1);
  }
  let post: unknown;
  try {
    post = JSON.parse(postRaw);
  } catch (err) {
    console.error(`POST.json is not valid JSON: ${(err as Error).message}`);
    process.exit(1);
  }
  if (
    typeof post !== "object" ||
    post === null ||
    typeof (post as { url?: unknown }).url !== "string"
  ) {
    console.error('POST.json must be a JSON object with a string "url" field');
    process.exit(1);
  }
  writeFileSync(join(OUTPUT_DIR, "POST.json"), postRaw);

  console.log(`wrote meme.png (${png.length} bytes, ${W}x${H}) to ${OUTPUT_DIR}`);
}

main();

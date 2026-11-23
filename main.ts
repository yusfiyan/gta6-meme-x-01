// GTA VI LOADING SCREEN meme — "LOADING... 99%" — for gta6-meme-x-01.
// DRAFT (not yet run / verified / committed — see parent report).
// Generates meme.png (1920x1280) deterministically with Node 22 stdlib only.
// Fresh implementation: RGBA canvas + PNG encoder via node:zlib, bitmap
// font drawn from code, ghost drawn from code. No network, no assets.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1920;
const H = 1280;
const buf = new Uint8Array(W * H * 4);

type RGB = [number, number, number];

// ---- deterministic PRNG (fixed seed; no Math.random / Date anywhere) ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  const rr = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr) setPx(x, y, c, a);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPx(x, y, c, a);
    }
  }
}

// Thick line via stepped circles.
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c, a);
  }
}

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

// Vertical gradient rect. stops: [position 0..1, color][] sorted by position.
function fillVGrad(x: number, y: number, w: number, h: number, stops: Array<[number, RGB]>): void {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    let c: RGB = stops[stops.length - 1][1];
    for (let s = 0; s < stops.length - 1; s++) {
      const [p0, c0] = stops[s];
      const [p1, c1] = stops[s + 1];
      if (t >= p0 && t <= p1) {
        c = lerpColor(c0, c1, p1 === p0 ? 0 : (t - p0) / (p1 - p0));
        break;
      }
      if (t < p0) { c = c0; break; }
    }
    fillRect(x, y + yy, w, 1, c);
  }
}

// Horizontal gradient rect.
function fillHGrad(x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void {
  for (let xx = 0; xx < w; xx++) {
    const t = w <= 1 ? 0 : xx / (w - 1);
    fillRect(x + xx, y, 1, h, lerpColor(c1, c2, t));
  }
}

// ---- CRC32 (PNG) ----
const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
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
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc32(crcData));
  return out;
}

function encodePNG(): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Raw scanlines, filter byte 0 per row.
  const raw = new Uint8Array(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    raw.set(buf.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
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
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
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

// Text with a chunky outline (outline thickness ~ scale/4).
function drawText(s: string, x: number, y: number, scale: number, color: RGB, outline?: RGB): void {
  if (outline) {
    const o = Math.max(2, Math.round(scale / 4));
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]] as const) {
      drawTextRaw(s, x + dx, y + dy, scale, outline);
    }
  }
  drawTextRaw(s, x, y, scale, color);
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, color: RGB, outline?: RGB): void {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, color, outline);
}

// ---- scene pieces ----
const PURPLE_DARK: RGB = [18, 9, 38];
const PURPLE_MID: RGB = [42, 24, 74];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 5, 18];
const YELLOW: RGB = [255, 209, 102];
const PINK: RGB = [255, 93, 162];
const CYAN: RGB = [126, 240, 255];
const ORANGE: RGB = [255, 154, 61];
const MAGENTA: RGB = [255, 45, 120];

function drawSky(): void {
  fillVGrad(0, 0, W, 780, [
    [0, [27, 15, 60]],
    [0.45, [123, 45, 139]],
    [0.75, [255, 94, 122]],
    [1, [255, 154, 61]],
  ]);
  // Stars in the upper sky.
  const rnd = mulberry32(2026);
  for (let i = 0; i < 90; i++) {
    const sx = rnd() * W;
    const sy = rnd() * 320;
    const s = rnd() < 0.8 ? 2 : 3;
    fillRect(sx, sy, s, s, WHITE, 0.35 + rnd() * 0.55);
  }
  // Sun with glow, upper right (clear of the centered title text).
  const sunX = 1560;
  const sunY = 300;
  fillCircle(sunX, sunY, 315, ORANGE, 0.05);
  fillCircle(sunX, sunY, 260, ORANGE, 0.07);
  fillCircle(sunX, sunY, 210, ORANGE, 0.1);
  fillCircle(sunX, sunY, 165, [255, 120, 80], 0.18);
  fillCircle(sunX, sunY, 120, [255, 190, 90], 1);
  fillCircle(sunX, sunY, 92, [255, 220, 130], 1);
}

function drawSkyline(): void {
  const rnd = mulberry32(1337);
  const winColors: RGB[] = [YELLOW, CYAN, PINK];
  // Back row.
  let x = -20;
  while (x < W) {
    const bw = 90 + rnd() * 70;
    const bh = 120 + rnd() * 140;
    fillRect(x, 760 - bh, bw, bh, PURPLE_MID);
    x += bw + 8;
  }
  // Front row with lit windows.
  x = -10;
  while (x < W) {
    const bw = 110 + rnd() * 90;
    const bh = 200 + rnd() * 180;
    const by = 860 - bh;
    fillRect(x, by, bw, bh, PURPLE_DARK);
    for (let wy = by + 18; wy < 846; wy += 34) {
      for (let wx = x + 14; wx < x + bw - 14; wx += 30) {
        if (rnd() < 0.42) {
          fillRect(wx, wy, 14, 20, winColors[Math.floor(rnd() * winColors.length)]);
        }
      }
    }
    x += bw + 14;
  }
  // Ground + neon reflections.
  fillRect(0, 860, W, 260, [16, 8, 30]);
  for (let i = 0; i < 60; i++) {
    const ry = 880 + rnd() * 220;
    const rx = rnd() * W;
    const rl = 60 + rnd() * 260;
    const rc = rnd() < 0.5 ? PINK : CYAN;
    fillRect(rx, ry, rl, 3 + rnd() * 3, rc, 0.08 + rnd() * 0.16);
  }
}

function drawPalm(baseX: number, baseY: number, s: number, lean: number): void {
  const c: RGB = [14, 7, 26];
  // Trunk: stepped segments curving toward `lean`.
  const segs = 7;
  const crownX = baseX + lean * 260 * s;
  const crownY = baseY - 300 * s;
  let px = baseX;
  let py = baseY;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const nx = baseX + (crownX - baseX) * t;
    const ny = baseY + (crownY - baseY) * t;
    thickLine(px, py, nx, ny, 16 * s, c);
    px = nx;
    py = ny;
  }
  // Fronds: 7 drooping two-segment blades.
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI * (0.08 + (i * 0.14)); // fan from up-left to up-right
    const len = (150 + (i % 3) * 30) * s;
    const mx = crownX + Math.cos(ang) * len * 0.55;
    const my = crownY - Math.abs(Math.sin(ang)) * len * 0.55 + 26 * s;
    const ex = crownX + Math.cos(ang) * len;
    const ey = crownY - Math.abs(Math.sin(ang)) * len * 0.55 + 78 * s;
    thickLine(crownX, crownY, mx, my, 9 * s, c);
    thickLine(mx, my, ex, ey, 8 * s, c);
  }
}

// 4-point sparkle star.
function drawSparkle(cx: number, cy: number, r: number, color: RGB): void {
  thickLine(cx - r, cy, cx + r, cy, Math.max(2, r / 5), color);
  thickLine(cx, cy - r, cx, cy + r, Math.max(2, r / 5), color);
  fillCircle(cx, cy, Math.max(2, r / 4), color);
}

// Big make.fun ghost: white blob, black pixel shades, smile, sparkles.
function drawGhost(cx: number, top: number, w: number, h: number): void {
  const draw = (dx: number, dy: number, dw: number, dh: number, color: RGB): void => {
    const ccx = cx + dx;
    const ttop = top + dy;
    const headR = dw * 0.36;
    const headCy = ttop + headR;
    fillCircle(ccx, headCy, headR, color);
    fillEllipse(ccx, ttop + dh * 0.52, dw * 0.5, dh * 0.48, color);
    // Scalloped hem.
    for (const off of [-0.3, 0, 0.3]) {
      fillCircle(ccx + dw * off, ttop + dh - dw * 0.07, dw * 0.11, color);
    }
  };
  // Dark outline pass (expanded), then white body.
  draw(-8, -8, w + 16, h + 16, [24, 8, 44]);
  draw(0, 0, w, h, WHITE);
  // Pixel shades: black bar across both eyes + white checker dots.
  const eyeY = top + h * 0.24;
  const eyeH = h * 0.1;
  fillRect(cx - w * 0.27, eyeY, w * 0.54, eyeH, BLACK);
  for (let i = 0; i < 3; i++) {
    fillRect(cx - w * 0.22 + i * w * 0.07, eyeY + eyeH * 0.3, w * 0.03, eyeH * 0.4, WHITE);
    fillRect(cx + w * 0.02 + i * w * 0.07, eyeY + eyeH * 0.3, w * 0.03, eyeH * 0.4, WHITE);
  }
  // Smile: small arc under the shades.
  const smileY = top + h * 0.44;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const ax = cx - w * 0.1 + w * 0.2 * t;
    const ay = smileY + Math.sin(t * Math.PI) * h * 0.03;
    fillCircle(ax, ay, Math.max(3, w * 0.012), BLACK);
  }
  // Sparkles around the ghost.
  drawSparkle(cx - w * 0.42, top + h * 0.12, 18, YELLOW);
  drawSparkle(cx + w * 0.44, top + h * 0.05, 14, CYAN);
  drawSparkle(cx + w * 0.4, top + h * 0.62, 16, YELLOW);
}

// ---- composition ----
function main(): void {
  drawSky();
  drawSkyline();
  // Palm silhouettes at both edges (behind the ghost).
  drawPalm(90, 1120, 1.0, 0.35);
  drawPalm(1850, 1120, 0.9, -0.3);

  // Title.
  drawTextCentered("GRAND THEFT AUTO VI", W / 2, 56, 7, WHITE, BLACK);
  // The joke, huge: a loading screen stuck at 99%.
  drawTextCentered("LOADING... 99%", W / 2, 200, 12, YELLOW, BLACK);

  // Progress bar: white frame, dark track, 99% magenta->orange fill.
  const barX = 260;
  const barY = 380;
  const barW = 1400;
  const barH = 64;
  fillRect(barX, barY, barW, barH, WHITE);
  fillRect(barX + 6, barY + 6, barW - 12, barH - 12, [20, 8, 36]);
  const innerW = barW - 12;
  const fillW = Math.floor(innerW * 0.99);
  fillHGrad(barX + 6, barY + 6, fillW, barH - 12, MAGENTA, ORANGE);
  // Shine stripe on the fill.
  fillRect(barX + 6, barY + 10, fillW, 8, WHITE, 0.25);

  // Elapsed vs remaining.
  drawText("ELAPSED: 13 YEARS", barX, 478, 5, WHITE, BLACK);
  const eta = "ESTIMATED TIME REMAINING: 2026";
  drawText(eta, barX + barW - textWidth(eta, 4), 482, 4, WHITE, BLACK);

  // Loading tips: one joke per line, receipt-style density.
  const tips = [
    "TIP: YOUR 2013 SAVE IS STILL WAITING.",
    "TIP: THE ALLIGATOR HAS SENIORITY NOW.",
    "TIP: VICE CITY RENT ROSE 13 YEARS STRAIGHT.",
  ];
  tips.forEach((tip, i) => {
    const y = 620 + i * 62;
    drawText("TIP:", 120, y, 4, YELLOW, BLACK);
    drawText(tip.slice(5), 120 + textWidth("TIP: ", 4), y, 4, WHITE, BLACK);
  });

  // Big ghost, right side — unmistakable.
  drawGhost(1520, 540, 500, 580);

  // Bottom band + punchline (sells make.fun).
  fillRect(0, 1120, W, 160, [13, 6, 24]);
  fillRect(0, 1120, W, 4, MAGENTA);
  const p1 = "YOUR AI AGENT ALREADY GOT PAID ON ";
  const p2 = "MAKE.FUN";
  const total = textWidth(p1, 6) + 6 * 6 + textWidth(p2, 6);
  let px = Math.round((W - total) / 2);
  drawText(p1, px, 1168, 6, YELLOW, BLACK);
  px += textWidth(p1, 6) + 6 * 6;
  drawText(p2, px, 1168, 6, PINK, BLACK);

  writeFileSync("meme.png", encodePNG());
}

main();

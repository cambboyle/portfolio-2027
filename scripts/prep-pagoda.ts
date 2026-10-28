/**
 * Turns the pagoda photo into a grid of characters, once, ahead of time.
 *
 *   bun scripts/prep-pagoda.ts
 *
 * For every cell it keeps: the character, a colour close to the photo's own, and the brightness. The browser redraws those cells every frame and adds the movement.
 *
 * Photo: "Temple near trees during day" by Svetlana Gumerova on Unsplash (see README.md).
 */
const SRC = `${process.env.HOME}/Downloads/refs/pagoda-original/original.jpg`;
const OUT = new URL("../src/art/pagoda.json", import.meta.url).pathname;

const COLS = 150;
const CROP_W = 2800; // the pagoda, Fuji's summit and the town; the far right edge is trimmed
const CROP_H = 3900; // from just above the spire down to the first maple leaves
const CROP_Y = 100;
const CELL_ASPECT = 1.8; // a text cell is about 1.8 times taller than wide
const ROWS = Math.round((COLS * (CROP_H / CROP_W)) / CELL_ASPECT);
const FINE = 3; // lines are found on a grid this many times finer than the character grid

const RAMP = " .,:;-=+*#%@";

/** Run ffmpeg on the photo and return raw pixels. `pix` is rgb24 (3 bytes) or gray (1 byte). */
async function pixels(w: number, h: number, extra: string, pix: "rgb24" | "gray") {
  const proc = Bun.spawn(
    [
      "ffmpeg", "-v", "error", "-y", "-i", SRC,
      // crop, mirror, sharpen the detail a little, lift contrast, then shrink with area averaging
      "-vf", `crop=${CROP_W}:${CROP_H}:0:${CROP_Y},hflip,${extra}scale=${w}:${h}:flags=area`,
      "-f", "rawvideo", "-pix_fmt", pix, "-",
    ],
    { stdout: "pipe" },
  );
  const buf = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
  const need = w * h * (pix === "rgb24" ? 3 : 1);
  if (buf.length !== need) throw new Error(`unexpected size ${buf.length}, wanted ${need}`);
  return buf;
}

const raw = await pixels(COLS, ROWS, "unsharp=9:9:1.0:9:9:0,eq=contrast=1.12:saturation=1.15,", "rgb24");
const fine = await pixels(COLS * FINE, ROWS * FINE, "unsharp=9:9:1.6:9:9:0,eq=contrast=1.2,", "gray");

// ---- brightness --------------------------------------------------------------------------------

const lum = new Float32Array(COLS * ROWS);
for (let i = 0; i < lum.length; i++) {
  lum[i] = 0.2126 * raw[i * 3] + 0.7152 * raw[i * 3 + 1] + 0.0722 * raw[i * 3 + 2];
}

const cool = new Uint8Array(COLS * ROWS); // sky and Fuji's flanks
const warm = new Uint8Array(COLS * ROWS); // pagoda, leaves and town: lifted out of shadow below

// The sky and Fuji's flanks are blue; the pagoda, leaves and town are warm. Dim the blue so the
// sky recedes and the subject stands out. White snow is not blue, so it stays bright.
for (let i = 0; i < lum.length; i++) {
  const r = raw[i * 3];
  const g = raw[i * 3 + 1];
  const b = raw[i * 3 + 2];
  const mx = Math.max(r, g, b);
  const sat = (mx - Math.min(r, g, b)) / (mx || 1);
  if (b > r * 1.05 && sat > 0.12) {
    cool[i] = 1;
    // open sky is the brightest blue: push it back hard so it frames the subject; Fuji's darker flanks keep more
    lum[i] *= lum[i] > 120 ? 0.5 : 0.8;
  }
  else if (r > b) warm[i] = 1;
  // Red walls and leaves are dark by luminance but vivid in colour; give them the brightness of their strongest channel.
  if (r > b * 1.3 && sat > 0.3) lum[i] = lum[i] * 0.4 + mx * 0.6;
}

// Local contrast: add back the difference between each cell and its wide neighbourhood, so Fuji's
// body, the town and the pagoda's walls stand apart from what is around them instead of melting in.
function boxBlur(src: Float32Array, radius: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < ROWS; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * COLS + Math.min(COLS - 1, Math.max(0, x))];
    for (let x = 0; x < COLS; x++) {
      tmp[y * COLS + x] = acc / (2 * radius + 1);
      acc += src[y * COLS + Math.min(COLS - 1, x + radius + 1)] - src[y * COLS + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < COLS; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(ROWS - 1, Math.max(0, y)) * COLS + x];
    for (let y = 0; y < ROWS; y++) {
      out[y * COLS + x] = acc / (2 * radius + 1);
      acc += tmp[Math.min(ROWS - 1, y + radius + 1) * COLS + x] - tmp[Math.max(0, y - radius) * COLS + x];
    }
  }
  return out;
}
const around = boxBlur(boxBlur(lum, 7), 7);
for (let i = 0; i < lum.length; i++) lum[i] = Math.max(0, lum[i] + (cool[i] ? 1.3 : 0.6) * (lum[i] - around[i]));

// Stretch brightness to fill the range, then push the mid-tones down a little.
const sorted = Float32Array.from(lum).sort();
const lo = sorted[Math.floor(sorted.length * 0.02)];
const hi = sorted[Math.floor(sorted.length * 0.995)];
for (let i = 0; i < lum.length; i++) {
  lum[i] = Math.pow(Math.max(0, Math.min(1, (lum[i] - lo) / (hi - lo))), warm[i] ? 0.45 : 0.85) * 255;
}

// ---- lines, found on the finer grid ------------------------------------------------------------

const FW = COLS * FINE;
const FH = ROWS * FINE;
const fat = (x: number, y: number) => fine[Math.min(FH - 1, Math.max(0, y)) * FW + Math.min(FW - 1, Math.max(0, x))];

/** The strongest line inside one character cell: its strength and its direction. */
function strongestLine(cx: number, cy: number) {
  let best = 0;
  let bgx = 0;
  let bgy = 0;
  for (let dy = 0; dy < FINE; dy++) {
    for (let dx = 0; dx < FINE; dx++) {
      const x = cx * FINE + dx;
      const y = cy * FINE + dy;
      const gx = fat(x + 1, y - 1) + 2 * fat(x + 1, y) + fat(x + 1, y + 1) - fat(x - 1, y - 1) - 2 * fat(x - 1, y) - fat(x - 1, y + 1);
      const gy = fat(x - 1, y + 1) + 2 * fat(x, y + 1) + fat(x + 1, y + 1) - fat(x - 1, y - 1) - 2 * fat(x, y - 1) - fat(x + 1, y - 1);
      const m = Math.hypot(gx, gy);
      if (m > best) {
        best = m;
        bgx = gx;
        bgy = gy;
      }
    }
  }
  return { mag: best, gx: bgx, gy: bgy };
}

let chars = "";
const edge = new Uint8Array(COLS * ROWS);
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    const i = y * COLS + x;
    const { mag, gx, gy } = strongestLine(x, y);
    if (mag > 260) {
      edge[i] = 1;
      chars += Math.abs(gx) > 2 * Math.abs(gy) ? "|" : Math.abs(gy) > 2 * Math.abs(gx) ? "-" : gx * gy > 0 ? "\\" : "/";
      continue;
    }
    const v = lum[i] / 255;
    chars += lum[i] < 6 ? " " : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)))];
  }
}

// ---- colours -----------------------------------------------------------------------------------

const photo = new Uint8Array(COLS * ROWS * 3);
for (let i = 0; i < lum.length; i++) {
  const v = lum[i] / 255;
  const src = [raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]];
  // the photo's own colours, a little more saturated and lifted by brightness so they stay readable
  const mean = (src[0] + src[1] + src[2]) / 3;
  const lift = 0.55 + 0.9 * v;
  for (let k = 0; k < 3; k++) photo[i * 3 + k] = Math.max(0, Math.min(255, (mean + (src[k] - mean) * 1.3) * lift * 1.15));
}

const b64 = (a: Uint8Array) => Buffer.from(a).toString("base64");
await Bun.write(
  OUT,
  JSON.stringify({
    cols: COLS,
    rows: ROWS,
    ramp: RAMP,
    chars,
    rgb: b64(photo),
    lum: b64(Uint8Array.from(lum, (v) => Math.round(v))),
    edge: b64(edge),
  }),
);
console.log(`wrote ${OUT}: ${COLS} x ${ROWS} cells, ${edge.reduce((a, b) => a + b, 0)} line cells`);

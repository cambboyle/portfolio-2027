/**
 * The easter egg: the Wayfarer, a made-up station the size of a small moon.
 *
 * A sphere covered in plating, a broken ring orbiting clear of its surface, and a spire at each pole with a glowing
 * tip. It is drawn by ray marching a signed distance function: for each character cell, step along a ray until it
 * meets the surface, then shade that point.
 *
 * Station coordinates: y is the axis through the spires, the ring lies in the xz plane. The sphere has radius 0.62.
 */

const R = 0.62;
const RING = 0.9;

// what the last call to `scene` hit, so the hot loop does not allocate objects
let material = 0;
let glowDist = 9;

const HULL = 0;
const RINGM = 1;
const SPIRE = 2;
const TIP = 3;

export function scene(x: number, y: number, z: number): number {
  // the sphere
  let d = Math.hypot(x, y, z) - R;
  material = HULL;
  // the ring: a flat band, broken into twelve segments with gaps between them
  const flat = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const gap = Math.abs((((angle / (Math.PI * 2)) * 12 + 12) % 1) - 0.5) < 0.06 ? 0.04 : 0;
  const ring = Math.max(Math.abs(flat - RING) - 0.07, Math.abs(y) - 0.018) + gap;
  if (ring < d) {
    d = ring;
    material = RINGM;
  }
  // the spires: thin and tapering, standing out from each pole
  const ay = Math.abs(y);
  const along = Math.min(Math.max(ay - R + 0.05, 0), 0.26);
  const spire = Math.max(flat - 0.035 * (1 - along / 0.3), ay - (R + 0.21), R - 0.05 - ay);
  if (spire < d) {
    d = spire;
    material = SPIRE;
  }
  // the glowing tips
  const tip = Math.hypot(x, ay - (R + 0.25), z) - 0.045;
  glowDist = Math.min(glowDist, tip);
  if (tip < d) {
    d = tip;
    material = TIP;
  }
  return d;
}

/** A fixed number in [0, 1) for a pair of integers, so each panel and window keeps its look. */
const hash2 = (a: number, b: number) => {
  let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

export interface Hit {
  /** 0 nothing, 1 lit surface, 2 window, 3 glowing tip, 4 glow around a tip */
  kind: number;
  light: number;
}

const out: Hit = { kind: 0, light: 0 };

/**
 * Casts one ray. `m` turns screen directions into station directions (a 3×3 rotation, row-major); the ray starts in
 * front of the screen point (sx, sy) and travels into the screen. `sun` is in screen coordinates.
 */
export function cast(sx: number, sy: number, m: Float32Array, sun: readonly number[]): Hit {
  let ox = m[0] * sx + m[1] * sy + m[2] * 1.4;
  let oy = m[3] * sx + m[4] * sy + m[5] * 1.4;
  let oz = m[6] * sx + m[7] * sy + m[8] * 1.4;
  const dx = -m[2];
  const dy = -m[5];
  const dz = -m[8];
  glowDist = 9;
  let travelled = 0;
  for (let step = 0; step < 80 && travelled < 2.8; step++) {
    const d = scene(ox, oy, oz);
    if (d < 0.004) {
      const mat = material;
      if (mat === TIP) {
        out.kind = 3;
        out.light = 1;
        return out;
      }
      // surface normal from the change in distance around the point, then back into screen coordinates
      const h = 0.003;
      const nx = scene(ox + h, oy, oz) - scene(ox - h, oy, oz);
      const ny = scene(ox, oy + h, oz) - scene(ox, oy - h, oz);
      const nz = scene(ox, oy, oz + h) - scene(ox, oy, oz - h);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const snx = (m[0] * nx + m[3] * ny + m[6] * nz) / nl;
      const sny = (m[1] * nx + m[4] * ny + m[7] * nz) / nl;
      const snz = (m[2] * nx + m[5] * ny + m[8] * nz) / nl;
      const lit = Math.max(0, snx * sun[0] + sny * sun[1] + snz * sun[2]);
      let shade = 1;
      if (mat === HULL) {
        // plating: bands of latitude split into panels, each a shade different, with dark seams between them
        const lat = Math.acos(Math.max(-1, Math.min(1, oy / R))) / Math.PI; // 0 at the top, 1 at the bottom
        const lon = (Math.atan2(oz, ox) / (Math.PI * 2) + 1) % 1;
        const band = Math.floor(lat * 14);
        const across = Math.max(4, Math.round(Math.sin(((band + 0.5) / 14) * Math.PI) * 32));
        const fx = lon * across;
        const fy = lat * 14;
        const panel = Math.floor(fx);
        const seam = fx - panel < 0.08 || fy - band < 0.1;
        shade = seam ? 0.55 : 0.8 + 0.2 * hash2(band, panel);
        // windows: on the shadowed side, a few panels have a lit row
        if (lit < 0.25 && !seam && fy - band > 0.45 && fy - band < 0.7 && hash2(band + 100, panel) < 0.22) {
          out.kind = 2;
          out.light = 1;
          return out;
        }
      } else if (mat === SPIRE) shade = 0.85;
      else {
        // the ring is a flat band seen almost edge on, so it gets little direct sun: lift it so it reads
        out.kind = 1;
        out.light = Math.min(1, 0.35 + 0.65 * lit);
        return out;
      }
      out.kind = 1;
      out.light = (0.1 + 0.9 * lit) * shade;
      return out;
    }
    const s = d * 0.9;
    ox += dx * s;
    oy += dy * s;
    oz += dz * s;
    travelled += s;
  }
  // missed everything, but passed close to a tip: a soft glow around it
  if (glowDist < 0.1) {
    out.kind = 4;
    out.light = 1 - glowDist / 0.1;
    return out;
  }
  out.kind = 0;
  out.light = 0;
  return out;
}

/** The rotation from screen to station coordinates: tipped towards us so the ring shows as an ellipse, turning slowly. */
export function shipMatrix(turn: number, out = new Float32Array(9)) {
  const tilt = 0.32; // the ring tipped towards the viewer
  const lean = -0.18; // and the axis leaning a little to one side
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const cl = Math.cos(lean), sl = Math.sin(lean);
  const cr = Math.cos(turn), sr = Math.sin(turn);
  const a = [cl, sl, 0, -sl, cl, 0, 0, 0, 1]; // undo the lean (about the view axis)
  const b = [1, 0, 0, 0, ct, -st, 0, st, ct]; // undo the tilt (about the horizontal axis)
  const c = [cr, 0, -sr, 0, 1, 0, sr, 0, cr]; // the turn (about the station's own axis)
  const mul = (p: number[], q: number[]) =>
    Array.from({ length: 9 }, (_, i) => {
      const r = (i / 3) | 0;
      const k = i % 3;
      return p[r * 3] * q[k] + p[r * 3 + 1] * q[3 + k] + p[r * 3 + 2] * q[6 + k];
    });
  out.set(mul(c, mul(b, a)));
  return out;
}

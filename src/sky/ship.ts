/**
 * The easter egg: a Death Star.
 *
 * What makes it read as the Death Star, drawn here:
 *  - a matte grey sphere, its surface cut into horizontal bands of rectangular panels, each a slightly different tone,
 *    with deeper grooves every few bands and a few dark recessed panels;
 *  - a narrow trench all the way round the equator, lined with lit windows;
 *  - on the northern half, a large round dish: a raised lip, concentric rings stepping down, and a green glow at the
 *    focus;
 *  - a scatter of lit windows over the shadowed side.
 *
 * It is drawn by ray marching a signed distance function: for each character cell, step along a ray until it meets
 * the surface, then shade that point. It turns slowly, at the Moon's pace, so the dish crosses the face during a visit.
 *
 * Station coordinates: y is the axis through the poles. The sphere has radius 1, the same size as the Moon.
 */

const R = 1;
const TRENCH_HALF = 0.03; // half the trench's height
const TRENCH_DEPTH = 0.05;
const BOWL = 0.27; // radius of the dish
/** The direction from the centre of the station to the middle of the dish: upper left, facing us. */
export const DISH: readonly number[] = (() => {
  const v = [-0.45, 0.5, 0.74];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const BOWL_X = DISH[0] * R;
const BOWL_Y = DISH[1] * R;
const BOWL_Z = DISH[2] * R;
const EMIT_X = DISH[0] * 0.8;
const EMIT_Y = DISH[1] * 0.8;
const EMIT_Z = DISH[2] * 0.8;

const BAND = Math.PI / 36; // each band of panels is five degrees of latitude, with the trench on a band edge

// what the last call to `scene` hit, so the hot loop does not allocate objects
let material = 0;

const HULL = 0;
const TRENCH = 1;
const BOWL_SURFACE = 2;
const EMITTER = 3;

export function scene(x: number, y: number, z: number): number {
  // the sphere
  const r = Math.hypot(x, y, z);
  let d = r - R;
  material = HULL;
  // the trench: a band round the equator, cut down to a floor below the plating
  const trench = Math.min(TRENCH_HALF - Math.abs(y), r - (R - TRENCH_DEPTH));
  if (trench > d) {
    d = trench;
    material = TRENCH;
  }
  // the dish: a smaller sphere taken out of the surface
  const bowl = BOWL - Math.hypot(x - BOWL_X, y - BOWL_Y, z - BOWL_Z);
  if (bowl > d) {
    d = bowl;
    material = BOWL_SURFACE;
  }
  // the emitter at the focus
  const emitter = Math.hypot(x - EMIT_X, y - EMIT_Y, z - EMIT_Z) - 0.04;
  if (emitter < d) {
    d = emitter;
    material = EMITTER;
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
  /** 0 nothing, 1 lit surface, 2 window, 3 green glow of the dish */
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
  let travelled = 0;
  for (let step = 0; step < 80 && travelled < 2.8; step++) {
    const d = scene(ox, oy, oz);
    if (d < 0.004) {
      const mat = material;
      if (mat === EMITTER) {
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
      let px = (m[0] * nx + m[3] * ny + m[6] * nz) / nl;
      let py = (m[1] * nx + m[4] * ny + m[7] * nz) / nl;
      let pz = (m[2] * nx + m[5] * ny + m[8] * nz) / nl;
      let shade = 0.85;
      const lon = (Math.atan2(oz, ox) / (Math.PI * 2) + 1) % 1;
      if (mat === HULL) {
        // panels: horizontal bands of latitude, each split into panels that stay roughly square
        const lat = Math.asin(Math.max(-1, Math.min(1, oy / R)));
        const fy = lat / BAND + 18; // 0 at the south pole, 36 at the north, the trench on 18
        const band = Math.floor(fy);
        const inBand = fy - band;
        const across = Math.max(5, Math.round(Math.cos((band + 0.5 - 18) * BAND) * 72));
        const fx = lon * across;
        const plate = Math.floor(fx);
        const groove = band % 6 === 0 && inBand < 0.3; // a deeper groove every few bands
        const seam = groove || fx - plate < 0.08 || inBand < 0.14;
        if (seam) shade = 0.28;
        else {
          shade = (0.78 + 0.22 * hash2(band, plate)) * (0.92 + 0.08 * hash2(band, 999));
          if (hash2(band + 5, plate) < 0.1) shade *= 0.55; // a recessed panel
        }
        // each panel sits at a very slightly different angle
        const wob = 0.04;
        px += (hash2(band + 7, plate) - 0.5) * wob;
        py += (hash2(band + 13, plate) - 0.5) * wob;
        pz += (hash2(band + 29, plate) - 0.5) * wob;
        const pl = Math.hypot(px, py, pz);
        px /= pl;
        py /= pl;
        pz /= pl;
        // windows: on the shadowed side, a scatter of lit slots
        const diffuse = px * sun[0] + py * sun[1] + pz * sun[2];
        if (diffuse < 0.2 && !seam && inBand > 0.4 && inBand < 0.7 && hash2(band + 100, plate) < 0.1) {
          out.kind = 2;
          out.light = 1;
          return out;
        }
      } else if (mat === TRENCH) {
        // the trench is lined with lights
        if (hash2(Math.floor(lon * 160), 500) < 0.75) {
          out.kind = 2;
          out.light = 1;
          return out;
        }
        shade = 0.25;
      } else {
        // the dish: 0 at the rim, 1 at the focus
        const depth = -((ox - BOWL_X) * DISH[0] + (oy - BOWL_Y) * DISH[1] + (oz - BOWL_Z) * DISH[2]) / BOWL;
        if (depth > 0.93) {
          // the green glow round the focus
          out.kind = 3;
          out.light = 1;
          return out;
        }
        if (depth < 0.1) shade = 1; // a bright lip round the edge
        else {
          const ring = depth * 5;
          shade = ring - Math.floor(ring) < 0.28 ? 0.1 : 0.62;
        }
      }
      const lit = Math.max(0, px * sun[0] + py * sun[1] + pz * sun[2]);
      out.kind = 1;
      out.light = Math.min(1, (0.1 + 0.8 * lit) * shade);
      return out;
    }
    const s = d * 0.9;
    ox += dx * s;
    oy += dy * s;
    oz += dz * s;
    travelled += s;
  }
  out.kind = 0;
  out.light = 0;
  return out;
}

/**
 * The rotation from screen to station coordinates: the north pole tipped a little towards us so the trench shows as a
 * gentle curve, the axis leaning slightly, and the station turning about its axis by `turn` radians (the surface
 * moving left to right, as on the globes). At turn 0 the dish is just coming into view on the left limb.
 */
export function shipMatrix(turn: number, out = new Float32Array(9)) {
  const tilt = 0.2;
  const lean = -0.1;
  const yaw = turn - 0.33;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const cl = Math.cos(lean), sl = Math.sin(lean);
  const cr = Math.cos(yaw), sr = Math.sin(yaw);
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

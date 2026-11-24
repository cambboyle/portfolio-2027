/**
 * The easter egg: the Wayfarer, a made-up station the size of a small moon.
 *
 * A sphere clad in metal plates, with a short spire at each pole ending in a glowing tip. It is drawn by ray marching
 * a signed distance function: for each character cell, step along a ray until it meets the surface, then shade that
 * point. The plates catch the light like metal: each is tilted very slightly differently, and a sharp highlight
 * moves across them as the station turns.
 *
 * Station coordinates: y is the axis through the spires. The sphere has radius 1, the same size as the Moon.
 */

const R = 1;

// what the last call to `scene` hit, so the hot loop does not allocate objects
let material = 0;
let glowDist = 9;

const HULL = 0;
const SPIRE = 2;
const TIP = 3;

export function scene(x: number, y: number, z: number): number {
  // the sphere
  let d = Math.hypot(x, y, z) - R;
  material = HULL;
  // the spires: short and tapering, standing out from each pole
  const flat = Math.hypot(x, z);
  const ay = Math.abs(y);
  const along = Math.min(Math.max(ay - R + 0.05, 0), 0.14);
  const spire = Math.max(flat - 0.03 * (1 - along / 0.16), ay - (R + 0.1), R - 0.05 - ay);
  if (spire < d) {
    d = spire;
    material = SPIRE;
  }
  // the glowing tips
  const tip = Math.hypot(x, ay - (R + 0.13), z) - 0.035;
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
      let px = snx;
      let py = sny;
      let pz = snz;
      let shade = 0.85;
      let seam = false;
      if (mat === HULL) {
        // plating: bands of latitude split into plates (fewer near the poles, so they stay roughly square)
        const lat = Math.acos(Math.max(-1, Math.min(1, oy / R))) / Math.PI; // 0 at the top, 1 at the bottom
        const lon = (Math.atan2(oz, ox) / (Math.PI * 2) + 1) % 1;
        const fy = lat * 22;
        const band = Math.floor(fy);
        const across = Math.max(6, Math.round(Math.sin(((band + 0.5) / 22) * Math.PI) * 56));
        const fx = lon * across;
        const plate = Math.floor(fx);
        seam = fx - plate < 0.1 || fy - band < 0.12;
        // each plate is a slightly different metal, and sits at a very slightly different angle
        shade = seam ? 0.35 : 0.72 + 0.28 * hash2(band, plate);
        const wob = 0.12;
        px += (hash2(band + 7, plate) - 0.5) * wob;
        py += (hash2(band + 13, plate) - 0.5) * wob;
        pz += (hash2(band + 29, plate) - 0.5) * wob;
        const pl = Math.hypot(px, py, pz);
        px /= pl;
        py /= pl;
        pz /= pl;
        const diffuse = px * sun[0] + py * sun[1] + pz * sun[2];
        // windows: on the shadowed side, a few plates have a lit slot
        if (diffuse < 0.15 && !seam && fy - band > 0.45 && fy - band < 0.7 && hash2(band + 100, plate) < 0.12) {
          out.kind = 2;
          out.light = 1;
          return out;
        }
      }
      const lit = Math.max(0, px * sun[0] + py * sun[1] + pz * sun[2]);
      // a sharp highlight where the sun reflects towards us, as on polished metal (Blinn-Phong: the half vector
      // between the sun and the viewer, who looks along -z)
      const hx = sun[0];
      const hy = sun[1];
      const hz = sun[2] + 1;
      const hl = Math.hypot(hx, hy, hz);
      const spec = seam ? 0 : Math.max(0, (px * hx + py * hy + pz * hz) / hl) ** 36;
      out.kind = 1;
      out.light = Math.min(1, (0.06 + 0.6 * lit) * shade + spec * 0.9);
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

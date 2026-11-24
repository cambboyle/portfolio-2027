/**
 * The easter egg: the Wayfarer, a made-up ship the size of a small moon.
 *
 * A long six-sided hull that narrows to a point at the front, three docking rings around it, a ridge along its
 * back, X-shaped fins at the stern and a glowing engine core behind. It is drawn by ray marching a signed
 * distance function: for each character cell, step along a ray until it meets the surface, then shade that point.
 *
 * Ship coordinates: x runs along the hull (front is +x), y up, z out of the side. About 2.1 units long.
 */

// what the last call to `scene` hit, so the hot loop does not allocate objects
let material = 0; // 0 hull, 1 engine
let engineDist = 9;

const HULL = 0;
const ENGINE = 1;

/** Distance to a regular hexagon of inner radius r, in the yz plane (after Inigo Quilez's 2D hexagon). */
function hexagon(y: number, z: number, r: number) {
  let px = Math.abs(y);
  let py = Math.abs(z);
  const d = 2 * Math.min(-0.866025 * px + 0.5 * py, 0);
  px -= d * -0.866025;
  py -= d * 0.5;
  const k = 0.57735 * r;
  px -= Math.max(-k, Math.min(k, px));
  py -= r;
  return Math.hypot(px, py) * Math.sign(py);
}

const box = (x: number, y: number, z: number, bx: number, by: number, bz: number) => {
  const qx = Math.abs(x) - bx;
  const qy = Math.abs(y) - by;
  const qz = Math.abs(z) - bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
};

export function scene(x: number, y: number, z: number): number {
  // the hull: full width in the middle, a long taper to the bow, a shorter one to the stern
  const r = x > 0.25 ? 0.26 * Math.max(0, 1 - (x - 0.25) / 0.8) : x < -0.55 ? 0.26 - (-0.55 - x) * 0.3 : 0.26;
  let d = Math.max(hexagon(y, z, r), x - 1.05, -x - 0.95) * 0.7;
  // three docking rings
  const yz = Math.hypot(y, z);
  for (const c of [-0.45, -0.05, 0.32]) d = Math.min(d, Math.max(Math.abs(x - c) - 0.03, Math.abs(yz - 0.33) - 0.045));
  // the dorsal ridge
  d = Math.min(d, box(x + 0.1, y - 0.25, z, 0.5, 0.06, 0.03));
  // fins in an X at the stern
  const a = (y + z) * 0.7071;
  const b = (y - z) * 0.7071;
  d = Math.min(d, box(x + 0.78, a, b, 0.14, 0.015, 0.46), box(x + 0.78, b, a, 0.14, 0.015, 0.46));
  material = HULL;
  // the engine core, just behind the stern
  const e = Math.hypot(x + 1.04, y, z) - 0.12;
  engineDist = Math.min(engineDist, e);
  if (e < d) {
    material = ENGINE;
    return e;
  }
  return d;
}

/** A fixed per-window number in [0, 1), so each window is either lit or dark. */
const hash2 = (a: number, b: number) => {
  let h = Math.imul(a * 73856093 ^ b * 19349663, 2654435761);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

export interface Hit {
  /** 0 nothing, 1 lit hull, 2 window, 3 engine, 4 engine glow */
  kind: number;
  light: number;
}

const out: Hit = { kind: 0, light: 0 };

/**
 * Casts one ray. `m` turns screen directions into ship directions (a 3×3 rotation, row-major); the ray starts in
 * front of the screen point (sx, sy) and travels into the screen. `sun` is in screen coordinates.
 */
export function cast(sx: number, sy: number, m: Float32Array, sun: readonly number[]): Hit {
  // origin and direction in ship coordinates
  let ox = m[0] * sx + m[1] * sy + m[2] * 1.4;
  let oy = m[3] * sx + m[4] * sy + m[5] * 1.4;
  let oz = m[6] * sx + m[7] * sy + m[8] * 1.4;
  const dx = -m[2];
  const dy = -m[5];
  const dz = -m[8];
  engineDist = 9;
  let travelled = 0;
  for (let step = 0; step < 96 && travelled < 2.8; step++) {
    const d = scene(ox, oy, oz);
    if (d < 0.006) {
      if (material === ENGINE) {
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
      // rows of windows along the hull; on the shadowed side the lit ones glow
      const row = Math.floor(ox * 22);
      const col = Math.floor((Math.atan2(oz, oy) + Math.PI) * 4);
      if (lit < 0.3 && ox * 22 - row < 0.5 && hash2(row, col) < 0.16 && Math.abs(ox) < 0.85) {
        out.kind = 2;
        out.light = 1;
        return out;
      }
      // hull plating: panels a shade lighter or darker than their neighbours
      const panel = 0.82 + 0.18 * hash2(Math.floor(ox * 12) + 500, Math.floor((Math.atan2(oz, oy) + Math.PI) * 2));
      out.kind = 1;
      out.light = (0.1 + 0.9 * lit) * panel;
      return out;
    }
    const s = d * 0.9;
    ox += dx * s;
    oy += dy * s;
    oz += dz * s;
    travelled += s;
  }
  // missed the ship, but passed close to the engine: a soft glow around it
  if (engineDist < 0.12) {
    out.kind = 4;
    out.light = 1 - engineDist / 0.12;
    return out;
  }
  out.kind = 0;
  out.light = 0;
  return out;
}

/** The rotation from screen to ship coordinates: a fixed three-quarter view, plus a slow roll along the hull. */
export function shipMatrix(roll: number, out = new Float32Array(9)) {
  const yaw = 0.5; // turned so we see its side and a little of its bow
  const pitch = 0.22; // seen slightly from above
  // screen → ship: undo the yaw, then the pitch, then the roll
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // A = Ry(-yaw)
  const a = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  // B = Rz(pitch): tips the bow up towards the viewer's top edge
  const b = [cp, sp, 0, -sp, cp, 0, 0, 0, 1];
  // C = Rx(roll)
  const c = [1, 0, 0, 0, cr, sr, 0, -sr, cr];
  const mul = (p: number[], q: number[]) =>
    Array.from({ length: 9 }, (_, i) => p[(i / 3 | 0) * 3] * q[i % 3] + p[(i / 3 | 0) * 3 + 1] * q[3 + i % 3] + p[(i / 3 | 0) * 3 + 2] * q[6 + i % 3]);
  out.set(mul(c, mul(b, a)));
  return out;
}

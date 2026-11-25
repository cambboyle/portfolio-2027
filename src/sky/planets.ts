/**
 * Made-up but recognisable surfaces for Mars and Saturn, in the same spirit as the Moon's (src/sky/moon.ts): built
 * once, when first needed, from fixed seeds so they look the same on every visit.
 */
export const MARS_W = 256;
export const MARS_H = 128;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const toVec = (lat: number, lon: number) => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
const angle = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const rad = (deg: number) => (deg * Math.PI) / 180;

let mars: Float32Array | null = null;

/**
 * Mars as an equirectangular map of brightness (0.15 to 1): rusty plains, the dark patches seen through a telescope
 * (Syrtis Major, Acidalia and others), a dark scar for Valles Marineris, a bright Hellas basin and some craters.
 * The polar caps are drawn by the globe, from the latitude.
 */
export function marsMap(): Float32Array {
  if (mars) return mars;
  const rand = rng(21);
  // [latitude, longitude, size in radians, how dark]
  const dark = [
    [8, 68, 0.3, 0.38], // Syrtis Major
    [-48, 0, 0.3, 0.25],
    [45, -30, 0.42, 0.3], // Acidalia
    [-32, 150, 0.4, 0.28],
    [-10, 20, 0.25, 0.22],
    [18, -95, 0.28, 0.2],
    [-25, -120, 0.3, 0.22],
  ].map(([la, lo, size, depth]) => ({ v: toVec(rad(la), rad(lo)), size, depth }));
  const canyon = { a: toVec(rad(-8), rad(-95)), b: toVec(rad(-12), rad(-45)) }; // Valles Marineris
  const hellas = { v: toVec(rad(-42), rad(70)), size: 0.28 };
  const craters = Array.from({ length: 40 }, () => ({ v: toVec(Math.asin(rand() * 2 - 1), rand() * Math.PI * 2), r: 0.04 + rand() * 0.07 }));
  mars = new Float32Array(MARS_W * MARS_H);
  const noise = rng(5);
  for (let y = 0; y < MARS_H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / MARS_H) * Math.PI;
    for (let x = 0; x < MARS_W; x++) {
      const p = toVec(lat, ((x + 0.5) / MARS_W) * Math.PI * 2 - Math.PI);
      let b = 0.74;
      for (const d of dark) b -= d.depth * smoothstep(1 - angle(p, d.v) / d.size);
      // the canyon: close to the arc between its two ends
      const ab = angle(canyon.a, canyon.b);
      const detour = angle(p, canyon.a) + angle(p, canyon.b) - ab;
      b -= 0.4 * smoothstep(1 - detour / 0.05);
      b += 0.18 * smoothstep(1 - angle(p, hellas.v) / hellas.size);
      for (const c of craters) {
        const d = angle(p, c.v) / c.r;
        if (d < 1) b *= 0.75 + 0.15 * d * d;
        else if (d < 1.3) b = Math.min(1, b * 1.1);
      }
      mars[y * MARS_W + x] = Math.max(0.15, Math.min(1, b + (noise() - 0.5) * 0.1));
    }
  }
  return mars;
}

/** Whether a latitude is under a polar cap: `la` runs 0 at the north pole to 1 at the south; `jitter` in [0, 1) makes the edge ragged. */
export const isPolarCap = (la: number, jitter: number) => la < 0.06 + jitter * 0.03 || la > 0.94 - jitter * 0.03;

/**
 * Saturn's cloud bands: brightness (0.25 to 1) by latitude, with a bright equatorial zone and darker poles. `la` runs
 * 0 at the north pole to 1 at the south; `lon` in [0, 1) adds faint streaks along the bands.
 */
export function saturnBand(la: number, lon: number): number {
  const eq = Math.exp(-(((la - 0.5) / 0.08) ** 2)); // the bright zone at the equator
  const poles = Math.abs(2 * la - 1) ** 3; // 0 at the equator, 1 at the poles
  const bands = 0.12 * Math.sin(la * Math.PI * 16 + 1.3) + 0.07 * Math.sin(la * Math.PI * 37) + 0.03 * Math.sin(lon * Math.PI * 18 + la * 40);
  return Math.max(0.25, Math.min(1, 0.62 + 0.2 * eq + bands - 0.28 * poles));
}

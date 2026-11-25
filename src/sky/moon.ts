/**
 * A made-up Moon surface: bright highlands, a few dark seas (maria) and scattered craters with bright rims.
 * Built once, the first time the Moon is needed, as an equirectangular map of brightness (0 to 1).
 */
export const MOON_W = 256;
export const MOON_H = 128;

/** A small seeded random number generator, so the Moon looks the same on every visit. */
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

let map: Float32Array | null = null;

export function moonMap(): Float32Array {
  if (map) return map;
  const rand = rng(7);
  // seas: big soft dark patches, mostly on one side, as on the real Moon
  const seas = Array.from({ length: 9 }, () => ({
    v: toVec((rand() - 0.5) * 1.4, (rand() - 0.5) * 3.2),
    size: 0.35 + rand() * 0.4,
  }));
  const craters = Array.from({ length: 70 }, () => {
    const big = rand() < 0.25;
    return { v: toVec(Math.asin(rand() * 2 - 1), rand() * Math.PI * 2), r: big ? 0.12 + rand() * 0.1 : 0.05 + rand() * 0.06 };
  });
  map = new Float32Array(MOON_W * MOON_H);
  const noise = rng(11);
  for (let y = 0; y < MOON_H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / MOON_H) * Math.PI;
    for (let x = 0; x < MOON_W; x++) {
      const p = toVec(lat, ((x + 0.5) / MOON_W) * Math.PI * 2 - Math.PI);
      let b = 0.88;
      for (const s of seas) {
        const d = Math.acos(Math.min(1, p[0] * s.v[0] + p[1] * s.v[1] + p[2] * s.v[2]));
        b -= 0.5 * smoothstep(1 - d / s.size);
      }
      for (const c of craters) {
        const d = Math.acos(Math.min(1, p[0] * c.v[0] + p[1] * c.v[1] + p[2] * c.v[2])) / c.r;
        if (d < 1) b *= 0.5 + 0.3 * d * d; // the floor is shadowed, darkest in the middle
        else if (d < 1.3) b = Math.min(1, b * 1.25); // a bright rim
      }
      map[y * MOON_W + x] = Math.max(0.1, Math.min(1, b + (noise() - 0.5) * 0.08));
    }
  }
  return map;
}

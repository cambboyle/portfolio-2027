/**
 * Saturn's rings. Each character cell is one ray from the viewer, straight into the screen; the rings are a flat disc
 * in the planet's equatorial plane, so the ray is tested against that plane. Everything is in planet radii, in screen
 * coordinates (x right, y up, z towards the viewer), with the planet at the origin.
 */
export const RING_INNER = 1.24;
export const RING_OUTER = 2.27;

/** How bright the rings are at a distance from the planet's centre: faint C ring, bright B ring, the Cassini division, the A ring and its Encke gap. */
export function ringProfile(rho: number): number {
  if (rho < RING_INNER || rho > RING_OUTER) return 0;
  if (rho < 1.53) return 0.3;
  if (rho < 1.95) return 0.78 + 0.18 * Math.sin(rho * 71);
  if (rho < 2.03) return 0; // the Cassini division
  if (Math.abs(rho - 2.21) < 0.012) return 0; // the Encke gap
  return 0.62 + 0.1 * Math.sin(rho * 97);
}

export interface RingHit {
  /** 0 to 1: how bright this bit of ring looks (profile, angle to the sun, and shadow of the planet). */
  brightness: number;
  /** True when this bit of ring is nearer to us than the planet's surface at that cell (or beside the planet), so it is seen. */
  seen: boolean;
}

/**
 * The ring seen at screen position (x, y), or null if the ray misses the rings. `north` is the planet's north pole and
 * `sun` the direction to the sun, both unit vectors in screen coordinates.
 */
export function ringHit(x: number, y: number, north: ArrayLike<number>, sun: ArrayLike<number>): RingHit | null {
  const nz = north[2];
  if (Math.abs(nz) < 1e-3) return null; // edge on: the rings are a line too thin to see
  // where the ray through (x, y) crosses the plane through the centre with this normal
  const z = -(x * north[0] + y * north[1]) / nz;
  const rho = Math.hypot(x, y, z);
  const base = ringProfile(rho);
  if (base === 0) return null;
  // in front of the planet's surface there, or clear of the planet
  const r2 = x * x + y * y;
  const seen = r2 >= 1 || z > Math.sqrt(1 - r2);
  // the planet's shadow: from the ring towards the sun, does the ray pass through the planet?
  const toward = x * sun[0] + y * sun[1] + z * sun[2];
  const shadowed = toward < 0 && toward * toward > rho * rho - 1;
  // a flat disc is lit by how squarely the sun shines on it, from either side
  const incidence = Math.abs(north[0] * sun[0] + north[1] * sun[1] + north[2] * sun[2]);
  return { brightness: base * (0.35 + 0.65 * incidence) * (shadowed ? 0.12 : 1), seen };
}

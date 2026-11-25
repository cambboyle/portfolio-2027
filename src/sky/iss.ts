/**
 * Showing where the International Space Station is right now, on the Earth. This is the one place the site asks anyone
 * else for anything, so it only happens when a visitor asks (the terminal's `iss`), never when a page loads. The
 * position comes from the public wheretheiss.at API as plain numbers; the maths of putting it on the globe is here.
 */
export const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
export const ISS_POLL_MS = 5000; // the API allows about one request a second; this is much gentler
export const ISS_GIVE_UP_MS = 10 * 60 * 1000; // tracking stops by itself after ten minutes

export interface IssFix {
  /** Degrees north (+) or south (-). */
  lat: number;
  /** Degrees east (+) or west (-), -180 to 180. */
  lon: number;
  /** Height above the ground in km. */
  altitude: number;
  /** Speed in km/h. */
  velocity: number;
}

/** Takes what the API sent and returns a position, or null if it is not what was expected. */
export function parseIss(raw: unknown): IssFix | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { latitude: lat, longitude: lon, altitude, velocity } = r;
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!ok(lat) || !ok(lon) || !ok(altitude) || !ok(velocity)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || altitude < 0 || altitude > 100000 || velocity < 0) return null;
  return { lat, lon, altitude, velocity };
}

/** Asks for the position. Any failure (offline, blocked, a bad answer) gives null rather than an error. */
export async function fetchIss(signal?: AbortSignal): Promise<IssFix | null> {
  try {
    const res = await fetch(ISS_URL, { signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
    return res.ok ? parseIss(await res.json()) : null;
  } catch {
    return null;
  }
}

/**
 * Where a point on the Earth is on screen. `orient` is the globe's screen → globe rotation (rows: east, north, the
 * meridian facing us). The result is on the unit sphere in screen coordinates (x right, y up, z towards the viewer);
 * the point can be seen when z is above 0.
 */
export function issToScreen(lat: number, lon: number, orient: ArrayLike<number>) {
  const [la, lo] = [(lat * Math.PI) / 180, (lon * Math.PI) / 180];
  // on the globe: x towards the east, y north, z at longitude 0 on the equator
  const [gx, gy, gz] = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  return {
    x: orient[0] * gx + orient[3] * gy + orient[6] * gz,
    y: orient[1] * gx + orient[4] * gy + orient[7] * gz,
    z: orient[2] * gx + orient[5] * gy + orient[8] * gz,
  };
}

/** The index of the character cell at a screen position given in globe radii, or -1 if it is off the grid. */
export function cellAt(x: number, y: number, cols: number, rows: number, aspect: number, scale = 1) {
  const radius = cols * 0.42 * scale;
  const col = Math.floor(cols / 2 + x * radius);
  const row = Math.floor(rows / 2 - (y * radius) / aspect);
  return col < 0 || col >= cols || row < 0 || row >= rows ? -1 : row * cols + col;
}

/** e.g. "6.1°N 155.7°E". */
export const place = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;

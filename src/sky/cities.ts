import data from "../art/cities.json";

/**
 * The lights of the world's cities, for the night side of the Earth. The cities are put on a coarse grid (about one
 * character cell of the globe per grid cell) so a city is a steady blob of light as the globe turns, rather than a
 * pixel that comes and goes, and neighbouring big cities run together into the clusters seen in photographs.
 */
export const CITY_W = 128;
export const CITY_H = 64;

let grid: Uint8Array | null = null;

/** Brightness 0 (dark), 1, 2 or 3 for each cell of an equirectangular grid, north at the top, longitude -180° at the left. */
export function cityGrid(): Uint8Array {
  if (grid) return grid;
  const g = new Uint8Array(CITY_W * CITY_H);
  const put = (x: number, y: number, w: number) => {
    if (y < 0 || y >= CITY_H) return;
    const i = y * CITY_W + (((x % CITY_W) + CITY_W) % CITY_W);
    if (g[i] < w) g[i] = w;
  };
  for (const [lon10, lat10, w] of data.cities) {
    const x = Math.floor(((lon10 / 10 + 180) / 360) * CITY_W);
    const y = Math.floor(((90 - lat10 / 10) / 180) * CITY_H);
    put(x, y, w);
    // the big ones glow into the cells beside them
    if (w >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, 1);
  }
  return (grid = g);
}

/** The brightness of the city lights at a spot: `u` is longitude as a fraction of a turn from -180°, `la` runs 0 at the north pole to 1 at the south. */
export function cityLight(g: Uint8Array, u: number, la: number) {
  const x = Math.min(CITY_W - 1, Math.floor(u * CITY_W));
  const y = Math.min(CITY_H - 1, Math.floor(la * CITY_H));
  return g[y * CITY_W + x];
}

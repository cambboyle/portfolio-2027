/**
 * Turns the world's coastlines into a small land/sea bitmap the globe can look up as it turns.
 *
 *   bun scripts/prep-earth.ts      (writes src/art/earth.json)
 *
 * The map is equirectangular: each row is a line of latitude (north at the top), each column a line of
 * longitude (from -180°). One bit per pixel, packed and base64 encoded. Coastlines come from Natural Earth
 * (public domain) via the world-atlas package.
 */
import { feature } from "topojson-client";
import land from "world-atlas/land-50m.json";

const W = 512;
const H = 256;

const geo = feature(land as any, (land as any).objects.land) as any;
const polygons: number[][][][] = geo.features.flatMap((f: any) =>
  f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
);

// scanline fill with the even-odd rule: along each row, find where the coast crosses it and fill between pairs
const bits = new Uint8Array((W * H) / 8);
for (let y = 0; y < H; y++) {
  const lat = 90 - ((y + 0.5) / H) * 180;
  const xs: number[] = [];
  for (const poly of polygons) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[j];
        if (y1 > lat !== y2 > lat) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
  }
  xs.sort((a, b) => a - b);
  // Antarctica's outline runs off the bottom of the map, so the scanline fill breaks down near the pole; it is all ice there
  if (lat < -80) xs.splice(0, xs.length, -180, 180);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const a = Math.max(0, Math.round(((xs[k] + 180) / 360) * W));
    const b = Math.min(W, Math.round(((xs[k + 1] + 180) / 360) * W));
    for (let x = a; x < b; x++) {
      const i = y * W + x;
      bits[i >> 3] |= 1 << (i & 7);
    }
  }
}

// a rough look in the terminal, to check the continents are the right way up
if (process.argv.includes("--show")) {
  for (let y = 0; y < H; y += 8) {
    let line = "";
    for (let x = 0; x < W; x += 4) {
      const i = y * W + x;
      line += bits[i >> 3] & (1 << (i & 7)) ? "#" : ".";
    }
    console.log(line);
  }
}

await Bun.write("src/art/earth.json", JSON.stringify({ w: W, h: H, land: Buffer.from(bits).toString("base64") }));
console.log(`wrote src/art/earth.json (${W}×${H})`);

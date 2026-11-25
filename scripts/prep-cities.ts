/**
 * Turns Natural Earth's populated places (public domain) into a small list of city lights for the night side of the
 * Earth.
 *
 *   bun scripts/prep-cities.ts path/to/ne_50m_populated_places_simple.geojson     (writes src/art/cities.json)
 *
 * Download the file from https://github.com/nvkelso/natural-earth-vector (geojson/) into its own folder and pass its
 * path; it is not kept in the repository. Each place becomes [longitude × 10, latitude × 10, brightness 1-3] as whole
 * numbers: brightness 3 for the very largest cities (8 million and over), 2 from 2 million, 1 for the rest. Places
 * under 300 000 people are left out.
 */
const path = process.argv[2];
if (!path) {
  console.error("usage: bun scripts/prep-cities.ts path/to/ne_50m_populated_places_simple.geojson");
  process.exit(1);
}

const places = JSON.parse(await Bun.file(path).text()).features as {
  properties: { pop_max: number; longitude: number; latitude: number };
}[];

const cities = places
  .filter((p) => p.properties.pop_max >= 300_000)
  .map(({ properties: p }) => [
    Math.round(p.longitude * 10),
    Math.round(p.latitude * 10),
    p.pop_max >= 8_000_000 ? 3 : p.pop_max >= 2_000_000 ? 2 : 1,
  ])
  // the same order every time, so the file only changes when the data does
  .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

await Bun.write("src/art/cities.json", JSON.stringify({ cities }));
console.log(`${cities.length} cities from ${places.length} places`);

import { expect, test } from "bun:test";
import { MARS_H, MARS_W, isPolarCap, marsMap, saturnBand } from "../src/sky/planets";
import { fixedPose } from "../src/sky/orbit";
import { RING_INNER, RING_OUTER, ringHit, ringProfile } from "../src/sky/rings";

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const row = (m: number[], i: number) => m.slice(i * 3, i * 3 + 3);

test("the Mars map is the same each time, in range, with both bright and dark ground", () => {
  const a = marsMap();
  expect(a).toBe(marsMap());
  expect(a.length).toBe(MARS_W * MARS_H);
  expect(Math.min(...a)).toBeGreaterThanOrEqual(0.15);
  expect(Math.max(...a)).toBeLessThanOrEqual(1);
  expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(0.4);
});

test("the polar caps are at the poles only", () => {
  expect(isPolarCap(0.01, 0.5)).toBe(true);
  expect(isPolarCap(0.99, 0.5)).toBe(true);
  expect(isPolarCap(0.5, 0.5)).toBe(false);
  expect(isPolarCap(0.2, 1)).toBe(false);
});

test("Saturn's bands stay in range, and the equator is brighter than the poles", () => {
  for (let la = 0; la <= 1; la += 0.01) {
    const b = saturnBand(la, 0.3);
    expect(b).toBeGreaterThanOrEqual(0.25);
    expect(b).toBeLessThanOrEqual(1);
  }
  expect(saturnBand(0.5, 0.3)).toBeGreaterThan(saturnBand(0.02, 0.3));
});

test("a fixed pose is a rotation with the pole tipped by the tilt", () => {
  const tilt = (25.2 * Math.PI) / 180;
  const m = fixedPose(tilt, 0);
  const [east, north, meridian] = [0, 1, 2].map((i) => row(m, i));
  expect(dot(east, east)).toBeCloseTo(1, 6);
  expect(dot(north, north)).toBeCloseTo(1, 6);
  expect(dot(east, north)).toBeCloseTo(0, 6);
  expect(dot(north, meridian)).toBeCloseTo(0, 6);
  // with no pitch the pole leans to the right by exactly the tilt from straight up
  expect(Math.acos(north[1])).toBeCloseTo(tilt, 6);
  expect(north[0]).toBeGreaterThan(0);
  // tipping it towards us points the pole at the viewer a little
  expect(row(fixedPose(tilt, 0.5), 1)[2]).toBeGreaterThan(0.3);
});

test("the ring profile has its gaps and ends", () => {
  expect(ringProfile(RING_INNER - 0.01)).toBe(0);
  expect(ringProfile(RING_OUTER + 0.01)).toBe(0);
  expect(ringProfile(1.4)).toBeGreaterThan(0);
  expect(ringProfile(1.4)).toBeLessThan(ringProfile(1.7)); // the B ring is brighter than the C ring
  expect(ringProfile(1.99)).toBe(0); // the Cassini division
  expect(ringProfile(2.21)).toBe(0); // the Encke gap
  expect(ringProfile(2.1)).toBeGreaterThan(0);
});

test("seen from above the north pole, the near rings pass in front of the planet and the far rings behind it", () => {
  const north = row(fixedPose(0, 0.5), 1); // the pole tipped towards the viewer
  const sun = [-0.9, 0.2, 0.4];
  const l = Math.hypot(...sun);
  const sunUnit = sun.map((v) => v / l);
  // beside the planet, a ring is simply seen
  expect(ringHit(1.7, 0, north, sunUnit)?.seen).toBe(true);
  // below the middle: the near side of the rings, in front of the planet
  expect(ringHit(0, -0.8, north, sunUnit)?.seen).toBe(true);
  // above the middle: the far side, hidden behind the planet
  expect(ringHit(0, 0.8, north, sunUnit)?.seen).toBe(false);
  // nothing where the rings are not: well beyond the outer edge, and just off the planet inside the inner edge
  expect(ringHit(2.9, 0, north, sunUnit)).toBeNull();
  expect(ringHit(0, 0, north, sunUnit)).toBeNull();
  // edge on, they vanish
  expect(ringHit(1.7, 0, [0, 1, 0], sunUnit)).toBeNull();
});

test("the planet's shadow darkens the rings on the far side from the sun", () => {
  const north = row(fixedPose(0, 0.5), 1);
  const sun = [-1, 0, 0]; // from the left
  // the right-hand ring is on the night side, in the planet's shadow; the left-hand one is in sunlight
  const shadow = ringHit(1.7, 0, north, sun)!;
  const lit = ringHit(-1.7, 0, north, sun)!;
  expect(shadow.brightness).toBeLessThan(lit.brightness * 0.3);
});

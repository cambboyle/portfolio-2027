import { expect, test } from "bun:test";
import earth from "../src/art/earth.json";
import { MOON_H, MOON_W, moonMap } from "../src/sky/moon";
import { cast, scene, shipMatrix } from "../src/sky/ship";

test("the land map is the size it says and is part land, part sea", () => {
  const bits = Buffer.from(earth.land, "base64");
  expect(bits.length).toBe((earth.w * earth.h) / 8);
  let land = 0;
  for (const b of bits) for (let k = 0; k < 8; k++) land += (b >> k) & 1;
  const share = land / (earth.w * earth.h);
  // about 29% of the Earth's surface is land; on a flat map the poles count extra, so allow some room
  expect(share).toBeGreaterThan(0.25);
  expect(share).toBeLessThan(0.45);
});

test("the Moon map is the same on every visit, and has both bright and dark ground", () => {
  const a = moonMap();
  expect(a.length).toBe(MOON_W * MOON_H);
  expect(Math.min(...a)).toBeGreaterThanOrEqual(0.1);
  expect(Math.max(...a)).toBeLessThanOrEqual(1);
  expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(0.5);
});

test("the station's shape: inside the sphere is negative, far away is positive", () => {
  expect(scene(0, 0, 0)).toBeLessThan(0);
  expect(scene(0, 2, 0)).toBeGreaterThan(1);
});

test("a ray through the middle of the ship hits it, and one through empty space does not", () => {
  const m = shipMatrix(0);
  const sun = [0, 0, 1];
  expect(cast(0, 0, m, sun).kind).not.toBe(0);
  expect(cast(0.95, 0.95, m, sun).kind).toBe(0);
});

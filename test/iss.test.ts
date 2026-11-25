import { expect, test } from "bun:test";
import { cellAt, issToScreen, parseIss, place } from "../src/sky/iss";
import { orientFromNorth } from "../src/sky/orbit";

// the real API's answer, trimmed
const reply = { name: "iss", id: 25544, latitude: 6.0557337203829, longitude: 155.65127561242, altitude: 419.66405558516, velocity: 27577.054439539, visibility: "eclipsed", units: "kilometers" };

test("a real reply is understood, and anything odd is refused", () => {
  expect(parseIss(reply)).toEqual({ lat: 6.0557337203829, lon: 155.65127561242, altitude: 419.66405558516, velocity: 27577.054439539 });
  expect(parseIss(null)).toBeNull();
  expect(parseIss("iss")).toBeNull();
  expect(parseIss({ ...reply, latitude: "6" })).toBeNull();
  expect(parseIss({ ...reply, latitude: 95 })).toBeNull();
  expect(parseIss({ ...reply, longitude: 200 })).toBeNull();
  expect(parseIss({ ...reply, altitude: -1 })).toBeNull();
  expect(parseIss({ ...reply, velocity: NaN })).toBeNull();
});

// a globe with its pole straight up and the meridian facing us: nothing tilted, so the answers can be checked by eye
const upright = orientFromNorth([0, 1, 0]);

test("places go where they should on the screen: east to the right, north up, the far side hidden", () => {
  const centre = issToScreen(0, 0, upright);
  expect(centre.x).toBeCloseTo(0, 6);
  expect(centre.y).toBeCloseTo(0, 6);
  expect(centre.z).toBeCloseTo(1, 6);
  const east = issToScreen(0, 90, upright);
  expect(east.x).toBeCloseTo(1, 6);
  expect(Math.abs(east.z)).toBeLessThan(1e-6);
  expect(issToScreen(0, -90, upright).x).toBeCloseTo(-1, 6);
  const north = issToScreen(90, 0, upright);
  expect(north.y).toBeCloseTo(1, 6);
  expect(issToScreen(0, 180, upright).z).toBeCloseTo(-1, 6); // the far side
  expect(issToScreen(45, 45, upright).z).toBeGreaterThan(0); // near side
});

test("the screen position is a rotation: it stays on the unit sphere and is undone by the globe's own", () => {
  const tilted = orientFromNorth([0.4, 0.8, 0.45].map((v) => v / Math.hypot(0.4, 0.8, 0.45)));
  for (const [lat, lon] of [[51.5, -0.1], [-33.9, 151.2], [6, 155.6], [80, 10]]) {
    const s = issToScreen(lat, lon, tilted);
    expect(Math.hypot(s.x, s.y, s.z)).toBeCloseTo(1, 5);
    // turning the screen position back into globe coordinates gives the same latitude
    const gy = tilted[3] * s.x + tilted[4] * s.y + tilted[5] * s.z;
    expect((Math.asin(gy) * 180) / Math.PI).toBeCloseTo(lat, 4);
  }
});

test("a screen position finds its character cell, matching how the globe is laid out", () => {
  const [cols, rows, aspect] = [104, 58, 1.8];
  expect(cellAt(0, 0, cols, rows, aspect)).toBe(29 * cols + 52); // the middle
  // right is further along the row, up is an earlier row
  expect(cellAt(0.5, 0, cols, rows, aspect) % cols).toBeGreaterThan(52);
  expect(Math.floor(cellAt(0, 0.5, cols, rows, aspect) / cols)).toBeLessThan(29);
  expect(cellAt(3, 0, cols, rows, aspect)).toBe(-1); // off the grid
  // the same position lands in the same cell the globe draws there: the edge of the disc is 0.42 of the width from the middle
  expect(cellAt(1, 0, cols, rows, aspect) % cols).toBe(Math.floor(52 + 104 * 0.42));
});

test("a position is written the way maps do", () => {
  expect(place(6.06, 155.65)).toBe("6.1°N 155.7°E");
  expect(place(-33.87, -70.5)).toBe("33.9°S 70.5°W");
});

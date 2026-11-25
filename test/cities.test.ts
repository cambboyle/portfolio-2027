import { expect, test } from "bun:test";
import { CITY_H, CITY_W, cityGrid, cityLight } from "../src/sky/cities";

// where a place falls on the globe's maps: u from longitude, la from latitude
const u = (lon: number) => (lon + 180) / 360;
const la = (lat: number) => (90 - lat) / 180;
const near = (g: Uint8Array, lon: number, lat: number) => {
  // the brightest light within one grid cell, since a city can sit on the edge of a cell
  let best = 0;
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    best = Math.max(best, cityLight(g, u(lon) + dx / CITY_W, la(lat) + dy / CITY_H));
  }
  return best;
};

test("the big cities are lit and the open ocean is dark", () => {
  const g = cityGrid();
  expect(near(g, -0.13, 51.5)).toBeGreaterThan(0); // London
  expect(near(g, 139.7, 35.7)).toBeGreaterThan(0); // Tokyo
  expect(near(g, -74, 40.7)).toBeGreaterThan(0); // New York
  expect(near(g, 77.2, 28.6)).toBeGreaterThan(0); // Delhi
  expect(cityLight(g, u(-140), la(-30))).toBe(0); // the South Pacific
  expect(cityLight(g, u(0), la(-60))).toBe(0); // the Southern Ocean
});

test("the lights are a small share of the globe, and the very biggest cities are the brightest", () => {
  const g = cityGrid();
  expect(g.length).toBe(CITY_W * CITY_H);
  const lit = g.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  expect(lit / g.length).toBeGreaterThan(0.02);
  expect(lit / g.length).toBeLessThan(0.15);
  expect(Math.max(...g)).toBe(3);
});

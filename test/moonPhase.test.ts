import { expect, test } from "bun:test";
import { moonPhase } from "../src/sky/moonPhase";

const deg = (r: number) => (r * 180) / Math.PI;
/** How far the elongation is from a target angle, in degrees, going the short way round. */
const off = (date: string, target: number) => {
  const d = Math.abs(deg(moonPhase(new Date(date)).angle) - target);
  return Math.min(d, 360 - d);
};

// well-known moments from published almanacs (UTC): the Moon moves about half a degree an hour, so 2° is about 4 hours
test("new moons land on new", () => {
  expect(off("2024-04-08T18:21:00Z", 0)).toBeLessThan(2); // the total solar eclipse
  expect(off("2025-11-20T06:47:00Z", 0)).toBeLessThan(2);
});

test("full moons land on full", () => {
  expect(off("2025-09-07T18:11:00Z", 180)).toBeLessThan(2); // the total lunar eclipse
  expect(off("2022-11-08T11:00:00Z", 180)).toBeLessThan(2);
  expect(off("2025-11-05T13:19:00Z", 180)).toBeLessThan(2);
});

test("illumination, age and name follow the angle", () => {
  const full = moonPhase(new Date("2025-11-05T13:19:00Z"));
  expect(full.illumination).toBeGreaterThan(0.99);
  expect(full.name).toBe("full moon");
  expect(full.age).toBeGreaterThan(14);
  expect(full.age).toBeLessThan(15.5);
  const fresh = moonPhase(new Date("2025-11-20T06:47:00Z"));
  expect(fresh.illumination).toBeLessThan(0.01);
  expect(fresh.name).toBe("new moon");
  // the first quarter, a week after new, is half lit and waxing
  const quarter = moonPhase(new Date("2025-11-28T06:59:00Z"));
  expect(quarter.name).toBe("first quarter");
  expect(quarter.illumination).toBeGreaterThan(0.45);
  expect(quarter.illumination).toBeLessThan(0.55);
});

test("a whole cycle takes about 29.5 days and the names go round in order", () => {
  const start = Date.UTC(2025, 10, 20, 7);
  const seen: string[] = [];
  for (let day = 0; day < 30; day++) {
    const name = moonPhase(new Date(start + day * 86400000)).name;
    if (seen[seen.length - 1] !== name) seen.push(name);
  }
  expect(seen).toEqual([
    "new moon", "waxing crescent", "first quarter", "waxing gibbous", "full moon", "waning gibbous", "last quarter", "waning crescent", "new moon",
  ]);
});

test("the next full and new moons are found, and are about a fortnight apart", async () => {
  const { nextPhase } = await import("../src/sky/moonPhase");
  // from the end of October 2025 the next full moon is the 5th of November, about 13:19 UTC
  const full = nextPhase(new Date("2025-10-30T00:00:00Z"), Math.PI);
  expect(Math.abs(full.getTime() - Date.parse("2025-11-05T13:19:00Z"))).toBeLessThan(3 * 3600000);
  const next = nextPhase(full, 0);
  expect(Math.abs(next.getTime() - Date.parse("2025-11-20T06:47:00Z"))).toBeLessThan(3 * 3600000);
  const days = (next.getTime() - full.getTime()) / 86400000;
  expect(days).toBeGreaterThan(13);
  expect(days).toBeLessThan(16);
});

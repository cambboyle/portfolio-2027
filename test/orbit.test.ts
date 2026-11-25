import { expect, test } from "bun:test";
import { OBLIQUITY, PITCH, skyPose } from "../src/sky/orbit";

const deg = (r: number) => (r * 180) / Math.PI;
const row = (m: number[], i: number) => m.slice(i * 3, i * 3 + 3);
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test("the sun is overhead at the tropics at the solstices and at the equator at the equinoxes", () => {
  expect(deg(skyPose(new Date("2026-06-21T12:00:00Z")).declination)).toBeCloseTo(23.4, 0);
  expect(deg(skyPose(new Date("2026-12-21T12:00:00Z")).declination)).toBeCloseTo(-23.4, 0);
  expect(Math.abs(deg(skyPose(new Date("2026-03-20T12:00:00Z")).declination))).toBeLessThan(1);
  expect(Math.abs(deg(skyPose(new Date("2026-09-23T12:00:00Z")).declination))).toBeLessThan(1);
  // late November: about 21° south, as in the almanac
  expect(deg(skyPose(new Date("2026-11-25T12:00:00Z")).declination)).toBeGreaterThan(-22);
  expect(deg(skyPose(new Date("2026-11-25T12:00:00Z")).declination)).toBeLessThan(-20);
});

test("the axis is 23.44° from the orbit's normal on every date, and the orientation is a rotation", () => {
  // the orbit's normal on screen is up, tipped by how far we look down from
  const normal = [0, Math.cos(PITCH), Math.sin(PITCH)];
  for (let day = 0; day < 365; day += 17) {
    const { orient } = skyPose(new Date(Date.UTC(2026, 0, 1 + day)));
    const [east, north, meridian] = [0, 1, 2].map((i) => row(orient, i));
    expect(dot(east, east)).toBeCloseTo(1, 5);
    expect(dot(north, north)).toBeCloseTo(1, 5);
    expect(dot(east, north)).toBeCloseTo(0, 5);
    expect(dot(north, meridian)).toBeCloseTo(0, 5);
    expect(dot(east, meridian)).toBeCloseTo(0, 5);
    expect(Math.acos(dot(north, normal))).toBeCloseTo(OBLIQUITY, 5);
  }
});

test("at the June solstice the north pole leans towards the sun, at the December one away from it", () => {
  const june = skyPose(new Date("2026-06-21T12:00:00Z"));
  const december = skyPose(new Date("2026-12-21T12:00:00Z"));
  expect(dot(row(june.orient, 1), june.sun)).toBeGreaterThan(0.3);
  expect(dot(row(december.orient, 1), december.sun)).toBeLessThan(-0.3);
});

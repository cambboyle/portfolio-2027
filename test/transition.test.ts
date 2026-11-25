import { expect, test } from "bun:test";
import { ringStrength as strength } from "../src/asciiRing";
import { navDirection } from "../src/pageTransition";
import { farthestCorner } from "../src/themeTransition";

const ringStrength = (offset: number) => strength(offset, 40, 150);

test("the circle grows far enough to cover the screen from wherever it starts", () => {
  expect(farthestCorner(0, 0, 300, 400)).toBe(500);
  expect(farthestCorner(300, 400, 300, 400)).toBe(500);
  expect(farthestCorner(150, 200, 300, 400)).toBe(250);
});

test("the ring is strongest at the edge, short ahead of it and long behind it", () => {
  expect(ringStrength(0)).toBe(1);
  expect(ringStrength(40)).toBe(0); // the end of the lead
  expect(ringStrength(-150)).toBe(0); // the end of the trail
  expect(ringStrength(200)).toBe(0);
  expect(ringStrength(-300)).toBe(0);
  // behind the edge it thins out gradually
  expect(ringStrength(-20)).toBeGreaterThan(ringStrength(-60));
  expect(ringStrength(-60)).toBeGreaterThan(ringStrength(-120));
  // and the lead is the steeper side
  expect(ringStrength(20)).toBeLessThan(ringStrength(-20));
});

test("the page sweep goes left to right towards later nav items and back again", () => {
  expect(navDirection("/", "/projects")).toBe(1);
  expect(navDirection("/about", "/notes")).toBe(-1);
  expect(navDirection("/notes", "/about")).toBe(1);
  // deeper into a section is forward, back out of it is backward
  expect(navDirection("/projects", "/projects/netkit")).toBe(1);
  expect(navDirection("/projects/netkit", "/projects")).toBe(-1);
  // and a page that does not exist counts as the last
  expect(navDirection("/about", "/nowhere")).toBe(1);
  expect(navDirection("/nowhere", "/")).toBe(-1);
});

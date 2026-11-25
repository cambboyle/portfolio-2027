import { expect, test } from "bun:test";
import { COMET_HIT, COMET_LIFE, TAIL_LENGTH, cometDelay, cometHead, cometTail, isCaught, newComet } from "../src/cometPath";
import { TRAIL_LIFE, TRAIL_STEP, shouldEmit, trailAlpha, trailGlyph } from "../src/trailLook";

/** A random number source that gives the same numbers in a repeating cycle. */
const cycle = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test("trail characters thin out as they age and are never very solid", () => {
  expect(trailGlyph(0)).toBe("#");
  expect(trailGlyph(0.99)).toBe(" ");
  expect(trailGlyph(5)).toBe(" ");
  expect(trailGlyph(-1)).toBe("#");
  expect(trailAlpha(0)).toBeLessThanOrEqual(0.55);
  expect(trailAlpha(0.5)).toBeLessThan(trailAlpha(0.1));
  expect(trailAlpha(1)).toBe(0);
  expect(TRAIL_LIFE).toBeGreaterThan(300);
});

test("a trail character is left only after the mouse has moved far enough", () => {
  expect(shouldEmit(null, 10, 10)).toBe(true);
  expect(shouldEmit({ x: 10, y: 10 }, 12, 12)).toBe(false);
  expect(shouldEmit({ x: 10, y: 10 }, 10 + TRAIL_STEP, 10)).toBe(true);
});

test("a comet enters off screen and crosses it heading down and to the left", () => {
  for (const r of [0, 0.3, 0.7, 0.99]) {
    const c = newComet(1440, 900, cycle(r, 0.5, 0.5), 1000);
    const start = cometHead(c, 1000);
    expect(start.x > 1440 || start.y < 0).toBe(true); // off the top or the right edge
    expect(c.vx).toBeLessThan(0);
    expect(c.vy).toBeGreaterThan(0);
    // by the end of its life it is well across the screen
    const end = cometHead(c, 1000 + COMET_LIFE);
    expect(end.x).toBeLessThan(start.x - 1000);
    expect(end.y).toBeGreaterThan(start.y + 300);
  }
});

test("the tail trails behind the head and fades", () => {
  const c = newComet(1440, 900, cycle(0.2, 0.5, 0.5), 0);
  const head = cometHead(c, 1000);
  const tail = cometTail(c, 1000);
  expect(tail.length).toBe(TAIL_LENGTH);
  // behind the head means up and to the right of it, since the comet heads down and left
  expect(tail[0].x).toBeGreaterThan(head.x);
  expect(tail[0].y).toBeLessThan(head.y);
  expect(tail[0].strength).toBeGreaterThan(tail[TAIL_LENGTH - 1].strength);
  expect(tail[TAIL_LENGTH - 1].strength).toBeGreaterThan(0);
});

test("a click catches the comet only close to its head", () => {
  const head = { x: 500, y: 300 };
  expect(isCaught(head, 500 + COMET_HIT - 1, 300)).toBe(true);
  expect(isCaught(head, 500 + COMET_HIT + 5, 300)).toBe(false);
});

test("comets come every one to four minutes, the first sooner", () => {
  expect(cometDelay(() => 0, true)).toBe(40000);
  expect(cometDelay(() => 1, true)).toBe(100000);
  expect(cometDelay(() => 0, false)).toBe(90000);
  expect(cometDelay(() => 1, false)).toBe(240000);
});

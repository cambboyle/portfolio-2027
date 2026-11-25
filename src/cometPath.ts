/**
 * A comet crossing the page: a bright head and a tail of fading characters. Positions are worked out from the time,
 * so nothing here depends on the screen or the clock and it can be tested.
 */
export const COMET_LIFE = 2600; // ms from one side of the screen to the other
export const COMET_HIT = 30; // px: how close a click must be to the head to catch it
export const TAIL_LENGTH = 22; // characters in the tail
export const TAIL_SPACING = 11; // px between them

export interface Comet {
  /** Where it was at birth (just off an edge of the screen), in px, and its velocity in px per second. */
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  born: number;
}

/** A comet entering over the top or the right edge and heading down and to the left. */
export function newComet(width: number, height: number, rand: () => number, now: number): Comet {
  const fromTop = rand() < 0.5;
  const x0 = fromTop ? width * (0.4 + rand() * 0.65) : width + 20;
  const y0 = fromTop ? -20 : height * (rand() * 0.5 - 0.05);
  const heading = ((25 + rand() * 30) * Math.PI) / 180; // below the horizontal
  const speed = Math.hypot(width, height) * 0.45;
  return { x0, y0, vx: -Math.cos(heading) * speed, vy: Math.sin(heading) * speed, born: now };
}

export function cometHead(c: Comet, now: number) {
  const s = (now - c.born) / 1000;
  return { x: c.x0 + c.vx * s, y: c.y0 + c.vy * s, age: (now - c.born) / COMET_LIFE };
}

/** The tail: positions behind the head along its path, with a strength that dies away from 1 at the head. */
export function cometTail(c: Comet, now: number) {
  const head = cometHead(c, now);
  const speed = Math.hypot(c.vx, c.vy);
  return Array.from({ length: TAIL_LENGTH }, (_, i) => {
    const back = (i + 1) * TAIL_SPACING;
    return { x: head.x - (c.vx / speed) * back, y: head.y - (c.vy / speed) * back, strength: 1 - (i + 1) / (TAIL_LENGTH + 1) };
  });
}

export const isCaught = (head: { x: number; y: number }, x: number, y: number) => Math.hypot(head.x - x, head.y - y) <= COMET_HIT;

/** How long to wait for the next comet, in ms: the first comes sooner, so a visitor has a chance of seeing one. */
export const cometDelay = (rand: () => number, first: boolean) =>
  (first ? 40 + rand() * 60 : 90 + rand() * 150) * 1000;

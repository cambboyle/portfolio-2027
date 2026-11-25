/** The cursor trail: characters left behind the mouse that fade away. The numbers and the look, kept apart from the canvas so they can be tested. */
export const TRAIL_LIFE = 700; // ms a character lasts
export const TRAIL_STEP = 16; // px the mouse must move before another character is left
export const TRAIL_MAX = 48; // most characters on screen at once

// from the freshest and strongest to the faintest
const FADE = "#*+=-:. ";

/** The character for a particle of this age (0 just left, 1 gone). */
export const trailGlyph = (age: number) => FADE[Math.min(FADE.length - 1, Math.max(0, Math.floor(age * FADE.length)))];

/** How see-through it is: never more than about half there, so text under it stays readable. */
export const trailAlpha = (age: number) => (age >= 1 ? 0 : (1 - Math.max(0, age)) ** 1.5 * 0.55);

/** Whether the mouse has moved far enough from where the last character was left. */
export const shouldEmit = (last: { x: number; y: number } | null, x: number, y: number) =>
  !last || Math.hypot(x - last.x, y - last.y) >= TRAIL_STEP;

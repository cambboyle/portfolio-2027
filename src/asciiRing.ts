import type { Theme } from "./theme";

/** Shared by the theme change and the page change: a canvas layer, and the characters of a ring or a line of them. */

/** The colours of each theme (keep in step with styles.css): characters are drawn in the colours of the side they are on. */
export const COLOURS: Record<Theme, { ink: string; accent: string }> = {
  light: { ink: "#1d2230", accent: "#3249b8" },
  dark: { ink: "#e8ecf5", accent: "#6f8cff" },
};

const RAMP = " .:-=+*#%@";
const GLITCH = "01#%@&$";

/**
 * How strong the ring is at a distance from its edge: `offset` is positive ahead of the edge and negative behind it.
 * 1 right at the edge, fading to 0 across `lead` ahead and `trail` behind.
 */
export function ringStrength(offset: number, lead: number, trail: number) {
  const w = offset >= 0 ? 1 - offset / lead : 1 + offset / trail;
  return w <= 0 ? 0 : w ** 1.5;
}

/** A fixed number in [0, 1) for a cell and a moment, so characters shimmer rather than flicker every frame. */
export const cellNoise = (a: number, b: number, c: number) => {
  let h = Math.imul(a * 73856093 ^ b * 19349663 ^ c * 83492791, 2654435761);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** The character for a cell at a strength: dense and glitchy at the edge, thinning behind it. Null for none. */
export function glyphFor(strength: number, col: number, row: number, moment: number): string | null {
  const n = cellNoise(col, row, moment);
  if (strength > 0.9 && n < 0.6) return GLITCH[Math.floor(cellNoise(col, row, moment + 7) * GLITCH.length)];
  const level = Math.round(strength * (RAMP.length - 1) + (n - 0.5) * 2.2);
  return level <= 0 ? null : RAMP[Math.min(RAMP.length - 1, level)];
}

/**
 * A canvas covering the screen, in the page's monospace. By default it takes part in a view transition so it stays on
 * top; pass null for a plain overlay (the cursor trail, the comet).
 */
export function makeLayer(width: number, height: number, transitionName: string | null = "ascii-ring") {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none" + (transitionName ? `;view-transition-name:${transitionName}` : "");
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.font = `700 15px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cw = ctx.measureText("M").width;
  return { canvas, ctx, cw, ch: cw * 1.9 };
}

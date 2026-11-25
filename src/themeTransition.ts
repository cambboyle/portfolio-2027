import { type Theme, setTheme } from "./theme";
import { stillness } from "./motion";
import { COLOURS, glyphFor, makeLayer, ringStrength as strength } from "./asciiRing";

/**
 * Changing theme: the new theme grows as a circle from the toggle that was pressed, and its edge is a ring of
 * characters, dense at the leading edge and thinning into a trail behind it, in the page's own monospace.
 *
 * The circle is the browser's View Transitions API (the old page and the new one are both real pictures of the page,
 * and the new one is clipped to a growing circle). The ring of characters is a canvas that takes part in the same
 * transition, so it stays above both. With reduced motion, animations paused, or a browser without the API, the
 * theme just changes.
 */

const DURATION = 1000; // ms for the circle to cross the whole screen
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
const LEAD = 40; // px of ring ahead of the edge (over the old theme)
const TRAIL = 150; // px of ring behind it (over the new theme)

/** How far the circle has to grow, from a point, to cover the whole screen: the distance to the farthest corner. */
export function farthestCorner(x: number, y: number, width: number, height: number) {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

let running = false;

export async function changeTheme(next: Theme, from?: { x: number; y: number }) {
  const start = (document as any).startViewTransition?.bind(document);
  if (running || stillness() || !start) {
    if (!running) setTheme(next);
    return;
  }
  running = true;
  const root = document.documentElement;
  const [width, height] = [innerWidth, innerHeight];
  const x = from?.x ?? width / 2;
  const y = from?.y ?? height / 2;
  const reach = farthestCorner(x, y, width, height) + LEAD;
  const previous: Theme = next === "light" ? "dark" : "light";

  const { canvas, ctx, cw, ch } = makeLayer(width, height);

  const draw = (radius: number) => {
    ctx.clearRect(0, 0, width, height);
    const moment = Math.floor(performance.now() / 90);
    const rows = Math.ceil(height / ch);
    const cols = Math.ceil(width / cw);
    for (let row = 0; row < rows; row++) {
      const py = row * ch + ch / 2;
      for (let col = 0; col < cols; col++) {
        const px = col * cw + cw / 2;
        const offset = Math.hypot(px - x, py - y) - radius;
        if (offset > LEAD || offset < -TRAIL) continue;
        const power = strength(offset, LEAD, TRAIL);
        if (power <= 0.03) continue;
        const glyph = glyphFor(power, col, row, moment);
        if (!glyph) continue;
        // ahead of the edge is still the old theme, behind it the new one: draw in the colours of that side
        const side = COLOURS[offset >= 0 ? previous : next];
        ctx.globalAlpha = Math.min(1, 0.25 + power);
        ctx.fillStyle = power > 0.75 ? side.accent : side.ink;
        ctx.fillText(glyph, px, py);
      }
    }
    ctx.globalAlpha = 1;
  };

  try {
    const transition = start(async () => {
      // while the page is frozen for the new picture: the globe swaps at once instead of fading
      root.setAttribute("data-theme-cover", "");
      document.body.append(canvas);
      setTheme(next);
      await new Promise((r) => setTimeout(r, 70));
    });
    await transition.ready;
    const reveal = root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
      { duration: DURATION, easing: EASING, pseudoElement: "::view-transition-new(root)" },
    );
    // the ring follows the same eased progress as the circle, so its characters sit exactly on the edge
    const follow = () => {
      draw((reveal.effect?.getComputedTiming().progress ?? 0) * reach);
      if (reveal.playState === "running") requestAnimationFrame(follow);
    };
    follow();
    await transition.finished;
  } catch {
    // the transition was skipped (for instance the tab was hidden): the theme is set either way
  } finally {
    canvas.remove();
    root.removeAttribute("data-theme-cover");
    running = false;
  }
}

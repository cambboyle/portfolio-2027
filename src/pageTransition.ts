import { stillness } from "./motion";
import { COLOURS, glyphFor, makeLayer, ringStrength } from "./asciiRing";
import { readTheme } from "./theme";

/**
 * Moving between pages: a thin line of characters sweeps across the screen, and the new page is revealed behind
 * it. Going to a later item in the nav it sweeps left to right, going back it sweeps right to left. It uses the
 * browser's View Transitions API, like the theme change (src/themeTransition.ts), and is skipped with reduced
 * motion, while paused, and where the API is missing.
 */

const DURATION = 520; // ms: quick, as it happens on every click
const EASING = "cubic-bezier(0.5, 0, 0.2, 1)";
const LEAD = 8; // px of line ahead of the edge
const TRAIL = 34; // px of fading trail behind it: a thin line

const ORDER = ["/", "/projects", "/notes", "/about"];
const place = (path: string) => {
  const i = ORDER.findIndex((o) => path === o || (o !== "/" && path.startsWith(o + "/")));
  return i === -1 ? ORDER.length : i; // anything else (a page that does not exist) counts as last
};

/** 1 if moving from one page to the other goes "forward" (to a later nav item, or deeper into one), else -1. */
export function navDirection(from: string, to: string): 1 | -1 {
  const [a, b] = [place(from), place(to)];
  if (a !== b) return b > a ? 1 : -1;
  return to.length >= from.length ? 1 : -1;
}

/** Runs `update` (which must change the page synchronously) inside the sweep. */
export function pageTransition(update: () => void, direction: 1 | -1) {
  const start = (document as any).startViewTransition?.bind(document);
  const root = document.documentElement;
  // not while the theme is changing: that transition would be cut short
  if (!start || stillness() || root.hasAttribute("data-theme-cover")) {
    update();
    return;
  }
  const [width, height] = [innerWidth, innerHeight];
  const { canvas, ctx, cw, ch } = makeLayer(width, height);
  const colours = COLOURS[readTheme()];

  const draw = (progress: number) => {
    ctx.clearRect(0, 0, width, height);
    // the edge's position along the screen; the line sits on it, with its trail behind
    const edge = (direction > 0 ? progress : 1 - progress) * width;
    const moment = Math.floor(performance.now() / 90);
    const rows = Math.ceil(height / ch);
    const first = Math.max(0, Math.floor((edge - TRAIL * 1.2 - LEAD) / cw));
    const last = Math.min(Math.ceil(width / cw), Math.ceil((edge + TRAIL * 1.2 + LEAD) / cw));
    for (let col = first; col < last; col++) {
      const px = col * cw + cw / 2;
      // positive ahead of the edge, negative behind it, whichever way it is moving
      const offset = direction > 0 ? px - edge : edge - px;
      const power = ringStrength(offset, LEAD, TRAIL);
      if (power <= 0.03) continue;
      for (let row = 0; row < rows; row++) {
        const glyph = glyphFor(power, col, row, moment);
        if (!glyph) continue;
        ctx.globalAlpha = Math.min(1, 0.25 + power);
        ctx.fillStyle = power > 0.75 ? colours.accent : colours.ink;
        ctx.fillText(glyph, px, row * ch + ch / 2);
      }
    }
    ctx.globalAlpha = 1;
  };

  const run = async () => {
    try {
      const transition = start(async () => {
        document.body.append(canvas);
        update();
        await new Promise((r) => setTimeout(r, 30));
      });
      await transition.ready;
      const from = direction > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
      const reveal = root.animate(
        { clipPath: [from, "inset(0 0 0 0)"] },
        { duration: DURATION, easing: EASING, pseudoElement: "::view-transition-new(root)" },
      );
      const follow = () => {
        draw(reveal.effect?.getComputedTiming().progress ?? 0);
        if (reveal.playState === "running") requestAnimationFrame(follow);
      };
      follow();
      await transition.finished;
    } catch {
      // skipped (for instance by another click): the page has changed either way
    } finally {
      canvas.remove();
    }
  };
  void run();
}

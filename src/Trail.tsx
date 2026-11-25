import { useEffect } from "react";
import { stillness, useMotionPaused } from "./motion";
import { createOverlay } from "./overlay";
import { useSettings } from "./settings";
import { TRAIL_LIFE, TRAIL_MAX, shouldEmit, trailAlpha, trailGlyph } from "./trailLook";

interface Particle {
  x: number;
  y: number;
  born: number;
}

/** Characters that follow the mouse and fade. Only for a mouse (not touch), only when switched on, never when paused or reduced motion. */
export function Trail() {
  const { trail } = useSettings();
  const paused = useMotionPaused();
  useEffect(() => {
    if (!trail || paused || stillness()) return;
    const overlay = createOverlay();
    let particles: Particle[] = [];
    let last: { x: number; y: number } | null = null;
    let raf = 0;
    const colours = getComputedStyle(document.documentElement);

    const frame = (now: number) => {
      particles = particles.filter((p) => now - p.born < TRAIL_LIFE);
      overlay.clear();
      const ctx = overlay.ctx;
      const accent = colours.getPropertyValue("--accent").trim() || "#6f8cff";
      const muted = colours.getPropertyValue("--muted").trim() || "#8a93a8";
      for (const p of particles) {
        const age = (now - p.born) / TRAIL_LIFE;
        ctx.globalAlpha = trailAlpha(age);
        ctx.fillStyle = age < 0.3 ? accent : muted;
        ctx.fillText(trailGlyph(age), p.x, p.y);
      }
      ctx.globalAlpha = 1;
      // stop drawing when there is nothing left to draw, and start again at the next mouse move
      raf = particles.length ? requestAnimationFrame(frame) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!shouldEmit(last, e.clientX, e.clientY)) return;
      last = { x: e.clientX, y: e.clientY };
      particles.push({ x: e.clientX, y: e.clientY, born: performance.now() });
      if (particles.length > TRAIL_MAX) particles.shift();
      if (!raf) raf = requestAnimationFrame(frame);
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      overlay.destroy();
    };
  }, [trail, paused]);
  return null;
}

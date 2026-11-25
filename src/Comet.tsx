import { useEffect, useState } from "react";
import { COMET_LIFE, type Comet as CometState, cometDelay, cometHead, cometTail, isCaught, newComet } from "./cometPath";
import { stillness, useMotionPaused } from "./motion";
import { createOverlay } from "./overlay";
import { getSettings, updateSettings } from "./settings";
import { onCometSummoned } from "./sky/control";
import { readTheme } from "./theme";

const TAIL_GLYPHS = "@*+=-:.";
const BURST_LIFE = 700;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * A comet now and then, on the light theme (the dark one has the Death Star): a bright head and a tail of fading
 * characters crossing the page. Click it as it goes by to catch it. The terminal's `comet` calls one on demand.
 */
export function Comet() {
  const paused = useMotionPaused();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (paused || stillness()) return;
    const overlay = createOverlay();
    let comet: CometState | null = null;
    let sparks: { born: number; list: Spark[] } | null = null;
    let raf = 0;
    let timer = 0;
    let first = true;
    const colours = getComputedStyle(document.documentElement);

    const colour = (name: string, fallback: string) => colours.getPropertyValue(name).trim() || fallback;

    const frame = (now: number) => {
      overlay.clear();
      const ctx = overlay.ctx;
      const accent = colour("--accent", "#3249b8");
      const ink = colour("--ink", "#1d2230");
      if (comet) {
        if (now - comet.born > COMET_LIFE) comet = null;
        else {
          const head = cometHead(comet, now);
          for (const [i, p] of cometTail(comet, now).entries()) {
            ctx.globalAlpha = p.strength * 0.7;
            ctx.fillStyle = ink;
            ctx.fillText(TAIL_GLYPHS[1 + Math.floor((i / 22) * (TAIL_GLYPHS.length - 1))], p.x, p.y);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = accent;
          ctx.fillText("@", head.x, head.y);
        }
      }
      if (sparks) {
        const age = (now - sparks.born) / BURST_LIFE;
        if (age >= 1) sparks = null;
        else {
          ctx.globalAlpha = (1 - age) * 0.9;
          ctx.fillStyle = accent;
          for (const s of sparks.list) ctx.fillText(age < 0.5 ? "*" : "+", s.x + s.vx * age, s.y + s.vy * age);
          ctx.globalAlpha = 1;
        }
      }
      raf = comet || sparks ? requestAnimationFrame(frame) : 0;
    };
    const run = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const launch = () => {
      if (comet) return;
      comet = newComet(overlay.width, overlay.height, Math.random, performance.now());
      run();
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        // a regular visit: only on the light theme, only when switched on
        if (readTheme() === "light" && getSettings().comets && !document.hidden) launch();
        schedule();
      }, cometDelay(Math.random, first));
      first = false;
    };

    const onDown = (e: PointerEvent) => {
      if (!comet) return;
      const head = cometHead(comet, performance.now());
      if (!isCaught(head, e.clientX, e.clientY)) return;
      comet = null;
      sparks = {
        born: performance.now(),
        list: Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
          const speed = 60 + Math.random() * 120;
          return { x: head.x, y: head.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
        }),
      };
      const total = getSettings().cometsCaught + 1;
      updateSettings({ cometsCaught: total });
      setMessage(`Caught a comet. That is ${total}.`);
      run();
    };

    schedule();
    addEventListener("pointerdown", onDown);
    const off = onCometSummoned(launch);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      removeEventListener("pointerdown", onDown);
      off();
      overlay.destroy();
    };
  }, [paused]);

  return <p className="sr-only" aria-live="polite">{message}</p>;
}

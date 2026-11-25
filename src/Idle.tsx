import { useEffect } from "react";
import { stillness, useMotionPaused } from "./motion";
import { useSettings } from "./settings";
import { getBodyOverride, nextBody, setBodyOverride } from "./sky/control";
import { readTheme } from "./theme";

const IDLE_AFTER = 60_000; // ms of nothing before the screensaver starts
const TOUR_EVERY = 25_000; // ms on each body

/**
 * The screensaver: after a minute of nothing on the home page, the text and controls fade away, the globe drifts to
 * the middle of the screen and grows, and it tours the Earth, the Moon, Mars and Saturn. Any input brings it all back.
 */
export function Idle({ active }: { active: boolean }) {
  const { idle } = useSettings();
  const paused = useMotionPaused();
  useEffect(() => {
    if (!idle || !active || paused || stillness()) return;
    const root = document.documentElement;
    let timer = 0;
    let tour = 0;
    let started = false;
    let before: ReturnType<typeof getBodyOverride> = null;

    const stop = () => {
      if (!started) return;
      started = false;
      clearInterval(tour);
      root.removeAttribute("data-idle");
      root.style.removeProperty("--idle-shift");
      setBodyOverride(before);
    };
    const start = () => {
      // not while a dialog (the terminal, the settings) is open
      if (document.querySelector('[role="dialog"]') || document.hidden) return arm();
      started = true;
      before = getBodyOverride();
      const wrap = document.querySelector(".earth-wrap");
      if (wrap) {
        const box = wrap.getBoundingClientRect();
        root.style.setProperty("--idle-shift", `${innerWidth / 2 - (box.left + box.width / 2)}px`);
      }
      root.setAttribute("data-idle", "");
      tour = window.setInterval(
        () => setBodyOverride(nextBody(getBodyOverride() ?? (readTheme() === "light" ? "earth" : "moon"))),
        TOUR_EVERY,
      );
    };
    const arm = () => {
      clearTimeout(timer);
      timer = window.setTimeout(start, IDLE_AFTER);
    };
    const onInput = () => {
      stop();
      arm();
    };

    const events = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;
    for (const e of events) addEventListener(e, onInput, { passive: true });
    arm();
    return () => {
      for (const e of events) removeEventListener(e, onInput);
      clearTimeout(timer);
      stop();
    };
  }, [idle, active, paused]);
  return null;
}

import { useSyncExternalStore } from "react";

/**
 * Whether the visitor has paused the site's animations (the button at the bottom right of the home page). It lives
 * for the visit: moving between pages keeps it, a reload starts again.
 */
let paused = false;
const listeners = new Set<() => void>();

export const isPaused = () => paused;

export function setPaused(next: boolean) {
  if (next === paused) return;
  paused = next;
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** True while animations are paused. The server render is never paused. */
export function useMotionPaused() {
  return useSyncExternalStore(subscribe, isPaused, () => false);
}

/** True when nothing should animate: the device asks for reduced motion, or the visitor paused it. */
export const stillness = () =>
  paused || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);

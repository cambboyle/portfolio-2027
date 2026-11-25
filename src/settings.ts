import { useSyncExternalStore } from "react";

/**
 * The visitor's small preferences, kept in localStorage so they last between visits. Every setting is a gentle extra
 * (the cursor trail, the idle screensaver, the comet), all on by default, and all switched off by the pause button
 * and by reduced motion regardless.
 */
export interface Settings {
  /** Characters that follow the mouse and fade. */
  trail: boolean;
  /** After a minute of nothing, the page drifts into a screensaver. */
  idle: boolean;
  /** A comet now and then on the light theme. */
  comets: boolean;
  /** How many comets have been caught with a click. */
  cometsCaught: number;
}

export const DEFAULTS: Settings = {
  trail: true,
  idle: true,
  comets: true,
  cometsCaught: 0,
};

const KEY = "settings";

/** Reads whatever was saved, keeping only values of the right type and falling back to the defaults for the rest. */
export function parseSettings(raw: unknown): Settings {
  const out = { ...DEFAULTS };
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.trail === "boolean") out.trail = r.trail;
  if (typeof r.idle === "boolean") out.idle = r.idle;
  if (typeof r.comets === "boolean") out.comets = r.comets;
  if (
    typeof r.cometsCaught === "number" &&
    Number.isFinite(r.cometsCaught) &&
    r.cometsCaught >= 0
  ) {
    out.cometsCaught = Math.min(1e6, Math.floor(r.cometsCaught));
  }
  return out;
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  if (current) return current;
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {}
  return (current = parseSettings(raw));
}

export function updateSettings(patch: Partial<Settings>) {
  current = parseSettings({ ...getSettings(), ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The current settings. The server render always sees the defaults, so the first render matches. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}

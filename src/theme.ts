import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const EVENT = "themechange";
const query = () => matchMedia("(prefers-color-scheme: light)");

/**
 * The theme in use: the one picked with the toggle (kept on <html data-theme>, set before the page paints by
 * public/theme.js), or else the device's own setting.
 */
export function readTheme(): Theme {
  const picked = document.documentElement.dataset.theme;
  if (picked === "light" || picked === "dark") return picked;
  return query().matches ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const q = query();
  window.addEventListener(EVENT, onChange);
  q.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    q.removeEventListener("change", onChange);
  };
}

// In development there is no early script, so apply a saved choice as soon as this module loads.
if (typeof document !== "undefined" && !document.documentElement.dataset.theme) {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  } catch {}
}

/** The current theme, or null while the page is being pre-rendered (there is no device to ask). */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, readTheme, () => null);
}

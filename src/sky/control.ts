import { useSyncExternalStore } from "react";

/**
 * What the visitor has asked the globe to do from outside it (the terminal, later the Konami code and a long press).
 * The globe lives on the home page only, so these are kept here and the globe reads them when it is there.
 */
export type Body = "earth" | "moon" | "mars" | "saturn";

/** The bodies in the order they are cycled through. */
export const BODIES: readonly Body[] = ["earth", "moon", "mars", "saturn"];

/** The body after this one, wrapping round. */
export const nextBody = (current: Body): Body => BODIES[(BODIES.indexOf(current) + 1) % BODIES.length];

let override: Body | null = null;
const listeners = new Set<() => void>();

/** The body picked by hand, or null for the theme's own (the Earth on the light theme, the Moon on the dark one). */
export const getBodyOverride = () => override;

export function setBodyOverride(next: Body | null) {
  if (next === override) return;
  override = next;
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useBodyOverride() {
  return useSyncExternalStore(subscribe, getBodyOverride, () => null);
}

// a one-off request for a comet (the terminal's `comet`); the comet component listens
const cometListeners = new Set<() => void>();
export const summonComet = () => {
  for (const l of cometListeners) l();
};
export function onCometSummoned(listener: () => void) {
  cometListeners.add(listener);
  return () => {
    cometListeners.delete(listener);
  };
}

// whether the visitor has asked to see the International Space Station (the terminal's `iss`)
let tracking = false;
const trackingListeners = new Set<() => void>();
export const getIssTracking = () => tracking;
export function setIssTracking(on: boolean) {
  if (on === tracking) return;
  tracking = on;
  for (const l of trackingListeners) l();
}
export function useIssTracking() {
  return useSyncExternalStore(
    (onChange) => {
      trackingListeners.add(onChange);
      return () => {
        trackingListeners.delete(onChange);
      };
    },
    getIssTracking,
    () => false,
  );
}

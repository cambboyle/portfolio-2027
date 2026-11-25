import { useSyncExternalStore } from "react";
import { projects } from "../data/projects";
import { type Card, FLAG_CARD, cardsFor } from "./cards";
import { type Collection, type Pull, addPulls, parseCollection } from "./collection";

/** The deck (every project's card) and what this browser has pulled from packs, kept in localStorage under "cards". */
export const deck: Card[] = cardsFor(projects);

const KEY = "cards";
const EMPTY: Collection = {};
let current: Collection | null = null;
const listeners = new Set<() => void>();

export function getCollection(): Collection {
  if (current) return current;
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {}
  return (current = parseCollection(raw, [...deck.map((c) => c.slug), FLAG_CARD.slug]));
}

function save(next: Collection) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  for (const l of listeners) l();
}

export const keepPulls = (pulls: Pull[]) => save(addPulls(getCollection(), pulls));
export const resetCollection = () => save({});

export function useCollection(): Collection {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getCollection,
    () => EMPTY,
  );
}

// the terminal's `pack` asks for a pack to be opened once the cards page is showing
let packWanted = false;
export const wantPack = () => {
  packWanted = true;
};
export const takePackWish = () => {
  const was = packWanted;
  packWanted = false;
  return was;
};

import type { Card, Rarity } from "./cards";

/**
 * Opening packs and keeping what you pull. A pack has three cards, picked by rarity (common ones turn up most), and
 * each has a small chance of coming out as a foil. What you have is kept in this browser.
 */
export const PACK_SIZE = 3;
export const FOIL_CHANCE = 1 / 8;
export const WEIGHTS: Record<Rarity, number> = { common: 50, uncommon: 30, rare: 15, holo: 5 };

export interface Pull {
  slug: string;
  foil: boolean;
}

export interface Owned {
  count: number;
  foil: boolean;
}

export type Collection = Record<string, Owned>;

export function rollPack(cards: Card[], rand: () => number): Pull[] {
  const total = cards.reduce((n, c) => n + WEIGHTS[c.rarity], 0);
  return Array.from({ length: PACK_SIZE }, () => {
    let pick = rand() * total;
    const card = cards.find((c) => (pick -= WEIGHTS[c.rarity]) < 0) ?? cards[cards.length - 1];
    return { slug: card.slug, foil: rand() < FOIL_CHANCE };
  });
}

/** The collection after adding some pulls; a foil, once pulled, stays. */
export function addPulls(collection: Collection, pulls: Pull[]): Collection {
  const next: Collection = { ...collection };
  for (const p of pulls) {
    const had = next[p.slug] ?? { count: 0, foil: false };
    next[p.slug] = { count: had.count + 1, foil: had.foil || p.foil };
  }
  return next;
}

/** Reads a saved collection, keeping only entries of the right shape for cards that exist. */
export function parseCollection(raw: unknown, slugs: string[]): Collection {
  const out: Collection = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [slug, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!slugs.includes(slug) || typeof v !== "object" || v === null) continue;
    const { count, foil } = v as Record<string, unknown>;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 1) continue;
    out[slug] = { count: Math.min(9999, Math.floor(count)), foil: foil === true };
  }
  return out;
}

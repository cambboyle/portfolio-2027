import type { Project } from "../data/projects";

/**
 * My projects as collectable cards. Everything on a card comes from the project's own data (src/data/projects.ts):
 * the type from its stack, the "attacks" from the choices in its case study, the rarity from how finished it is. The
 * numbers are made from the project's name, so a card is the same on every visit and in the prerendered page.
 */
export type Rarity = "common" | "uncommon" | "rare" | "holo";
export type CardType = "gopher" | "script" | "cloud" | "shell" | "data" | "plain";

export interface Attack {
  name: string;
  text: string;
  power: number;
}

export interface Card {
  slug: string;
  name: string;
  type: CardType;
  hp: number;
  attacks: Attack[];
  rarity: Rarity;
  /** A line under the attacks, from the project's blurb. */
  flavour: string;
  /** e.g. "02/04". */
  number: string;
  stack: string;
}

export const TYPE_NAMES: Record<CardType, string> = {
  gopher: "Gopher",
  script: "Script",
  cloud: "Cloud",
  shell: "Shell",
  data: "Data",
  plain: "Plain",
};

/** A small mark for each type, in characters like everything else. */
export const TYPE_MARKS: Record<CardType, string> = {
  gopher: "~",
  script: "{}",
  cloud: "^^",
  shell: "$",
  data: "#",
  plain: "*",
};

/** A fixed whole number for a string (FNV-1a), so the same project always gets the same numbers. */
export function hashText(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The card's type, from the first thing in its stack that has one. */
export function typeOf(stack: string): CardType {
  const s = stack.toLowerCase();
  if (/\bgo\b/.test(s)) return "gopher";
  if (/react|typescript|javascript|node|vite/.test(s)) return "script";
  if (/aws|cloud|lambda/.test(s)) return "cloud";
  if (/linux|bash|shell/.test(s)) return "shell";
  if (/sql|postgres|database/.test(s)) return "data";
  return "plain";
}

/** Cuts text at the end of its first sentence, or at a word before `max` characters with an ellipsis. */
export function firstSentence(text: string, max: number) {
  const sentence = text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text.trim();
  if (sentence.length <= max) return sentence;
  return sentence.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function rarityOf(p: Project): Rarity {
  if (!p.study) return "common";
  if (p.live && p.docs) return "holo";
  if (p.live || p.docs) return "rare";
  return "uncommon";
}

export function cardFor(p: Project, index: number, total: number): Card {
  const h = hashText(p.slug);
  const attacks: Attack[] = p.study
    ? p.study.choices.slice(0, 2).map((c, i) => ({
        name: c.title,
        text: firstSentence(c.body, 90),
        power: 20 + (hashText(`${p.slug}:${i}`) % 8) * 10,
      }))
    : [{ name: "Overview", text: firstSentence(p.blurb, 90), power: 30 }];
  const width = String(total).length < 2 ? 2 : String(total).length;
  return {
    slug: p.slug,
    name: p.name,
    type: typeOf(p.stack),
    hp: 40 + (h % 12) * 10,
    attacks,
    rarity: rarityOf(p),
    flavour: firstSentence(p.blurb, 110),
    number: `${String(index + 1).padStart(width, "0")}/${String(total).padStart(width, "0")}`,
    stack: p.stack,
  };
}

/** The card for solving the console puzzle (src/flag.ts). It is not in packs; it only comes from unlock. */
export const FLAG_CARD: Card = {
  slug: "flag",
  name: "No Moon",
  type: "plain",
  hp: 250,
  attacks: [
    { name: "Superlaser", text: "Fires once a day, slowly, and only from the dish.", power: 200 },
    { name: "Trench run", text: "A known weakness, two metres wide.", power: 0 },
  ],
  rarity: "holo",
  flavour: "Found in the console. It's a space station.",
  number: "??/??",
  stack: "a console, rot13 and base64",
};

export const cardsFor = (projects: Project[]) => projects.map((p, i) => cardFor(p, i, projects.length));

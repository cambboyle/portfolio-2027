import { expect, test } from "bun:test";
import { projects } from "../src/data/projects";
import { backArt, cardArt } from "../src/cards/art";
import { cardFor, cardsFor, firstSentence, rarityOf, typeOf } from "../src/cards/cards";
import { FOIL_CHANCE, PACK_SIZE, addPulls, parseCollection, rollPack } from "../src/cards/collection";

const cards = cardsFor(projects);

/** A seeded random source, so a test always sees the same packs. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("every project becomes a card, the same each time, with sensible numbers", () => {
  expect(cards.length).toBe(projects.length);
  expect(cardsFor(projects)).toEqual(cards);
  for (const c of cards) {
    expect(c.hp).toBeGreaterThanOrEqual(40);
    expect(c.hp).toBeLessThanOrEqual(150);
    expect(c.hp % 10).toBe(0);
    expect(c.attacks.length).toBeGreaterThanOrEqual(1);
    expect(c.attacks.length).toBeLessThanOrEqual(2);
    for (const a of c.attacks) {
      expect(a.text.length).toBeLessThanOrEqual(90);
      expect(a.power).toBeGreaterThanOrEqual(20);
    }
    expect(c.flavour.length).toBeLessThanOrEqual(110);
  }
  expect(cards[0].number).toBe(`01/${String(projects.length).padStart(2, "0")}`);
});

test("types come from the stack and rarity from how finished the project is", () => {
  expect(typeOf("Go, Raspberry Pi")).toBe("gopher");
  expect(typeOf("React, TypeScript, NestJS")).toBe("script");
  expect(typeOf("AWS")).toBe("cloud");
  expect(typeOf("Postgres")).toBe("data");
  expect(typeOf("Lego")).toBe("plain"); // "go" inside another word is not Go
  const base = { slug: "x", name: "X", blurb: "A thing.", stack: "Go" };
  const study = { problem: ["p"], choices: [{ title: "t", body: "b." }], result: ["r"] };
  expect(rarityOf(base)).toBe("common");
  expect(rarityOf({ ...base, study })).toBe("uncommon");
  expect(rarityOf({ ...base, study, live: "https://x" })).toBe("rare");
  expect(rarityOf({ ...base, study, live: "https://x", docs: "https://y" })).toBe("holo");
  // a project without a case study still gets one attack, from its blurb
  expect(cardFor(base, 0, 1).attacks).toEqual([{ name: "Overview", text: "A thing.", power: 30 }]);
});

test("first sentences are cut cleanly", () => {
  expect(firstSentence("One. Two.", 50)).toBe("One.");
  expect(firstSentence("No full stop here", 50)).toBe("No full stop here");
  expect(firstSentence("A very long sentence that keeps going and going.", 20)).toBe("A very long…");
});

test("the art is the right size, the same for the same card, and different between cards", () => {
  const a = cardArt("CamDex");
  expect(a.length).toBe(8);
  expect(a.every((l) => l.length === 24)).toBe(true);
  expect(cardArt("CamDex")).toEqual(a);
  expect(cardArt("Crate")).not.toEqual(a);
  const back = backArt();
  expect(back.length).toBe(16);
  expect(back.every((l) => l.length === 24)).toBe(true);
});

test("a pack is three cards that exist, common ones turn up most, and some are foils", () => {
  const rand = seeded(42);
  const seen: Record<string, number> = {};
  let foils = 0;
  const packs = 3000;
  for (let i = 0; i < packs; i++) {
    const pack = rollPack(cards, rand);
    expect(pack.length).toBe(PACK_SIZE);
    for (const p of pack) {
      expect(cards.some((c) => c.slug === p.slug)).toBe(true);
      seen[p.slug] = (seen[p.slug] ?? 0) + 1;
      if (p.foil) foils++;
    }
  }
  // every card can be pulled
  expect(Object.keys(seen).length).toBe(cards.length);
  // about one in eight is a foil
  expect(foils / (packs * PACK_SIZE)).toBeGreaterThan(FOIL_CHANCE * 0.8);
  expect(foils / (packs * PACK_SIZE)).toBeLessThan(FOIL_CHANCE * 1.2);
  // a common card turns up more often than a rarer one
  const common = cards.find((c) => c.rarity === "common");
  const rarer = cards.find((c) => c.rarity !== "common");
  if (common && rarer) expect(seen[common.slug]).toBeGreaterThan(seen[rarer.slug]);
});

test("pulls add up in the collection, and a foil stays once pulled", () => {
  let c = addPulls({}, [{ slug: "camdex", foil: false }, { slug: "camdex", foil: true }]);
  expect(c.camdex).toEqual({ count: 2, foil: true });
  c = addPulls(c, [{ slug: "camdex", foil: false }]);
  expect(c.camdex).toEqual({ count: 3, foil: true });
});

test("a saved collection is read carefully", () => {
  const slugs = ["camdex", "crate"];
  expect(parseCollection(null, slugs)).toEqual({});
  expect(parseCollection({ camdex: { count: 2, foil: true }, crate: { count: 1 } }, slugs)).toEqual({
    camdex: { count: 2, foil: true },
    crate: { count: 1, foil: false },
  });
  expect(parseCollection({ gone: { count: 1, foil: true } }, slugs)).toEqual({}); // a card that no longer exists
  expect(parseCollection({ camdex: { count: 0 } }, slugs)).toEqual({});
  expect(parseCollection({ camdex: { count: "5" } }, slugs)).toEqual({});
  expect(parseCollection({ camdex: { count: 2.7, foil: "yes" } }, slugs)).toEqual({ camdex: { count: 2, foil: false } });
});

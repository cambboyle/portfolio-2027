import { expect, test } from "bun:test";
import { CLUE, checkFlag, normaliseGuess } from "../src/flag";

const rot13 = (s: string) =>
  s.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + ((c.charCodeAt(0) - base + 13) % 26));
  });

test("the clue decodes to the answer, and the answer unlocks", async () => {
  const answer = rot13(atob(CLUE));
  expect(await checkFlag(answer)).toBe(true);
});

test("punctuation, case and spacing do not matter, but the words do", async () => {
  expect(normaliseGuess("  That's   NO moon! ")).toBe("thats no moon");
  expect(await checkFlag("THATS NO MOON")).toBe(true);
  expect(await checkFlag("that's a moon")).toBe(false);
  expect(await checkFlag("")).toBe(false);
});

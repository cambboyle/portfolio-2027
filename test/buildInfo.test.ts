import { expect, test } from "bun:test";
import { footerLine } from "../src/buildInfo";

test("the footer line reads naturally, and leaves out what it does not know", () => {
  expect(footerLine({ date: "2026-11-25", sha: "b3a3675", commits: 152 })).toBe("built 25 nov 2026 · b3a3675 · 152 commits · audited on every push");
  expect(footerLine({ date: "2026-01-03", sha: null, commits: null })).toBe("built 3 jan 2026 · audited on every push");
  expect(footerLine(null)).toBe("a development build · audited on every push");
});

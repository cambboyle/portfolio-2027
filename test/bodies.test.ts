import { expect, test } from "bun:test";
import { KONAMI_LENGTH, konamiStep } from "../src/konami";
import { BODIES, nextBody } from "../src/sky/control";

test("the bodies cycle earth, moon, mars, saturn and back again", () => {
  expect(BODIES).toEqual(["earth", "moon", "mars", "saturn"]);
  expect(nextBody("earth")).toBe("moon");
  expect(nextBody("moon")).toBe("mars");
  expect(nextBody("mars")).toBe("saturn");
  expect(nextBody("saturn")).toBe("earth");
});

const type = (keys: string[]) => keys.reduce((progress, k) => konamiStep(progress, k), 0);
const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

test("the Konami code completes only when typed in full and in order", () => {
  expect(type(CODE)).toBe(KONAMI_LENGTH);
  expect(type(CODE.slice(0, 9))).toBe(9);
  expect(type(["ArrowUp", "ArrowUp", "ArrowLeft"])).toBe(0);
  // case does not matter for the letters
  expect(type([...CODE.slice(0, 8), "B", "A"])).toBe(KONAMI_LENGTH);
  // a slip starts again; extra Up arrows at the start do not stop the code from working
  expect(type(["ArrowUp", "ArrowUp", "ArrowLeft"])).toBe(0);
  expect(type(["ArrowUp", ...CODE])).toBe(KONAMI_LENGTH);
  expect(type(["ArrowUp", "ArrowUp", "ArrowUp", ...CODE.slice(2)])).toBe(KONAMI_LENGTH);
  expect(type(["x", ...CODE])).toBe(KONAMI_LENGTH);
});

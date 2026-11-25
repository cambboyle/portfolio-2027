import { expect, test } from "bun:test";
import { DEFAULTS, parseSettings } from "../src/settings";

test("settings fall back to the defaults for anything missing or the wrong type", () => {
  expect(parseSettings(null)).toEqual(DEFAULTS);
  expect(parseSettings("nope")).toEqual(DEFAULTS);
  expect(parseSettings({ trail: "yes", idle: 1, comets: null, cometsCaught: "3" })).toEqual(DEFAULTS);
});

test("settings keep valid values and ignore unknown ones", () => {
  expect(parseSettings({ trail: false, idle: false, comets: true, cometsCaught: 4, extra: 1 })).toEqual({
    trail: false,
    idle: false,
    comets: true,
    cometsCaught: 4,
  });
});

test("the comet count is a sensible whole number", () => {
  expect(parseSettings({ cometsCaught: -2 }).cometsCaught).toBe(0);
  expect(parseSettings({ cometsCaught: 2.9 }).cometsCaught).toBe(2);
  expect(parseSettings({ cometsCaught: Infinity }).cometsCaught).toBe(0);
  expect(parseSettings({ cometsCaught: 1e12 }).cometsCaught).toBe(1e6);
});

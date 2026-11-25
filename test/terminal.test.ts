import { expect, test } from "bun:test";
import { DEFAULTS } from "../src/settings";
import { complete, parse, resolvePage, run, when, type Env } from "../src/terminal/commands";

const env = (over: Partial<Env> = {}): Env => ({
  now: new Date("2025-11-05T13:19:00Z"),
  path: "/",
  theme: "dark",
  paused: false,
  settings: DEFAULTS,
  body: null,
  iss: false,
  ...over,
});

test("parse splits the name from the arguments and ignores case and spacing", () => {
  expect(parse("  CD   projects ")).toEqual({ name: "cd", args: ["projects"] });
  expect(parse("")).toEqual({ name: "", args: [] });
});

test("unknown commands say so, and the secret ones are not in help", () => {
  expect(run("frobnicate", env()).lines[0]).toContain("command not found");
  expect(run("sudo make me a sandwich", env()).lines[0]).toContain("sudoers");
  expect(run("help", env()).lines.join("\n")).not.toContain("sudo");
});

test("cd finds real pages only, relative or absolute, and closes the terminal", () => {
  expect(resolvePage("projects", "/")).toBe("/projects");
  expect(resolvePage("about", "/projects")).toBe("/about");
  expect(resolvePage("nowhere", "/")).toBeNull();
  expect(resolvePage("..", "/projects/camdex")).toBe("/projects");
  expect(resolvePage("..", "/projects")).toBe("/");
  expect(resolvePage("~", "/about")).toBe("/");
  const r = run("cd about", env());
  expect(r.actions).toEqual([{ type: "navigate", to: "/about" }, { type: "close" }]);
  expect(run("cd nowhere", env()).actions).toBeUndefined();
});

test("ls lists what is on the page you are on", () => {
  const top = run("ls", env()).lines[0];
  expect(top).toContain("projects/");
  expect(top).toContain("about");
  expect(run("ls", env({ path: "/projects" })).lines[0]).toContain("camdex");
  expect(run("ls nowhere", env()).lines[0]).toContain("no such page");
});

test("theme, pause and the switches turn into actions", () => {
  expect(run("theme light", env()).actions).toEqual([{ type: "theme", theme: "light" }]);
  expect(run("theme toggle", env()).actions).toEqual([{ type: "theme", theme: "light" }]);
  expect(run("theme dark", env()).actions).toBeUndefined();
  expect(run("theme blue", env()).lines[0]).toContain("unknown theme");
  expect(run("pause", env()).actions).toEqual([{ type: "pause", paused: true }]);
  expect(run("pause", env({ paused: true })).actions).toBeUndefined();
  expect(run("resume", env({ paused: true })).actions).toEqual([{ type: "pause", paused: false }]);
  expect(run("trail off", env()).actions).toEqual([{ type: "settings", patch: { trail: false } }]);
  expect(run("trail maybe", env()).actions).toBeUndefined();
  expect(run("comets", env({ settings: { ...DEFAULTS, comets: false } })).lines[0]).toContain("off");
});

test("body goes to the home page first, since that is where the globe is", () => {
  expect(run("body earth", env()).actions).toEqual([{ type: "body", body: "earth" }]);
  expect(run("body moon", env({ path: "/about" })).actions).toEqual([
    { type: "navigate", to: "/" },
    { type: "body", body: "moon" },
  ]);
  expect(run("body reset", env()).actions).toEqual([{ type: "body", body: null }]);
  expect(run("body saturn", env()).actions).toEqual([{ type: "body", body: "saturn" }]);
  // cycle goes round earth, moon, mars, saturn from whatever is showing (the dark theme's own is the Moon)
  expect(run("body cycle", env()).actions).toEqual([{ type: "body", body: "mars" }]);
  expect(run("body cycle", env({ theme: "light" })).actions).toEqual([{ type: "body", body: "moon" }]);
  expect(run("body cycle", env({ body: "saturn" })).actions).toEqual([{ type: "body", body: "earth" }]);
  expect(run("body pluto", env()).lines[0]).toContain("unknown body");
});

test("comet calls one and closes the terminal so it can be seen", () => {
  expect(run("comet", env()).actions).toEqual([{ type: "comet" }, { type: "close" }]);
});

test("iss asks first, in plain words, and only does anything when it is told to", () => {
  const r = run("iss", env());
  expect(r.lines.join(" ")).toContain("IP address");
  expect(r.actions).toContainEqual({ type: "iss", on: true });
  expect(r.actions).toContainEqual({ type: "body", body: "earth" });
  expect(run("iss", env({ path: "/about" })).actions?.[0]).toEqual({ type: "navigate", to: "/" });
  expect(run("iss off", env({ iss: true })).actions).toEqual([{ type: "iss", on: false }]);
  expect(run("iss off", env()).actions).toBeUndefined();
  expect(run("iss now", env()).actions).toBeUndefined();
});

test("phase reports the Moon and the next full and new moons", () => {
  const lines = run("phase", env()).lines;
  expect(lines[0]).toContain("full moon");
  expect(lines[1]).toContain("next full moon:");
  expect(lines[1]).toContain("UTC");
  expect(lines[2]).toContain("next new moon:");
  expect(when(new Date("2026-11-24T14:53:00Z"))).toBe("tue 24 nov 2026, 14:53 UTC");
});

test("tab completes names and arguments", () => {
  const e = env();
  expect(complete("ne", e)).toBe("neofetch ");
  expect(complete("th", e)).toBe("theme ");
  expect(complete("theme l", e)).toBe("theme light");
  expect(complete("cd pro", e)).toBe("cd projects");
  expect(complete("p", e)).toBe("p"); // pause, phase and ping are all possible; nothing in common beyond "p"
  expect(complete("zzz", e)).toBe("zzz");
});

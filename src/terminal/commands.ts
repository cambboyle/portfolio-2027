import { posts } from "../data/posts";
import { projects } from "../data/projects";
import { routes } from "../meta";
import type { Settings } from "../settings";
import { moonPhase, nextPhase } from "../sky/moonPhase";
import { type Body, nextBody } from "../sky/control";
import type { Theme } from "../theme";

/**
 * The terminal's commands, as plain functions: they are given what the page looks like now (`Env`) and return lines
 * to print and, if the command changes anything, actions for the terminal to carry out. Nothing here touches the page,
 * so it can all be tested.
 */

export type Action =
  | { type: "navigate"; to: string }
  | { type: "theme"; theme: Theme }
  | { type: "pause"; paused: boolean }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "body"; body: Body | null }
  | { type: "comet" }
  | { type: "iss"; on: boolean }
  | { type: "clear" }
  | { type: "close" };

export interface Env {
  now: Date;
  /** The page being shown, e.g. "/projects/camdex". */
  path: string;
  theme: Theme;
  paused: boolean;
  settings: Settings;
  /** The body picked by hand for the globe, if any. */
  body: Body | null;
  /** Whether the space station is being shown. */
  iss: boolean;
}

export interface Result {
  lines: string[];
  actions?: Action[];
}

interface Command {
  name: string;
  help: string;
  run(args: string[], env: Env): Result;
  /** Words that can follow the command, for Tab completion. */
  args?: (env: Env) => string[];
}

const say = (...lines: string[]): Result => ({ lines });

export function parse(input: string) {
  const [name = "", ...args] = input.trim().split(/\s+/).filter(Boolean);
  return { name: name.toLowerCase(), args };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const pad = (n: number) => String(n).padStart(2, "0");
/** e.g. "tue 24 nov 2026, 14:53 UTC": the same wherever the visitor is. */
export const when = (d: Date) =>
  `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;

/** The pages inside a folder: "/" holds projects, notes and about; "/projects" holds each project's page. */
function listing(dir: string): string[] {
  const prefix = dir === "/" ? "/" : dir + "/";
  const names = new Set<string>();
  for (const r of routes) {
    if (r === dir || !r.startsWith(prefix)) continue;
    const [first, ...rest] = r.slice(prefix.length).split("/");
    names.add(rest.length ? first + "/" : first);
  }
  // the folders of the site hold pages even when only the folder itself is a page
  return [...names].map((n) => (dir === "/" && (n === "projects" || n === "notes") ? n + "/" : n)).sort();
}

/** Turns what was typed after `cd` into the path of a page, or null if there is no such page. */
export function resolvePage(arg: string, from: string): string | null {
  const a = arg.replace(/\/+$/, "");
  if (a === "" || a === "~" || a === "/" || a === "home") return "/";
  if (a === "..") return from.includes("/") && from !== "/" ? from.slice(0, from.lastIndexOf("/")) || "/" : "/";
  const clean = a.replace(/^~?\//, "");
  const candidates = [`/${clean}`];
  if (from !== "/") candidates.unshift(`${from}/${clean}`);
  return candidates.find((c) => routes.includes(c)) ?? null;
}

const THEME_NAMES = ["light", "dark", "toggle"];
const BODY_NAMES = ["earth", "moon", "mars", "saturn", "cycle", "reset"];

const commands: Command[] = [
  {
    name: "help",
    help: "list the commands",
    run: () =>
      say("commands:", ...commands.filter((c) => c.name !== "help").map((c) => `  ${c.name.padEnd(9)} ${c.help}`), "", "tab completes, ↑ ↓ recalls, esc closes"),
  },
  {
    name: "whoami",
    help: "who is this",
    run: () =>
      say(
        "Cameron Boyle",
        "full stack developer from Newport, building at Novira Technologies.",
        "learning Go, AWS and security.",
        "“Fall seven times, stand up eight.”",
      ),
  },
  {
    name: "ls",
    help: "list the pages here",
    run: (args, env) => {
      const dir = args[0] ? resolvePage(args[0], env.path) : env.path;
      if (!dir) return say(`ls: no such page: ${args[0]}`);
      const items = listing(dir);
      return say(items.length ? items.join("  ") : "(nothing inside; try cd ..)");
    },
    args: () => ["projects", "notes"],
  },
  {
    name: "cd",
    help: "go to a page: cd projects, cd .., cd ~",
    run: (args, env) => {
      const to = resolvePage(args[0] ?? "", env.path);
      if (!to) return say(`cd: no such page: ${args[0]}`);
      return { lines: [], actions: [{ type: "navigate", to }, { type: "close" }] };
    },
    args: (env) => {
      const names = new Set<string>(["~", ".."]);
      for (const dir of ["/", env.path]) for (const n of listing(dir)) names.add(n.replace(/\/$/, ""));
      for (const r of routes) names.add(r.slice(1));
      names.delete("");
      return [...names];
    },
  },
  {
    name: "theme",
    help: "light, dark or toggle",
    run: (args, env) => {
      const want = args[0];
      if (!want) return say(`${env.theme} (${env.theme === "dark" ? "the Moon" : "the Earth"}); try theme light | dark | toggle`);
      const next = want === "toggle" ? (env.theme === "dark" ? "light" : "dark") : want;
      if (next !== "light" && next !== "dark") return say(`theme: unknown theme: ${want}`);
      if (next === env.theme) return say(`already ${next}`);
      return { lines: [`switching to ${next}`], actions: [{ type: "theme", theme: next }] };
    },
    args: () => THEME_NAMES,
  },
  {
    name: "pause",
    help: "stop the animations",
    run: (_, env) =>
      env.paused ? say("already paused; resume carries on") : { lines: ["paused"], actions: [{ type: "pause", paused: true }] },
  },
  {
    name: "resume",
    help: "carry on",
    run: (_, env) =>
      env.paused ? { lines: ["carrying on"], actions: [{ type: "pause", paused: false }] } : say("nothing is paused"),
  },
  {
    name: "body",
    help: "what the globe shows: body earth | moon | mars | saturn | cycle | reset",
    run: (args, env) => {
      const want = args[0];
      const own = env.theme === "light" ? "earth" : "moon";
      if (!want) return say(`showing the ${env.body ?? own}${env.body ? "" : " (the theme's own)"}; try body earth | moon | mars | saturn | cycle | reset`);
      if (!BODY_NAMES.includes(want)) return say(`body: unknown body: ${want}`);
      const body = want === "reset" ? null : want === "cycle" ? nextBody(env.body ?? own) : (want as Body);
      const home = env.path === "/" ? [] : [{ type: "navigate", to: "/" } as Action];
      return { lines: [body ? `now showing the ${body}` : `back to the ${own}`], actions: [...home, { type: "body", body }] };
    },
    args: () => BODY_NAMES,
  },
  {
    name: "phase",
    help: "the Moon tonight",
    run: (_, env) => {
      const p = moonPhase(env.now);
      return say(
        `${p.name}, ${Math.round(p.illumination * 100)}% lit, ${p.age.toFixed(1)} days old`,
        `next full moon: ${when(nextPhase(env.now, Math.PI))}`,
        `next new moon:  ${when(nextPhase(env.now, 0))}`,
      );
    },
  },
  ...(["trail", "idle", "comets"] as const).map(
    (key): Command => ({
      name: key,
      help: { trail: "cursor trail on | off", idle: "screensaver on | off", comets: "comets on | off" }[key],
      run: (args, env) => {
        const want = args[0];
        if (!want) return say(`${key} is ${env.settings[key] ? "on" : "off"}; try ${key} on | off`);
        if (want !== "on" && want !== "off") return say(`${key}: say on or off`);
        return { lines: [`${key} ${want}`], actions: [{ type: "settings", patch: { [key]: want === "on" } }] };
      },
      args: () => ["on", "off"],
    }),
  ),
  {
    name: "stats",
    help: "the numbers",
    run: (_, env) =>
      say(
        `projects:      ${projects.length} (${projects.filter((p) => p.study).length} with a case study)`,
        `notes:         ${posts.length}`,
        `comets caught: ${env.settings.cometsCaught}`,
      ),
  },
  {
    name: "neofetch",
    help: "this machine",
    run: (_, env) => {
      const p = moonPhase(env.now);
      const art = ["    ,-'''-.   ", "  ,'  . .  `. ", " /  .  ;;  . \\", " |  ;;;;;;   |", " \\   ;;;  .  /", "  `.  .   ,'  ", "    `-...-'   "];
      const info = [
        "cam@portfolio",
        "-------------",
        "site:   a portfolio, in characters",
        `theme:  ${env.theme}`,
        `moon:   ${p.name}, ${Math.round(p.illumination * 100)}% lit`,
        "built:  bun, react, no frameworks",
        "fonts:  JetBrains Mono",
      ];
      return say(...Array.from({ length: Math.max(art.length, info.length) }, (_, i) => `${(art[i] ?? "").padEnd(16)}${info[i] ?? ""}`));
    },
  },
  { name: "comet", help: "call a comet (click it as it passes)", run: () => ({ lines: ["there it goes"], actions: [{ type: "comet" }, { type: "close" }] }) },
  {
    name: "iss",
    help: "show the space station on the Earth (asks api.wheretheiss.at); iss off stops",
    run: (args, env) => {
      if (args[0] === "off") return env.iss ? { lines: ["stopped asking"], actions: [{ type: "iss", on: false }] } : say("not tracking it");
      if (args[0]) return say("iss: try iss or iss off");
      const home = env.path === "/" ? [] : [{ type: "navigate", to: "/" } as Action];
      return {
        lines: [
          "looking for the space station: this asks api.wheretheiss.at every few seconds,",
          "which sees your IP address like any website would. `iss off` stops it.",
        ],
        actions: [...home, { type: "body", body: "earth" }, { type: "iss", on: true }, { type: "close" }],
      };
    },
    args: () => ["off"],
  },
  { name: "date", help: "the time, in UTC", run: (_, env) => say(when(env.now)) },
  { name: "echo", help: "say it back", run: (args) => say(args.join(" ")) },
  { name: "clear", help: "empty the screen", run: () => ({ lines: [], actions: [{ type: "clear" }] }) },
  { name: "exit", help: "close the terminal", run: () => ({ lines: [], actions: [{ type: "close" }] }) },
];

// a few that are not in help
const jokes: Record<string, (args: string[]) => Result> = {
  sudo: () => say("cam is not in the sudoers file. this incident will be reported."),
  rm: () => say("rm: permission denied. (the Death Star is gone enough.)"),
  hello: () => say("hello."),
  hi: () => say("hello."),
  vim: () => say("you can leave any time you like. :q"),
  ping: () => say("pong"),
};

export function run(input: string, env: Env): Result {
  const { name, args } = parse(input);
  if (!name) return say();
  const command = commands.find((c) => c.name === name);
  if (command) return command.run(args, env);
  if (jokes[name]) return jokes[name](args);
  return say(`${name}: command not found. try help`);
}

const longestCommon = (words: string[]) =>
  words.reduce((prefix, w) => {
    let i = 0;
    while (i < prefix.length && i < w.length && prefix[i] === w[i]) i++;
    return prefix.slice(0, i);
  });

/** Tab completion: finishes the command name, or the word after it, as far as it can be done unambiguously. */
export function complete(input: string, env: Env): string {
  const trailingSpace = /\s$/.test(input);
  const parts = input.trimStart().split(/\s+/);
  if (parts.length === 1 && !trailingSpace) {
    const matches = commands.map((c) => c.name).filter((n) => n.startsWith(parts[0].toLowerCase()));
    if (!matches.length) return input;
    const done = longestCommon(matches);
    return matches.length === 1 ? done + " " : done;
  }
  const command = commands.find((c) => c.name === parts[0].toLowerCase());
  const options = command?.args?.(env);
  if (!options) return input;
  const word = trailingSpace ? "" : parts[parts.length - 1];
  const matches = options.filter((o) => o.startsWith(word));
  if (!matches.length) return input;
  const done = longestCommon(matches);
  const head = parts.slice(0, trailingSpace ? parts.length : -1).join(" ");
  return `${head} ${done}${matches.length === 1 ? "" : ""}`;
}

export const commandNames = () => commands.map((c) => c.name);

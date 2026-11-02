/**
 * Checks the built site the way a visitor and a search engine would, and fails if it slips.
 *
 *   bun run audit        (builds first, then serves dist/ and checks it)
 *
 * 1. Lighthouse on two pages, phone and desktop: performance, accessibility, best practices and SEO scores
 *    (a low speed score is re-measured and the median of three runs counts, because single runs vary).
 * 2. A real browser, driven through the DevTools Protocol: keyboard order, focus after moving between pages,
 *    nothing scrolling sideways on small screens, no console errors, tap targets big enough.
 *
 * Needs Chrome. Set CHROME_PATH if it is not in the usual place.
 */
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";

const PORT = Number(process.env.AUDIT_PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync) ??
  "google-chrome";

/** Lowest score allowed, out of 100. Performance has a little room because timings vary from run to run. */
const MIN = { performance: 95, accessibility: 100, "best-practices": 100, seo: 100 } as const;
const PAGES = ["/", "/projects/camdex"];

const problems: string[] = [];
const fail = (msg: string) => {
  problems.push(msg);
  console.log(`  FAIL ${msg}`);
};
const pass = (msg: string) => console.log(`  ok   ${msg}`);

// ---- serve dist/ -----------------------------------------------------------------------------------------------
const server = Bun.spawn(["bun", "scripts/preview.ts"], { env: { ...process.env, PORT: String(PORT) }, stdout: "ignore", stderr: "inherit" });
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  if (i > 50) throw new Error("the preview server did not start");
  await Bun.sleep(100);
}

// ---- 1. Lighthouse ---------------------------------------------------------------------------------------------
async function lighthouse(path: string, form: "mobile" | "desktop") {
  const out = `${tmpdir()}/audit-lh-${process.pid}.json`;
  const args = [
    "lighthouse@13", `${BASE}${path}`, "--quiet", "--output=json", `--output-path=${out}`,
    `--only-categories=${Object.keys(MIN).join(",")}`,
    `--chrome-flags=--headless=new --no-sandbox`,
    ...(form === "desktop" ? ["--preset=desktop"] : []),
  ];
  const proc = Bun.spawn(["bunx", ...args], { env: { ...process.env, CHROME_PATH: CHROME }, stdout: "ignore", stderr: "ignore" });
  await proc.exited;
  const report = await Bun.file(out).json();
  return Object.fromEntries(Object.entries(report.categories).map(([k, v]: [string, any]) => [k, Math.round(v.score * 100)])) as Record<string, number>;
}

console.log("Lighthouse");
for (const path of PAGES) {
  for (const form of ["mobile", "desktop"] as const) {
    let scores = await lighthouse(path, form);
    // The speed score is simulated from one recorded load and now and then an odd run scores much lower (about
    // one in eight). So when it looks low, take two more runs and keep the middle one of the three.
    if (scores.performance < MIN.performance) {
      const runs = [scores, await lighthouse(path, form), await lighthouse(path, form)].sort((a, b) => a.performance - b.performance);
      scores = runs[1];
    }
    const low = Object.entries(MIN).filter(([k, min]) => scores[k] < min);
    const summary = Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(", ");
    if (low.length) fail(`${path} (${form}): ${summary}`);
    else pass(`${path} (${form}): ${summary}`);
  }
}

// ---- 2. A real browser -----------------------------------------------------------------------------------------
console.log("Browser checks");
const port = 9444;
const chrome = Bun.spawn([CHROME, "--headless=new", "--no-sandbox", `--remote-debugging-port=${port}`, `--user-data-dir=${tmpdir()}/audit-chrome-${process.pid}`, "about:blank"], {
  stdout: "ignore",
  stderr: "ignore",
});
try {
  let target: any;
  for (let i = 0; !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t: any) => t.type === "page");
    } catch {}
    if (!target) {
      if (i > 50) throw new Error("Chrome did not start");
      await Bun.sleep(100);
    }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r as any));
  let id = 0;
  const pending = new Map<number, (r: any) => void>();
  const consoleErrors: string[] = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data as string);
    if (m.id && pending.has(m.id)) pending.get(m.id)!(m.result);
    if (m.method === "Runtime.exceptionThrown") consoleErrors.push(String(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    // the browser itself reports blocked files and security-policy violations here
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") consoleErrors.push(`${m.params.entry.text} ${m.params.entry.url ?? ""}`);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(m.params.args.map((a: any) => a.value ?? a.description).join(" "));
  };
  const call = (method: string, params: any = {}) =>
    new Promise<any>((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expression: string) => (await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const press = async (key: string, code: string, vk: number) => {
    for (const type of ["keyDown", "keyUp"]) await call("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk });
  };
  const open = async (path: string, width = 1280, height = 800) => {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 900 });
    await call("Page.navigate", { url: `${BASE}${path}` });
    await Bun.sleep(1200);
  };
  await call("Runtime.enable");
  await call("Log.enable");
  await call("Page.enable");

  // the security headers are sent, and the hashed files are cached for a year
  {
    const home = await fetch(`${BASE}/`);
    const csp = home.headers.get("content-security-policy") ?? "";
    csp.includes("default-src 'self'") && home.headers.get("x-content-type-options") === "nosniff"
      ? pass("security headers are sent")
      : fail("security headers are missing from the home page");
    const js = (await home.text()).match(/src="(\/chunk-[^"]+\.js)"/)?.[1];
    const cache = js ? (await fetch(`${BASE}${js}`)).headers.get("cache-control") : null;
    cache?.includes("immutable") ? pass("the bundle is cached for a year") : fail(`the bundle's Cache-Control is "${cache}"`);
  }

  // keyboard: the first stop is the skip link, then the nav in order
  await open("/");
  await press("Tab", "Tab", 9);
  const first = await ev("document.activeElement.textContent.trim()");
  first === "Skip to content" ? pass("first Tab stop is the skip link") : fail(`first Tab stop was "${first}", not the skip link`);
  const stops: string[] = [];
  for (let i = 0; i < 6; i++) {
    await press("Tab", "Tab", 9);
    stops.push(await ev("document.activeElement.textContent.trim().replace(/ \\(opens in a new tab\\)/, '')"));
  }
  const order = stops.join(",");
  order === "home,projects,notes,about,github,linkedin" ? pass("nav is reachable in order") : fail(`nav order was ${order}`);
  const outline = await ev("getComputedStyle(document.activeElement).outlineStyle");
  outline !== "none" ? pass("focused link has a visible outline") : fail("focused link has no outline");

  // moving between pages: the title changes, focus goes to the page, the nav marks the current page
  await ev("document.querySelector('nav a[href=\"/projects\"]').click()");
  await Bun.sleep(300);
  const after = await ev("JSON.stringify({ focus: document.activeElement.id, title: document.title, current: document.querySelector('nav [aria-current]')?.textContent })");
  const a = JSON.parse(after);
  a.focus === "main" && a.title.startsWith("Projects") && a.current === "projects"
    ? pass("after a page change focus is on the content, the title updated and the nav marks the page")
    : fail(`after a page change: ${after}`);

  // small screens: nothing scrolls sideways, links are big enough to tap
  for (const [w, h] of [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
    for (const path of ["/", "/projects", "/projects/camdex", "/notes", "/about", "/nope"]) {
      await open(path, w, h);
      const m = JSON.parse(await ev("JSON.stringify({ sw: document.documentElement.scrollWidth, cw: innerWidth, small: [...document.querySelectorAll('a')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 24 }).map(e => e.textContent.trim()) })"));
      if (m.sw > m.cw) fail(`${path} scrolls sideways at ${w}px (${m.sw} > ${m.cw})`);
      if (m.small.length) fail(`${path} at ${w}px has links under 24px tall: ${m.small.join(", ")}`);
    }
  }
  problems.some((p) => p.includes("sideways") || p.includes("under 24px")) ? null : pass("no sideways scrolling and no tiny links at 320, 390, 768, 1024 and 1440px");

  // no errors in the console on any page, and nothing blocked by the security policy
  consoleErrors.length = 0;
  for (const path of ["/", "/projects", "/projects/camdex", "/projects/tallgrass", "/notes", "/about"]) await open(path);
  consoleErrors.length ? fail(`console errors: ${consoleErrors.slice(0, 3).join(" | ")}`) : pass("no console errors");
} finally {
  chrome.kill();
  server.kill();
}

if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"} found`);
  process.exit(1);
}
console.log("\nall checks passed");
process.exit(0);

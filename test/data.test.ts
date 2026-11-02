import { describe, expect, test } from "bun:test";
import wide from "../src/art/pagoda.json";
import small from "../src/art/pagoda-small.json";
import { posts } from "../src/data/posts";
import { projects } from "../src/data/projects";
import { pageMeta, routes } from "../src/meta";
import { rss } from "../src/feed";

describe("projects", () => {
  test("slugs are unique and URL-safe", () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  test("every case study has a problem, choices and a result", () => {
    for (const p of projects.filter((p) => p.study)) {
      expect(p.study!.problem.length).toBeGreaterThan(0);
      expect(p.study!.choices.length).toBeGreaterThan(0);
      expect(p.study!.result.length).toBeGreaterThan(0);
    }
  });

  test("links are https", () => {
    for (const p of projects) for (const url of [p.repo, p.live, p.docs]) if (url) expect(url).toStartWith("https://");
  });

  // Run with STRICT=1 before publishing: bun test with STRICT=1 fails while any TODO is left.
  test.skipIf(!process.env.STRICT)("no TODO placeholders are left", () => {
    expect(JSON.stringify(projects)).not.toContain("TODO");
  });
});

describe("posts", () => {
  test("slugs are unique and dates look like dates", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of posts) expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("are listed newest first", () => {
    const dates = posts.map((p) => p.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe.each([
  ["wide", wide],
  ["small", small],
])("pagoda art (%s)", (_name, art) => {
  const bytes = (s: string) => Buffer.from(s, "base64").length;
  const cells = art.cols * art.rows;

  test("every layer has one entry per cell", () => {
    expect(art.chars.length).toBe(cells);
    expect(bytes(art.rgb)).toBe(cells * 3);
    expect(bytes(art.lum)).toBe(cells);
    expect(bytes(art.edge)).toBe(cells);
  });

  test("only uses characters from the ramp or the line glyphs", () => {
    const allowed = new Set(art.ramp + "|-/\\");
    for (const ch of art.chars) expect(allowed.has(ch)).toBe(true);
  });
});

test("both pictures have the same shape, so the page layout does not jump", () => {
  const shape = (a: typeof wide) => a.cols / (a.rows * 1.8);
  expect(Math.abs(shape(wide) - shape(small))).toBeLessThan(0.01);
});

describe("page metadata", () => {
  const metas = routes.map((r) => ({ route: r, ...pageMeta(r) }));

  test("every page has its own title", () => {
    const titles = metas.map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("descriptions are short enough for search results", () => {
    for (const m of metas) {
      expect(m.description.length).toBeGreaterThan(10);
      expect(m.description.length).toBeLessThanOrEqual(160);
    }
  });
});

describe("rss feed", () => {
  test("has one item per post, with full links", () => {
    const xml = rss("https://example.com", posts);
    expect(xml.match(/<item>/g)?.length).toBe(posts.length);
    expect(xml).toContain(`<link>https://example.com/notes/${posts[0].slug}</link>`);
  });

  test("escapes characters that would break the XML", () => {
    const xml = rss("https://example.com", [{ slug: "a", title: "Go & <Rust>", date: "2026-01-02", body: ["x"] }]);
    expect(xml).toContain("Go &amp; &lt;Rust&gt;");
  });
});

describe("fonts", () => {
  const html = Bun.file(new URL("../index.html", import.meta.url).pathname).text();

  test("every font the page asks for exists, and the licence is kept beside them", async () => {
    const wanted = [...(await html).matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]);
    expect(wanted.length).toBeGreaterThan(0);
    for (const file of wanted) expect(await Bun.file(new URL(`../public/fonts/${file}`, import.meta.url).pathname).exists()).toBe(true);
    expect(await Bun.file(new URL("../public/fonts/LICENSE-JetBrainsMono.txt", import.meta.url).pathname).exists()).toBe(true);
  });
});

describe("host settings (vercel.json)", () => {
  const read = () => Bun.file(new URL("../vercel.json", import.meta.url).pathname).json();
  const headerOf = (config: any, source: string, key: string) =>
    config.headers.find((h: any) => h.source === source)?.headers.find((h: any) => h.key === key)?.value as string | undefined;

  test("builds with Bun into dist, with clean addresses and no trailing slash", async () => {
    const c = await read();
    expect(c.buildCommand).toBe("bun run build");
    expect(c.outputDirectory).toBe("dist");
    expect(c.cleanUrls).toBe(true);
    expect(c.trailingSlash).toBe(false);
  });

  test("sends a content security policy that allows no outside or inline scripts", async () => {
    const csp = headerOf(await read(), "/(.*)", "Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*(https?:|'unsafe-inline'|'unsafe-eval')/);
  });

  test("caches the bundle for a year and fonts for a month", async () => {
    const c = await read();
    expect(headerOf(c, "/chunk-(.*)", "Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(headerOf(c, "/fonts/(.*)", "Cache-Control")).toBe("public, max-age=2592000");
  });
});

import { describe, expect, test } from "bun:test";
import art from "../src/art/pagoda.json";
import { posts } from "../src/data/posts";
import { projects } from "../src/data/projects";
import { pageMeta, routes } from "../src/meta";

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

describe("pagoda art", () => {
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

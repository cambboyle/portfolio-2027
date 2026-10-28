import type { Post } from "./data/posts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** An RSS 2.0 feed of the Notes posts, newest first. `site` is the full address, such as https://example.com. */
export function rss(site: string, posts: Post[]) {
  const items = posts
    .map((p) => {
      const url = `${site}/notes/${p.slug}`;
      return [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid>${url}</guid>`,
        `      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${esc(p.body.join("\n\n"))}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cameron Boyle: notes</title>
    <link>${site}/notes</link>
    <description>Notes on what I'm building and learning.</description>
${items}
  </channel>
</rss>
`;
}

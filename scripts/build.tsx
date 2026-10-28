/**
 * Builds the site into dist/:
 *   1. bundle the app (Bun's bundler)
 *   2. write each page out as real HTML, so search engines and link previews see the content without running JavaScript
 *   3. write robots.txt (and sitemap.xml when SITE_URL is set)
 *
 *   bun run build
 *   SITE_URL=https://example.com bun run build     # adds canonical links, absolute share URLs and a sitemap
 */
import { renderToString } from "react-dom/server";
import { mkdir, cp } from "node:fs/promises";
import { App } from "../src/App";
import { pageMeta, routes } from "../src/meta";

const site = process.env.SITE_URL?.replace(/\/$/, "");
const root = new URL("../", import.meta.url).pathname;

const built = await Bun.build({
  entrypoints: [`${root}index.html`],
  outdir: `${root}dist`,
  minify: true,
  sourcemap: "linked",
  publicPath: "/", // absolute, so /projects/camdex finds /index-xxxx.js
});
if (!built.success) {
  for (const log of built.logs) console.error(log);
  process.exit(1);
}

const template = await Bun.file(`${root}dist/index.html`).text();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function page(path: string, indexable = true) {
  const { title, description } = pageMeta(path);
  const url = site && indexable ? `${site}${path === "/" ? "/" : path}` : undefined;
  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace('<div id="root"></div>', `<div id="root">${renderToString(<App initialPath={path} />)}</div>`);
  const extra: string[] = [];
  if (!indexable) extra.push('<meta name="robots" content="noindex" />');
  if (url) extra.push(`<link rel="canonical" href="${url}" />`, `<meta property="og:url" content="${url}" />`);
  if (site) html = html.replace('content="/og.png"', `content="${site}/og.png"`);
  return html.replace("</head>", `${extra.join("\n    ")}\n  </head>`);
}

for (const path of routes) {
  const dir = path === "/" ? `${root}dist` : `${root}dist${path}`;
  await mkdir(dir, { recursive: true });
  await Bun.write(`${dir}/index.html`, page(path));
}
await Bun.write(`${root}dist/404.html`, page("/404", false));

await cp(`${root}public`, `${root}dist`, { recursive: true });

await Bun.write(`${root}dist/robots.txt`, `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ""}`);
if (site) {
  const urls = routes.map((r) => `  <url><loc>${site}${r === "/" ? "/" : r}</loc></url>`).join("\n");
  await Bun.write(`${root}dist/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

console.log(`built ${routes.length} pages${site ? ` for ${site}` : " (set SITE_URL for canonical links and a sitemap)"}`);

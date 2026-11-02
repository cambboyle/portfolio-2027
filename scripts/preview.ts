/** Serves dist/ the way the host will: /about from about.html, a folder's index.html, and 404.html for anything else. */
import { resolve, sep } from "node:path";

const dist = resolve(new URL("../dist/", import.meta.url).pathname);
/** Reads the "headers" from vercel.json so the preview sends the same headers the real host will. */
type Rule = { pattern: RegExp; headers: [string, string][] };
const config = await Bun.file(new URL("../vercel.json", import.meta.url).pathname).json();
const rules: Rule[] = (config.headers ?? []).map((h: { source: string; headers: { key: string; value: string }[] }) => ({
  // vercel.json patterns are written like /chunk-(.*) ; here that is turned into a regular expression
  pattern: new RegExp(`^${h.source.split("(.*)").map((part) => part.replace(/[.+?^${}|[\]\\]/g, "\\$&")).join(".*")}$`),
  headers: h.headers.map((x) => [x.key, x.value]),
}));
const withHeaders = (path: string, res: Response) => {
  for (const rule of rules) if (rule.pattern.test(path)) for (const [k, v] of rule.headers) res.headers.set(k, v);
  return res;
};

const notFound = (path = "/404") => withHeaders(path, new Response(Bun.file(`${dist}/404.html`), { status: 404, headers: { "content-type": "text/html" } }));

const server = Bun.serve({
  hostname: "127.0.0.1", // this is only for looking at the build on your own machine
  port: Number(process.env.PORT ?? 4000),
  async fetch(req) {
    let rel: string;
    try {
      rel = decodeURIComponent(new URL(req.url).pathname);
    } catch {
      return notFound();
    }
    const target = resolve(dist, "." + rel);
    // never serve anything outside dist/, whatever the address contains (for example ..%2f)
    if (target !== dist && !target.startsWith(dist + sep)) return notFound(rel);
    // like the host with cleanUrls: /about is about.html, and a folder shows its index.html
    for (const candidate of [target, `${target}.html`, resolve(target, "index.html")]) {
      const file = Bun.file(candidate);
      if (candidate !== dist && (await file.exists()) && file.size > 0) return withHeaders(new URL(req.url).pathname, new Response(file));
    }
    return notFound(rel);
  },
});

console.log(`previewing dist/ at ${server.url}`);

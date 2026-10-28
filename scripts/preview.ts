/** Serves dist/ the way a static host would: a folder's index.html, and 404.html for anything else. */
import { resolve, sep } from "node:path";

const dist = resolve(new URL("../dist/", import.meta.url).pathname);
const notFound = () => new Response(Bun.file(`${dist}/404.html`), { status: 404, headers: { "content-type": "text/html" } });

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
    if (target !== dist && !target.startsWith(dist + sep)) return notFound();
    for (const candidate of [target, resolve(target, "index.html")]) {
      const file = Bun.file(candidate);
      if (candidate !== dist && (await file.exists()) && file.size > 0) return new Response(file);
    }
    return notFound();
  },
});

console.log(`previewing dist/ at ${server.url}`);

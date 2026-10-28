/** Serves dist/ the way a static host would: a folder's index.html, and 404.html for anything else. */
const dist = new URL("../dist/", import.meta.url).pathname;

const server = Bun.serve({
  port: Number(process.env.PORT ?? 4000),
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname).replace(/\/$/, "");
    for (const candidate of [`${dist}${path}`, `${dist}${path}/index.html`]) {
      const file = Bun.file(candidate);
      if (path !== "" || candidate.endsWith("index.html")) if (await file.exists() && file.size > 0 && !candidate.endsWith("/dist/")) return new Response(file);
    }
    return new Response(Bun.file(`${dist}404.html`), { status: 404, headers: { "content-type": "text/html" } });
  },
});

console.log(`previewing dist/ at ${server.url}`);

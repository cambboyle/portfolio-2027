import index from "./index.html";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/og.png": () => new Response(Bun.file("./public/og.png")),
    "/fonts/:file": (req) => {
      const file = req.params.file;
      // only plain font file names, never a path
      if (!/^[\w.-]+\.(woff2|txt)$/.test(file) || file.includes("..")) return new Response("Not found", { status: 404 });
      return new Response(Bun.file(`./public/fonts/${file}`));
    },
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`portfolio running at ${server.url}`);

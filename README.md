# cbb00-portfolio

My personal site: Home (a short intro and a small animated pagoda drawn in text characters), Projects, Notes and About.

## Run it

Everything uses [Bun](https://bun.sh).

```sh
bun install
bun run dev          # http://localhost:3000, live reload
PORT=3100 bun run dev
bun run typecheck
bun run build        # writes the finished site to dist/
bun run preview      # serves dist/ like a static host, at http://localhost:4000
bun run test         # tests in test/
bun run check        # typecheck, tests and build together
```

## Building and SEO

`bun run build` (`scripts/build.tsx`) bundles the app, then writes every page out as real HTML (`dist/projects/camdex/index.html` and so on) so search engines and link previews see the content without running JavaScript. The browser then attaches React to that HTML. Each build starts from an empty `dist/`. It also writes `404.html`, `robots.txt` and the share image.

Set the site's address once you know it, to get canonical links, absolute share URLs, `sitemap.xml` and an RSS feed of Notes at `/feed.xml`:

```sh
SITE_URL=https://example.com bun run build
```

Each page's title and description come from `src/meta.ts`. The home page also has Person structured data in `index.html`. Lighthouse scores on the built site: performance 99 to 100, accessibility 100, best practices 100, SEO 100.

Ask the host to cache the hashed `.js` and `.css` files for a long time, and to serve `404.html` for unknown addresses.

## Where things live

- `src/pages/` has one file per page; `src/App.tsx` picks the page from the URL and draws the nav.
- `src/meta.ts` has each page's title and description, and the list of pages to build.
- `src/router.tsx` is a small history-API router (no library).
- `src/data/projects.ts` and `src/data/posts.ts` hold the Projects and Notes content. Add an object to add an entry.
- A project with a `study` gets its own page at `/projects/<slug>` (problem, choices, result, and an optional `next` list). NetKit's study still has `TODO:` lines to fill in.
- `public/og.png` is the share image, served by `server.ts`. Change `og:image` in `index.html` to a full URL once the site is hosted.

## How the pagoda is made

`scripts/prep-pagoda.ts` turns the photo into a grid of characters, once:

```sh
bun scripts/prep-pagoda.ts
```

It reads the photo from `~/Downloads/refs/pagoda-original/original.jpg`, mirrors and crops it, shrinks it to 150 by 116 cells, picks a character per cell from its brightness (or from the edge direction where there is a strong line), colours it, and saves the result to `src/art/pagoda.json`. `src/PagodaArt.tsx` draws that picture once per size, then each frame copies it and redraws only the twinkling cells. Clicking or tapping the pagoda sends a gust through the petals.

## Credits

- **Photo:** [Temple near trees during day](https://unsplash.com/photos/temple-near-trees-during-day-PMkQ7WVWqr0) by Svetlana Gumerova ([@bananablackcat](https://unsplash.com/@bananablackcat)) on [Unsplash](https://unsplash.com), used under the [Unsplash License](https://unsplash.com/license). The site shows an ASCII version of it, not the photo itself.

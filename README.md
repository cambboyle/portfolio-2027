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
```

## Where things live

- `src/pages/` has one file per page; `src/App.tsx` picks the page from the URL and draws the nav.
- `src/router.tsx` is a small history-API router (no library).
- `src/data/projects.ts` and `src/data/posts.ts` hold the Projects and Notes content. Add an object to add an entry.
- A project with a `study` gets its own page at `/projects/<slug>` (problem, choices, result, and an optional `next` list). NetKit's study still has `TODO:` lines to fill in.
- `public/og.png` is the share image, served by `server.ts`. Change `og:image` in `index.html` to a full URL once the site is hosted.

## How the pagoda is made

`scripts/prep-pagoda.ts` turns the photo into a grid of characters, once:

```sh
bun scripts/prep-pagoda.ts
```

It reads the photo from `~/Downloads/refs/pagoda-original/original.jpg`, mirrors and crops it, shrinks it to 150 by 116 cells, picks a character per cell from its brightness (or from the edge direction where there is a strong line), colours it, and saves the result to `src/art/pagoda.json`. `src/PagodaArt.tsx` redraws those cells on a canvas and adds the movement.

## Credits

- **Photo:** [Temple near trees during day](https://unsplash.com/photos/temple-near-trees-during-day-PMkQ7WVWqr0) by Svetlana Gumerova ([@bananablackcat](https://unsplash.com/@bananablackcat)) on [Unsplash](https://unsplash.com), used under the [Unsplash License](https://unsplash.com/license). The site shows an ASCII version of it, not the photo itself.

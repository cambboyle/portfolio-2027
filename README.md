# cbb00-portfolio

My [Cameron Boyle] personal site: a small animated pagoda drawn entirely in text characters, with my projects, notes and a bit about me.

![The home page: an intro on the left and a pagoda with Mount Fuji drawn in characters on the right](public/og.png)

It is a hand-built static site on [Bun](https://bun.sh) and React, with no UI library and no framework. The things I cared about were speed, accessibility and being readable as code.

|                | Lighthouse (built site, phone and desktop) |
| -------------- | ------------------------------------------ |
| Performance    | 100                                        |
| Accessibility  | 100                                        |
| Best practices | 100                                        |
| SEO            | 100                                        |

These are checked by `bun run audit` and by CI, so a change that lowers them fails the build.

## What's in it

- **The pagoda.** A photo turned into a grid of characters ahead of time (`scripts/prep-pagoda.ts`). The browser draws it on a canvas, with petals on the wind that you can push with the cursor or a tap. Phones get a coarser picture with bigger characters.
- **Pages.** Home, Projects (case studies: problem, choices, result), Notes and About. Content lives in plain data files, so adding a project or a post means adding an object.
- **Pre-rendered HTML.** The build writes every page as real HTML, so search engines and link previews see the content without running JavaScript. React then attaches to it.
- **Accessible by default.** Skip link, one `h1` per page, focus moves to the content after a page change, links that open a new tab say so, `rem` text sizes, large tap targets, and the pagoda stops moving for people who ask for reduced motion.
- **Small and fast.** About 3 KB of CSS and JetBrains Mono at 43 KB are the only assets besides the script. The phone and desktop pictures are separate files, so a phone downloads only its own.

## Run it

```sh
bun install
bun run dev          # http://localhost:3000, live reload (PORT=3100 bun run dev for another port)
bun run test         # unit tests in test/
bun run typecheck
bun run build        # writes the finished site to dist/
bun run preview      # serves dist/ like a static host, at http://localhost:4000
bun run audit        # builds, then runs Lighthouse and real-browser checks (needs Chrome)
bun run check        # typecheck, tests and build together
```

`bun run audit` fails if any Lighthouse score drops below its limit (performance 95, the rest 100), if the keyboard order or focus handling breaks, if any page scrolls sideways from 320px to 1440px wide, if a link is too small to tap, or if there are console errors.

## Deploying

The site is static, so it runs on any static host. I use [Vercel](https://vercel.com) (free Hobby plan), connected to this repository, at <https://cambboyle.me>. `vercel.json` holds the settings, so there is nothing to type into the dashboard except one variable:

| Where            | Setting                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `vercel.json`    | `bun install --frozen-lockfile`, `bun run build`, output `dist`               |
| `vercel.json`    | `cleanUrls` on and `trailingSlash` off, so `about.html` is served at `/about` |
| `vercel.json`    | security headers, and long caching for the hashed files                       |
| Vercel dashboard | environment variable `SITE_URL` = `https://cambboyle.me`                      |

Vercel installs with `bun install --frozen-lockfile`, which refuses to run if `bun.lock` doesn't match `package.json`. So after adding or changing any dependency, run `bun install` and commit the updated `bun.lock` with it, or the deploy fails at the install step.

Vercel Web Analytics (`<Analytics />` in `src/App.tsx`) loads its script from the site's own address (`/_vercel/insights/script.js`, added by Vercel), so the content security policy needs no outside script source. This only holds because `scripts/build.tsx` sets `process.env.NODE_ENV` to `"production"` in the bundle; without it the package thinks it is in development and loads a debug script from `va.vercel-scripts.com`, which the policy blocks and the audit flags as a console error. `scripts/preview.ts` serves an empty stand-in for that address, since only Vercel has it.

`SITE_URL` makes the build write canonical links, absolute share-image URLs, `sitemap.xml` and an RSS feed of Notes (`/feed.xml`); without it they are left out.

The headers include a content security policy that allows no outside scripts. `bun run preview` and `bun run audit` read the same `vercel.json`, so a rule that would break the site shows up before it is live. The build writes each page as a flat file (`dist/projects/camdex.html`), and Vercel serves a missing address with `404.html`.

## Where things live

- `src/pages/` has one file per page; `src/App.tsx` picks the page from the URL and draws the nav.
- `src/router.tsx` is a small history-API router (no library).
- `src/meta.ts` has each page's title and description and the list of pages to build.
- `src/data/projects.ts` and `src/data/posts.ts` hold the content. A project with a `study` gets its own page at `/projects/<slug>`.
- `src/PagodaArt.tsx` draws the pagoda. It draws the picture once per size, then each frame copies it and redraws only the cells that twinkle.
- `scripts/build.tsx` bundles the app and writes the pages; `scripts/preview.ts` serves `dist/`; `scripts/audit.ts` checks the result.
- `test/` has the tests: unique slugs, complete case studies, pagoda data shape, page titles and descriptions, the RSS feed and the font files.

## How the pagoda is made

```sh
bun run art    # makes src/art/pagoda.json (150 columns) and src/art/pagoda-small.json (80 columns, for phones)
```

`scripts/prep-pagoda.ts` reads the photo, mirrors and crops it, and shrinks it to a grid of cells. Each cell gets a character from its brightness (or from the edge direction where there is a strong line) and a colour from the photo. Local contrast is added so Mount Fuji's slope and the pagoda's roofs stand out, the open sky is dimmed so it frames the subject, and shadows are lifted. The photo itself is not in the repository; the script expects it at `~/Downloads/refs/pagoda-original/original.jpg`.

## The sky (branch `experiment/earth`)

The home page shows a turning globe drawn in characters, lit by a sun off to one side so half of it is in night: **the Earth on the light theme, the Moon on the dark one**. The site follows the device's light or dark setting, and the toggle at the end of the nav overrides it; the choice is saved and applied by `public/theme.js` before the page paints, so there is no flash.

- **Earth:** `bun scripts/prep-earth.ts` turns Natural Earth's coastlines into a 512×256 land/sea bitmap (`src/art/earth.json`, 22 KB). The night side is drawn faintly so the disc stays round, and the **city lights** on it are real: `bun scripts/prep-cities.ts path/to/ne_50m_populated_places_simple.geojson` (Natural Earth, public domain; download it from the `geojson/` folder of nvkelso/natural-earth-vector, it is not kept in the repository) keeps the 739 places over 300 000 people as `src/art/cities.json` (about 10 KB), and `src/sky/cities.ts` puts them on a coarse grid so each city is a steady blob of light that glows into its neighbours; the smaller ones twinkle slowly.
- **Moon:** a made-up surface (seas, craters with bright rims) generated from a fixed seed the first time it is needed (`src/sky/moon.ts`), **lit by today's real phase**: `src/sky/moonPhase.ts` works out the Moon's and the sun's positions with the standard low-precision series (good to a few hours) and the sun is placed to match, so a waxing Moon is lit on the right, a waning one on the left, and a new Moon is a dark disc. The phase is also in the canvas's description for screen readers. It keeps its slow spin (a real Moon is tidally locked, and always shows the same face).
- **The axis is real:** `src/sky/orbit.ts` works out where the Earth's axis points for the current date. It is tipped 23.44° from the normal to the orbit plane and always points the same way in space, so the sun's latitude swings between 23.4° north (June) and 23.4° south (December), the north pole leans towards the sun in June and away in December, and the spin is west to east. The sun sits off to the left and the orbit plane is seen from a little above.
- **More bodies:** the globe can also show **Mars** (rusty, with the dark patches seen through a telescope, a canyon scar, a bright Hellas basin and white polar caps) and **Saturn** (cloud bands and rings), both made up procedurally in `src/sky/planets.ts` in the style of the Moon's map. Saturn's rings (`src/sky/rings.ts`) are a flat disc tested against each character's ray: faint C ring, bright B ring, the Cassini division, the A ring and its Encke gap; the near rings cross in front of the planet, the far ones hide behind it, and the planet casts a shadow on them. Each body has its own axial tilt, applied when it comes into view. Move to the next body with the **Konami code**, by **holding still on the globe for most of a second** (the touch-screen way), or in the terminal with `body mars`, `body saturn` or `body cycle`; a line of facts appears under the globe for a few seconds. A change of theme goes back to the theme's own body.
- **Gentle extras** (each has a switch in the settings panel and a terminal command, all on by default, and all stopped by the pause button and by reduced motion): a **cursor trail** (`src/Trail.tsx`, mouse only: characters left behind the pointer that fade in under a second and are never more than about half solid, and it draws only while there is something to draw), a **comet** on the light theme (`src/Comet.tsx`, every minute or few: a bright `@` head with a tail of fading characters crosses the page and you can click it to catch it, with a count kept in the settings panel; `comet` in the terminal calls one now), and an **idle screensaver** on the home page (`src/Idle.tsx`: after a minute of nothing the text and controls fade away, the globe drifts to the middle and grows, and it tours Earth, Moon, Mars and Saturn; any input brings everything back). The numbers and shapes are plain functions in `src/trailLook.ts` and `src/cometPath.ts` (tested in `test/effects.test.ts`), and `src/overlay.ts` is the shared transparent canvas.
- **The space station** (`src/sky/iss.ts`): type `iss` in the terminal and the Earth shows where the International Space Station is right now, a blinking marker with its height and speed and the little path it has just taken, updated every five seconds for up to ten minutes (`iss off` stops it; on the dark theme it switches the globe to the Earth first). **This is the only time the site talks to anyone else**: it asks `https://api.wheretheiss.at/v1/satellites/25544`, only after you ask, never when a page loads, which means that service sees your IP address like any website you visit would. The security policy in `vercel.json` allows exactly that one address in `connect-src` (a test checks that nothing broader is ever added), no cookies or referrer are sent, and a failed request just says so. The position is turned into a spot on the globe with the globe's own rotation, so it follows the globe as it turns and is hidden on the far side.
- **How it stays cheap:** `src/SkyArt.tsx` works out once per size where each cell falls on the sphere facing us and how much sun it gets. Each frame it turns those points by the globe's orientation (a 3×3 rotation) to find the latitude and longitude under each cell, then looks up the land, sea or crater there.
- Drag it any way (sideways, up, down, diagonally) to turn it like a real ball: the surface follows your finger, and if you flick it, it keeps coasting before settling back to its own slow spin. Its orientation is a full 3D rotation, so it can end up tipped over; it is not locked to one axis.

- **The dock** (bottom right of every page, `src/Dock.tsx`): a round **pause** button (`src/PauseButton.tsx`, state in `src/motion.ts`) that stops the globe turning and skips the theme and page animations (the icon becomes a play triangle; a paused globe can still be dragged; it lasts for the visit), and a very quiet **settings** button (`···`, `src/SettingsPanel.tsx`, loaded only when opened) with switches for the extras (cursor trail, idle screensaver, comets). Settings are saved in `localStorage` under `settings` (`src/settings.ts`); pausing and reduced motion override them.
- **The terminal** (`src/Terminal.tsx`, loaded only when opened): press the backtick key (`` ` ``) anywhere, or use the `>_` button in the dock. Type `help`. It knows the site: `cd projects`, `cd ..`, `ls`, `whoami`, `theme light|dark|toggle`, `pause`/`resume`, `body earth|moon|mars|saturn|cycle|reset` (what the globe shows, until the theme changes), `phase` (tonight's Moon and the next full and new moons), `trail|idle|comets on|off`, `comet`, `iss` / `iss off`, `stats`, `neofetch`, `date`, `clear`, `exit`, plus a few that are not in `help`. Tab completes, ↑ ↓ recalls, Esc closes, and it is an accessible dialog (focus stays inside, output is announced). The commands are plain functions in `src/terminal/commands.ts` that return lines and actions, so they are unit-tested (`test/terminal.test.ts`); the audit also opens it with the keyboard in a real browser.
- **Theme change animation:** pressing the toggle in the nav (`src/themeTransition.ts`) grows the new theme as a circle out from the button, and the edge of the circle is a ring of characters (dense and glitchy at the leading edge, thinning into a trail behind it) drawn in the page's monospace, in each side's own colours. The circle is the browser's View Transitions API, so both themes are real pictures of the page and the globe keeps turning inside the circle; the ring is a canvas that joins the same transition so it stays on top. It is skipped with reduced motion or while paused, and where the API is missing the theme just changes.
- **Page change animation:** moving between pages (`src/pageTransition.ts`, hooked into `src/router.tsx`) sweeps a thin line of the same characters across the screen in about half a second, with the new page revealed behind it. It goes left to right towards later nav items (home, projects, notes, about) and right to left going back, and works for the browser's back and forward buttons too. Skipped with reduced motion, while paused, during a theme change, and where the View Transitions API is missing. The ring and line share their characters and canvas code in `src/asciiRing.ts`.

- **Project cards** (kept in the code, not connected to the site at the moment): `src/cards/` and `src/pages/Cards.tsx` turn each project into a collectable card drawn in characters (type from its stack, moves from its case study, rarity from how finished it is), with a tilt, a faint holo foil, a pack opener, a binder saved in `localStorage` and an up-close view. Its styles are in `src/cards/cards.css` and only load with the page, and its rules are tested in `test/cards.test.ts`. To bring it back, add a `/cards` branch in `src/App.tsx`, its title in `pageMeta` and its path in `routes` (`src/meta.ts`).
- **A puzzle in the console** (kept in the code, not connected, since its reward is a card): `src/flag.ts` holds a console banner with an encoded clue and a SHA-256 check of the answer (tested in `test/flag.test.ts`). To bring it back, call `printBanner()` from `src/main.tsx` and add an `unlock` command to the terminal that calls `checkFlag`.
- **Build line** (`src/Footer.tsx`, `src/buildInfo.ts`): a quiet line at the bottom of every page with the build date, the commit and the number of commits. `scripts/build.tsx` reads them from git (or `VERCEL_GIT_COMMIT_SHA`), leaves the count out on a shallow clone rather than show a wrong number, and gives the same text to the prerender and the browser bundle so the two match.
**Easter egg (dark theme only; on the light theme double-clicking does nothing and no visit happens).** Every three to five minutes the globe fades out and a Death Star drifts past for a while: a matte grey sphere the size of the Moon, its surface cut into bands of rectangular panels (each a slightly different tone, with deeper grooves every few bands), a narrow trench of lit windows round the equator, and a large round dish on the upper left with a bright lip, stepped rings and a green glow at its focus. It turns at the Moon's pace, and a visit is timed so the dish crosses its face. It is ray marched from a signed distance function in `src/sky/ship.ts`. Double-click the globe to call it.

## Font

[JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License; the licence text is in `public/fonts/`), in two weights, Latin only. `font-display: swap` shows text straight away in a local monospace font sized to match JetBrains Mono, so little moves when the font arrives, and the pagoda redraws once it has loaded.

## Credits

- **Photo:** [Temple near trees during day](https://unsplash.com/photos/temple-near-trees-during-day-PMkQ7WVWqr0) by Svetlana Gumerova ([@bananablackcat](https://unsplash.com/@bananablackcat)) on [Unsplash](https://unsplash.com), used under the [Unsplash License](https://unsplash.com/license). The site shows an ASCII version of it, not the photo itself.
- **Coastlines:** [Natural Earth](https://www.naturalearthdata.com) (public domain), via [world-atlas](https://github.com/topojson/world-atlas) (ISC).
- **Font:** JetBrains Mono, by the JetBrains Mono Project Authors, under the SIL Open Font License 1.1.

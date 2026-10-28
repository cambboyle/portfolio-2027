export interface Choice {
  title: string;
  body: string;
}

export interface CaseStudy {
  problem: string[]; // one string per paragraph
  choices: Choice[];
  result: string[];
  next?: string[]; // what you would change or build next; the section is hidden while this is empty
}

export interface Project {
  slug: string;
  name: string;
  blurb: string;
  stack: string;
  repo?: string; // left out while the repo is private
  live?: string;
  docs?: string;
  study?: CaseStudy;
}

// Case studies are drafts in your voice, written from the repos' READMEs; edit anything that isn't quite right.
export const projects: Project[] = [
  {
    slug: "tallgrass",
    name: "Tallgrass",
    blurb: "A live companion for Pokemon games on an emulator. It runs on a Raspberry Pi and shows your game on any device on your wifi.",
    stack: "Go, on a Raspberry Pi 4 with RetroArch",
    repo: "https://github.com/cambboyle/Tallgrass",
    docs: "https://tallgrass-delta.vercel.app",
    study: {
      problem: [
        "I play Pokemon romhacks on a Raspberry Pi running RetroPie. Romhacks are hard: they have custom trainers, new encounters and rules that change from game to game, and the emulator tells you nothing about any of it.",
        "I wanted a second screen: a full companion that updates as I play. My party with its levels, natures, stats, IVs, EVs and movesets; the route I'm on and which Pokemon I can meet there, by time of day; a log of my run for Nuzlockes. All of it on my phone, without leaving the game.",
      ],
      choices: [
        {
          title: "A small web server on the Pi",
          body: "A Go agent runs next to the emulator, reads the game's memory and save data as it plays, and serves a small web app from the Pi. Anyone on my local wifi opens it on a phone or laptop and sees the game live, with nothing to install on their device. I chose Go because it builds to a single binary that is easy to put on a Pi, and because I wanted to learn it properly by building something real.",
        },
        {
          title: "Games as JSON profiles",
          body: "Each supported game is a profile of memory addresses and table locations, not code. Adding a game doesn't need a rebuild, and anyone can try a profile by dropping a file in a folder. I made the profiles CC0 and the code GPL v3, so the community can build on both.",
        },
        {
          title: "No game data, ever",
          body: "Tallgrass never ships anything from the games. Everything it shows is read from the player's own copy. That keeps it a fan tool and keeps it safe to share.",
        },
        {
          title: "One-line install, self-updating",
          body: "If someone has to fight with setup, they won't use it. A single install command sets it up on the Pi, and it keeps itself up to date, so I could ship fixes without anyone redoing anything.",
        },
      ],
      result: [
        "Tallgrass works with Pokemon Radical Red and Unbound on RetroArch (mGBA), and HeartGold Generations on DraStic, on a Raspberry Pi 4 or a Linux PC. There is also a separate docs site for each game, generated from the game itself so it can't drift from what the game actually does.",
        "It's the project where I learned the most about reading binary data, and about shipping something other people can install.",
      ],
    },
  },
  {
    slug: "netkit",
    name: "NetKit",
    blurb: "A cyber security kit that runs on a Raspberry Pi.",
    stack: "Go, Raspberry Pi",
    study: {
      problem: [
        "TODO: Why did you build it? What were you trying to learn or fix, and what was annoying before it existed?",
        "TODO: Who is it for (you, a home network, a lab)?",
      ],
      choices: [
        { title: "TODO: first big decision", body: "TODO: what you chose, what you considered instead, and why." },
        { title: "TODO: second decision", body: "TODO: tools, hardware, how it runs on the Pi." },
        { title: "TODO: third decision", body: "TODO: anything about safety, scope or what it deliberately doesn't do." },
      ],
      result: [
        "TODO: what it can do now, and what you learned about Go and security while building it.",
      ],
      next: ["TODO: what you'd change or build next, and what you'd do differently."],
    },
  },
  {
    slug: "camdex",
    name: "CamDex",
    blurb: "A Pokedex for the games, like Pokemon HOME but on the web.",
    stack: "React, TypeScript, NestJS, PostgreSQL, Bun",
    repo: "https://github.com/cambboyle/CamDex",
    live: "https://camdex.vercel.app",
    study: {
      problem: [
        "I collect Pokemon in the games and I like a full living dex: one of every form. Pokemon HOME tracks that, but only inside the app, and not the way I wanted. I wanted it on the web, for every form, with a separate dex per game or per goal.",
        "I also wanted somewhere to build competitive teams that knew each game's rules, so I stopped keeping them in notes.",
      ],
      choices: [
        {
          title: "A real database, seeded from PokeAPI",
          body: "There are about 1,800 trackable forms, so a spreadsheet wouldn't cut it. PostgreSQL on Supabase holds the data, seeded from PokeAPI, behind a NestJS API that I know well from work.",
        },
        {
          title: "JWTs verified locally",
          body: "Supabase Auth signs its tokens with RS256, so the API verifies them with the public key instead of calling Supabase on every request. It's faster and there's one less thing to go down.",
        },
        {
          title: "Rules that depend on the game",
          body: "Standard games cap EVs at 252 per stat and 508 in total. Pokemon Champions caps them at 32 per stat and 66 in total, and has an Item Clause. The team builder reads the rule set for the game, so it won't let you build something that's illegal there.",
        },
        {
          title: "TanStack Router and Query",
          body: "File-based routes and cached server state kept the front end small. I wrote tests with Vitest on the front end and Jest on the back end, because a collection tracker that loses your data isn't worth using.",
        },
      ],
      result: [
        "CamDex is live on Vercel and Railway. It was built for one player and I'm that player, so it gets used for real.",
      ],
    },
  },
  {
    slug: "crate",
    name: "Crate",
    blurb: "A Spotify playlist curator.",
    stack: "React, Vite, the Spotify Web API",
    repo: "https://github.com/cambboyle/Crate",
    study: {
      problem: [
        "Building a playlist in Spotify means a lot of clicking and dragging. I wanted to search, drop tracks in and reorder them quickly, with the keyboard if I felt like it.",
      ],
      choices: [
        {
          title: "Spotify OAuth, cached search",
          body: "Login and playlist changes go through the Spotify Web API. Search results are cached so repeat searches feel instant.",
        },
        {
          title: "Drag and drop that works without a mouse",
          body: "Reordering works by dragging or from the keyboard. I treat accessibility as part of the feature, not something to add afterwards.",
        },
        {
          title: "A self-hosted, preloaded font",
          body: "Inter is served from the site itself and preloaded, which removes a render-blocking request to a third party and makes the first paint faster.",
        },
        {
          title: "Tests from the start",
          body: "Vitest and Testing Library cover over 80% of the code, with a coverage badge in the repo.",
        },
      ],
      result: [
        "A responsive playlist editor that searches, adds, removes and reorders tracks, and works on a phone as well as a desktop.",
      ],
    },
  },
];

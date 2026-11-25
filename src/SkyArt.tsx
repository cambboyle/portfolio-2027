import { useEffect, useRef, useState } from "react";
import earth from "./art/earth.json";
import { MOON_H, MOON_W, moonMap } from "./sky/moon";
import { isPaused, useMotionPaused } from "./motion";
import { type Body, getBodyOverride, nextBody, setBodyOverride, setIssTracking, useBodyOverride, useIssTracking } from "./sky/control";
import { cityGrid, cityLight } from "./sky/cities";
import { ISS_GIVE_UP_MS, ISS_POLL_MS, type IssFix, cellAt, fetchIss, issToScreen, place } from "./sky/iss";
import { moonPhase } from "./sky/moonPhase";
import { fixedPose, skyPose } from "./sky/orbit";
import { MARS_H, MARS_W, isPolarCap, marsMap, saturnBand } from "./sky/planets";
import { ringHit } from "./sky/rings";
import { cast, shipMatrix } from "./sky/ship";
import { type Theme, readTheme, useTheme } from "./theme";

const RAMP = " .,:;-=+*#%@";
const LEVELS = RAMP.length;
// the Earth's axis and the sun for today's date (see sky/orbit.ts); the sun is off to the left, so about half the
// globe is in shadow
const POSE = skyPose(new Date());
const SUN = POSE.sun;
// the Moon is lit from wherever the sun really is relative to it today: new moon the sun is behind it, first quarter
// off to the right (as seen from the northern hemisphere), full moon in front, last quarter off to the left
const PHASE = moonPhase(new Date());
const MOON_SUN = (() => {
  const v = [Math.sin(PHASE.angle), 0.12, -Math.cos(PHASE.angle)];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
// the ship is lit more from the front than the globes, so its side facing us reads clearly
const SHIP_SUN = (() => {
  const v = [-0.45, 0.55, 0.7];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const TURN_SECONDS: Record<Body, number> = { earth: 48, moon: 70, mars: 50, saturn: 30 };
// the tilt of each planet's axis, and how far it is tipped towards us: Saturn more, so its rings open out
const MARS_POSE = new Float32Array(fixedPose((25.2 * Math.PI) / 180, 0.3));
const SATURN_POSE = new Float32Array(fixedPose((26.7 * Math.PI) / 180, 0.5));
const SATURN_SIZE = 0.46; // Saturn is drawn smaller, to leave room for its rings
const FADE = 1.2; // seconds to fade one picture out and the next in
const SHIP_STAYS = 16; // seconds the ship is on screen
const shipEvery = () => 180 + Math.random() * 120; // it turns up every three to five minutes

const landBits = Uint8Array.from(atob(earth.land), (c) => c.charCodeAt(0));
const isLand = (x: number, y: number) => {
  const i = y * earth.w + x;
  return (landBits[i >> 3] & (1 << (i & 7))) !== 0;
};

/** A cheap per-cell number in [0, 1), fixed for each cell. */
const hash = (i: number) => {
  let h = Math.imul(i + 1, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type RGB = [number, number, number];
const css = ([r, g, b]: RGB) => `rgb(${r | 0},${g | 0},${b | 0})`;
/** One colour per brightness step, from faint to strong. */
const steps = (faint: RGB, strong: RGB) =>
  Array.from({ length: LEVELS }, (_, k) => {
    const f = 0.25 + 0.75 * (k / (LEVELS - 1));
    return css(faint.map((c, j) => c + (strong[j] - c) * f) as RGB);
  });

/**
 * Colours for each theme. On the dark page bright glyphs are light; on the light page they are dark ink, so the
 * same density ramp reads as a print on paper.
 */
const PALETTES = {
  dark: {
    moon: steps([40, 40, 44], [236, 230, 214]),
    land: steps([40, 40, 34], [214, 204, 160]),
    sea: steps([24, 32, 56], [110, 150, 230]),
    hull: steps([38, 40, 44], [190, 194, 202]),
    nightSea: "rgb(34,44,70)",
    nightLand: "rgb(70,68,56)",
    // how much more ink the sea and the night side get: none on the dark page, where faint is dark
    weight: 400,
    landLift: 0,
    seaLift: 0,
    nightSeaGlyph: 1,
    nightLandGlyph: 3,
    nightMoon: "rgb(44,46,54)",
    iss: "#ff7a59",
    mars: steps([48, 26, 20], [238, 148, 92]),
    saturn: steps([54, 46, 34], [238, 214, 168]),
    ring: steps([60, 56, 50], [224, 204, 170]),
    cap: "#eeeae0",
    nightMars: "rgb(40,26,24)",
    nightSaturn: "rgb(44,38,30)",
    city: "#f0b45a",
    cityGlyphs: [3, 1], // a bigger and a smaller light
    window: "#f0b45a",
    engine: steps([30, 80, 50], [150, 255, 160]),
    star: "#8a93a8",
  },
  light: {
    moon: steps([214, 208, 194], [52, 50, 48]),
    land: steps([120, 176, 70], [24, 120, 44]),
    sea: steps([96, 150, 230], [14, 84, 210]),
    hull: steps([214, 211, 204], [44, 46, 52]),
    nightSea: "rgb(18,34,112)",
    nightLand: "rgb(30,72,38)",
    // on the light page faint means pale, so the sea and the night side need heavier glyphs to show up
    weight: 700,
    landLift: 3,
    seaLift: 5,
    nightSeaGlyph: 11,
    nightLandGlyph: 10,
    nightMoon: "rgb(218,212,200)",
    iss: "#d1301a",
    mars: steps([226, 190, 160], [124, 44, 16]),
    saturn: steps([224, 206, 176], [112, 82, 36]),
    ring: steps([214, 204, 186], [92, 72, 42]),
    cap: "rgb(150,176,200)",
    nightMars: "rgb(96,46,28)",
    nightSaturn: "rgb(96,76,44)",
    city: "#ffc23d",
    cityGlyphs: [10, 8],
    window: "#c47a14",
    engine: steps([200, 224, 206], [10, 140, 50]),
    star: "#b9b2a2",
  },
};

/**
 * Everything about a cell that does not change as a globe turns: where it falls on the sphere and how much sunlight
 * it gets (the sun stays put while the globe turns underneath it). Which latitude and longitude it shows is worked
 * out each frame from the globe's orientation.
 */
function geometry(cols: number, rows: number, aspect: number, sun: number[] = SUN, scale = 1) {
  const n = cols * rows;
  const inside = new Uint8Array(n);
  const nx = new Float32Array(n); // where the cell falls on the unit sphere facing us, in screen coordinates
  const ny = new Float32Array(n);
  const nz = new Float32Array(n);
  const light = new Float32Array(n); // 0 in shadow, 1 in full sun
  const night = new Float32Array(n); // 1 deep on the night side, 0 in daylight
  const sx = new Float32Array(n); // the cell's position on screen, in globe radii, for the ship
  const sy = new Float32Array(n);
  const stars: number[] = [];
  const cx = cols / 2;
  const cy = rows / 2;
  const radius = cols * 0.42 * scale;
  for (let i = 0; i < n; i++) {
    const x = ((i % cols) + 0.5 - cx) / radius;
    const y = (-(((i / cols) | 0) + 0.5 - cy) * aspect) / radius;
    sx[i] = x;
    sy[i] = y;
    const r2 = x * x + y * y;
    if (r2 > 1) {
      if (hash(i * 7 + 3) < 0.012 && r2 > 1.08) stars.push(i);
      continue;
    }
    const z = Math.sqrt(1 - r2);
    inside[i] = 1;
    nx[i] = x;
    ny[i] = y;
    nz[i] = z;
    const d = x * sun[0] + y * sun[1] + z * sun[2];
    // a soft line between day and night, and a little darkening towards the edge of the disc
    light[i] = smooth(-0.08, 0.3, d) * (0.55 + 0.45 * Math.max(0, d)) * (0.75 + 0.25 * z);
    night[i] = smooth(0.0, -0.25, d);
  }
  return { inside, nx, ny, nz, light, night, sx, sy, stars };
}

/**
 * A globe's orientation is a 3×3 rotation (row-major) from screen coordinates to the globe's own: x right, y up,
 * z towards us on screen; in the globe's own frame y is the axis through the poles.
 */
type Mat = Float32Array;
const mul = (a: ArrayLike<number>, b: ArrayLike<number>, out: Mat) => {
  const r = new Float32Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  }
  out.set(r);
};
const rotX = (a: number) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotY = (a: number) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
/** Keeps the matrix a pure rotation after many small turns. */
const tidy = (o: Mat) => {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < i; j++) {
      const d = o[i * 3] * o[j * 3] + o[i * 3 + 1] * o[j * 3 + 1] + o[i * 3 + 2] * o[j * 3 + 2];
      for (let k = 0; k < 3; k++) o[i * 3 + k] -= d * o[j * 3 + k];
    }
    const l = Math.hypot(o[i * 3], o[i * 3 + 1], o[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) o[i * 3 + k] /= l;
  }
};
/** The starting pose: the axis as it really is today, turned so Africa and Europe start in the sunlight. */
const startPose = (out: Mat) => {
  out.set(POSE.orient);
  mul(rotY(2 * Math.PI * 0.1), out, out);
};

type Picture = Body | "ship";

export interface Sky {
  stop(): void;
  setTheme(theme: Theme): void;
  /** Stop (or carry on) turning; a stopped globe can still be dragged. */
  setPaused(paused: boolean): void;
  /** Show this body instead of the theme's own (null to go back to it). */
  setBody(body: Body | null): void;
  /** The recent positions of the space station, newest last, to show on the Earth (empty to hide it). */
  setIss(fixes: IssFix[]): void;
  /** Bring the ship in now (or send it away if it is already here). Does nothing on the light theme. */
  ship(): void;
}

function start(canvas: HTMLCanvasElement, cols: number, theme: Theme, picked: Body | null): Sky {
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = isPaused();
  // nothing animates by itself if the device asks for reduced motion or the visitor paused it; the canvas then
  // redraws only when something happens
  const still = () => reduced.matches || paused;
  let palette = PALETTES[theme];
  let rows = 0;
  let cw = 6;
  let ch = 10;
  let cssW = 0;
  let cssH = 0;
  let geo = geometry(1, 1, 1.8);
  let moonGeo = geo; // the same sphere lit by the Moon's phase
  let saturnGeo = geo; // a smaller sphere, with room round it for the rings
  let glyph = new Uint8Array(0);
  let override = picked; // a body picked by hand, until the theme changes
  const body = (): Body => override ?? (theme === "light" ? "earth" : "moon");
  let showing: Picture = body();
  let next: Picture | null = null; // fading towards this picture
  let fade = 0; // 0..2: fading out over the first half, in over the second
  const orient = new Float32Array(9);
  startPose(orient);
  let spin = 1 / TURN_SECONDS[body()]; // turns per second about the globe's own axis
  let drag: { x: number; y: number; t: number } | null = null;
  let flickX = 0; // after a drag, how fast it is still turning on screen (radians per second), easing off
  let flickY = 0;
  let t = 0;
  let shipAt = 0; // when the ship arrived
  let shipTurnFrom = 0; // when it started to turn: the moment the ship was called, so it is already turning as it fades in
  let shipDue = shipEvery();
  let raf = 0;
  let last = 0;
  const m = new Float32Array(9);

  const setFont = () => {
    ctx.font = `${palette.weight} ${Math.round(ch * 0.9)}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  };
  const size = () => {
    cssW = canvas.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = cssW / cols;
    ch = cw * 1.8;
    rows = Math.round(cssW / ch);
    cssH = rows * ch;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setFont();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    geo = geometry(cols, rows, ch / cw);
    moonGeo = geometry(cols, rows, ch / cw, MOON_SUN);
    saturnGeo = geometry(cols, rows, ch / cw, SUN, SATURN_SIZE);
    taken = new Uint8Array(cols * rows);
    glyph = new Uint8Array(cols * rows);
  };

  // cells grouped by colour each frame, so the canvas changes fill colour a few dozen times rather than thousands
  const buckets = new Map<string, number[]>();
  // which cells already have something drawn in them this frame, so the stars do not show through it
  let iss: IssFix[] = [];
  let labels: { text: string; x: number; y: number; right: boolean }[] = [];
  let taken = new Uint8Array(0);
  const add = (colour: string, i: number, g: number) => {
    let list = buckets.get(colour);
    if (!list) buckets.set(colour, (list = []));
    list.push(i);
    glyph[i] = g;
    taken[i] = 1;
  };


  // the lights of the world's cities; the small ones twinkle on and off slowly, the big ones stay lit
  const cities = cityGrid();
  const lit = (u: number, la: number, i: number) => {
    const c = cityLight(cities, u, la);
    return c >= 2 || (c === 1 && hash(i * 3 + Math.floor(t * 0.7)) > 0.25);
  };

  const drawGlobe = (which: Body) => {
    const g = which === "moon" ? moonGeo : which === "saturn" ? saturnGeo : geo;
    const { inside, nx, ny, nz, light, night } = g;
    const [o0, o1, o2, o3, o4, o5, o6, o7, o8] = orient;
    const moon = which === "moon" ? moonMap() : null;
    const marsBrightness = which === "mars" ? marsMap() : null;
    const lift = palette.landLift;
    if (which === "saturn") {
      // the rings first: where one is seen (beside the planet, or in front of it) it takes the cell
      const north = [o3, o4, o5];
      for (let i = 0; i < cols * rows; i++) {
        const hit = ringHit(g.sx[i], g.sy[i], north, SUN);
        if (!hit || !hit.seen || hit.brightness < 0.06) continue;
        const k = Math.max(1, Math.round(Math.min(1, hit.brightness) * (LEVELS - 1)));
        add(palette.ring[k], i, Math.min(LEVELS - 1, k + lift));
      }
    }
    if (which === "earth" && iss.length) {
      // the space station and the path it has just taken: marked first, so the globe leaves those cells alone
      const aspect = ch / cw;
      const last = iss.length - 1;
      iss.forEach((fix, n) => {
        const p = issToScreen(fix.lat, fix.lon, orient);
        if (p.z <= 0) return; // on the far side
        const cell = cellAt(p.x, p.y, cols, rows, aspect);
        if (cell < 0 || (taken[cell] && n < last)) return;
        if (n < last) return void add(palette.iss, cell, 1);
        add(palette.iss, cell, Math.floor(t * 2) % 2 ? 11 : 8);
        const col = cell % cols;
        const fast = String(Math.round(fix.velocity)).replace(/\B(?=(\d{3})+$)/g, ",");
        labels.push({
          text: `ISS ${Math.round(fix.altitude)} km · ${fast} km/h`,
          x: col * cw + (col > cols * 0.62 ? -cw * 0.5 : cw * 1.5),
          y: ((cell / cols) | 0) * ch + ch / 2,
          right: col > cols * 0.62,
        });
      });
    }
    for (let i = 0; i < cols * rows; i++) {
      if (!inside[i] || taken[i]) continue;
      // where on the globe this cell is looking, given how it is turned now
      const gx = o0 * nx[i] + o1 * ny[i] + o2 * nz[i];
      const gy = o3 * nx[i] + o4 * ny[i] + o5 * nz[i];
      const gz = o6 * nx[i] + o7 * ny[i] + o8 * nz[i];
      const la = Math.min(0.9999, (Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, gy)))) / Math.PI);
      const u = Math.atan2(gx, gz) / (2 * Math.PI) + 0.5;
      const l = light[i];
      if (moon) {
        // the square root flattens the lighting a little, so the seas and craters show through it
        const k = Math.round(Math.min(1, Math.sqrt(l) * moon[((la * MOON_H) | 0) * MOON_W + ((u * MOON_W) | 0)] * 0.95) * (LEVELS - 1));
        if (k > 1) add(palette.moon[k], i, k);
        else add(palette.nightMoon, i, 1);
        continue;
      }
      if (marsBrightness) {
        if (isPolarCap(la, hash(Math.floor(u * 64)))) {
          const k = Math.round(Math.min(1, Math.sqrt(l)) * (LEVELS - 1));
          if (k > 1) add(palette.cap, i, Math.min(LEVELS - 1, k + lift));
          else add(palette.nightMars, i, palette.nightLandGlyph);
          continue;
        }
        const k = Math.round(Math.min(1, Math.sqrt(l) * marsBrightness[((la * MARS_H) | 0) * MARS_W + ((u * MARS_W) | 0)] * 1.05) * (LEVELS - 1));
        if (k > 1) add(palette.mars[k], i, Math.min(LEVELS - 1, k + lift));
        else add(palette.nightMars, i, palette.nightLandGlyph);
        continue;
      }
      if (which === "saturn") {
        const k = Math.round(Math.min(1, Math.sqrt(l) * saturnBand(la, u)) * (LEVELS - 1));
        if (k > 1) add(palette.saturn[k], i, Math.min(LEVELS - 1, k + lift));
        else add(palette.nightSaturn, i, palette.nightLandGlyph);
        continue;
      }
      const mx = (u * earth.w) | 0;
      const my = (la * earth.h) | 0;
      if (isLand(mx, my)) {
        const k = Math.round(l * (LEVELS - 1));
        if (k > 1) add(palette.land[k], i, Math.min(LEVELS - 1, k + palette.landLift));
        // on the night side, a scattering of towns and cities glows through
        else if (night[i] > 0.4 && lit(u, la, i)) add(palette.city, i, palette.cityGlyphs[cityLight(cities, u, la) >= 2 ? 0 : 1]);
        else add(palette.nightLand, i, palette.nightLandGlyph);
      } else {
        // the sea is darker than land
        const k = Math.round(l * 0.5 * (LEVELS - 1));
        if (k > 1) add(palette.sea[Math.min(LEVELS - 1, k + 3 + palette.seaLift)], i, Math.min(LEVELS - 1, k + palette.seaLift));
        else add(palette.nightSea, i, palette.nightSeaGlyph);
      }
    }
  };

  const drawShip = () => {
    const { sx, sy } = geo;
    shipMatrix(((t - shipTurnFrom) * Math.PI * 2) / TURN_SECONDS.moon, m);
    for (let i = 0; i < cols * rows; i++) {
      // skip cells the station can never reach
      if (Math.abs(sy[i]) > 1.05 || Math.abs(sx[i]) > 1.05) continue;
      const hit = cast(sx[i], sy[i], m, SHIP_SUN);
      if (hit.kind === 0) continue;
      if (hit.kind === 1) {
        const k = Math.max(1, Math.round(hit.light * (LEVELS - 1)));
        add(palette.hull[k], i, k);
      } else if (hit.kind === 2) add(palette.window, i, 4);
      else add(palette.engine[LEVELS - 1], i, LEVELS - 1 - ((t * 6 + i) % 2 | 0));
    }
  };

  /** Each planet has its own tilt, so when the picture changes to or from one the globe is turned to suit it. */
  let posed: Picture = showing;
  const pose = (pic: Picture) => {
    if (pic === "ship" || pic === posed) return;
    if (pic === "mars") orient.set(MARS_POSE);
    else if (pic === "saturn") orient.set(SATURN_POSE);
    else if (posed === "mars" || posed === "saturn") startPose(orient);
    posed = pic;
  };
  pose(showing);

  const draw = () => {
    ctx.clearRect(0, 0, cssW, cssH);
    for (const list of buckets.values()) list.length = 0;
    taken.fill(0);
    labels = [];
    const pic = next && fade >= 1 ? next : showing;
    pose(pic);
    if (pic === "ship") drawShip();
    else drawGlobe(pic);
    // the stars, wherever nothing else has been drawn
    for (const i of (pic === "saturn" ? saturnGeo : geo).stars) {
      if (taken[i]) continue;
      const tw = Math.sin(t * 0.8 + hash(i) * 40);
      if (tw > -0.3) add(palette.star, i, tw > 0.7 ? 3 : 1);
    }
    for (const [colour, list] of buckets) {
      ctx.fillStyle = colour;
      for (const i of list) ctx.fillText(RAMP[glyph[i]], (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
    }
    if (labels.length) {
      // small labels in the page's colours, with a halo of the background so they read over the globe
      const bg = getComputedStyle(canvas).getPropertyValue("--bg") || (theme === "light" ? "#f4efe4" : "#0b0d12");
      ctx.font = `${palette.weight} ${Math.round(ch * 0.62)}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      for (const l of labels) {
        ctx.textAlign = l.right ? "right" : "left";
        ctx.strokeStyle = bg;
        ctx.strokeText(l.text, l.x, l.y);
        ctx.fillStyle = palette.iss;
        ctx.fillText(l.text, l.x, l.y);
      }
      setFont();
      ctx.textAlign = "center";
    }
    // fading between pictures: lay the background colour over the top, thickest at the swap
    if (next) {
      const a = 1 - Math.abs(fade - 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--bg") || (theme === "light" ? "#f4efe4" : "#0b0d12");
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalAlpha = 1;
    }
  };

  const switchTo = (pic: Picture) => {
    if (pic === (next ?? showing)) return;
    next = pic;
    fade = 0;
    if (pic === "ship") shipTurnFrom = t;
    if (still()) finishFade();
  };
  const finishFade = () => {
    if (!next) return;
    showing = next;
    next = null;
    if (showing === "ship") shipAt = t;
    else spin = 1 / TURN_SECONDS[body()];
    if (still()) draw();
  };

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    if (dt >= 1 / 30) {
      last = now;
      t += dt;
      if (next) {
        fade += (dt / FADE) * 2;
        if (fade >= 2) finishFade();
      }
      if (showing === "ship" && !next && t - shipAt > SHIP_STAYS) {
        switchTo(body());
        shipDue = t + shipEvery();
      }
      if (showing !== "ship" && !next && t > shipDue && theme === "dark") switchTo("ship");
      if (!drag) {
        // it turns about its own axis at its own pace, plus whatever is left of the last flick, which dies away
        turnBy(0, 0, 2 * Math.PI * spin * dt);
        const keep = Math.exp(-dt * 2.2);
        flickX *= keep;
        flickY *= keep;
        if (Math.abs(flickX) + Math.abs(flickY) > 0.001) turnBy(flickX * dt, flickY * dt, 0);
      }
      draw();
    }
    raf = requestAnimationFrame(frame);
  };

  /**
   * Turns the globe: `right` and `down` are angles on screen (the surface follows the finger), `around` is a turn
   * about the globe's own axis.
   */
  const turnBy = (right: number, down: number, around: number) => {
    if (around) mul(rotY(-around), orient, orient);
    if (right || down) mul(orient, mul2(rotY(-right), rotX(-down)), orient);
    tidy(orient);
  };
  const mul2 = (a: number[], b: number[]) => {
    const r = new Float32Array(9);
    mul(a, b, r);
    return r;
  };

  // drag the globe any way, like a ball; let go and it keeps coasting for a moment, then settles to its own spin
  // holding still on the globe for most of a second moves on to the next body (the touch-screen way in)
  let hold: { x: number; y: number; timer: number } | null = null;
  const endHold = () => {
    if (hold) clearTimeout(hold.timer);
    hold = null;
  };
  const onDown = (e: PointerEvent) => {
    endHold();
    hold = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => (setBodyOverride(nextBody(body())), (hold = null)), 800) };
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    flickX = flickY = 0;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 6) endHold();
    if (!drag) return;
    const now = performance.now();
    const right = ((e.clientX - drag.x) / cssW) * Math.PI;
    const down = ((e.clientY - drag.y) / cssW) * Math.PI;
    const secs = Math.max(0.016, (now - drag.t) / 1000);
    turnBy(right, down, 0);
    flickX = Math.max(-4, Math.min(4, right / secs));
    flickY = Math.max(-4, Math.min(4, down / secs));
    drag = { x: e.clientX, y: e.clientY, t: now };
    if (still()) draw();
  };
  const onUp = () => {
    endHold();
    // a pause before letting go means no flick
    if (drag && performance.now() - drag.t > 80) flickX = flickY = 0;
    drag = null;
  };
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !still()) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  size();
  let lastW = canvas.clientWidth;
  let pending = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      if (canvas.clientWidth === lastW) return;
      lastW = canvas.clientWidth;
      size();
      draw();
    });
  });
  ro.observe(canvas);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  document.addEventListener("visibilitychange", onVisibility);

  if (still()) draw();
  else raf = requestAnimationFrame(frame);

  let stopped = false;
  Promise.all([document.fonts?.load('400 14px "JetBrains Mono"'), document.fonts?.load('700 14px "JetBrains Mono"')]).then(() => {
    if (stopped) return;
    size();
    draw();
  });

  return {
    stop() {
      stopped = true;
      endHold();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
    },
    setIss(fixes: IssFix[]) {
      iss = fixes;
      if (still()) draw();
    },
    setBody(next: Body | null) {
      override = next;
      if (showing !== "ship") switchTo(body());
    },
    setTheme(next: Theme) {
      if (next !== theme) override = null; // a new theme goes back to its own body
      theme = next;
      palette = PALETTES[theme];
      setFont();
      // the station only visits on the dark theme: on the light one it is sent away
      if (showing !== "ship" || theme === "light") switchTo(body());
      // during the theme change there is nothing to fade, so swap pictures at once
      if (document.documentElement.hasAttribute("data-theme-cover")) {
        finishFade();
        draw(); // the page is being photographed for the transition, so do not wait for the next frame
      }
      if (still()) draw();
      if (theme === "dark") shipDue = Math.max(shipDue, t + 60);
    },
    setPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      cancelAnimationFrame(raf);
      if (paused) {
        // stop where it is, but let a fade in progress finish so it is not left half-drawn
        finishFade();
        draw();
      } else if (!reduced.matches && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    ship() {
      if (theme === "light") return;
      if ((next ?? showing) === "ship") {
        switchTo(body());
      } else switchTo("ship");
      shipDue = t + shipEvery();
    },
  };
}

const NARROW = "(max-width: 600px)";

/** A line of facts for each body, shown for a few seconds when it is picked by hand. */
const FACTS: Record<Body, () => string> = {
  earth: () => "earth · a day is 24 hours · axis tilted 23.4° · 71% ocean",
  moon: () => `moon · ${PHASE.name} tonight · always shows us the same face`,
  mars: () => "mars · a day is 24h 37m · axis tilted 25° · a year is 687 days",
  saturn: () => "saturn · a day is 10h 33m · axis tilted 27° · rings 280,000 km wide and about 10 m thick",
};

const LABELS: Record<Theme, string> = {
  light: "The Earth drawn in characters, slowly turning, half of it in night",
  dark: "The Moon drawn in characters, slowly turning",
};

/** The Earth on the light theme, the Moon on the dark one, and now and then, on the dark theme only, a visitor. Double-click to call it. */
export function SkyArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  const sky = useRef<Sky | null>(null);
  const theme = useTheme();
  const paused = useMotionPaused();
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== "undefined" && matchMedia(NARROW).matches);

  useEffect(() => {
    const query = matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const s = start(ref.current!, narrow ? 64 : 104, readTheme(), getBodyOverride());
    sky.current = s;
    return () => {
      s.stop();
      sky.current = null;
    };
  }, [narrow]);

  // a change of theme (not the first render) puts the globe back to the theme's own body
  const lastTheme = useRef(theme);
  useEffect(() => {
    if (!theme) return;
    if (lastTheme.current && lastTheme.current !== theme) setBodyOverride(null);
    lastTheme.current = theme;
    sky.current?.setTheme(theme);
  }, [theme]);

  // the space station: only while asked for, asking the API every few seconds, and giving up after ten minutes
  const tracking = useIssTracking();
  const [issNote, setIssNote] = useState("");
  useEffect(() => {
    if (!tracking) {
      sky.current?.setIss([]);
      return;
    }
    const fixes: IssFix[] = [];
    const controller = new AbortController();
    let first = true;
    const poll = async () => {
      if (document.hidden) return;
      const fix = await fetchIss(controller.signal);
      if (controller.signal.aborted) return;
      if (!fix) {
        if (first) {
          setIssNote("couldn't reach the space station's position (offline?)");
          setIssTracking(false);
        }
        return;
      }
      first = false;
      fixes.push(fix);
      if (fixes.length > 10) fixes.shift();
      sky.current?.setIss([...fixes]);
      setIssNote(`ISS · ${Math.round(fix.altitude)} km up · over ${place(fix.lat, fix.lon)} · drag the globe to find it`);
    };
    void poll();
    const every = setInterval(poll, ISS_POLL_MS);
    const giveUp = setTimeout(() => setIssTracking(false), ISS_GIVE_UP_MS);
    return () => {
      controller.abort();
      clearInterval(every);
      clearTimeout(giveUp);
      sky.current?.setIss([]);
    };
  }, [tracking]);

  const picked = useBodyOverride();
  const [caption, setCaption] = useState("");
  useEffect(() => {
    sky.current?.setBody(picked);
    // a line of facts about the body, for a few seconds
    setCaption(picked ? FACTS[picked]() : "");
    if (!picked) return;
    const id = setTimeout(() => setCaption(""), 7000);
    return () => clearTimeout(id);
  }, [picked]);

  useEffect(() => {
    sky.current?.setPaused(paused);
  }, [paused]);

  // today's phase is only known in the browser, so it is added to the description after the page has loaded
  const [phaseNote, setPhaseNote] = useState("");
  useEffect(() => setPhaseNote(`, tonight a ${PHASE.name}, ${Math.round(PHASE.illumination * 100)}% lit`), []);

  return (
    <div className="pagoda-wrap earth-wrap">
      <canvas
        ref={ref}
        className="earth"
        style={{ aspectRatio: "1 / 1", touchAction: "pan-y" }}
        onDoubleClick={() => sky.current?.ship()}
        role="img"
        aria-label={(theme ?? "dark") === "dark" ? LABELS.dark + phaseNote : LABELS.light}
      />
      <p className="sky-caption" aria-live="polite">{issNote && tracking ? issNote : caption || (issNote.startsWith("couldn") ? issNote : "")}</p>
    </div>
  );
}

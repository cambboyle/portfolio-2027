import { useEffect, useRef, useState } from "react";
import earth from "./art/earth.json";
import { MOON_H, MOON_W, moonMap } from "./sky/moon";
import { isPaused, useMotionPaused } from "./motion";
import { skyPose } from "./sky/orbit";
import { cast, shipMatrix } from "./sky/ship";
import { type Theme, readTheme, useTheme } from "./theme";

const RAMP = " .,:;-=+*#%@";
const LEVELS = RAMP.length;
// the Earth's axis and the sun for today's date (see sky/orbit.ts); the sun is off to the left, so about half the
// globe is in shadow
const POSE = skyPose(new Date());
const SUN = POSE.sun;
// the ship is lit more from the front than the globes, so its side facing us reads clearly
const SHIP_SUN = (() => {
  const v = [-0.45, 0.55, 0.7];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const TURN_SECONDS = { earth: 48, moon: 70 };
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
function geometry(cols: number, rows: number, aspect: number) {
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
  const radius = cols * 0.42;
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
    const d = x * SUN[0] + y * SUN[1] + z * SUN[2];
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

type Picture = "earth" | "moon" | "ship";

export interface Sky {
  stop(): void;
  setTheme(theme: Theme): void;
  /** Stop (or carry on) turning; a stopped globe can still be dragged. */
  setPaused(paused: boolean): void;
  /** Bring the ship in now (or send it away if it is already here). Does nothing on the light theme. */
  ship(): void;
}

function start(canvas: HTMLCanvasElement, cols: number, theme: Theme): Sky {
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
  let glyph = new Uint8Array(0);
  const body = (): "earth" | "moon" => (theme === "light" ? "earth" : "moon");
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
    glyph = new Uint8Array(cols * rows);
  };

  // cells grouped by colour each frame, so the canvas changes fill colour a few dozen times rather than thousands
  const buckets = new Map<string, number[]>();
  const add = (colour: string, i: number, g: number) => {
    let list = buckets.get(colour);
    if (!list) buckets.set(colour, (list = []));
    list.push(i);
    glyph[i] = g;
  };

  const drawGlobe = (which: "earth" | "moon") => {
    const { inside, nx, ny, nz, light, night } = geo;
    const [o0, o1, o2, o3, o4, o5, o6, o7, o8] = orient;
    const moon = which === "moon" ? moonMap() : null;
    for (let i = 0; i < cols * rows; i++) {
      if (!inside[i]) continue;
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
      const mx = (u * earth.w) | 0;
      const my = (la * earth.h) | 0;
      if (isLand(mx, my)) {
        const k = Math.round(l * (LEVELS - 1));
        if (k > 1) add(palette.land[k], i, Math.min(LEVELS - 1, k + palette.landLift));
        // on the night side, a scattering of towns and cities glows through
        else if (night[i] > 0.4 && hash(((my / 6) | 0) * 1000 + ((mx / 6) | 0)) < 0.06) add(palette.city, i, palette.cityGlyphs[hash(((my / 6) | 0) * 77 + ((mx / 6) | 0)) < 0.3 ? 0 : 1]);
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

  const draw = () => {
    ctx.clearRect(0, 0, cssW, cssH);
    for (const list of buckets.values()) list.length = 0;
    for (const i of geo.stars) {
      const tw = Math.sin(t * 0.8 + hash(i) * 40);
      if (tw > -0.3) add(palette.star, i, tw > 0.7 ? 3 : 1);
    }
    const pic = next && fade >= 1 ? next : showing;
    if (pic === "ship") drawShip();
    else drawGlobe(pic);
    for (const [colour, list] of buckets) {
      ctx.fillStyle = colour;
      for (const i of list) ctx.fillText(RAMP[glyph[i]], (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
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
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    flickX = flickY = 0;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
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
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
    },
    setTheme(next: Theme) {
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

const LABELS: Record<Theme, string> = {
  light: "The Earth drawn in characters, slowly turning, half of it in night",
  dark: "The Moon drawn in characters, slowly turning, half of it in shadow",
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
    const s = start(ref.current!, narrow ? 64 : 104, readTheme());
    sky.current = s;
    return () => {
      s.stop();
      sky.current = null;
    };
  }, [narrow]);

  useEffect(() => {
    if (theme) sky.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    sky.current?.setPaused(paused);
  }, [paused]);

  return (
    <div className="pagoda-wrap earth-wrap">
      <canvas
        ref={ref}
        className="earth"
        style={{ aspectRatio: "1 / 1", touchAction: "pan-y" }}
        onDoubleClick={() => sky.current?.ship()}
        role="img"
        aria-label={LABELS[theme ?? "dark"]}
      />
    </div>
  );
}

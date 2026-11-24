import { useEffect, useRef, useState } from "react";
import earth from "./art/earth.json";
import { MOON_H, MOON_W, moonMap } from "./sky/moon";
import { cast, shipMatrix } from "./sky/ship";
import { type Theme, readTheme, useTheme } from "./theme";

const RAMP = " .,:;-=+*#%@";
const LEVELS = RAMP.length;
const TILT = (23.4 * Math.PI) / 180; // the axis leans over, as the Earth's does
const TIP = (12 * Math.PI) / 180; // and the north pole tips a little towards us
const SUN = (() => {
  // the sun sits off to the left, a touch above and slightly in front, so about half the globe is in shadow
  const v = [-0.9, 0.3, 0.3];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
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
    hull: steps([36, 40, 50], [196, 204, 220]),
    nightSea: "rgb(34,44,70)",
    nightLand: "rgb(70,68,56)",
    nightMoon: "rgb(44,46,54)",
    city: "#f0b45a",
    window: "#f0b45a",
    engine: steps([30, 60, 80], [150, 230, 255]),
    star: "#8a93a8",
  },
  light: {
    moon: steps([214, 208, 194], [52, 50, 48]),
    land: steps([214, 206, 180], [70, 86, 44]),
    sea: steps([200, 208, 222], [36, 74, 160]),
    hull: steps([214, 210, 200], [40, 44, 58]),
    nightSea: "rgb(222,216,203)",
    nightLand: "rgb(204,197,176)",
    nightMoon: "rgb(218,212,200)",
    city: "#c47a14",
    window: "#c47a14",
    engine: steps([200, 220, 228], [10, 120, 175]),
    star: "#b9b2a2",
  },
};

/**
 * Everything about a cell that does not change as a globe turns: where it falls on the sphere, its latitude,
 * and how much sunlight it gets (the sun stays put while the globe turns underneath it).
 */
function geometry(cols: number, rows: number, aspect: number) {
  const n = cols * rows;
  const inside = new Uint8Array(n);
  const lat = new Float32Array(n); // 0 at the north pole, 1 at the south
  const lon = new Float32Array(n); // longitude as a fraction of a turn, before rotation
  const light = new Float32Array(n); // 0 in shadow, 1 in full sun
  const night = new Float32Array(n); // 1 deep on the night side, 0 in daylight
  const sx = new Float32Array(n); // the cell's position on screen, in globe radii, for the ship
  const sy = new Float32Array(n);
  const stars: number[] = [];
  const cx = cols / 2;
  const cy = rows / 2;
  const radius = cols * 0.42;
  const [ct, st, cp, sp] = [Math.cos(TILT), Math.sin(TILT), Math.cos(TIP), Math.sin(TIP)];
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
    // undo the tilt (around the view axis) and the tip (around the horizontal axis) to get the globe's own frame
    const x1 = x * ct + y * st;
    const y1 = -x * st + y * ct;
    const gy = y1 * cp - z * sp;
    const gz = y1 * sp + z * cp;
    inside[i] = 1;
    lat[i] = Math.min(0.9999, (Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, gy)))) / Math.PI);
    lon[i] = Math.atan2(x1, gz) / (2 * Math.PI) + 0.5;
    const d = x * SUN[0] + y * SUN[1] + z * SUN[2];
    // a soft line between day and night, and a little darkening towards the edge of the disc
    light[i] = smooth(-0.08, 0.3, d) * (0.55 + 0.45 * Math.max(0, d)) * (0.75 + 0.25 * z);
    night[i] = smooth(0.0, -0.25, d);
  }
  return { inside, lat, lon, light, night, sx, sy, stars };
}

type Picture = "earth" | "moon" | "ship";

export interface Sky {
  stop(): void;
  setTheme(theme: Theme): void;
  /** Bring the ship in now (or send it away if it is already here). */
  ship(): void;
}

function start(canvas: HTMLCanvasElement, cols: number, theme: Theme): Sky {
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
  let turn = 0.1; // start with Africa and Europe in the sunlight
  let spin = 1 / TURN_SECONDS[body()];
  let drag: { x: number; t: number } | null = null;
  let t = 0;
  let shipAt = 0; // when the ship arrived
  let shipDue = shipEvery();
  let raf = 0;
  let last = 0;
  const m = new Float32Array(9);

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
    ctx.font = `${Math.round(ch * 0.9)}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
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
    const { inside, lat, lon, light, night } = geo;
    const moon = which === "moon" ? moonMap() : null;
    for (let i = 0; i < cols * rows; i++) {
      if (!inside[i]) continue;
      let u = lon[i] + turn;
      u -= Math.floor(u);
      const l = light[i];
      if (moon) {
        // the square root flattens the lighting a little, so the seas and craters show through it
        const k = Math.round(Math.min(1, Math.sqrt(l) * moon[((lat[i] * MOON_H) | 0) * MOON_W + ((u * MOON_W) | 0)] * 0.95) * (LEVELS - 1));
        if (k > 1) add(palette.moon[k], i, k);
        else add(palette.nightMoon, i, 1);
        continue;
      }
      const mx = (u * earth.w) | 0;
      const my = (lat[i] * earth.h) | 0;
      if (isLand(mx, my)) {
        const k = Math.round(l * (LEVELS - 1));
        if (k > 1) add(palette.land[k], i, k);
        // on the night side, a scattering of towns and cities glows through
        else if (night[i] > 0.4 && hash(my * earth.w + mx) < 0.08) add(palette.city, i, hash(mx + my) < 0.3 ? 3 : 1);
        else add(palette.nightLand, i, 3);
      } else {
        // the sea is darker than land
        const k = Math.round(l * 0.5 * (LEVELS - 1));
        if (k > 1) add(palette.sea[Math.min(LEVELS - 1, k + 3)], i, k);
        else add(palette.nightSea, i, 1);
      }
    }
  };

  const drawShip = () => {
    const { sx, sy } = geo;
    shipMatrix(0.35 + (t - shipAt) * 0.18, m);
    for (let i = 0; i < cols * rows; i++) {
      // the ship is long and low: skip cells it can never reach
      if (Math.abs(sy[i]) > 0.75 || Math.abs(sx[i]) > 1.15) continue;
      const hit = cast(sx[i], sy[i], m, SHIP_SUN);
      if (hit.kind === 0) continue;
      if (hit.kind === 1) {
        const k = Math.max(1, Math.round(hit.light * (LEVELS - 1)));
        add(palette.hull[k], i, k);
      } else if (hit.kind === 2) add(palette.window, i, 4);
      else if (hit.kind === 3) add(palette.engine[LEVELS - 1], i, LEVELS - 1 - ((t * 6 + i) % 2 | 0));
      else {
        const k = Math.max(1, Math.round(hit.light * 5 * (0.8 + 0.2 * Math.sin(t * 9))));
        add(palette.engine[k + 2], i, k);
      }
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
    if (reduced.matches) finishFade();
  };
  const finishFade = () => {
    if (!next) return;
    showing = next;
    next = null;
    if (showing === "ship") shipAt = t;
    else spin = 1 / TURN_SECONDS[body()];
    if (reduced.matches) draw();
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
      if (showing !== "ship" && !next && t > shipDue) switchTo("ship");
      if (!drag) spin += (1 / TURN_SECONDS[body()] - spin) * Math.min(1, dt * 1.2);
      turn += spin * dt;
      draw();
    }
    raf = requestAnimationFrame(frame);
  };

  // drag sideways to spin the globe; let go and it eases back to its own pace
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, t: performance.now() };
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const now = performance.now();
    const dx = (e.clientX - drag.x) / cssW;
    turn -= dx * 0.5;
    spin = Math.max(-1.5, Math.min(1.5, (-dx * 0.5) / Math.max(0.016, (now - drag.t) / 1000)));
    drag = { x: e.clientX, t: now };
    if (reduced.matches) draw();
  };
  const onUp = () => (drag = null);
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduced.matches) {
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

  if (reduced.matches) draw();
  else raf = requestAnimationFrame(frame);

  let stopped = false;
  document.fonts?.load('400 14px "JetBrains Mono"').then(() => {
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
      if (showing !== "ship") switchTo(body());
      else if (reduced.matches) draw();
    },
    ship() {
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

/** The Earth on the light theme, the Moon on the dark one, and now and then a visitor. Double-click to call it. */
export function SkyArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  const sky = useRef<Sky | null>(null);
  const theme = useTheme();
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

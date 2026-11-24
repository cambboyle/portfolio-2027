import { useEffect, useRef, useState } from "react";
import earth from "./art/earth.json";

const RAMP = " .,:;-=+*#%@";
const LEVELS = RAMP.length;
const TILT = (23.4 * Math.PI) / 180; // the axis leans over, as the real one does
const TIP = (12 * Math.PI) / 180; // and the north pole tips a little towards us
const SUN = (() => {
  // the sun sits off to the left, a touch above and only slightly in front, so about half the globe is in shadow
  const v = [-0.9, 0.3, 0.3];
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as [number, number, number];
})();
const TURN_SECONDS = 48; // one full turn

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

/** Colours for each brightness step, built once: sea is a muted blue, land a warm sage, lights on the night side amber. */
const shades = (r: number, g: number, b: number) =>
  Array.from({ length: LEVELS }, (_, k) => {
    const f = 0.35 + 0.65 * (k / (LEVELS - 1));
    return `rgb(${(r * f) | 0},${(g * f) | 0},${(b * f) | 0})`;
  });
const SEA = shades(110, 150, 230);
const LAND = shades(214, 204, 160);
const CITY = "#f0b45a";
// the night side is drawn very faintly, so the globe still reads as round
const NIGHT_SEA = "rgb(34,44,70)";
const NIGHT_LAND = "rgb(70,68,56)";
const STAR = "#8a93a8";

/**
 * Everything about a cell that does not change as the globe turns: where it falls on the sphere, which row of the
 * map it reads, and how much sunlight it gets (the sun stays put while the Earth turns underneath it).
 */
function geometry(cols: number, rows: number, aspect: number) {
  const n = cols * rows;
  const inside = new Uint8Array(n);
  const mapY = new Uint16Array(n);
  const lon = new Float32Array(n); // longitude as a fraction of a turn, before rotation
  const light = new Float32Array(n); // 0 in shadow, 1 in full sun
  const night = new Float32Array(n); // 1 deep on the night side, 0 in daylight
  const stars: number[] = [];
  const cx = cols / 2;
  const cy = rows / 2;
  const radius = cols * 0.42;
  const [ct, st, cp, sp] = [Math.cos(TILT), Math.sin(TILT), Math.cos(TIP), Math.sin(TIP)];
  for (let i = 0; i < n; i++) {
    const x = ((i % cols) + 0.5 - cx) / radius;
    const y = -(((i / cols) | 0) + 0.5 - cy) * aspect / radius;
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
    const lat = Math.asin(Math.max(-1, Math.min(1, gy)));
    inside[i] = 1;
    mapY[i] = Math.min(earth.h - 1, (((Math.PI / 2 - lat) / Math.PI) * earth.h) | 0);
    lon[i] = Math.atan2(x1, gz) / (2 * Math.PI) + 0.5;
    const d = x * SUN[0] + y * SUN[1] + z * SUN[2];
    // a soft terminator, and a little darkening towards the edge of the disc
    light[i] = smooth(-0.08, 0.3, d) * (0.55 + 0.45 * Math.max(0, d)) * (0.75 + 0.25 * z);
    night[i] = smooth(0.0, -0.25, d);
  }
  return { inside, mapY, lon, light, night, stars };
}

function start(canvas: HTMLCanvasElement, cols: number) {
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let rows = 0;
  let cw = 6;
  let ch = 10;
  let cssW = 0;
  let cssH = 0;
  let geo = geometry(1, 1, 1.8);
  let turn = 0.1; // start with Africa and Europe in the sunlight
  let spin = 1 / TURN_SECONDS; // turns per second; a drag changes it, then it eases back
  let drag: { x: number; t: number } | null = null;
  let t = 0;
  let raf = 0;
  let last = 0;
  let glyph = new Uint8Array(0);

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

  const draw = () => {
    ctx.clearRect(0, 0, cssW, cssH);
    for (const list of buckets.values()) list.length = 0;
    const add = (colour: string, i: number, g: number) => {
      let list = buckets.get(colour);
      if (!list) buckets.set(colour, (list = []));
      list.push(i);
      glyph[i] = g;
    };
    const { inside, mapY, lon, light, night, stars } = geo;
    for (let i = 0; i < cols * rows; i++) {
      if (!inside[i]) continue;
      let u = lon[i] + turn;
      u -= Math.floor(u);
      const mx = Math.min(earth.w - 1, (u * earth.w) | 0);
      const land = isLand(mx, mapY[i]);
      const l = light[i];
      if (land) {
        const k = Math.round(l * (LEVELS - 1));
        if (k > 1) add(LAND[k], i, k);
        // on the night side, a scattering of towns and cities glows through
        else if (night[i] > 0.4 && hash(mapY[i] * earth.w + mx) < 0.08) add(CITY, i, hash(mx + mapY[i]) < 0.3 ? 3 : 1);
        else add(NIGHT_LAND, i, 3);
      } else {
        // the sea is darker than land
        const k = Math.round(l * 0.5 * (LEVELS - 1));
        if (k > 1) add(SEA[Math.min(LEVELS - 1, k + 3)], i, k);
        else add(NIGHT_SEA, i, 1);
      }
    }
    for (const i of stars) {
      const tw = Math.sin(t * 0.8 + hash(i) * 40);
      if (tw > -0.3) add(STAR, i, tw > 0.7 ? 3 : 1);
    }
    for (const [colour, list] of buckets) {
      ctx.fillStyle = colour;
      for (const i of list) ctx.fillText(RAMP[glyph[i]], (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
    }
  };

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    if (dt >= 1 / 30) {
      last = now;
      t += dt;
      if (!drag) spin += (1 / TURN_SECONDS - spin) * Math.min(1, dt * 1.2);
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

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(pending);
    ro.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

const NARROW = "(max-width: 600px)";

export function EarthArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== "undefined" && matchMedia(NARROW).matches);

  useEffect(() => {
    const query = matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => start(ref.current!, narrow ? 64 : 104), [narrow]);

  return (
    <div className="pagoda-wrap earth-wrap">
      <canvas
        ref={ref}
        className="earth"
        style={{ aspectRatio: "1 / 1", touchAction: "pan-y" }}
        role="img"
        aria-label="The Earth drawn in characters, slowly turning, half of it in night"
      />
    </div>
  );
}

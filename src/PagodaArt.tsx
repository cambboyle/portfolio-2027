import { useEffect, useRef, useState } from "react";

const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** A cheap per-cell number in [0, 1), fixed for each cell, so every cell twinkles on its own clock. */
const phaseOf = (i: number) => {
  let h = Math.imul(i + 1, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

interface ArtFile {
  cols: number;
  rows: number;
  ramp: string;
  chars: string;
  rgb: string;
  lum: string;
  edge: string;
}

/** Turns a saved picture into what the drawing code needs. */
function prepare(data: ArtFile) {
  const { cols, rows, ramp, chars } = data;
  const rgb = decode(data.rgb);
  const lum = decode(data.lum);
  const edge = decode(data.edge);
  const n = cols * rows;
  // The colour of every cell as a ready-made string, so a frame never has to build thousands of them.
  const colours = Array.from({ length: n }, (_, i) => {
    const f = (0.95 + 0.25 * (lum[i] / 255)) * (edge[i] === 1 ? 1.12 : 1);
    const c = (k: number) => Math.min(255, (rgb[i * 3 + k] * f) | 0);
    return `rgb(${c(0)},${c(1)},${c(2)})`;
  });
  const phases = Float32Array.from({ length: n }, (_, i) => phaseOf(i));
  // Cells whose glyph can twinkle: everything but spaces and lines.
  const twinklers = Array.from({ length: n }, (_, i) => i).filter((i) => chars[i] !== " " && edge[i] !== 1);
  return { cols, rows, ramp, chars, colours, phases, twinklers };
}

type Art = ReturnType<typeof prepare>;

/** Phones get a coarser picture with bigger characters; only the one that is needed is downloaded. */
async function loadArt(narrow: boolean): Promise<Art> {
  const file = narrow ? await import("./art/pagoda-small.json") : await import("./art/pagoda.json");
  return prepare(file.default);
}

interface Petal {
  x: number;
  y: number;
  spin: number;
  seed: number;
  kx: number; // push left over from a click, fading away
  ky: number;
}

const PETAL_GLYPHS = "*`,.'";

/**
 * The pagoda as characters, redrawn every frame with three small movements:
 * the bright sky twinkles, the glow breathes, and a few petals drift past on the wind.
 */
function start(canvas: HTMLCanvasElement, art: Art) {
  const { cols, rows, ramp, chars, colours, phases, twinklers } = art;
  const ctx = canvas.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const petals: Petal[] = Array.from({ length: 26 }, (_, i) => ({
    x: Math.random() * cols,
    y: Math.random() * rows,
    spin: 2 + Math.random() * 3,
    seed: Math.random() * 10 + i,
    kx: 0,
    ky: 0,
  }));
  let raf = 0;
  let last = 0;
  let t = 0;
  let cw = 6;
  let ch = 10;
  let pointer: { x: number; y: number } | null = null;
  // The whole picture, drawn once per size. Each frame copies it and redraws only the cells that twinkle.
  const still = document.createElement("canvas");
  let cssW = 0;
  let cssH = 0;

  const size = () => {
    cssW = canvas.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = cssW / cols;
    ch = cw * 1.8;
    cssH = ch * rows;
    canvas.width = still.width = Math.round(cssW * dpr);
    canvas.height = still.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    const font = `${Math.round(ch * 0.9)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    for (const c of [ctx, still.getContext("2d")!]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.font = font;
      c.textAlign = "center";
      c.textBaseline = "middle";
    }
    const s = still.getContext("2d")!;
    for (let i = 0; i < cols * rows; i++) {
      if (chars[i] === " ") continue;
      s.fillStyle = colours[i];
      s.fillText(chars[i], (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, cssW, cssH);
    const breathe = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.55));
    ctx.globalAlpha = breathe;
    ctx.drawImage(still, 0, 0, cssW, cssH);
    // twinkle: now and then a cell's glyph steps one place up or down the ramp
    for (const i of twinklers) {
      const w = Math.sin(t * 0.9 + phases[i] * 6.2832);
      if (w < 0.8 && w > -0.8) continue;
      const idx = Math.max(1, Math.min(ramp.length - 1, ramp.indexOf(chars[i]) + (w > 0 ? 1 : -1)));
      const x = (i % cols) * cw;
      const y = ((i / cols) | 0) * ch;
      ctx.globalAlpha = 1;
      ctx.clearRect(x, y, cw, ch);
      ctx.globalAlpha = breathe;
      ctx.fillStyle = colours[i];
      ctx.fillText(ramp[idx], x + cw / 2, y + ch / 2);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#f6b9c8";
    for (const p of petals) {
      ctx.fillText(PETAL_GLYPHS[Math.floor(t * p.spin + p.seed) % PETAL_GLYPHS.length], p.x * cw + cw / 2, p.y * ch + ch / 2);
    }
  };

  const step = (dt: number) => {
    t += dt;
    // wind comes in slow gusts; petals follow it with a little flutter of their own
    const k = cols / 96; // keep the petals moving at the same pace on a finer grid
    const gust = 1 + 0.7 * Math.sin(t * 0.4) * Math.sin(t * 0.13 + 1);
    for (const p of petals) {
      let vx = 2.4 * k * gust + Math.sin(t * 1.3 + p.seed) * 0.9 * k;
      let vy = 2.6 * k + Math.cos(t * 1.1 + p.seed * 1.7) * 0.8 * k;
      if (pointer) {
        const dx = p.x - pointer.x;
        const dy = (p.y - pointer.y) * 1.8;
        const d = Math.hypot(dx, dy);
        if (d < 10 * k) {
          vx += (dx / (d || 1)) * (10 * k - d) * 0.8;
          vy += (dy / (d || 1)) * (10 * k - d) * 0.4;
        }
      }
      vx += p.kx;
      vy += p.ky;
      const fade = Math.exp(-dt * 1.6);
      p.kx *= fade;
      p.ky *= fade;
      p.x += vx * dt;
      p.y += vy * dt;
      if (p.x > cols + 2) p.x = -2;
      if (p.y > rows + 1) {
        p.y = -1;
        p.x = Math.random() * cols;
      }
    }
  };

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    if (dt >= 1 / 30) {
      last = now;
      step(dt);
      draw();
    }
    raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: ((e.clientX - rect.left) / rect.width) * cols, y: ((e.clientY - rect.top) / rect.height) * rows };
  };
  // a click or tap sends a gust out from that spot: nearby petals are thrown away from it
  const onDown = (e: PointerEvent) => {
    onMove(e);
    if (!pointer) return;
    const k = cols / 96;
    for (const p of petals) {
      const dx = p.x - pointer.x;
      const dy = (p.y - pointer.y) * 1.8;
      const d = Math.hypot(dx, dy);
      const power = Math.max(0, 1 - d / (45 * k));
      p.kx += (dx / (d || 1)) * power * 22 * k;
      p.ky += (dy / (d || 1)) * power * 12 * k;
    }
  };
  const onLeave = () => (pointer = null);
  // a finger has no "mouse left" event: when it lifts, stop pushing the petals away from where it was
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") pointer = null;
  };
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
    // resizing the canvas can itself trigger the observer, so wait a frame and only react to a real width change
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      if (canvas.clientWidth === lastW) return;
      lastW = canvas.clientWidth;
      size();
      draw();
    });
  });
  ro.observe(canvas);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  document.addEventListener("visibilitychange", onVisibility);

  if (reduced.matches) draw();
  else raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(pending);
    ro.disconnect();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

const NARROW = "(max-width: 600px)";

export function PagodaArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  // the markup is the same either way, so choosing the picture on the client does not upset hydration
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== "undefined" && matchMedia(NARROW).matches);

  useEffect(() => {
    const query = matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let stop = () => {};
    let dead = false;
    loadArt(narrow).then((art) => {
      if (!dead) stop = start(ref.current!, art);
    });
    return () => {
      dead = true;
      stop();
    };
  }, [narrow]);

  return (
    <div className="pagoda-wrap">
      <canvas ref={ref} className="pagoda" style={{ aspectRatio: "2800 / 3900" }} role="img" aria-label="A pagoda at sunset drawn in characters, petals drifting past" />
    </div>
  );
}

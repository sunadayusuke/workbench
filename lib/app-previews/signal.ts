/* ==================================================================
   signal — home-card live preview

   Faithful reproduction of app/apps/signal/page.tsx at its DEFAULT
   state. Canvas 2D Bayer-ordered-dither generator, animated.

   The BAYER matrix, bayerAt(), computeIntensity() and the draw loop
   are copied verbatim from the app page, and DEFAULT mirrors the
   page's DEFAULT params exactly. Time advances by
   speed/100 * 0.055 per frame, identical to the page.

   Runner conventions match components/app-preview.tsx:
   - size to the CSS box via getBoundingClientRect + ResizeObserver
   - devicePixelRatio capped at 2 (applied via ctx.scale so the grid
     cell size stays in CSS px, exactly like the real page which uses
     raw offsetWidth/offsetHeight)
   - RAF capped at ~40fps (skip when now-last < 25ms)
   - skip rendering while document.hidden
   - cleanup() cancels the RAF and disconnects the ResizeObserver
================================================================== */

// 4×4 Bayer ordered dither matrix
const BAYER: number[][] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function bayerAt(x: number, y: number): number {
  return BAYER[y & 3][x & 3] / 16;
}

type Mode = "wave" | "ripple" | "random" | "plasma";
type Shape = "square" | "circle";

interface Params {
  mode: Mode;
  gridSize: number; // px per cell (2–20)
  speed: number; // 0–100
  frequency: number; // 0–100
  amplitude: number; // 0–100
  spread: number; // 0–100
  noise: number; // 0–100
  layers: number; // 1–4
  shape: Shape;
  bgColor: string;
  fgColor: string;
  midColor: string;
  transparentBg: boolean;
}

const DEFAULT: Params = {
  mode: "random",
  gridSize: 4,
  speed: 45,
  frequency: 30,
  amplitude: 65,
  spread: 82,
  noise: 10,
  layers: 2,
  shape: "square",
  bgColor: "#111111",
  fgColor: "#eeeeee",
  midColor: "#555555",
  transparentBg: false,
};

function computeIntensity(
  mode: Mode,
  gx: number,
  gy: number,
  cols: number,
  rows: number,
  t: number,
  p: Params,
): number {
  const freq = (p.frequency / 100) * 0.12 + 0.01;
  const amp = (p.amplitude / 100) * (rows * 0.35) + 2;
  const spread = (p.spread / 100) * 197 + 3;
  const noise = (p.noise / 100) * 0.25;

  switch (mode) {
    case "wave": {
      const cy = rows / 2;
      let wave = 0;
      for (let l = 0; l < p.layers; l++) {
        const fScale = 1 + l * 0.4;
        const tScale = 1 - l * 0.15;
        const phOff = l * 0.9;
        wave += Math.sin(gx * freq * fScale + t * tScale + phOff) * (amp / p.layers);
        wave +=
          Math.cos(gx * freq * fScale * 0.4 - t * tScale * 0.6 + phOff) *
          ((amp * 0.35) / p.layers);
      }
      const dist = Math.abs(gy - (cy + wave));
      return Math.max(0, 1 - dist / spread) + (Math.random() - 0.5) * noise;
    }

    case "ripple": {
      const cx = cols / 2;
      const cy = rows / 2;
      const nx = (gx - cx) / 18;
      const ny = (gy - cy) / 18;
      const d = Math.sqrt(nx * nx + ny * ny);
      let val = 0;
      for (let l = 0; l < p.layers; l++) {
        const ph = (l / p.layers) * Math.PI;
        val += Math.sin(d * (freq * 25 + 2) - t + ph);
      }
      val /= p.layers;
      val =
        val * 0.7 +
        (Math.sin(nx * freq * 10 + t * 0.3) + Math.cos(ny * freq * 10 + t * 0.2)) * 0.15;
      val += (Math.random() - 0.5) * noise * 2;
      return (val + 1) / 2;
    }

    case "random": {
      const nx = gx / cols;
      const ny = gy / rows;
      const f = freq * 40 + 5;
      let val =
        Math.sin(nx * f + t * 1.1) * 0.35 +
        Math.cos(ny * f + t * 0.8) * 0.35 +
        Math.sin((nx - ny) * f * 0.7 + t * 1.4) * 0.3;
      val += (Math.random() - 0.5) * (noise * 4 + 0.3);
      return (val + 1) / 2;
    }

    case "plasma": {
      const nx = gx / 10;
      const ny = gy / 10;
      const f = freq * 5 + 0.5;
      let val = Math.sin(nx * f + t);
      val += Math.cos(ny * f * 0.9 + t * 0.8);
      val += Math.sin((nx + ny) * f * 0.6 + t * 1.2);
      val += Math.sin(Math.sqrt(nx * nx + ny * ny + 0.01) * f - t);
      for (let l = 1; l < p.layers; l++) {
        const ph = l * 1.3;
        val += Math.sin(nx * f * (1 + l * 0.3) + t * 1.1 + ph) * 0.5;
        val += Math.cos(ny * f * (1 + l * 0.3) - t * 0.9 + ph) * 0.5;
      }
      val /= 4 + (p.layers - 1);
      val += (Math.random() - 0.5) * noise;
      return (val + 1) / 2;
    }
  }
}

const FRAME_MS = 25; // ~40fps cap

export function createPreview(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};

  const p = DEFAULT;
  // CSS-pixel canvas dimensions (the app uses raw offsetWidth/offsetHeight,
  // so the grid cell size lives in CSS pixels). DPR is applied via ctx.scale
  // for crispness while keeping the cell size identical to the real page.
  let cssW = 0;
  let cssH = 0;
  let time = 0;
  let raf = 0;
  let last = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const draw = () => {
    const w = cssW;
    const h = cssH;
    if (w === 0 || h === 0) return;

    const gs = Math.max(2, Math.round(p.gridSize));
    const cols = Math.ceil(w / gs);
    const rows = Math.ceil(h / gs);
    const spd = (p.speed / 100) * 0.055;

    ctx.clearRect(0, 0, w, h);
    if (!p.transparentBg) {
      ctx.fillStyle = p.bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = computeIntensity(p.mode, x, y, cols, rows, time, p);
        const thr = bayerAt(x, y);

        let color: string | null = null;
        if (v > thr + 0.38) color = p.fgColor;
        else if (v > thr + 0.05) color = p.midColor;

        if (color) {
          ctx.fillStyle = color;
          if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(x * gs + gs / 2, y * gs + gs / 2, (gs - 1) / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(x * gs, y * gs, gs - 1, gs - 1);
          }
        }
      }
    }

    time += spd;
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    if (document.hidden) return;
    draw();
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

/* ==================================================================
   easing app preview — faithful reproduction of the BezierEditor
   canvas at its DEFAULT state.

   Mirrors app/apps/easing/page.tsx <BezierEditor> draw() exactly:
   default control points = easeInOutCubic = [0.65, 0, 0.35, 1],
   dark background, grid, linear diagonal reference, control-handle
   lines, the white cubic-bezier curve, control points and end points.

   The real editor canvas is static. To make the card lively we add an
   animated dot traveling along the same cubic-bezier curve. Disable by
   leaving it; it uses the very same control points so it stays faithful.
================================================================== */

type ControlPoints = [number, number, number, number];

// Verbatim defaults from app/apps/easing/page.tsx
// DEFAULT_PRESET = "easeInOutCubic" → value [0.65, 0, 0.35, 1]
const DEFAULT_POINTS: ControlPoints = [0.65, 0, 0.35, 1];

// Verbatim layout constants from <BezierEditor>
const PADDING = 28;
const Y_MIN = -0.5;
const Y_MAX = 1.5;
const Y_RANGE = Y_MAX - Y_MIN;

const FPS = 40;
const FRAME_MS = 1000 / FPS;

// Cubic bezier interpolation along one axis (matches app-preview helper).
function cubic(p0: number, p1: number, p2: number, p3: number, u: number) {
  const m = 1 - u;
  return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
}

export function createPreview(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const points = DEFAULT_POINTS;

  let raf = 0;
  let last = 0;
  const start = performance.now();
  let w = 0;
  let h = 0;
  let dpr = 1;

  // toCanvas / fromCanvas mirror the page's coordinate mapping.
  const toCanvas = (x: number, y: number) => {
    const drawW = w - PADDING * 2;
    const drawH = h - PADDING * 2;
    return {
      cx: PADDING + x * drawW,
      cy: PADDING + (1 - (y - Y_MIN) / Y_RANGE) * drawH,
    };
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const draw = (timeSec: number) => {
    // Reset transform then apply dpr scale (canvas reused each frame).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background (verbatim)
    ctx.fillStyle = "oklch(0.14 0 0)";
    ctx.fillRect(0, 0, w, h);

    const drawW = w - PADDING * 2;
    const drawH = h - PADDING * 2;

    // Grid lines (verbatim)
    ctx.strokeStyle = "oklch(0.22 0 0)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = PADDING + (i / 4) * drawW;
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, PADDING + drawH);
      ctx.stroke();
    }
    // Y grid: 0 and 1 lines (verbatim)
    for (const val of [0, 1]) {
      const { cy } = toCanvas(0, val);
      ctx.beginPath();
      ctx.moveTo(PADDING, cy);
      ctx.lineTo(PADDING + drawW, cy);
      ctx.stroke();
    }

    // Diagonal reference line (linear) (verbatim)
    const p0 = toCanvas(0, 0);
    const p1 = toCanvas(1, 1);
    ctx.strokeStyle = "oklch(0.35 0 0)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.cx, p0.cy);
    ctx.lineTo(p1.cx, p1.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Control point handle lines (verbatim)
    const cp1 = toCanvas(points[0], points[1]);
    const cp2 = toCanvas(points[2], points[3]);
    ctx.strokeStyle = "oklch(0.5 0 0)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p0.cx, p0.cy);
    ctx.lineTo(cp1.cx, cp1.cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p1.cx, p1.cy);
    ctx.lineTo(cp2.cx, cp2.cy);
    ctx.stroke();

    // Bezier curve (verbatim)
    ctx.strokeStyle = "oklch(0.95 0 0)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p0.cx, p0.cy);
    ctx.bezierCurveTo(cp1.cx, cp1.cy, cp2.cx, cp2.cy, p1.cx, p1.cy);
    ctx.stroke();

    // Control points (verbatim)
    for (const cp of [cp1, cp2]) {
      ctx.fillStyle = "oklch(0.95 0 0)";
      ctx.beginPath();
      ctx.arc(cp.cx, cp.cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "oklch(0.14 0 0)";
      ctx.beginPath();
      ctx.arc(cp.cx, cp.cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Start/end points (verbatim)
    for (const ep of [p0, p1]) {
      ctx.fillStyle = "oklch(0.5 0 0)";
      ctx.beginPath();
      ctx.arc(ep.cx, ep.cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Animated traveling dot along the same default curve.
    // u sweeps 0→1 then pauses briefly, looping (ping over ~2.4s).
    const period = 2.4;
    const phase = (timeSec % period) / period;
    // Hold the last 25% of the cycle so the dot rests at the end before looping.
    const u = Math.min(1, phase / 0.75);
    const dotX = cubic(p0.cx, cp1.cx, cp2.cx, p1.cx, u);
    const dotY = cubic(p0.cy, cp1.cy, cp2.cy, p1.cy, u);
    ctx.fillStyle = "oklch(0.72 0.18 150)"; // green progress dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    if (document.hidden) return;
    draw((now - start) / 1000);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

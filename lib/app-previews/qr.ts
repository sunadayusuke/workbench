/* ==================================================================
   qr — home-card live preview

   Draws a stylized fake QR code (21×21 module grid) on a Canvas 2D
   context. Uses a seeded PRNG (mulberry32) so layout is deterministic.

   Visual features:
   - Light background (#f3f4f4 = wb-50) with ink dots (#0c0c10 = wb-950)
   - Rounded dot modules (small circles)
   - Three finder "eyes" (top-left, top-right, bottom-left) drawn as
     rounded outer ring + rounded inner center square
   - Slow shimmer: a handful of non-eye data modules toggle every ~400 ms
     (visibility state flips by re-seeding a shimmer PRNG each tick)
   - Centered + margins preserved so it reads as a QR at card size

   Runner conventions match components/app-preview.tsx:
   - size to the CSS box via getBoundingClientRect + ResizeObserver
   - devicePixelRatio capped at 2, applied via ctx.scale
   - RAF capped at ~40fps (skip when now-last < 25ms)
   - skip rendering while document.hidden
   - cleanup() cancels the RAF and disconnects the ResizeObserver
================================================================== */

const FRAME_MS = 25; // ~40fps cap
const SHIMMER_INTERVAL = 400; // ms between shimmer ticks

const GRID = 29; // QR v3 module count — eyes read at realistic ~24% of width
const MARGIN = 4; // standard quiet-zone modules on each side

const BG_COLOR = "#f3f4f4"; // wb-50
const INK_COLOR = "#0c0c10"; // wb-950

// ------------------------------------------------------------------ //
//  Seeded PRNG — mulberry32                                           //
// ------------------------------------------------------------------ //

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ //
//  Finder-eye geometry                                                //
//  An eye occupies a 7×7 area in the grid (col, row are top-left).   //
// ------------------------------------------------------------------ //

const EYE_POSITIONS = [
  { col: 0, row: 0 }, // top-left
  { col: GRID - 7, row: 0 }, // top-right
  { col: 0, row: GRID - 7 }, // bottom-left
] as const;

/** Returns true if (c, r) falls inside any finder eye's 7×7 region. */
function isInEye(c: number, r: number): boolean {
  for (const { col, row } of EYE_POSITIONS) {
    if (c >= col && c < col + 7 && r >= row && r < row + 7) return true;
  }
  return false;
}

// ------------------------------------------------------------------ //
//  Center logo (WB favicon) — modules knocked out like the real app   //
// ------------------------------------------------------------------ //

const LOGO_SRC = "/images/favicon.svg";
const LOGO_ASPECT = 887.91 / 403.91; // wide WB monogram
const LOGO_W = 11; // modules
const LOGO_H = LOGO_W / LOGO_ASPECT; // ≈ 5 modules
const LOGO_PAD = 1; // clear-zone padding (modules)

/** Cell rect vs centered logo clear-zone rect (strict overlap). */
function isInLogoZone(c: number, r: number): boolean {
  const zw = LOGO_W + LOGO_PAD * 2;
  const zh = LOGO_H + LOGO_PAD * 2;
  const x1 = (GRID - zw) / 2;
  const y1 = (GRID - zh) / 2;
  return c + 1 > x1 && c < x1 + zw && r + 1 > y1 && r < y1 + zh;
}

// ------------------------------------------------------------------ //
//  Static module pattern (deterministic)                              //
//  Modules inside eyes are handled separately; data modules are       //
//  generated once with the seeded PRNG.                               //
// ------------------------------------------------------------------ //

const LAYOUT_SEED = 0xdeadbeef;

function buildStaticModules(): boolean[][] {
  const rng = mulberry32(LAYOUT_SEED);
  const grid: boolean[][] = [];
  for (let r = 0; r < GRID; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < GRID; c++) {
      if (isInEye(c, r) || isInLogoZone(c, r)) {
        row.push(false); // eyes drawn separately; logo zone knocked out
      } else {
        // Density ~55% for a believable QR look
        row.push(rng() < 0.55);
      }
    }
    grid.push(row);
  }
  return grid;
}

const STATIC_MODULES = buildStaticModules();

// Collect indices of non-eye data modules eligible for shimmer
const DATA_MODULE_INDICES: [number, number][] = [];
for (let r = 0; r < GRID; r++) {
  for (let c = 0; c < GRID; c++) {
    if (!isInEye(c, r) && !isInLogoZone(c, r)) DATA_MODULE_INDICES.push([r, c]);
  }
}

// Pick ~8% of data modules as shimmer candidates (deterministic subset)
function buildShimmerIndices(): [number, number][] {
  const rng = mulberry32(0xcafebabe);
  const count = Math.round(DATA_MODULE_INDICES.length * 0.08);
  const arr = DATA_MODULE_INDICES.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

const SHIMMER_INDICES: [number, number][] = buildShimmerIndices();

// ------------------------------------------------------------------ //
//  Drawing helpers                                                     //
// ------------------------------------------------------------------ //

/**
 * Draws a filled rounded-rect, used for both module dots and eye parts.
 * radius is clamped to half the smaller dimension.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const cr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + cr, y);
  ctx.lineTo(x + w - cr, y);
  ctx.arcTo(x + w, y, x + w, y + cr, cr);
  ctx.lineTo(x + w, y + h - cr);
  ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr);
  ctx.lineTo(x + cr, y + h);
  ctx.arcTo(x, y + h, x, y + h - cr, cr);
  ctx.lineTo(x, y + cr);
  ctx.arcTo(x, y, x + cr, y, cr);
  ctx.closePath();
  ctx.fill();
}

/** Draws one finder eye. eyeCol/eyeRow are the top-left module coords. */
function drawEye(
  ctx: CanvasRenderingContext2D,
  eyeCol: number,
  eyeRow: number,
  originX: number,
  originY: number,
  cellPx: number,
  r: number
) {
  // Outer 7×7 filled square (ink)
  const ox = originX + eyeCol * cellPx;
  const oy = originY + eyeRow * cellPx;
  const outer = 7 * cellPx;
  ctx.fillStyle = INK_COLOR;
  roundedRect(ctx, ox, oy, outer, outer, r * 2.5);

  // 5×5 hollow interior (bg)
  const ix = ox + cellPx;
  const iy = oy + cellPx;
  const inner = 5 * cellPx;
  ctx.fillStyle = BG_COLOR;
  roundedRect(ctx, ix, iy, inner, inner, r * 1.8);

  // 3×3 center filled (ink)
  const cx = ox + 2 * cellPx;
  const cy = oy + 2 * cellPx;
  const center = 3 * cellPx;
  ctx.fillStyle = INK_COLOR;
  roundedRect(ctx, cx, cy, center, center, r * 1.2);
}

// ------------------------------------------------------------------ //
//  createPreview — entry point matching app-preview.tsx contract      //
// ------------------------------------------------------------------ //

export function createPreview(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  // WB monogram for the knocked-out center (appears once loaded; the RAF
  // loop redraws continuously so no explicit onload hook is needed).
  const logoImg = new Image();
  logoImg.src = LOGO_SRC;

  let cssW = 0;
  let cssH = 0;
  let raf = 0;
  let last = 0;
  let lastShimmer = 0;
  let shimmerPhase = 0; // increments each tick, seeds shimmer visibility

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

    // Size the QR to fit with equal margin on all sides
    const totalModules = GRID + MARGIN * 2;
    const cellPx = Math.floor(Math.min(w, h) / totalModules);
    if (cellPx < 1) return;
    const qrPx = GRID * cellPx;
    const originX = Math.round((w - qrPx) / 2);
    const originY = Math.round((h - qrPx) / 2);
    // Module dot radius (slightly more than half cell for a chunky look)
    const dotR = cellPx * 0.42;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Build shimmer visibility set for this tick
    const shimmerRng = mulberry32(shimmerPhase * 0x9e3779b9 + 1);
    const shimmerVisible = new Set<number>();
    for (let i = 0; i < SHIMMER_INDICES.length; i++) {
      // ~60% of shimmer candidates visible at any given tick
      if (shimmerRng() < 0.6) shimmerVisible.add(i);
    }

    // Draw data modules
    ctx.fillStyle = INK_COLOR;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (isInEye(c, r) || isInLogoZone(c, r)) continue;

        let on = STATIC_MODULES[r][c];

        // Apply shimmer override for candidate modules
        const shimmerIdx = SHIMMER_INDICES.findIndex(([sr, sc]) => sr === r && sc === c);
        if (shimmerIdx !== -1) {
          on = shimmerVisible.has(shimmerIdx);
        }

        if (!on) continue;

        const px = originX + c * cellPx;
        const py = originY + r * cellPx;
        ctx.beginPath();
        ctx.arc(px + cellPx / 2, py + cellPx / 2, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw finder eyes on top
    for (const { col, row } of EYE_POSITIONS) {
      drawEye(ctx, col, row, originX, originY, cellPx, dotR);
    }

    // Center logo in the knocked-out zone
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const lw = LOGO_W * cellPx;
      const lh = lw / LOGO_ASPECT;
      ctx.drawImage(
        logoImg,
        originX + (qrPx - lw) / 2,
        originY + (qrPx - lh) / 2,
        lw,
        lh
      );
    }
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    if (document.hidden) return;

    // Advance shimmer phase every SHIMMER_INTERVAL ms
    if (now - lastShimmer >= SHIMMER_INTERVAL) {
      shimmerPhase++;
      lastShimmer = now;
    }

    draw();
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

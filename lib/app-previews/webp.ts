/* ==================================================================
   webp — home-card canvas preview.

   NOTE: the webp app (app/apps/webp/page.tsx) is a converter built
   from HTML/React DOM (drop zone, <video>/<img> preview, settings
   panel). There's no shader or Three.js scene to reproduce.

   So this preview draws the app's IDEA: a row of separate source
   frames on the left flowing into one card on the right that plays
   them back. The little dot steps through the same three positions
   the source frames show, on a ~260ms beat, which reads as the
   low-frame-rate animation the tool produces. All colors are the
   app's real design tokens.

   Runner conventions match components/app-preview.tsx:
   - size to the CSS box via getBoundingClientRect + ResizeObserver
   - devicePixelRatio capped at 2 (applied via ctx.setTransform)
   - RAF capped at ~40fps, and repaints only when the step changes
   - skip rendering while document.hidden
   - cleanup() cancels the RAF and disconnects the ResizeObserver
================================================================== */

// app/globals.css design tokens (verbatim hex values).
const WB_0 = "#ffffff"; // --wb-0    (card fill)
const WB_50 = "#f3f4f4"; // --wb-50   (page bg)
const WB_100 = "#e7e7e9"; // --wb-100  (progress track)
const WB_200 = "#dcdce0"; // --wb-200  (borders / gradient floor)
const WB_300 = "#ceced3"; // --wb-300  (source-frame dots)
const WB_400 = "#9f9fa9"; // --wb-400  (arrow)
const WB_GREEN = "#0dca7a"; // --wb-green (the live, animated frame)

const FRAME_MS = 25; // ~40fps cap
const STEP_MS = 260; // one animation step — deliberately choppy
const STEPS = 3;
const OFFSETS = [-1, 0, 1]; // dot position per step

export function createPreview(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let lastStep = -1;

  const draw = (step: number) => {
    if (w === 0 || h === 0) return;

    // Page backdrop: soft wb-50 → wb-200 vertical gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, WB_50);
    bg.addColorStop(1, WB_200);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;
    const side = h * 0.26; // source frame
    const gap = side * 0.3;
    const bigH = h * 0.5;
    const bigW = bigH * 1.45;
    const arrow = h * 0.18;
    const strip = side * STEPS + gap * (STEPS - 1);
    const total = strip + arrow * 2 + bigW;
    let x = (w - total) / 2;
    if (total > w) x = w * 0.04; // very narrow card — just bleed off-canvas

    ctx.lineWidth = 1;

    // Source frames: three stills, each with its dot at a different height.
    for (let i = 0; i < STEPS; i++) {
      const fx = x + i * (side + gap);
      const fy = cy - side / 2;
      ctx.fillStyle = WB_0;
      roundRect(ctx, fx, fy, side, side, side * 0.16);
      ctx.fill();
      ctx.strokeStyle = WB_200;
      ctx.stroke();

      ctx.fillStyle = WB_300;
      ctx.beginPath();
      ctx.arc(
        fx + side / 2,
        cy + OFFSETS[i] * side * 0.22,
        Math.max(1, side * 0.13),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Arrow: the frames collapsing into one file.
    const ax = x + strip + arrow * 0.4;
    const aw = arrow * 1.2;
    ctx.strokeStyle = WB_400;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, cy);
    ctx.lineTo(ax + aw, cy);
    ctx.moveTo(ax + aw - arrow * 0.3, cy - arrow * 0.26);
    ctx.lineTo(ax + aw, cy);
    ctx.lineTo(ax + aw - arrow * 0.3, cy + arrow * 0.26);
    ctx.stroke();
    ctx.lineCap = "butt";

    // The animated result: one card, dot stepping through the same positions.
    const bx = x + strip + arrow * 2;
    const by = cy - bigH / 2;
    ctx.save();
    ctx.shadowColor = "rgba(12,12,16,0.08)";
    ctx.shadowBlur = Math.max(6, h * 0.06);
    ctx.shadowOffsetY = Math.max(2, h * 0.02);
    ctx.fillStyle = WB_0;
    roundRect(ctx, bx, by, bigW, bigH, bigH * 0.14);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = WB_200;
    roundRect(ctx, bx, by, bigW, bigH, bigH * 0.14);
    ctx.stroke();

    ctx.fillStyle = WB_GREEN;
    ctx.beginPath();
    ctx.arc(
      bx + bigW / 2,
      cy - bigH * 0.06 + OFFSETS[step] * bigH * 0.2,
      Math.max(1.5, bigH * 0.11),
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Playback bar along the bottom of the card.
    const barW = bigW * 0.62;
    const barH = Math.max(2, bigH * 0.055);
    const barX = bx + (bigW - barW) / 2;
    const barY = by + bigH - barH * 3;
    ctx.fillStyle = WB_100;
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = WB_GREEN;
    roundRect(ctx, barX, barY, (barW * (step + 1)) / STEPS, barH, barH / 2);
    ctx.fill();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(Math.max(0, lastStep));
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    if (document.hidden) return;
    const step = Math.floor(now / STEP_MS) % STEPS;
    if (step === lastStep) return; // stepped animation → nothing to repaint
    lastStep = step;
    draw(step);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

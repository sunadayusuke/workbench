/* ==================================================================
   compress — home-card canvas preview.

   NOTE: the compress app (app/apps/compress/page.tsx) is a file-
   compression UTILITY built entirely from HTML/React DOM (drop zone,
   file list, format <Select>, totals panel). It has NO real canvas,
   shader, or Three.js scene to reproduce.

   So this preview renders a tasteful, STATIC neutral that fits the
   design system: a soft wb-50 → wb-200 vertical gradient backdrop with
   a subtle rounded dashed drop-zone rectangle — a direct echo of the
   app's signature default surface (its dashed drop zone uses
   border-wb-300 on a bg-wb-0 card over a bg-wb-50 page). All colors are
   the app's real design tokens. Static = render once + on resize, no RAF.
================================================================== */

// app/globals.css design tokens (verbatim hex values).
const WB_0 = "#ffffff"; // --wb-0   (drop-zone card)
const WB_50 = "#f3f4f4"; // --wb-50  (page bg)
const WB_100 = "#e7e7e9"; // --wb-100
const WB_200 = "#dcdce0"; // --wb-200 (gradient floor / borders)
const WB_300 = "#ceced3"; // --wb-300 (dashed drop-zone border)
const WB_400 = "#9f9fa9"; // --wb-400 (hint text dots)

export function createPreview(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let w = 0;
  let h = 0;

  const draw = () => {
    if (w === 0 || h === 0) return;

    // Page backdrop: soft wb-50 → wb-200 vertical gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, WB_50);
    bg.addColorStop(1, WB_200);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Drop-zone card: a centered rounded wb-0 panel with a faint shadow,
    // matching the app's `h-32 rounded-[14px] bg-wb-0` drop zone.
    const pad = Math.max(8, Math.min(w, h) * 0.14);
    const rx = pad;
    const ry = Math.max(pad, h * 0.22);
    const rw = w - pad * 2;
    const rh = h - ry * 2;
    if (rw <= 0 || rh <= 0) return;
    const radius = Math.min(14, rw / 2, rh / 2);

    // Card fill + soft drop shadow.
    ctx.save();
    ctx.shadowColor = "rgba(12,12,16,0.08)";
    ctx.shadowBlur = Math.max(6, h * 0.06);
    ctx.shadowOffsetY = Math.max(2, h * 0.02);
    ctx.fillStyle = WB_0;
    roundRect(ctx, rx, ry, rw, rh, radius);
    ctx.fill();
    ctx.restore();

    // Dashed drop-zone border (border-2 border-dashed border-wb-300).
    ctx.save();
    const inset = Math.max(3, Math.min(rw, rh) * 0.08);
    ctx.strokeStyle = WB_300;
    ctx.lineWidth = 2;
    const dash = Math.max(4, Math.min(rw, rh) * 0.05);
    ctx.setLineDash([dash, dash * 0.7]);
    roundRect(
      ctx,
      rx + inset,
      ry + inset,
      rw - inset * 2,
      rh - inset * 2,
      Math.max(2, radius - inset),
    );
    ctx.stroke();
    ctx.restore();

    // A few neutral "file" hint bars centered in the zone (suggesting the
    // drop-hint / sub-hint text lines), using the muted wb tokens.
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const barW = rw * 0.42;
    const barH = Math.max(2, rh * 0.06);
    const gap = barH * 2.0;
    const lines: Array<[number, string]> = [
      [0.6, WB_100],
      [0.4, WB_200],
      [0.28, WB_400],
    ];
    let y = cy - gap;
    for (const [scale, color] of lines) {
      const lw = barW * scale;
      ctx.fillStyle = color;
      roundRect(ctx, cx - lw / 2, y, lw, barH, barH / 2);
      ctx.fill();
      y += gap;
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Static visual → just re-render on resize, no RAF.
    draw();
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return () => {
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

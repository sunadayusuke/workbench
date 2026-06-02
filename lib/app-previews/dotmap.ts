/* ==================================================================
   dotmap preview — reproduces app/apps/dotmap/page.tsx default canvas.

   The real app is a STATIC dotted world map (Canvas 2D / SVG). It loads
   d3-geo + topojson-client + /data/world-110m.json, builds a Mercator
   projection clipped to lat -56..71, rasterizes the `land` feature into
   a bitmap for O(1) point-in-land lookups, then walks a dot grid and
   emits a <circle> (or hexagon) per land cell.

   This preview replays that EXACT pipeline (same DEFAULT_PARAMS, same
   raster-lookup math, same diagonal grid offset / dot radius / aspect),
   but paints directly onto the provided <canvas> with Canvas 2D arcs
   instead of building an SVG string. The map is fit + centered in the
   canvas box, matching the app's "[&>svg]:max-w-full" centered layout.

   Static → render once + on resize (no RAF). No three / WebGL.
================================================================== */

/* ----------------------- DEFAULT_PARAMS (verbatim) ---------------- */

const DEFAULT_PARAMS = {
  rows: 136,
  gridPattern: "diagonal" as "vertical" | "diagonal",
  dotColor: "#555555",
  backgroundColor: "#ffffff",
  bgTransparent: false,
  dotRadius: 0.4,
  shape: "circle" as "circle" | "hexagon",
  lngOffset: 0,
};

/* --------------------------- Mercator helpers --------------------- */

const LAT_MIN = -56;
const LAT_MAX = 71;
const LNG_MIN = -180;
const LNG_MAX = 180;

function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const Y_TOP = mercatorY(LAT_MAX);
const Y_BOT = mercatorY(LAT_MIN);
const Y_RANGE = Y_TOP - Y_BOT;
const X_RANGE = LNG_MAX - LNG_MIN;
const ASPECT = X_RANGE / (Y_RANGE * (180 / Math.PI));

/* ------------- Rasterize GeoJSON → bitmap (point-in-land) --------- */

const RASTER_W = 8192;
const RASTER_H = Math.round(RASTER_W / ASPECT);

interface D3GeoLike {
  geoMercator: () => GeoProjectionLike;
  geoPath: (
    projection: GeoProjectionLike,
    ctx: CanvasRenderingContext2D
  ) => (feature: unknown) => void;
}
interface GeoProjectionLike {
  translate: (t: [number, number]) => GeoProjectionLike;
  scale: (s: number) => GeoProjectionLike;
  fitSize: (size: [number, number], object: unknown) => GeoProjectionLike;
}

function rasterizeFeature(d3Geo: D3GeoLike, feature: unknown): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = RASTER_W;
  canvas.height = RASTER_H;
  const ctx = canvas.getContext("2d")!;

  const projection = d3Geo
    .geoMercator()
    .translate([RASTER_W / 2, RASTER_H / 2])
    .scale(1)
    .fitSize([RASTER_W, RASTER_H], {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [LNG_MIN, LAT_MIN],
            [LNG_MAX, LAT_MIN],
            [LNG_MAX, LAT_MAX],
            [LNG_MIN, LAT_MAX],
            [LNG_MIN, LAT_MIN],
          ],
        ],
      },
      properties: {},
    });

  const path = d3Geo.geoPath(projection, ctx);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  path(feature);
  ctx.fill();

  return ctx.getImageData(0, 0, RASTER_W, RASTER_H).data;
}

function isLand(data: Uint8ClampedArray, px: number, py: number): boolean {
  const x = Math.round(px);
  const y = Math.round(py);
  if (x < 0 || x >= RASTER_W || y < 0 || y >= RASTER_H) return false;
  return data[(y * RASTER_W + x) * 4 + 3] > 128;
}

function hexPathTo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/* ------------------------------ Preview --------------------------- */

export function createPreview(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let landData: Uint8ClampedArray | null = null;
  let ro: ResizeObserver | null = null;

  /* Draw the full dotted map, fit + centered in the canvas CSS box. */
  const draw = () => {
    if (disposed || !landData) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rows = DEFAULT_PARAMS.rows;
    const cols = Math.round(rows * ASPECT);
    const r = DEFAULT_PARAMS.dotRadius;
    const bgColor = DEFAULT_PARAMS.backgroundColor;
    const defaultColor = DEFAULT_PARAMS.dotColor;
    const isHex = DEFAULT_PARAMS.shape === "hexagon";
    const pattern = DEFAULT_PARAMS.gridPattern;
    const lngOff = DEFAULT_PARAMS.lngOffset;

    // Background fills the whole canvas (default is solid #ffffff).
    ctx.clearRect(0, 0, cssW, cssH);
    if (!DEFAULT_PARAMS.bgTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    // SVG viewBox is "-1 -1 cols+2 rows+2" → fit that box, centered.
    const vbW = cols + 2;
    const vbH = rows + 2;
    const scale = Math.min(cssW / vbW, cssH / vbH);
    const drawW = vbW * scale;
    const drawH = vbH * scale;
    const originX = (cssW - drawW) / 2;
    const originY = (cssH - drawH) / 2;
    // map (svgX, svgY) → device px: account for the -1 viewBox offset.
    const toPxX = (svgX: number) => originX + (svgX + 1) * scale;
    const toPxY = (svgY: number) => originY + (svgY + 1) * scale;

    ctx.fillStyle = defaultColor;

    for (let row = 0; row < rows; row++) {
      const isDiagOffset = pattern === "diagonal" && row % 2 === 1;
      const offset = isDiagOffset ? 0.5 : 0;

      for (let col = 0; col < cols; col++) {
        const svgX = col + offset;
        const svgY = row;

        let rasterX =
          (svgX / cols) * RASTER_W + (lngOff / X_RANGE) * RASTER_W;
        rasterX = ((rasterX % RASTER_W) + RASTER_W) % RASTER_W;
        const rasterY = (svgY / rows) * RASTER_H;

        if (!isLand(landData, rasterX, rasterY)) continue;

        const px = toPxX(svgX);
        const py = toPxY(svgY);
        const pr = r * scale;

        if (isHex) {
          hexPathTo(ctx, px, py, pr);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  (async () => {
    try {
      const [d3, tj, topo] = await Promise.all([
        import("d3-geo"),
        import("topojson-client"),
        fetch("/data/world-110m.json").then((res) => res.json()),
      ]);
      if (disposed) return;

      const d3Geo = d3 as unknown as D3GeoLike;
      const topoClient = tj as unknown as {
        feature: (topo: unknown, obj: unknown) => unknown;
      };
      const topoData = topo as { objects: { land: unknown } };

      const land = topoClient.feature(topoData, topoData.objects.land);
      landData = rasterizeFeature(d3Geo, land);
      if (disposed) return;

      draw();

      ro = new ResizeObserver(() => draw());
      ro.observe(canvas);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("dotmap preview init error:", err);
    }
  })();

  return () => {
    disposed = true;
    ro?.disconnect();
    ro = null;
    landData = null;
  };
}

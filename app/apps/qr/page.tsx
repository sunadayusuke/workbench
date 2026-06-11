"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import { useLanguage } from "@/lib/i18n";
import { downloadBlob, downloadCanvas } from "@/lib/canvas-download";
import { AppTopBar } from "@/components/app-top-bar";
import { ControlPanel } from "@/components/ui/control-panel";
import { PanelSection } from "@/components/ui/panel-section";
import { ControlRow } from "@/components/ui/control-row";
import { NestedGroup } from "@/components/ui/nested-group";
import { OutputMenu, OutputMenuItem } from "@/components/ui/output-menu";
import { PushButton } from "@/components/ui/push-button";
import { ButtonSelect } from "@/components/ui/button-select";
import { DragParam } from "@/components/ui/drag-param";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ColorRow } from "@/components/ui/color-row";
import { CodeField } from "@/components/ui/code-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types & defaults                                                   */
/* ------------------------------------------------------------------ */

type EcLevel = "L" | "M" | "Q" | "H";
type ModuleShape = "square" | "rounded" | "dot";
type EyeShape = "square" | "rounded" | "circle";
type PngSize = "512" | "1024" | "2048" | "4096";

interface QrParams {
  text: string;
  ecLevel: EcLevel;
  moduleShape: ModuleShape;
  dotVariation: number;
  eyeShape: EyeShape;
  margin: number;
  fgColor: string;
  bgColor: string;
  transparentBg: boolean;
  customEyeColor: boolean;
  eyeColor: string;
  logoDataUrl: string | null;
  logoScale: number;
  logoPad: number;
  logoRadius: number;
  /** Intrinsic width/height of the uploaded logo (1 until measured). */
  logoAspect: number;
  pngSize: PngSize;
}

const DEFAULT_TEXT = "https://workbench.suna.design";

const DEFAULTS: QrParams = {
  text: "",
  ecLevel: "H",
  moduleShape: "rounded",
  dotVariation: 0,
  eyeShape: "rounded",
  margin: 4,
  fgColor: "#0c0c10",
  bgColor: "#ffffff",
  transparentBg: false,
  customEyeColor: false,
  eyeColor: "#0c0c10",
  logoDataUrl: null,
  logoScale: 20,
  logoPad: 1,
  logoRadius: 0,
  logoAspect: 1,
  pngSize: "1024",
};

/* ------------------------------------------------------------------ */
/*  SVG geometry helpers                                               */
/* ------------------------------------------------------------------ */

/** Rounded-rect as an SVG path command (needed for evenodd cutouts). */
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const rr = Math.min(r, w / 2, h / 2);
  const x2 = x + w;
  const y2 = y + h;
  return (
    `M${(x + rr).toFixed(3)},${y.toFixed(3)}` +
    `H${(x2 - rr).toFixed(3)}` +
    `A${rr.toFixed(3)},${rr.toFixed(3)} 0 0 1 ${x2.toFixed(3)},${(y + rr).toFixed(3)}` +
    `V${(y2 - rr).toFixed(3)}` +
    `A${rr.toFixed(3)},${rr.toFixed(3)} 0 0 1 ${(x2 - rr).toFixed(3)},${y2.toFixed(3)}` +
    `H${(x + rr).toFixed(3)}` +
    `A${rr.toFixed(3)},${rr.toFixed(3)} 0 0 1 ${x.toFixed(3)},${(y2 - rr).toFixed(3)}` +
    `V${(y + rr).toFixed(3)}` +
    `A${rr.toFixed(3)},${rr.toFixed(3)} 0 0 1 ${(x + rr).toFixed(3)},${y.toFixed(3)}` +
    `Z`
  );
}

interface BitMatrixLike {
  size: number;
  get(row: number, col: number): number;
  /** Function-pattern flag (timing/alignment/format) — these must stay full-size. */
  isReserved(row: number, col: number): number;
}

interface BuildOpts {
  margin: number;
  moduleShape: ModuleShape;
  dotVariation: number;
  eyeShape: EyeShape;
  fgColor: string;
  bgColor: string;
  transparentBg: boolean;
  eyeColor: string;
  logoDataUrl: string | null;
  logoScale: number;
  logoPad: number;
  logoRadius: number;
  logoAspect: number;
}

/** Top-left coords of the three finder-pattern 7×7 boxes (in module space). */
function eyeOrigins(size: number): Array<[number, number]> {
  return [
    [0, 0], // top-left
    [size - 7, 0], // top-right
    [0, size - 7], // bottom-left
  ];
}

function isInEye(row: number, col: number, size: number): boolean {
  for (const [ex, ey] of eyeOrigins(size)) {
    if (col >= ex && col < ex + 7 && row >= ey && row < ey + 7) return true;
  }
  return false;
}

/** Deterministic integer hash → [0,1) per cell (no Math.random, byte-stable). */
function cellRand(row: number, col: number): number {
  let h = (row * 374761393 + col * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Render one finder eye (outer ring + center) as SVG path/shape strings. */
function buildEye(
  ex: number,
  ey: number,
  shape: EyeShape,
  color: string
): string {
  if (shape === "circle") {
    // Outer ring via two circles (evenodd), center dot.
    const cx = ex + 3.5;
    const cy = ey + 3.5;
    const ring =
      `<path fill-rule="evenodd" fill="${color}" d="` +
      `M${(cx - 3.5).toFixed(3)},${cy.toFixed(3)} a3.5,3.5 0 1,0 7,0 a3.5,3.5 0 1,0 -7,0 Z` +
      `M${(cx - 2.5).toFixed(3)},${cy.toFixed(3)} a2.5,2.5 0 1,1 5,0 a2.5,2.5 0 1,1 -5,0 Z` +
      `"/>`;
    const center = `<circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="1.5" fill="${color}"/>`;
    return ring + center;
  }

  // square / rounded → rounded-rect paths (rounded uses corner radii, square = 0)
  const outerR = shape === "rounded" ? 1.75 : 0;
  const cutoutR = shape === "rounded" ? 1.05 : 0;
  const centerR = shape === "rounded" ? 0.9 : 0;

  const ring =
    `<path fill-rule="evenodd" fill="${color}" d="` +
    roundedRectPath(ex, ey, 7, 7, outerR) +
    roundedRectPath(ex + 1, ey + 1, 5, 5, cutoutR) +
    `"/>`;
  const center = `<path fill="${color}" d="${roundedRectPath(ex + 2, ey + 2, 3, 3, centerR)}"/>`;
  return ring + center;
}

/** Pure: matrix + options → standalone SVG string (no width/height). */
function buildQrSvg(matrix: BitMatrixLike, opts: BuildOpts): string {
  const size = matrix.size;
  const margin = opts.margin;
  const total = size + margin * 2;

  // Logo rendered rect (cell space, incl. margin). logoScale sets the bounding
  // box side; the rect inside it honors the logo's aspect ratio (centered), so
  // wide/tall logos aren't forced into a square.
  let logoRect: { x: number; y: number; w: number; h: number } | null = null;
  if (opts.logoDataUrl) {
    const boxSide = (size * opts.logoScale) / 100;
    const aspect = opts.logoAspect > 0 ? opts.logoAspect : 1;
    let w = boxSide;
    let h = boxSide;
    if (aspect >= 1) h = boxSide / aspect;
    else w = boxSide * aspect;
    logoRect = { x: total / 2 - w / 2, y: total / 2 - h / 2, w, h };
  }

  // Knockout zone = rendered rect + padding. Modules whose 1×1 cell rect
  // overlaps it are dropped so the void shows the background.
  let zx1 = 0;
  let zy1 = 0;
  let zx2 = 0;
  let zy2 = 0;
  let hasZone = false;
  if (logoRect) {
    zx1 = logoRect.x - opts.logoPad;
    zy1 = logoRect.y - opts.logoPad;
    zx2 = logoRect.x + logoRect.w + opts.logoPad;
    zy2 = logoRect.y + logoRect.h + opts.logoPad;
    hasZone = true;
  }

  /** Eye box OR (when a logo is set) cell rect overlapping the knockout zone. */
  function isExcluded(row: number, col: number): boolean {
    if (isInEye(row, col, size)) return true;
    if (!hasZone) return false;
    const cellX = col + margin;
    const cellY = row + margin;
    return cellX < zx2 && cellX + 1 > zx1 && cellY < zy2 && cellY + 1 > zy1;
  }

  const parts: string[] = [];
  // crispEdges only for hard squares — it disables AA and would jag rounded/dot shapes.
  const rendering = opts.moduleShape === "square" && opts.eyeShape === "square"
    ? ' shape-rendering="crispEdges"'
    : "";
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"${rendering}>`
  );

  if (!opts.transparentBg) {
    parts.push(`<rect width="${total}" height="${total}" fill="${opts.bgColor}"/>`);
  }

  // --- Data modules (skip the three 7×7 eye boxes) ---
  const dataParts: string[] = [];
  if (opts.moduleShape === "square") {
    // Merge horizontal runs into a single path of rect-like subpaths.
    let d = "";
    for (let row = 0; row < size; row++) {
      let col = 0;
      while (col < size) {
        if (
          matrix.get(row, col) &&
          !isExcluded(row, col)
        ) {
          let runEnd = col;
          while (
            runEnd < size &&
            matrix.get(row, runEnd) &&
            !isExcluded(row, runEnd)
          ) {
            runEnd++;
          }
          const x = col + margin;
          const y = row + margin;
          const w = runEnd - col;
          d += `M${x},${y}h${w}v1h${-w}z`;
          col = runEnd;
        } else {
          col++;
        }
      }
    }
    if (d) dataParts.push(`<path fill="${opts.fgColor}" d="${d}"/>`);
  } else if (opts.moduleShape === "rounded") {
    let d = "";
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (matrix.get(row, col) && !isExcluded(row, col)) {
          d += roundedRectPath(col + margin, row + margin, 1, 1, 0.3);
        }
      }
    }
    if (d) dataParts.push(`<path fill="${opts.fgColor}" d="${d}"/>`);
  } else {
    // dot
    let circles = "";
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (matrix.get(row, col) && !isExcluded(row, col)) {
          const cx = (col + margin + 0.5).toFixed(3);
          const cy = (row + margin + 0.5).toFixed(3);
          // r ∈ [0.28, 0.5] for data/EC modules only — function patterns
          // (timing/alignment/format) stay full-size or decoders lose the grid.
          const jitter = matrix.isReserved(row, col)
            ? 0
            : opts.dotVariation * 0.22 * cellRand(row, col);
          const r = (0.5 - jitter).toFixed(3);
          circles += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
        }
      }
    }
    if (circles) dataParts.push(`<g fill="${opts.fgColor}">${circles}</g>`);
  }
  parts.push(...dataParts);

  // --- Finder eyes ---
  const finderColor = opts.eyeColor || opts.fgColor;
  for (const [ex, ey] of eyeOrigins(size)) {
    parts.push(buildEye(ex + margin, ey + margin, opts.eyeShape, finderColor));
  }

  // --- Logo (centered; modules under it are knocked out, so no pad rect) ---
  if (logoRect) {
    const { x, y, w, h } = logoRect;
    const image =
      `<image x="${x.toFixed(3)}" y="${y.toFixed(3)}" ` +
      `width="${w.toFixed(3)}" height="${h.toFixed(3)}" ` +
      `href="${opts.logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`;
    // logoRadius is a % of the shorter side (50% → circle / stadium).
    const minSide = Math.min(w, h);
    const rPx = Math.min((minSide * opts.logoRadius) / 100, minSide / 2);
    if (rPx > 0) {
      const clip = roundedRectPath(x, y, w, h, rPx);
      parts.push(
        `<clipPath id="logoClip"><path d="${clip}"/></clipPath>` +
          `<g clip-path="url(#logoClip)">${image}</g>`
      );
    } else {
      parts.push(image);
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function QrPage() {
  const { t } = useLanguage();
  const [params, setParams] = useState<QrParams>(DEFAULTS);
  const [logoName, setLogoName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep last valid SVG so an over-long edit doesn't blank the preview.
  const lastSvgRef = useRef<string>("");

  const update = useCallback(
    <K extends keyof QrParams>(key: K, value: QrParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Generate SVG on every param change (generation is fast — no debounce).
  const { svg, error } = useMemo(() => {
    const content = params.text.trim() === "" ? DEFAULT_TEXT : params.text;
    try {
      const qr = QRCode.create(content, { errorCorrectionLevel: params.ecLevel });
      const next = buildQrSvg(qr.modules as unknown as BitMatrixLike, {
        margin: params.margin,
        moduleShape: params.moduleShape,
        dotVariation: params.dotVariation,
        eyeShape: params.eyeShape,
        fgColor: params.fgColor,
        bgColor: params.bgColor,
        transparentBg: params.transparentBg,
        eyeColor: params.customEyeColor ? params.eyeColor : params.fgColor,
        logoDataUrl: params.logoDataUrl,
        logoScale: params.logoScale,
        logoPad: params.logoPad,
        logoRadius: params.logoRadius,
        logoAspect: params.logoAspect,
      });
      lastSvgRef.current = next;
      return { svg: next, error: false };
    } catch {
      return { svg: lastSvgRef.current, error: true };
    }
  }, [params]);

  const handleReset = useCallback(() => {
    setParams(DEFAULTS);
    setLogoName("");
  }, []);

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLogoName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Measure intrinsic aspect so wide/tall logos render undistorted.
        const img = new Image();
        img.onload = () => {
          const aspect =
            img.naturalWidth && img.naturalHeight
              ? img.naturalWidth / img.naturalHeight
              : 1;
          setParams((prev) => ({ ...prev, logoDataUrl: dataUrl, logoAspect: aspect }));
        };
        img.onerror = () => {
          setParams((prev) => ({ ...prev, logoDataUrl: dataUrl, logoAspect: 1 }));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const removeLogo = useCallback(() => {
    update("logoDataUrl", null);
    setLogoName("");
  }, [update]);

  /* --- Exports --- */
  const ensureXmlns = (s: string) =>
    s.includes("xmlns=") ? s : s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

  const downloadSvg = useCallback(() => {
    if (!svg) return;
    const out = ensureXmlns(svg);
    downloadBlob(new Blob([out], { type: "image/svg+xml" }), "qrcode.svg");
  }, [svg]);

  const downloadPng = useCallback(() => {
    if (!svg) return;
    const px = Number(params.pngSize);
    // Inject width/height so the rasterizer knows the pixel dimensions.
    const sized = ensureXmlns(svg).replace(
      "<svg",
      `<svg width="${px}" height="${px}"`
    );
    const blob = new Blob([sized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Do not pre-fill — the SVG carries its own background (or stays alpha).
        ctx.drawImage(img, 0, 0, px, px);
        void downloadCanvas(canvas, "qrcode.png");
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [svg, params.pngSize]);

  const logoEcWeak = params.logoDataUrl && (params.ecLevel === "L" || params.ecLevel === "M");

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-wb-50">
      {/* Canvas area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">
        <div className="w-full h-full flex items-center justify-center p-6 md:p-12 overflow-hidden">
          <div
            className="w-[min(70vmin,520px)] max-w-full rounded-[16px] overflow-hidden [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
            style={
              params.transparentBg
                ? {
                    backgroundImage:
                      "repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%)",
                    backgroundSize: "16px 16px",
                  }
                : undefined
            }
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        {/* Trademark notice */}
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-wb-400 select-none text-center">
          {t.qr.trademark}
        </p>

        <AppTopBar />
      </div>

      {/* Control surface */}
      <ControlPanel
        title={t.apps.qr.name}
        footer={
          <>
            <PushButton variant="light" onClick={handleReset} className="shrink-0">
              {t.reset}
            </PushButton>
            <OutputMenu label={t.qr.output}>
              <OutputMenuItem onSelect={downloadSvg}>SVG — Vector</OutputMenuItem>
              <OutputMenuItem onSelect={downloadPng}>PNG — Image</OutputMenuItem>
            </OutputMenu>
          </>
        }
      >
        {/* 1. Content */}
        <PanelSection title={t.qr.content}>
          <CodeField
            value={params.text}
            onChange={(e) => update("text", e.target.value)}
            placeholder={DEFAULT_TEXT}
            className="min-h-[72px]"
            spellCheck={false}
          />
          {error && <p className="text-[12px] text-wb-500">{t.qr.tooLong}</p>}
          <ControlRow label={t.qr.ecLevel}>
            <ButtonSelect
              value={params.ecLevel}
              options={[
                { value: "L", label: "L" },
                { value: "M", label: "M" },
                { value: "Q", label: "Q" },
                { value: "H", label: "H" },
              ]}
              onChange={(v) => update("ecLevel", v as EcLevel)}
            />
          </ControlRow>
        </PanelSection>

        {/* 2. Style */}
        <PanelSection title={t.qr.style}>
          <ControlRow label={t.qr.moduleShape}>
            <ButtonSelect
              value={params.moduleShape}
              options={[
                { value: "square", label: t.qr.square },
                { value: "rounded", label: t.qr.rounded },
                { value: "dot", label: t.qr.dot },
              ]}
              onChange={(v) => update("moduleShape", v as ModuleShape)}
            />
          </ControlRow>
          {params.moduleShape === "dot" && (
            <NestedGroup>
              <DragParam
                label={t.qr.dotVariation}
                value={params.dotVariation}
                min={0}
                max={1}
                step={0.05}
                defaultValue={DEFAULTS.dotVariation}
                onChange={(v) => update("dotVariation", v)}
              />
              {params.dotVariation > 0.6 && (
                <p className="text-[12px] text-wb-500">{t.qr.variationHint}</p>
              )}
            </NestedGroup>
          )}
          <ControlRow label={t.qr.eyeShape}>
            <ButtonSelect
              value={params.eyeShape}
              options={[
                { value: "square", label: t.qr.square },
                { value: "rounded", label: t.qr.rounded },
                { value: "circle", label: t.qr.circle },
              ]}
              onChange={(v) => update("eyeShape", v as EyeShape)}
            />
          </ControlRow>
          <DragParam
            label={t.qr.quietZone}
            value={params.margin}
            min={0}
            max={8}
            step={1}
            defaultValue={DEFAULTS.margin}
            onChange={(v) => update("margin", v)}
          />
        </PanelSection>

        {/* 3. Colors */}
        <PanelSection title={t.colors}>
          <ColorRow
            label={t.qr.fgColor}
            value={params.fgColor}
            onChange={(v) => update("fgColor", v)}
          />
          {!params.transparentBg && (
            <ColorRow
              label={t.qr.bgColor}
              value={params.bgColor}
              onChange={(v) => update("bgColor", v)}
            />
          )}
          <ToggleSwitch
            label={t.qr.transparentBg}
            active={params.transparentBg}
            onClick={() => update("transparentBg", !params.transparentBg)}
          />
          <ToggleSwitch
            label={t.qr.eyeColorToggle}
            active={params.customEyeColor}
            onClick={() => update("customEyeColor", !params.customEyeColor)}
          />
          {params.customEyeColor && (
            <NestedGroup>
              <ColorRow
                label={t.qr.eyeColor}
                value={params.eyeColor}
                onChange={(v) => update("eyeColor", v)}
              />
            </NestedGroup>
          )}
        </PanelSection>

        {/* 4. Logo */}
        <PanelSection title={t.qr.logo}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/svg+xml,image/png,image/jpeg"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <PushButton
            variant="dark"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            {t.qr.uploadLogo}
          </PushButton>
          {params.logoDataUrl && (
            <>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[12px] text-wb-600">
                  {logoName || "logo"}
                </p>
                <PushButton size="sm" variant="light" onClick={removeLogo} className="shrink-0">
                  {t.qr.removeLogo}
                </PushButton>
              </div>
              <NestedGroup>
                <DragParam
                  label={t.qr.logoSize}
                  value={params.logoScale}
                  min={10}
                  max={30}
                  step={1}
                  defaultValue={DEFAULTS.logoScale}
                  onChange={(v) => update("logoScale", v)}
                />
                <DragParam
                  label={t.qr.logoPad}
                  value={params.logoPad}
                  min={0}
                  max={4}
                  step={0.5}
                  defaultValue={DEFAULTS.logoPad}
                  onChange={(v) => update("logoPad", v)}
                />
                <DragParam
                  label={t.qr.logoRadius}
                  value={params.logoRadius}
                  min={0}
                  max={50}
                  step={1}
                  defaultValue={DEFAULTS.logoRadius}
                  onChange={(v) => update("logoRadius", v)}
                />
              </NestedGroup>
              {logoEcWeak && (
                <p className="text-[12px] text-wb-500">{t.qr.logoEcHint}</p>
              )}
            </>
          )}
        </PanelSection>

        {/* 5. Export */}
        <PanelSection title={t.qr.export} border={false}>
          <Select
            value={params.pngSize}
            onValueChange={(v) => update("pngSize", v as PngSize)}
          >
            <SelectTrigger size="sm" label={t.qr.pngSize}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="512">512</SelectItem>
              <SelectItem value="1024">1024</SelectItem>
              <SelectItem value="2048">2048</SelectItem>
              <SelectItem value="4096">4096</SelectItem>
            </SelectContent>
          </Select>
        </PanelSection>
      </ControlPanel>
    </div>
  );
}

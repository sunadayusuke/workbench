"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { PushButton } from "@/components/ui/push-button";
import { DragParam } from "@/components/ui/drag-param";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { downloadCanvas } from "@/lib/canvas-download";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 4×4 Bayer ordered dither matrix
const BAYER: number[][] = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

function bayerAt(x: number, y: number): number {
  return BAYER[y & 3][x & 3] / 16;
}

type Mode  = "wave" | "ripple" | "random" | "plasma";
type Shape = "square" | "circle";

interface Params {
  mode:         Mode;
  gridSize:     number;  // px per cell (2–20)
  speed:        number;  // 0–100
  frequency:    number;  // 0–100
  amplitude:    number;  // 0–100
  spread:       number;  // 0–100
  noise:        number;  // 0–100
  layers:       number;  // 1–4
  shape:        Shape;
  bgColor:      string;
  fgColor:      string;
  midColor:     string;
  transparentBg: boolean;
}

const DEFAULT: Params = {
  mode:         "random",
  gridSize:     4,
  speed:        45,
  frequency:    30,
  amplitude:    65,
  spread:       82,
  noise:        10,
  layers:       2,
  shape:        "square",
  bgColor:      "#111111",
  fgColor:      "#eeeeee",
  midColor:     "#555555",
  transparentBg: false,
};

function computeIntensity(
  mode: Mode,
  gx: number, gy: number,
  cols: number, rows: number,
  t: number,
  p: Params,
): number {
  const freq   = p.frequency / 100 * 0.12 + 0.01;
  const amp    = p.amplitude  / 100 * (rows * 0.35) + 2;
  const spread = p.spread     / 100 * 197 + 3;
  const noise  = p.noise      / 100 * 0.25;

  switch (mode) {
    case "wave": {
      const cy = rows / 2;
      let wave = 0;
      for (let l = 0; l < p.layers; l++) {
        const fScale = 1 + l * 0.4;
        const tScale = 1 - l * 0.15;
        const phOff  = l * 0.9;
        wave += Math.sin(gx * freq * fScale + t * tScale + phOff) * (amp / p.layers);
        wave += Math.cos(gx * freq * fScale * 0.4 - t * tScale * 0.6 + phOff) * (amp * 0.35 / p.layers);
      }
      const dist = Math.abs(gy - (cy + wave));
      return Math.max(0, 1 - dist / spread) + (Math.random() - 0.5) * noise;
    }

    case "ripple": {
      const cx = cols / 2;
      const cy = rows / 2;
      const nx = (gx - cx) / 18;
      const ny = (gy - cy) / 18;
      const d  = Math.sqrt(nx * nx + ny * ny);
      let val = 0;
      for (let l = 0; l < p.layers; l++) {
        const ph = (l / p.layers) * Math.PI;
        val += Math.sin(d * (freq * 25 + 2) - t + ph);
      }
      val /= p.layers;
      val = val * 0.7
          + (Math.sin(nx * freq * 10 + t * 0.3) + Math.cos(ny * freq * 10 + t * 0.2)) * 0.15;
      val += (Math.random() - 0.5) * noise * 2;
      return (val + 1) / 2;
    }

    case "random": {
      const nx = gx / cols;
      const ny = gy / rows;
      const f  = freq * 40 + 5;
      let val = Math.sin(nx * f + t * 1.1)          * 0.35
              + Math.cos(ny * f + t * 0.8)          * 0.35
              + Math.sin((nx - ny) * f * 0.7 + t * 1.4) * 0.30;
      val += (Math.random() - 0.5) * (noise * 4 + 0.3);
      return (val + 1) / 2;
    }

    case "plasma": {
      const nx = gx / 10;
      const ny = gy / 10;
      const f  = freq * 5 + 0.5;
      let val  = Math.sin(nx * f + t);
      val     += Math.cos(ny * f * 0.9 + t * 0.8);
      val     += Math.sin((nx + ny) * f * 0.6 + t * 1.2);
      val     += Math.sin(Math.sqrt(nx * nx + ny * ny + 0.01) * f - t);
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

function buildHtml(p: Params): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signal Noise</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: ${p.transparentBg ? "transparent" : p.bgColor}; overflow: hidden; }
canvas { display: block; width: 100vw; height: 100vh; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
const bayerAt = (x, y) => BAYER[y & 3][x & 3] / 16;

const p = {
  mode: "${p.mode}",
  gridSize: ${p.gridSize},
  speed: ${p.speed},
  frequency: ${p.frequency},
  amplitude: ${p.amplitude},
  spread: ${p.spread},
  noise: ${p.noise},
  layers: ${p.layers},
  shape: "${p.shape}",
  bgColor: "${p.bgColor}",
  fgColor: "${p.fgColor}",
  midColor: "${p.midColor}",
  transparentBg: ${p.transparentBg},
};

function computeIntensity(mode, gx, gy, cols, rows, t) {
  const freq   = p.frequency / 100 * 0.12 + 0.01;
  const amp    = p.amplitude  / 100 * (rows * 0.35) + 2;
  const spread = p.spread     / 100 * 197 + 3;
  const noise  = p.noise      / 100 * 0.25;
  if (mode === "wave") {
    const cy = rows / 2;
    let wave = 0;
    for (let l = 0; l < p.layers; l++) {
      const fScale = 1 + l * 0.4, tScale = 1 - l * 0.15, phOff = l * 0.9;
      wave += Math.sin(gx * freq * fScale + t * tScale + phOff) * (amp / p.layers);
      wave += Math.cos(gx * freq * fScale * 0.4 - t * tScale * 0.6 + phOff) * (amp * 0.35 / p.layers);
    }
    const dist = Math.abs(gy - (cy + wave));
    return Math.max(0, 1 - dist / spread) + (Math.random() - 0.5) * noise;
  }
  if (mode === "ripple") {
    const cx = cols / 2, cy = rows / 2;
    const nx = (gx - cx) / 18, ny = (gy - cy) / 18;
    const d = Math.sqrt(nx * nx + ny * ny);
    let val = 0;
    for (let l = 0; l < p.layers; l++) val += Math.sin(d * (freq * 25 + 2) - t + (l / p.layers) * Math.PI);
    val = val / p.layers * 0.7 + (Math.sin(nx * freq * 10 + t * 0.3) + Math.cos(ny * freq * 10 + t * 0.2)) * 0.15;
    return (val + (Math.random() - 0.5) * noise * 2 + 1) / 2;
  }
  if (mode === "random") {
    const nx = gx / cols, ny = gy / rows, f = freq * 40 + 5;
    let val = Math.sin(nx * f + t * 1.1) * 0.35 + Math.cos(ny * f + t * 0.8) * 0.35 + Math.sin((nx - ny) * f * 0.7 + t * 1.4) * 0.30;
    return (val + (Math.random() - 0.5) * (noise * 4 + 0.3) + 1) / 2;
  }
  // plasma
  const nx = gx / 10, ny = gy / 10, f = freq * 5 + 0.5;
  let val = Math.sin(nx * f + t) + Math.cos(ny * f * 0.9 + t * 0.8) + Math.sin((nx + ny) * f * 0.6 + t * 1.2) + Math.sin(Math.sqrt(nx * nx + ny * ny + 0.01) * f - t);
  for (let l = 1; l < p.layers; l++) { const ph = l * 1.3; val += Math.sin(nx * f * (1 + l * 0.3) + t * 1.1 + ph) * 0.5 + Math.cos(ny * f * (1 + l * 0.3) - t * 0.9 + ph) * 0.5; }
  return (val / (4 + (p.layers - 1)) + (Math.random() - 0.5) * noise + 1) / 2;
}

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: true });
let time = 0;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resize);
resize();

function draw() {
  const w = canvas.width, h = canvas.height;
  const gs = Math.max(2, Math.round(p.gridSize));
  const cols = Math.ceil(w / gs), rows = Math.ceil(h / gs);
  ctx.clearRect(0, 0, w, h);
  if (!p.transparentBg) { ctx.fillStyle = p.bgColor; ctx.fillRect(0, 0, w, h); }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = computeIntensity(p.mode, x, y, cols, rows, time);
      const thr = bayerAt(x, y);
      const color = v > thr + 0.38 ? p.fgColor : v > thr + 0.05 ? p.midColor : null;
      if (color) {
        ctx.fillStyle = color;
        if (p.shape === "circle") {
          ctx.beginPath(); ctx.arc(x * gs + gs / 2, y * gs + gs / 2, (gs - 1) / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(x * gs, y * gs, gs - 1, gs - 1);
        }
      }
    }
  }
  time += p.speed / 100 * 0.055;
  requestAnimationFrame(draw);
}
draw();
<\/script>
</body>
</html>`;
}

export default function SignalPage() {
  const { lang, toggle, t } = useLanguage();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const paramsRef  = useRef<Params>(DEFAULT);
  const timeRef    = useRef(0);
  const [params, setParams]       = useState<Params>(DEFAULT);
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const { copy, copied } = useClipboard();

  useEffect(() => { paramsRef.current = params; }, [params]);

  const update = useCallback(<K extends keyof Params>(key: K, val: Params[K]) => {
    setParams(p => ({ ...p, [key]: val }));
  }, []);

  // Animation loop — runs once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function draw() {
      if (!canvas || !ctx) return;
      const p  = paramsRef.current;
      const w  = canvas.width;
      const h  = canvas.height;
      if (w === 0 || h === 0) { animId = requestAnimationFrame(draw); return; }

      const gs   = Math.max(2, Math.round(p.gridSize));
      const cols = Math.ceil(w / gs);
      const rows = Math.ceil(h / gs);
      const spd  = p.speed / 100 * 0.055;

      ctx.clearRect(0, 0, w, h);
      if (!p.transparentBg) {
        ctx.fillStyle = p.bgColor;
        ctx.fillRect(0, 0, w, h);
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v   = computeIntensity(p.mode, x, y, cols, rows, timeRef.current, p);
          const thr = bayerAt(x, y);

          let color: string | null = null;
          if      (v > thr + 0.38) color = p.fgColor;
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

      timeRef.current += spd;
      animId = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  const handleDownload = () => {
    if (canvasRef.current) downloadCanvas(canvasRef.current, "signal-noise.png");
  };

  const handleExportCode = () => {
    setExportCode(buildHtml(params));
    setShowExport(true);
  };

  const MODES: Mode[] = ["wave", "ripple", "random", "plasma"];
  const modeLabel: Record<Mode, string> = {
    wave:   t.signal.wave,
    ripple: t.signal.ripple,
    random: t.signal.random,
    plasma: t.signal.plasma,
  };

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-[#d8d8da]">

      {/* Canvas area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative overflow-hidden" style={{ background: params.transparentBg ? undefined : params.bgColor }}>
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/"><PushButton variant="dark" size="sm">[ {t.back} ]</PushButton></Link>
          <PushButton onClick={toggle} variant="dark" size="sm">[ {lang === "ja" ? "EN" : "JA"} ]</PushButton>
        </div>
      </div>

      {/* Control surface */}
      <aside className="md:w-[320px] bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] border-l border-[#bbbbbe] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-[rgba(0,0,0,0.12)] shrink-0">
          <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333]">{t.apps.signal.name}</span>
          <PushButton size="sm" variant="dark" onClick={() => setParams(DEFAULT)}>[ {t.reset} ]</PushButton>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Mode */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
            <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] mb-3">{t.signal.mode}</p>
            <Select value={params.mode} onValueChange={v => update("mode", v as Mode)}>
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map(m => (
                  <SelectItem key={m} value={m}>{modeLabel[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.signal.grid}</p>
            <DragParam
              label={t.signal.gridSize}
              value={params.gridSize}
              min={2} max={20} step={1}
              defaultValue={DEFAULT.gridSize}
              onChange={v => update("gridSize", v)}
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono uppercase tracking-[0.10em] text-[#666]">{t.signal.shape}</span>
              <div className="flex gap-1">
                {(["square", "circle"] as Shape[]).map(s => (
                  <PushButton
                    key={s}
                    variant={params.shape === s ? "accent" : "light"}
                    size="sm"
                    onClick={() => update("shape", s)}
                  >
                    [ {s === "square" ? t.signal.square : t.signal.circle} ]
                  </PushButton>
                ))}
              </div>
            </div>
          </div>

          {/* Motion — params shown depend on mode */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.signal.motion}</p>
            <DragParam label={t.signal.speed}     value={params.speed}     min={0}  max={100} step={1} defaultValue={DEFAULT.speed}     onChange={v => update("speed", v)} />
            <DragParam label={t.signal.frequency} value={params.frequency} min={1}  max={100} step={1} defaultValue={DEFAULT.frequency} onChange={v => update("frequency", v)} />
            {(params.mode === "wave") && (
              <DragParam label={t.signal.amplitude} value={params.amplitude} min={1} max={100} step={1} defaultValue={DEFAULT.amplitude} onChange={v => update("amplitude", v)} />
            )}
            {(params.mode === "wave" || params.mode === "ripple") && (
              <DragParam label={t.signal.spread} value={params.spread} min={1} max={100} step={1} defaultValue={DEFAULT.spread} onChange={v => update("spread", v)} />
            )}
            <DragParam label={t.signal.noise}     value={params.noise}     min={0}  max={100} step={1} defaultValue={DEFAULT.noise}     onChange={v => update("noise", v)} />
            {(params.mode === "wave" || params.mode === "ripple" || params.mode === "plasma") && (
              <DragParam label={t.signal.layers} value={params.layers} min={1} max={4} step={1} defaultValue={DEFAULT.layers} onChange={v => update("layers", v)} />
            )}
          </div>

          {/* Colors */}
          <div className="px-5 py-4 flex flex-col gap-3">
            <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.signal.colors}</p>
            {([
              { key: "fgColor"  as const, label: t.signal.fgColor  },
              { key: "midColor" as const, label: t.signal.midColor },
              { key: "bgColor"  as const, label: t.signal.bgColor  },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[12px] font-mono uppercase tracking-[0.10em] text-[#666]">{label}</span>
                <input
                  type="color"
                  className="color-swatch"
                  value={params[key] as string}
                  onChange={e => update(key, e.target.value)}
                />
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono uppercase tracking-[0.10em] text-[#666]">{t.signal.transparentBg}</span>
              <ToggleSwitch
                active={params.transparentBg}
                onClick={() => update("transparentBg", !params.transparentBg)}
                size="sm"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-[rgba(0,0,0,0.12)] flex flex-col gap-2">
          <PushButton variant="light" className="w-full text-center" onClick={handleExportCode}>
            [ {t.exportCode} ]
          </PushButton>
          <PushButton variant="dark" className="w-full text-center" onClick={handleDownload}>
            [ {t.download} ]
          </PushButton>
        </div>
      </aside>

      {/* Export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>{t.exportCodeTitle}</DialogTitle>
          </DialogHeader>
          <textarea
            readOnly
            className="flex-1 min-h-0 w-full resize-none font-mono text-[11px] leading-relaxed bg-[#1a1a1a] text-[#e0e0e2] border border-[rgba(0,0,0,0.5)] [box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)] rounded p-3 outline-none"
            value={exportCode}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              className="px-4 py-2 bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none"
              onClick={() => copy(exportCode)}
            >
              {copied ? `[ ${t.copied} ]` : `[ ${t.copy} ]`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

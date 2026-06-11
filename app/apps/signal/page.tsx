"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLanguage } from "@/lib/i18n";
import { PushButton } from "@/components/ui/push-button";
import { DragParam } from "@/components/ui/drag-param";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ButtonSelect } from "@/components/ui/button-select";
import { ColorRow } from "@/components/ui/color-row";
import { downloadCanvas } from "@/lib/canvas-download";
import { AppTopBar } from "@/components/app-top-bar";
import { ControlPanel } from "@/components/ui/control-panel";
import { PanelSection } from "@/components/ui/panel-section";
import { ControlRow } from "@/components/ui/control-row";
import { OutputMenu, OutputMenuItem } from "@/components/ui/output-menu";
import { ExportDialog } from "@/components/ui/export-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { t } = useLanguage();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const paramsRef  = useRef<Params>(DEFAULT);
  const timeRef    = useRef(0);
  const [params, setParams]       = useState<Params>(DEFAULT);
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");

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
    <div className="fixed inset-0 flex flex-col md:flex-row bg-wb-50">

      {/* Canvas area */}
      <div className="h-[30vh] md:h-auto md:flex-1 relative overflow-hidden" style={{ background: params.transparentBg ? undefined : params.bgColor }}>
        <canvas ref={canvasRef} className="w-full h-full block" />
        <AppTopBar />
      </div>

      {/* Control surface */}
      <ControlPanel
        title={t.apps.signal.name}
        footer={
          <>
            <PushButton variant="light" onClick={() => setParams(DEFAULT)} className="shrink-0">
              {t.reset}
            </PushButton>
            <OutputMenu label={t.signal.output}>
              <OutputMenuItem onSelect={handleDownload}>PNG — Image</OutputMenuItem>
              <OutputMenuItem onSelect={handleExportCode}>HTML — Code</OutputMenuItem>
            </OutputMenu>
          </>
        }
      >

        {/* Mode */}
        <PanelSection>
          <Select value={params.mode} onValueChange={v => update("mode", v as Mode)}>
            <SelectTrigger label={t.signal.mode} className="w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map(m => (
                <SelectItem key={m} value={m}>{modeLabel[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelSection>

        {/* Grid */}
        <PanelSection title={t.signal.grid}>
          <DragParam
            label={t.signal.gridSize}
            value={params.gridSize}
            min={2} max={20} step={1}
            defaultValue={DEFAULT.gridSize}
            onChange={v => update("gridSize", v)}
          />
          <ControlRow label={t.signal.shape}>
            <ButtonSelect
              value={params.shape}
              options={[{ value: "square", label: t.signal.square }, { value: "circle", label: t.signal.circle }]}
              onChange={(v) => update("shape", v as Shape)}
            />
          </ControlRow>
        </PanelSection>

        {/* Motion — params shown depend on mode */}
        <PanelSection title={t.signal.motion}>
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
        </PanelSection>

        {/* Colors */}
        <PanelSection title={t.signal.colors} border={false}>
          {([
            { key: "fgColor"  as const, label: t.signal.fgColor  },
            { key: "midColor" as const, label: t.signal.midColor },
            { key: "bgColor"  as const, label: t.signal.bgColor  },
          ] as const).map(({ key, label }) => (
            <ColorRow
              key={key}
              label={label}
              value={params[key] as string}
              onChange={v => update(key, v)}
            />
          ))}
          <ToggleSwitch
            label={t.signal.transparentBg}
            active={params.transparentBg}
            onClick={() => update("transparentBg", !params.transparentBg)}
          />
        </PanelSection>

      </ControlPanel>

      {/* Export dialog */}
      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        title={t.exportCodeTitle}
        code={exportCode}
        filename="signal-noise.html"
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { Input } from "@/components/ui/input";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ControlPoints = [number, number, number, number];

type Preset = {
  name: string;
  category: string;
  value: ControlPoints;
};

type SceneKey = "button" | "modal" | "toast" | "sidebar" | "drawer" | "card" | "gallery";

type SceneMode = "interactive" | "toggle" | "carousel";

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */

const EASING_PRESETS: Preset[] = [
  // Basic
  { name: "linear", category: "Basic", value: [0, 0, 1, 1] },
  { name: "ease", category: "Basic", value: [0.25, 0.1, 0.25, 1] },
  // Ease In (gentle → aggressive)
  { name: "easeInSine", category: "Ease In", value: [0.12, 0, 0.39, 0] },
  { name: "easeInQuad", category: "Ease In", value: [0.11, 0, 0.5, 0] },
  { name: "easeInCubic", category: "Ease In", value: [0.32, 0, 0.67, 0] },
  { name: "easeInQuart", category: "Ease In", value: [0.5, 0, 0.75, 0] },
  { name: "easeInExpo", category: "Ease In", value: [0.7, 0, 0.84, 0] },
  { name: "easeInCirc", category: "Ease In", value: [0.55, 0, 1, 0.45] },
  { name: "easeInBack", category: "Ease In", value: [0.36, 0, 0.66, -0.56] },
  // Ease Out (gentle → aggressive)
  { name: "easeOutSine", category: "Ease Out", value: [0.61, 1, 0.88, 1] },
  { name: "easeOutQuad", category: "Ease Out", value: [0.5, 1, 0.89, 1] },
  { name: "easeOutCubic", category: "Ease Out", value: [0.33, 1, 0.68, 1] },
  { name: "easeOutQuart", category: "Ease Out", value: [0.25, 1, 0.5, 1] },
  { name: "easeOutExpo", category: "Ease Out", value: [0.16, 1, 0.3, 1] },
  { name: "easeOutCirc", category: "Ease Out", value: [0, 0.55, 0.45, 1] },
  { name: "easeOutBack", category: "Ease Out", value: [0.34, 1.56, 0.64, 1] },
  // Ease In Out (gentle → aggressive)
  { name: "easeInOutSine", category: "Ease In Out", value: [0.37, 0, 0.63, 1] },
  { name: "easeInOutQuad", category: "Ease In Out", value: [0.45, 0, 0.55, 1] },
  { name: "easeInOutCubic", category: "Ease In Out", value: [0.65, 0, 0.35, 1] },
  { name: "easeInOutQuart", category: "Ease In Out", value: [0.76, 0, 0.24, 1] },
  { name: "easeInOutExpo", category: "Ease In Out", value: [0.87, 0, 0.13, 1] },
  { name: "easeInOutCirc", category: "Ease In Out", value: [0.85, 0, 0.15, 1] },
  { name: "easeInOutBack", category: "Ease In Out", value: [0.68, -0.6, 0.32, 1.6] },
];

const PRESET_CATEGORIES = [...new Set(EASING_PRESETS.map((p) => p.category))];

/* ------------------------------------------------------------------ */
/*  Scene definitions                                                  */
/* ------------------------------------------------------------------ */

const SCENES: { key: SceneKey; label: string; mode: SceneMode }[] = [
  { key: "button", label: "ボタン", mode: "interactive" },
  { key: "modal", label: "モーダル", mode: "toggle" },
  { key: "toast", label: "トースト", mode: "toggle" },
  { key: "sidebar", label: "サイドバー", mode: "toggle" },
  { key: "drawer", label: "ドロワー", mode: "toggle" },
  { key: "card", label: "カード", mode: "interactive" },
  { key: "gallery", label: "ギャラリー", mode: "carousel" },
];

/* ------------------------------------------------------------------ */
/*  Unsplash images                                                    */
/* ------------------------------------------------------------------ */

const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
];

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function formatCubicBezier(p: ControlPoints): string {
  return `cubic-bezier(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]})`;
}

function generateExportCode(
  format: string,
  points: ControlPoints,
  duration: number
): string {
  const [x1, y1, x2, y2] = points;
  const cb = formatCubicBezier(points);
  const sec = (duration / 1000).toFixed(2).replace(/\.?0+$/, "");

  switch (format) {
    case "css-transition":
      return `transition: all ${duration}ms ${cb};`;
    case "css-animation":
      return `@keyframes myAnimation {
  from { /* 開始状態 */ }
  to { /* 終了状態 */ }
}

.element {
  animation: myAnimation ${duration}ms ${cb} both;
}`;
    case "javascript":
      return `element.animate(
  [
    { /* 開始状態 */ },
    { /* 終了状態 */ }
  ],
  {
    duration: ${duration},
    easing: "${cb}",
    fill: "both"
  }
);`;
    case "framer-motion":
      return `<motion.div
  animate={{ /* 終了状態 */ }}
  transition={{
    duration: ${sec},
    ease: [${x1}, ${y1}, ${x2}, ${y2}]
  }}
/>`;
    case "swiftui":
      return `.animation(
  .timingCurve(${x1}, ${y1}, ${x2}, ${y2}, duration: ${sec}),
  value: trigger
)`;
    case "tailwind":
      return `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      transitionTimingFunction: {
        custom: "${cb}",
      },
    },
  },
};

// 使用例:
// <div className="transition-all duration-[${duration}ms] ease-custom">`;
    default:
      return "";
  }
}

const DEFAULT_POINTS: ControlPoints = [0.65, 0, 0.35, 1];
const DEFAULT_DURATION = 200;
const DEFAULT_PRESET = "easeInOutCubic";

const EXPORT_FORMATS = [
  { value: "css-transition", label: "CSS Transition" },
  { value: "css-animation", label: "CSS Animation" },
  { value: "javascript", label: "JavaScript" },
  { value: "framer-motion", label: "React (Framer Motion)" },
  { value: "swiftui", label: "SwiftUI" },
  { value: "tailwind", label: "Tailwind CSS" },
];

/* ------------------------------------------------------------------ */
/*  (no global animation hook — each scene manages its own state)      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  BezierEditor                                                       */
/* ------------------------------------------------------------------ */

function BezierEditor({
  points,
  onChange,
}: {
  points: ControlPoints;
  onChange: (p: ControlPoints) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<1 | 2 | null>(null);

  const PADDING = 28;
  const Y_MIN = -0.5;
  const Y_MAX = 1.5;
  const Y_RANGE = Y_MAX - Y_MIN;

  const toCanvas = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const drawW = w - PADDING * 2;
      const drawH = h - PADDING * 2;
      return {
        cx: PADDING + x * drawW,
        cy: PADDING + (1 - (y - Y_MIN) / Y_RANGE) * drawH,
      };
    },
    []
  );

  const fromCanvas = useCallback(
    (cx: number, cy: number, w: number, h: number) => {
      const drawW = w - PADDING * 2;
      const drawH = h - PADDING * 2;
      const x = Math.max(0, Math.min(1, (cx - PADDING) / drawW));
      const y = Y_MIN + (1 - (cy - PADDING) / drawH) * Y_RANGE;
      return { x, y: Math.max(Y_MIN, Math.min(Y_MAX, y)) };
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "oklch(0.14 0 0)";
    ctx.fillRect(0, 0, w, h);

    const drawW = w - PADDING * 2;
    const drawH = h - PADDING * 2;

    // Grid lines
    ctx.strokeStyle = "oklch(0.22 0 0)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = PADDING + (i / 4) * drawW;
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, PADDING + drawH);
      ctx.stroke();
    }
    // Y grid: 0 and 1 lines (main reference)
    for (const val of [0, 1]) {
      const { cy } = toCanvas(0, val, w, h);
      ctx.beginPath();
      ctx.moveTo(PADDING, cy);
      ctx.lineTo(PADDING + drawW, cy);
      ctx.stroke();
    }

    // Diagonal reference line (linear)
    const p0 = toCanvas(0, 0, w, h);
    const p1 = toCanvas(1, 1, w, h);
    ctx.strokeStyle = "oklch(0.35 0 0)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.cx, p0.cy);
    ctx.lineTo(p1.cx, p1.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Control point handle lines
    const cp1 = toCanvas(points[0], points[1], w, h);
    const cp2 = toCanvas(points[2], points[3], w, h);
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

    // Bezier curve
    ctx.strokeStyle = "oklch(0.95 0 0)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p0.cx, p0.cy);
    ctx.bezierCurveTo(cp1.cx, cp1.cy, cp2.cx, cp2.cy, p1.cx, p1.cy);
    ctx.stroke();

    // Control points
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

    // Start/end points
    for (const ep of [p0, p1]) {
      ctx.fillStyle = "oklch(0.5 0 0)";
      ctx.beginPath();
      ctx.arc(ep.cx, ep.cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points, toCanvas]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  const getCanvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cx, cy } = getCanvasCoords(e);
    const w = rect.width;
    const h = rect.height;

    const cp1 = toCanvas(points[0], points[1], w, h);
    const cp2 = toCanvas(points[2], points[3], w, h);

    const dist1 = Math.hypot(cx - cp1.cx, cy - cp1.cy);
    const dist2 = Math.hypot(cx - cp2.cx, cy - cp2.cy);

    const threshold = 20;
    if (dist1 < threshold && dist1 <= dist2) {
      draggingRef.current = 1;
    } else if (dist2 < threshold) {
      draggingRef.current = 2;
    } else {
      return;
    }

    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cx, cy } = getCanvasCoords(e);
    const { x, y } = fromCanvas(cx, cy, rect.width, rect.height);

    const newPoints: ControlPoints = [...points];
    if (draggingRef.current === 1) {
      newPoints[0] = Math.round(x * 100) / 100;
      newPoints[1] = Math.round(y * 100) / 100;
    } else {
      newPoints[2] = Math.round(x * 100) / 100;
      newPoints[3] = Math.round(y * 100) / 100;
    }
    onChange(newPoints);
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  return (
    <div ref={containerRef} className="w-full aspect-square">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PresetGrid                                                         */
/* ------------------------------------------------------------------ */

function PresetMiniCurve({ points }: { points: ControlPoints }) {
  const [x1, y1, x2, y2] = points;
  const svgW = 22;
  const svgH = 22;
  const pad = 2;
  const w = svgW - pad * 2;
  const h = svgH - pad * 2;
  const toSvg = (x: number, y: number) => ({
    sx: pad + x * w,
    sy: pad + (1 - y) * h,
  });
  const s = toSvg(0, 0);
  const c1 = toSvg(x1, y1);
  const c2 = toSvg(x2, y2);
  const e = toSvg(1, 1);
  const d = `M${s.sx},${s.sy} C${c1.sx},${c1.sy} ${c2.sx},${c2.sy} ${e.sx},${e.sy}`;
  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <path
        d={d}
        fill="none"
        stroke="oklch(0.5 0 0)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function PresetGrid({
  activePreset,
  onSelect,
}: {
  activePreset: string | null;
  onSelect: (name: string, value: ControlPoints) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {PRESET_CATEGORIES.map((category) => (
        <div key={category}>
          <div className="text-[11px] text-muted-foreground mb-1.5">{category}</div>
          <div className="flex flex-wrap gap-1">
            {EASING_PRESETS.filter((p) => p.category === category).map((preset) => (
              <button
                key={preset.name}
                title={preset.name}
                onClick={() => onSelect(preset.name, preset.value)}
                className={`p-[4px] rounded-md border transition-colors cursor-pointer ${
                  activePreset === preset.name
                    ? "border-foreground bg-foreground/10"
                    : "border-border bg-transparent hover:border-foreground/30"
                }`}
              >
                <PresetMiniCurve points={preset.value} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene components                                                   */
/* ------------------------------------------------------------------ */

interface SceneProps {
  easing: string;
  duration: number;
}

/* --- Interactive scenes: button (press) & card (hover) --- */

function ButtonScene({ easing, duration }: SceneProps) {
  const [pressed, setPressed] = useState(false);

  const style: React.CSSProperties = {
    transform: pressed ? "scale(0.92)" : "scale(1)",
    boxShadow: pressed
      ? "0 1px 2px rgba(0,0,0,0.3)"
      : "0 4px 12px rgba(0,0,0,0.2)",
    transition: `all ${duration}ms ${easing}`,
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div
        className="px-8 py-3 bg-foreground text-background rounded-xl text-[15px] font-semibold select-none cursor-pointer"
        style={style}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
      >
        ボタンを押す
      </div>
    </div>
  );
}

function CardScene({ easing, duration }: SceneProps) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    transform: hovered ? "translateY(-4px)" : "translateY(0)",
    boxShadow: hovered
      ? "0 8px 20px rgba(0,0,0,0.15)"
      : "0 1px 3px rgba(0,0,0,0.1)",
    transition: `all ${duration}ms ${easing}`,
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div
        className="bg-card border border-border rounded-xl overflow-hidden w-[220px] cursor-pointer"
        style={style}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onTouchStart={() => setHovered(true)}
        onTouchEnd={() => setHovered(false)}
      >
        <div className="h-[100px] bg-muted" />
        <div className="p-4">
          <div className="text-[14px] font-semibold mb-1">カードタイトル</div>
          <div className="text-[12px] text-muted-foreground">
            ホバーでエフェクトを確認
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Toggle scenes: modal, toast, sidebar, drawer --- */

function ToggleControls({
  isOpen,
  onOpen,
  onClose,
}: {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
      <button
        onClick={onOpen}
        disabled={isOpen}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-[13px] font-semibold shadow-lg transition-all cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-default disabled:active:scale-100"
      >
        開く
      </button>
      <button
        onClick={onClose}
        disabled={!isOpen}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-muted text-foreground border border-border text-[13px] font-semibold shadow-lg transition-all cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-default disabled:active:scale-100"
      >
        閉じる
      </button>
    </div>
  );
}

function ModalScene({ easing, duration }: SceneProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Track whether we've ever opened so we can apply transitions only after first open
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

  const overlayStyle: React.CSSProperties = {
    opacity: isOpen ? 1 : 0,
    transition: hasOpened ? `opacity ${duration}ms ${easing}` : "none",
    pointerEvents: "none" as const,
  };

  const modalStyle: React.CSSProperties = {
    transform: isOpen ? "scale(1)" : "scale(0.9)",
    opacity: isOpen ? 1 : 0,
    transition: hasOpened ? `all ${duration}ms ${easing}` : "none",
  };

  return (
    <div className="flex items-center justify-center h-full relative">
      <div className="absolute inset-0 bg-black/40 rounded-lg" style={overlayStyle} />
      <div
        className="relative bg-card border border-border rounded-xl p-6 w-[280px] shadow-xl"
        style={modalStyle}
      >
        <div className="text-[15px] font-semibold mb-2">確認</div>
        <div className="text-[13px] text-muted-foreground mb-4">
          この操作を実行しますか？
        </div>
        <div className="flex gap-2 justify-end">
          <div className="px-3 py-1.5 text-[13px] rounded-lg border border-border bg-muted">
            キャンセル
          </div>
          <div className="px-3 py-1.5 text-[13px] rounded-lg bg-foreground text-background">
            確認
          </div>
        </div>
      </div>
      <ToggleControls isOpen={isOpen} onOpen={handleOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

function ToastScene({ easing, duration }: SceneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

  const style: React.CSSProperties = {
    transform: isOpen ? "translateX(0)" : "translateX(120%)",
    transition: hasOpened ? `transform ${duration}ms ${easing}` : "none",
  };

  return (
    <div className="h-full relative overflow-hidden">
      <div className="absolute top-6 right-6" style={style}>
        <div className="bg-card border border-border rounded-xl p-4 shadow-lg w-[240px]">
          <div className="flex items-start gap-3">
            <div className="text-[18px]">✓</div>
            <div>
              <div className="text-[13px] font-semibold">保存しました</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                変更が正常に保存されました
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToggleControls isOpen={isOpen} onOpen={handleOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

function SidebarScene({ easing, duration }: SceneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

  const overlayStyle: React.CSSProperties = {
    opacity: isOpen ? 1 : 0,
    transition: hasOpened ? `opacity ${duration}ms ${easing}` : "none",
    pointerEvents: isOpen ? ("auto" as const) : ("none" as const),
  };

  const sidebarStyle: React.CSSProperties = {
    transform: isOpen ? "translateX(0)" : "translateX(-100%)",
    transition: hasOpened ? `transform ${duration}ms ${easing}` : "none",
  };

  return (
    <div className="h-full relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-0 bg-black/40"
        style={overlayStyle}
        onClick={() => setIsOpen(false)}
      />
      <div
        className="absolute inset-y-0 left-0 w-[200px] bg-card border-r border-border p-4"
        style={sidebarStyle}
      >
        <div className="text-[13px] font-semibold mb-4">メニュー</div>
        {["ホーム", "プロフィール", "設定", "ヘルプ"].map((item) => (
          <div
            key={item}
            className="text-[13px] text-muted-foreground py-2 px-2 rounded-lg hover:bg-muted"
          >
            {item}
          </div>
        ))}
      </div>
      <ToggleControls isOpen={isOpen} onOpen={handleOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

function DrawerScene({ easing, duration }: SceneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

  const overlayStyle: React.CSSProperties = {
    opacity: isOpen ? 1 : 0,
    transition: hasOpened ? `opacity ${duration}ms ${easing}` : "none",
    pointerEvents: isOpen ? ("auto" as const) : ("none" as const),
  };

  const drawerStyle: React.CSSProperties = {
    transform: isOpen ? "translateY(0)" : "translateY(100%)",
    transition: hasOpened ? `transform ${duration}ms ${easing}` : "none",
  };

  return (
    <div className="h-full relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-0 bg-black/40"
        style={overlayStyle}
        onClick={() => setIsOpen(false)}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-card border-t border-border rounded-t-xl p-5"
        style={drawerStyle}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
        <div className="text-[14px] font-semibold mb-2">共有</div>
        <div className="text-[13px] text-muted-foreground mb-4">
          このリンクを共有しますか？
        </div>
        <div className="flex gap-4">
          {["コピー", "メール", "SNS"].map((item) => (
            <div
              key={item}
              className="flex-1 py-2 text-center text-[13px] rounded-lg bg-muted border border-border"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
      <ToggleControls isOpen={isOpen} onOpen={handleOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

/* --- Carousel scene: gallery --- */

function GalleryScene({ easing, duration }: SceneProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [offset, setOffset] = useState(0);

  const total = UNSPLASH_IMAGES.length;

  const go = (dir: "next" | "prev") => {
    if (isAnimating) return;
    setDirection(dir);
    setIsAnimating(true);
    // offset: -1 = slide left (next), +1 = slide right (prev)
    setOffset(dir === "next" ? -1 : 1);
  };

  const handleTransitionEnd = () => {
    setIsAnimating(false);
    setCurrentIndex((prev) =>
      direction === "next"
        ? (prev + 1) % total
        : (prev - 1 + total) % total
    );
    setOffset(0);
  };

  const prevIndex = (currentIndex - 1 + total) % total;
  const nextIndex = (currentIndex + 1) % total;

  // Track is w-[300%], so translateX % is relative to 3x parent width.
  // To show middle slide: -33.333%, shift by ±33.333% per slide.
  const unit = 100 / 3;
  const baseOffset = -unit;
  const animOffset = offset * unit;

  const trackStyle: React.CSSProperties = {
    transform: `translateX(${baseOffset + animOffset}%)`,
    transition: isAnimating ? `transform ${duration}ms ${easing}` : "none",
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="flex items-center gap-3">
        {/* Prev arrow */}
        <button
          onClick={() => go("prev")}
          className="w-8 h-8 rounded-full bg-muted border border-border text-foreground flex items-center justify-center cursor-pointer hover:bg-accent active:scale-95 transition-all shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
        </button>

        {/* Image */}
        <div className="w-[260px] md:w-[400px] h-[180px] md:h-[260px] rounded-xl overflow-hidden">
          <div
            className="flex w-[300%] h-full"
            style={trackStyle}
            onTransitionEnd={handleTransitionEnd}
          >
            {[prevIndex, currentIndex, nextIndex].map((imgIdx, i) => (
              <div
                key={`${i}-${imgIdx}`}
                className="w-1/3 h-full bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${UNSPLASH_IMAGES[imgIdx]})` }}
              />
            ))}
          </div>
        </div>

        {/* Next arrow */}
        <button
          onClick={() => go("next")}
          className="w-8 h-8 rounded-full bg-muted border border-border text-foreground flex items-center justify-center cursor-pointer hover:bg-accent active:scale-95 transition-all shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {/* Dots */}
      <div className="flex gap-1.5">
        {UNSPLASH_IMAGES.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === currentIndex ? "bg-foreground" : "bg-foreground/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

const SCENE_COMPONENTS: Record<SceneKey, React.ComponentType<SceneProps>> = {
  button: ButtonScene,
  modal: ModalScene,
  toast: ToastScene,
  sidebar: SidebarScene,
  drawer: DrawerScene,
  card: CardScene,
  gallery: GalleryScene,
};

/* ------------------------------------------------------------------ */
/*  ExportDialog                                                       */
/* ------------------------------------------------------------------ */

function ExportDialog({
  open,
  onOpenChange,
  points,
  duration,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  points: ControlPoints;
  duration: number;
}) {
  const [format, setFormat] = useState("css-transition");
  const [copied, setCopied] = useState(false);

  const code = generateExportCode(format, points, duration);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
        <DialogHeader>
          <DialogTitle>コード出力</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <textarea
            readOnly
            value={code}
            className="flex-1 min-h-[200px] bg-muted text-foreground border border-border rounded-lg font-mono text-[11px] leading-relaxed p-4 resize-none outline-none focus:border-ring"
          />
          <Button size="sm" onClick={handleCopy}>
            {copied ? "コピーしました" : "コピー"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function EasingPage() {
  const [controlPoints, setControlPoints] = useState<ControlPoints>(DEFAULT_POINTS);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [activePreset, setActivePreset] = useState<string | null>(DEFAULT_PRESET);
  const [activeScene, setActiveScene] = useState<SceneKey>("button");
  const [showExport, setShowExport] = useState(false);

  const easingCSS = formatCubicBezier(controlPoints);

  const handlePointsChange = (p: ControlPoints) => {
    setControlPoints(p);
    setActivePreset(null);
  };

  const handlePresetSelect = (name: string, value: ControlPoints) => {
    setControlPoints(value);
    setActivePreset(name);
  };

  const handleDurationChange = (val: number[]) => {
    setDuration(val[0]);
  };

  const handleReset = () => {
    setControlPoints(DEFAULT_POINTS);
    setDuration(DEFAULT_DURATION);
    setActivePreset(DEFAULT_PRESET);
  };

  const handlePointInput = (index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const clamped =
      index % 2 === 0
        ? Math.max(0, Math.min(1, num))
        : Math.max(-0.5, Math.min(1.5, num));
    const newPoints: ControlPoints = [...controlPoints];
    newPoints[index] = Math.round(clamped * 100) / 100;
    setControlPoints(newPoints);
    setActivePreset(null);
  };

  const ActiveSceneComponent = SCENE_COMPONENTS[activeScene];

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-background">
      {/* Main area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0 flex flex-col">
        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/75! border-black/10! text-foreground/80! backdrop-blur-xl hover:bg-white/90! hover:border-black/20!"
            >
              ← 戻る
            </Button>
          </Link>
        </div>

        {/* Scene tabs */}
        <div className="flex items-center gap-1 px-3 pt-14 pb-2 md:px-4 md:pt-16 md:pb-3 overflow-x-auto shrink-0">
          {SCENES.map((scene) => (
            <button
              key={scene.key}
              onClick={() => setActiveScene(scene.key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                activeScene === scene.key
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {scene.label}
            </button>
          ))}
        </div>

        {/* Scene preview area */}
        <div className="flex-1 relative mx-3 mb-3 md:mx-4 md:mb-4 rounded-xl bg-muted/50 border border-border overflow-hidden">
          <ActiveSceneComponent
            easing={easingCSS}
            duration={duration}
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex-1 md:flex-none md:w-80 shrink bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.25)] md:shadow-none border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden">
        <div className="px-6 py-3 md:pt-5 md:pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold -tracking-[0.01em]">
              イージング
            </h2>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              リセット
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
          {/* Bezier editor */}
          <div className="text-[12px] text-muted-foreground font-mono">{easingCSS}</div>
          <BezierEditor points={controlPoints} onChange={handlePointsChange} />

          {/* Numeric inputs */}
          <div className="grid grid-cols-4 gap-2">
            {(["P1x", "P1y", "P2x", "P2y"] as const).map((label, i) => (
              <div key={label} className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">{label}</Label>
                <Input
                  type="number"
                  step={0.01}
                  min={i % 2 === 0 ? 0 : -0.5}
                  max={i % 2 === 0 ? 1 : 1.5}
                  value={controlPoints[i]}
                  onChange={(e) => handlePointInput(i, e.target.value)}
                  className="h-8 text-[13px] font-mono"
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Duration */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">デュレーション</Label>
              <span className="text-[12px] text-muted-foreground font-mono">
                {duration}ms
              </span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={handleDurationChange}
              min={10}
              max={2000}
              step={10}
            />
          </div>

          <Separator />

          {/* Presets */}
          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">プリセット</Label>
            <PresetGrid
              activePreset={activePreset}
              onSelect={handlePresetSelect}
            />
          </div>

          <Separator />

          {/* Export button */}
          <Button size="sm" onClick={() => setShowExport(true)}>
            コード出力
          </Button>
        </div>
      </aside>

      {/* Export dialog */}
      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        points={controlPoints}
        duration={duration}
      />
    </div>
  );
}

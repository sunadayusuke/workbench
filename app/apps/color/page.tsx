"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ================================================================== */
/*  Color conversion utilities (no external library)                   */
/* ================================================================== */

// sRGB ↔ Linear RGB
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// HEX → sRGB [0,1]
function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// sRGB [0,1] → HEX
function srgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Linear RGB → OKLab (Bjorn Ottosson)
function linearRgbToOklab(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// OKLab → Linear RGB
function oklabToLinearRgb(
  L: number,
  a: number,
  b: number
): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// OKLab ↔ OKLCH
function oklabToOklch(
  L: number,
  a: number,
  b: number
): [number, number, number] {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
function oklchToOklab(
  L: number,
  C: number,
  H: number
): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
}

// High-level conversions
function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToSrgb(hex);
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const [L, a, bVal] = linearRgbToOklab(lr, lg, lb);
  return oklabToOklch(L, a, bVal);
}

function oklchToHex(L: number, C: number, H: number): string {
  const [labL, a, b] = oklchToOklab(L, C, H);
  const [lr, lg, lb] = oklabToLinearRgb(labL, a, b);
  return srgbToHex(linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb));
}

function isInGamut(L: number, C: number, H: number): boolean {
  const [labL, a, b] = oklchToOklab(L, C, H);
  const [r, g, bVal] = oklabToLinearRgb(labL, a, b);
  const eps = -0.001;
  const max = 1.001;
  return r >= eps && r <= max && g >= eps && g <= max && bVal >= eps && bVal <= max;
}

// WCAG relative luminance from sRGB [0,1]
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToSrgb(hex);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Validate hex
function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// oklch(...) 文字列をパースしてHEXに変換
function parseOklchString(str: string): string | null {
  const m = str.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*\)/i);
  if (!m) return null;
  let L = parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const H = parseFloat(m[3]);
  // % 表記の場合は 0-1 に変換
  if (L > 1) L = L / 100;
  if (isNaN(L) || isNaN(C) || isNaN(H)) return null;
  return oklchToHex(L, C, H);
}

// sRGB → HSL hue (0-360, or -1 if achromatic)
function srgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.001) return -1;
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h / 6) * 360;
}

function perceivedHue(hex: string): number {
  return srgbHue(...hexToSrgb(hex));
}

function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

// Find OKLCH hue that produces the target perceived (HSL) hue at given L and C
function findCorrectedHue(
  targetPerceivedHue: number,
  L: number,
  C: number,
  hintH: number
): number {
  if (C < 0.005 || targetPerceivedHue < 0) return hintH;

  let bestH = hintH;
  let bestDiff = Infinity;

  // Coarse search ±40°
  for (let d = -40; d <= 40; d += 2) {
    const h = (hintH + d + 360) % 360;
    const ph = perceivedHue(oklchToHex(L, C, h));
    if (ph < 0) continue;
    const diff = hueDiff(ph, targetPerceivedHue);
    if (diff < bestDiff) { bestDiff = diff; bestH = h; }
  }

  // Fine search ±2°
  const coarse = bestH;
  for (let d = -2; d <= 2; d += 0.2) {
    const h = (coarse + d + 360) % 360;
    const ph = perceivedHue(oklchToHex(L, C, h));
    if (ph < 0) continue;
    const diff = hueDiff(ph, targetPerceivedHue);
    if (diff < bestDiff) { bestDiff = diff; bestH = h; }
  }

  return bestH;
}

/* ================================================================== */
/*  Scale generation                                                   */
/* ================================================================== */

// Tailwind準拠の固定明度分布
const SCALE_STEPS: { step: number; lightness: number }[] = [
  { step: 50, lightness: 0.97 },
  { step: 100, lightness: 0.93 },
  { step: 200, lightness: 0.88 },
  { step: 300, lightness: 0.81 },
  { step: 400, lightness: 0.71 },
  { step: 500, lightness: 0.62 },
  { step: 600, lightness: 0.55 },
  { step: 700, lightness: 0.49 },
  { step: 800, lightness: 0.42 },
  { step: 900, lightness: 0.38 },
  { step: 950, lightness: 0.28 },
];

// Binary search for maximum in-gamut chroma at given L and H
function maxChromaInGamut(L: number, H: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(L, mid, H)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function generateScale(
  baseL: number,
  baseC: number,
  H: number
): { step: number; L: number; C: number; H: number; hex: string; isBase: boolean }[] {
  const maxCAtBase = maxChromaInGamut(baseL, H);
  const chromaRatio = maxCAtBase > 0 ? Math.min(baseC / maxCAtBase, 1) : 0;

  const baseHex = oklchToHex(baseL, baseC, H);
  const targetHue = perceivedHue(baseHex);

  // ベースカラーに最も近いステップをベースステップとする
  let baseIdx = 0;
  let bestDiff = Infinity;
  SCALE_STEPS.forEach(({ lightness }, i) => {
    const diff = Math.abs(lightness - baseL);
    if (diff < bestDiff) { bestDiff = diff; baseIdx = i; }
  });

  // 高明度 × 高彩度の色はスケール上端から離す（黄色〜黄緑の鮮やかな色向け）
  const chromaWeight = Math.min(1, baseC / 0.10);
  const effectiveSat = chromaRatio * chromaWeight;
  const pushSteps = Math.round(2 * effectiveSat * effectiveSat);
  let anchorIdx = Math.max(pushSteps, baseIdx);

  // 高彩度色が steps 300-400 にある場合、gamut cliff を越えて step 500 へ押し出す
  // （赤〜ピンク系は L=0.70-0.80 で gamut が急激に狭まり、base だけ彩度が突出する）
  if (effectiveSat > 0.7 && anchorIdx >= 3 && anchorIdx <= 4) {
    anchorIdx = 5;
  }

  const pushed = anchorIdx > baseIdx;

  // === 明度 ===
  const K_L = 0.15;
  const last = SCALE_STEPS.length - 1;
  let lightnessValues: number[];

  if (pushed) {
    // 押し出しあり: SCALE_STEPS を区分線形リスケール
    // アンカー位置で baseL を通るように上下を伸縮（標準比率を維持）
    const stdAbove = SCALE_STEPS[0].lightness - SCALE_STEPS[anchorIdx].lightness;
    const newAbove = SCALE_STEPS[0].lightness - baseL;
    const stdBelow = SCALE_STEPS[anchorIdx].lightness - SCALE_STEPS[last].lightness;
    const newBelow = baseL - SCALE_STEPS[last].lightness;
    lightnessValues = SCALE_STEPS.map(({ lightness }, i) => {
      if (i <= anchorIdx) {
        const t = stdAbove > 0 ? (SCALE_STEPS[0].lightness - lightness) / stdAbove : 1;
        return SCALE_STEPS[0].lightness - t * newAbove;
      }
      const t = stdBelow > 0 ? (SCALE_STEPS[anchorIdx].lightness - lightness) / stdBelow : 1;
      return baseL - t * newBelow;
    });
  } else {
    // 押し出しなし: ガウシアンシフト（従来通り）
    const lShift = baseL - SCALE_STEPS[anchorIdx].lightness;
    lightnessValues = SCALE_STEPS.map(({ lightness }, i) => {
      const dist = i - anchorIdx;
      return lightness + lShift * Math.exp(-K_L * dist * dist);
    });
  }

  // 単調減少を保証 + 範囲クランプ
  lightnessValues = lightnessValues.map((v) => Math.max(0.01, Math.min(0.995, v)));
  for (let i = 1; i < lightnessValues.length; i++) {
    if (lightnessValues[i] >= lightnessValues[i - 1]) {
      lightnessValues[i] = lightnessValues[i - 1] - 0.005;
    }
  }

  // === 彩度 ===
  // peakRatio: 遠いステップが目指す gamut max に対する彩度比率
  // chromaRatio > 0.5（淡色でもガマット境界に近い）→ フルブースト（鮮やかなスケール）
  // chromaRatio < 0.2（グレー系）→ ブーストなし（chromaRatio をそのまま使用）
  const colorFactor = Math.min(1, baseC / 0.01);
  const boostGate = Math.min(1, Math.max(0, (chromaRatio - 0.2) / 0.3));
  const crBoost = boostGate * 0.9 * (1 - Math.pow(1 - chromaRatio, 3)) * colorFactor;
  const peakRatio = Math.max(chromaRatio, crBoost);
  const K_C = 0.15;

  // 押し出し時: 上端の彩度（step 50 を淡くする）
  const topEndC = pushed
    ? 0.35 * maxChromaInGamut(lightnessValues[0], H)
    : 0;

  // === 第1パス: L, C を計算 ===
  const rawSteps = SCALE_STEPS.map(({ step }, i) => {
    const L = lightnessValues[i];
    const maxC = maxChromaInGamut(L, H);
    const idealC = peakRatio * maxC;
    let stepC: number;

    if (pushed && i < anchorIdx) {
      const t = anchorIdx > 0 ? i / anchorIdx : 0;
      stepC = topEndC + (baseC - topEndC) * t;
      stepC = Math.min(stepC, maxC);
    } else {
      const dist = i - anchorIdx;
      const blendT = 1 - Math.exp(-K_C * dist * dist);
      stepC = baseC + (idealC - baseC) * blendT;
      stepC = Math.max(0, Math.min(stepC, maxC));
    }

    return { step, L, C: stepC, isBase: i === anchorIdx };
  });

  // === 第2パス: 色相をスムーズ化 ===
  // 各ステップで独立に色相補正すると赤〜ピンク系で大きなジャンプが生じる
  // → 端点の補正色相を求め、ベースを通る線形補間で均一なグラデーションにする
  const hue0 = rawSteps[0].C > 0.005
    ? findCorrectedHue(targetHue, rawSteps[0].L, rawSteps[0].C, H) : H;
  const hueLast = rawSteps[last].C > 0.005
    ? findCorrectedHue(targetHue, rawSteps[last].L, rawSteps[last].C, H) : H;

  // 色相差を [-180, 180) に正規化
  const normHueDiff = (a: number, b: number) => {
    let d = b - a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };
  const diffAbove = normHueDiff(hue0, H);
  const diffBelow = normHueDiff(H, hueLast);

  return rawSteps.map((s, i) => {
    let finalH: number;
    if (s.isBase) {
      finalH = H;
    } else if (i < anchorIdx) {
      const t = anchorIdx > 0 ? i / anchorIdx : 0;
      finalH = hue0 + diffAbove * t;
    } else {
      const remaining = last - anchorIdx;
      const t = remaining > 0 ? (i - anchorIdx) / remaining : 1;
      finalH = H + diffBelow * t;
    }
    finalH = ((finalH % 360) + 360) % 360;

    const hex = oklchToHex(s.L, s.C, finalH);
    return { step: s.step, L: s.L, C: s.C, H: finalH, hex, isBase: s.isBase };
  });
}

function generateCssOutput(
  scaleName: string,
  scale: ReturnType<typeof generateScale>
): string {
  const lightLines = scale.map(
    (s) =>
      `  --${scaleName}-${s.step}: oklch(${s.L.toFixed(3)} ${s.C.toFixed(3)} ${s.H.toFixed(1)}); /* ${s.hex} */`
  );
  const reversed = [...scale].reverse();
  const darkLines = scale.map(
    (s, i) =>
      `  --${scaleName}-${s.step}: oklch(${reversed[i].L.toFixed(3)} ${reversed[i].C.toFixed(3)} ${reversed[i].H.toFixed(1)}); /* ${reversed[i].hex} */`
  );
  return `/* Light */\n:root, .light {\n${lightLines.join("\n")}\n}\n\n/* Dark */\n.dark {\n${darkLines.join("\n")}\n}`;
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <Label className="text-[13px]">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {value.toFixed(step < 0.01 ? 4 : step < 0.1 ? 3 : 2)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function ColorInput({
  label,
  hex,
  onChangeHex,
  className,
  inputClassName,
}: {
  label?: string;
  hex: string;
  onChangeHex: (hex: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [draft, setDraft] = useState(hex);
  const [editing, setEditing] = useState(false);

  const commitDraft = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      // oklch(...) をパース
      const fromOklch = parseOklchString(trimmed);
      if (fromOklch) {
        onChangeHex(fromOklch);
        setDraft(fromOklch);
        return;
      }
      // HEX正規化
      let normalized = trimmed.replace(/^#+/, "#");
      if (!normalized.startsWith("#")) normalized = "#" + normalized;
      if (isValidHex(normalized)) {
        onChangeHex(normalized);
        setDraft(normalized);
      } else {
        setDraft(hex);
      }
    },
    [onChangeHex, hex]
  );

  const displayValue = editing ? draft : hex;

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {label && <Label className="text-[13px]">{label}</Label>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => {
            onChangeHex(e.target.value);
            setDraft(e.target.value);
          }}
          className="size-9 shrink-0 border border-border rounded-xl bg-transparent cursor-pointer p-0 overflow-hidden color-swatch"
        />
        <Input
          value={displayValue}
          onFocus={() => {
            setDraft(hex);
            setEditing(true);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commitDraft(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDraft(draft);
          }}
          className={`font-mono text-xs ${inputClassName ?? ""}`}
        />
      </div>
    </div>
  );
}

function ContrastResult({
  fgHex,
  bgHex,
}: {
  fgHex: string;
  bgHex: string;
}) {
  const ratio = contrastRatio(fgHex, bgHex);
  const checks = [
    { label: "AA", threshold: 4.5 },
    { label: "AA 大", threshold: 3.0 },
    { label: "AAA", threshold: 7.0 },
    { label: "AAA 大", threshold: 4.5 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Preview */}
      <div
        className="rounded-lg border border-border p-4 text-center"
        style={{ backgroundColor: bgHex, color: fgHex }}
      >
        <p className="text-[22px] font-bold leading-tight">Aa</p>
        <p className="text-xs mt-1">サンプルテキスト</p>
      </div>

      {/* Ratio */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">コントラスト比</span>
        <span className="text-[15px] font-bold font-mono tabular-nums">
          {ratio.toFixed(2)}:1
        </span>
      </div>

      {/* WCAG badges */}
      <div className="flex flex-wrap gap-1.5">
        {checks.map((c) => (
          <Badge
            key={c.label}
            variant={ratio >= c.threshold ? "default" : "outline"}
            className={
              ratio >= c.threshold
                ? "bg-success text-success-foreground"
                : "text-muted-foreground"
            }
          >
            {c.label} {ratio >= c.threshold ? "Pass" : "Fail"}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ScaleSwatch({
  scale,
}: {
  scale: ReturnType<typeof generateScale>;
}) {
  return (
    <div className="flex flex-col gap-0">
      {scale.map((s) => (
        <div
          key={s.step}
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: s.hex }}
        >
          <span
            className="text-xs font-bold w-8 tabular-nums"
            style={{ color: textOnBg(s.hex) }}
          >
            {s.step}
          </span>
          {s.isBase && (
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: textOnBg(s.hex) }}
            />
          )}
          <span
            className="text-[11px] font-mono flex-1"
            style={{ color: textOnBg(s.hex), opacity: 0.8 }}
          >
            oklch({s.L.toFixed(3)} {s.C.toFixed(3)} {s.H.toFixed(1)})
          </span>
          <span
            className="text-[11px] font-mono"
            style={{ color: textOnBg(s.hex), opacity: 0.6 }}
          >
            {s.hex}
          </span>
        </div>
      ))}
    </div>
  );
}

type ScaleEntry = ReturnType<typeof generateScale>[number];

// Find the scale step whose contrast against pageBgHex is closest to target
function pickByContrast(
  scale: ScaleEntry[],
  pageBgHex: string,
  target: number
): ScaleEntry {
  let best = scale[0];
  let bestDiff = Infinity;
  for (const s of scale) {
    const diff = Math.abs(contrastRatio(s.hex, pageBgHex) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

function toOklch(s: ScaleEntry): string {
  return `oklch(${s.L.toFixed(3)} ${s.C.toFixed(3)} ${s.H.toFixed(1)})`;
}

// 背景色に対して白と黒のどちらがコントラスト高いか返す
function textOnBg(bgHex: string): string {
  // 白がAA大文字基準(3:1)を満たすなら白を優先（色付き背景では白文字の方が自然）
  if (contrastRatio(bgHex, "#ffffff") >= 3) return "#fff";
  return "#000";
}

function UiSample({ scale, bg }: { scale: ScaleEntry[]; bg: "light" | "dark" }) {
  const pageBg = bg === "light" ? "#ffffff" : "#000000";

  // コントラスト比ベースで動的にステップを選定
  const textPrimary  = toOklch(pickByContrast(scale, pageBg, 12));
  const textSecondary = toOklch(pickByContrast(scale, pageBg, 4.5));
  const accentEntry  = pickByContrast(scale, pageBg, 4.0);
  const accent       = toOklch(accentEntry);
  const accentText   = textOnBg(accentEntry.hex);
  const surfaceEntry = pickByContrast(scale, pageBg, 1.1);
  const surfaceBg    = toOklch(surfaceEntry);
  const raisedEntry  = pickByContrast(scale, pageBg, 1.25);
  const surfaceRaised = toOklch(raisedEntry);
  const raisedText   = textOnBg(raisedEntry.hex);
  const accentHoverEntry = pickByContrast(scale, pageBg, 5.0);
  const accentHover  = toOklch(accentHoverEntry);
  const accentHoverText = textOnBg(accentHoverEntry.hex);
  const raisedHover  = toOklch(pickByContrast(scale, pageBg, 1.5));
  const borderSubtle = toOklch(pickByContrast(scale, pageBg, 1.3));
  const borderColor  = toOklch(pickByContrast(scale, pageBg, 2.0));
  const borderHover  = toOklch(pickByContrast(scale, pageBg, 3.0));
  const inputBg      = toOklch(pickByContrast(scale, pageBg, 1.05));

  return (
    <div className="flex flex-col gap-5" style={{ color: textPrimary }}>
      {/* Card */}
      <div
        className="rounded-xl p-5 flex flex-col gap-3"
        style={{ backgroundColor: surfaceBg, border: `1px solid ${borderSubtle}` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold">月間レポート</span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: surfaceRaised, color: raisedText }}
          >
            公開中
          </span>
        </div>
        <p className="text-[26px] font-bold tracking-tight">¥1,248,000</p>
        <p className="text-[12px]" style={{ color: textSecondary }}>
          前月比 +12.5%
        </p>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: surfaceRaised }}>
          <div
            className="h-full rounded-full"
            style={{ width: "68%", backgroundColor: accent }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] ui-btn-primary"
          style={{
            "--btn-bg": accent,
            "--btn-bg-hover": accentHover,
            "--btn-text": accentText,
            "--btn-text-hover": accentHoverText,
            backgroundColor: "var(--btn-bg)",
            color: "var(--btn-text)",
          } as React.CSSProperties}
        >
          保存する
        </button>
        <button
          className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] ui-btn-secondary"
          style={{
            "--btn-bg": surfaceRaised,
            "--btn-bg-hover": raisedHover,
            backgroundColor: "var(--btn-bg)",
            color: textPrimary,
          } as React.CSSProperties}
        >
          下書き
        </button>
        <button
          className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] ui-btn-outline"
          style={{
            "--btn-border": borderColor,
            "--btn-border-hover": borderHover,
            border: "1px solid var(--btn-border)",
            color: textPrimary,
          } as React.CSSProperties}
        >
          キャンセル
        </button>
      </div>

      {/* Notification */}
      <div
        className="rounded-lg p-3.5 flex items-start gap-3"
        style={{ backgroundColor: surfaceBg, border: `1px solid ${borderSubtle}` }}
      >
        <span
          className="shrink-0 mt-0.5 size-5 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ backgroundColor: accent, color: accentText }}
        >
          i
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold">お知らせ</span>
          <span className="text-[12px]" style={{ color: textSecondary }}>
            新しいアップデートが利用可能です。
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">メールアドレス</span>
        <div
          className="h-9 rounded-xl px-3 flex items-center text-[13px]"
          style={{
            backgroundColor: inputBg,
            border: `1px solid ${borderColor}`,
            color: textSecondary,
          }}
        >
          example@email.com
        </div>
      </div>

      {/* List items */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: `1px solid ${borderSubtle}` }}
      >
        {["ダッシュボード", "プロジェクト", "設定"].map((item, i) => (
          <div
            key={item}
            className="px-4 py-2.5 text-[13px] flex items-center justify-between transition-colors ui-list-item"
            style={{
              "--item-bg": "transparent",
              "--item-bg-hover": surfaceRaised,
              backgroundColor: i === 1 ? surfaceRaised : "var(--item-bg)",
              borderTop: i > 0 ? `1px solid ${borderSubtle}` : undefined,
              fontWeight: i === 1 ? 600 : 400,
            } as React.CSSProperties}
          >
            {item}
            <span className="text-[11px]" style={{ color: textSecondary }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Page component                                                     */
/* ================================================================== */

export default function ColorPage() {
  // Base color state
  const [hex, setHex] = useState("#2a6db6");
  const [oklch, setOklch] = useState<[number, number, number]>(() =>
    hexToOklch("#2a6db6")
  );

  // Contrast comparison color
  const [contrastHex, setContrastHex] = useState("#ffffff");

  // Scale CSS variable name
  const [scaleName, setScaleName] = useState("brand");

  // CSS output dialog
  const [showCssDialog, setShowCssDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync hex → oklch
  const updateFromHex = useCallback((newHex: string) => {
    setHex(newHex);
    setOklch(hexToOklch(newHex));
  }, []);

  // Sync oklch → hex
  const updateFromOklch = useCallback(
    (index: 0 | 1 | 2, value: number) => {
      const next: [number, number, number] = [...oklch];
      next[index] = value;
      setOklch(next);
      setHex(oklchToHex(next[0], next[1], next[2]));
    },
    [oklch]
  );

  // Derived data
  const gamutOk = useMemo(
    () => isInGamut(oklch[0], oklch[1], oklch[2]),
    [oklch]
  );

  const scale = useMemo(
    () => generateScale(oklch[0], oklch[1], oklch[2]),
    [oklch]
  );

  const darkScale = useMemo(() => {
    const reversed = [...scale].reverse();
    return scale.map((s, i) => ({
      ...s,
      L: reversed[i].L,
      C: reversed[i].C,
      H: reversed[i].H,
      hex: reversed[i].hex,
      isBase: reversed[i].isBase,
    }));
  }, [scale]);

  const cssOutput = useMemo(
    () => generateCssOutput(scaleName, scale),
    [scaleName, scale]
  );

  const handleCopyCss = useCallback(() => {
    navigator.clipboard.writeText(cssOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cssOutput]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-background">
      {/* Main area */}
      <div className="h-[60vh] md:h-auto md:flex-1 min-w-0 flex flex-col overflow-hidden shrink-0">
        {/* Top bar */}
        <div className="flex items-center px-4 md:px-5 h-12 md:h-14 border-b border-border shrink-0">
          <Link href="/">
            <Button variant="outline" size="sm">
              ← 戻る
            </Button>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 md:gap-8">
          {/* Color preview */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              プレビュー
            </h3>
            <div className="flex gap-4 items-stretch">
              <div
                className="w-32 h-32 rounded-3xl border border-border shrink-0"
                style={{ backgroundColor: hex }}
              />
              <div className="flex flex-col justify-center gap-1 min-w-0">
                <p className="text-[15px] font-bold font-mono">{hex}</p>
                <p className="text-[13px] font-mono text-muted-foreground">
                  oklch({oklch[0].toFixed(3)} {oklch[1].toFixed(3)}{" "}
                  {oklch[2].toFixed(1)})
                </p>
                {!gamutOk && (
                  <p className="text-xs text-warning font-medium">
                    sRGBガマット外（クランプ表示）
                  </p>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* Contrast checker */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              コントラストチェック
            </h3>
            <ColorInput
              label="比較色"
              hex={contrastHex}
              onChangeHex={setContrastHex}
              inputClassName="w-20"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ContrastResult fgHex={hex} bgHex={contrastHex} />
              <ContrastResult fgHex={contrastHex} bgHex={hex} />
            </div>
          </section>

          <Separator />

          {/* Scale */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              カラースケール
            </h3>
            <div className="flex flex-col sm:flex-row -mx-4 md:-mx-6 -mb-6">
              <div className="flex-1 min-w-0 bg-white px-5 py-6 md:px-9 md:py-9">
                <p className="text-[13px] font-medium text-black mb-4">Light</p>
                <ScaleSwatch scale={scale} />
              </div>
              <div className="flex-1 min-w-0 bg-black px-5 py-6 md:px-9 md:py-9">
                <p className="text-[13px] font-medium text-white mb-4">Dark</p>
                <ScaleSwatch scale={darkScale} />
              </div>
            </div>
          </section>

          <Separator />

          {/* UI Samples */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              UIサンプル
            </h3>
            <div className="flex flex-col sm:flex-row -mx-4 md:-mx-6 -mb-6">
              <div className="flex-1 min-w-0 bg-white px-5 py-6 md:px-9 md:py-9">
                <UiSample scale={scale} bg="light" />
              </div>
              <div className="flex-1 min-w-0 bg-black px-5 py-6 md:px-9 md:py-9">
                <UiSample scale={scale} bg="dark" />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex-1 md:flex-none w-full md:w-80 bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.15)] md:shadow-none border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden">
        <div className="flex items-center px-6 h-10 md:h-14 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold -tracking-[0.01em]">
            設定
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
          {/* Base color input */}
          <ColorInput
            label="ベースカラー"
            hex={hex}
            onChangeHex={updateFromHex}
          />

          <Separator />

          {/* OKLCH sliders */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            OKLCH
          </p>
          <ParamSlider
            label="L（明度）"
            value={oklch[0]}
            min={0}
            max={1}
            step={0.001}
            onChange={(v) => updateFromOklch(0, v)}
          />
          <ParamSlider
            label="C（彩度）"
            value={oklch[1]}
            min={0}
            max={0.4}
            step={0.001}
            onChange={(v) => updateFromOklch(1, v)}
          />
          <ParamSlider
            label="H（色相）"
            value={oklch[2]}
            min={0}
            max={360}
            step={0.1}
            onChange={(v) => updateFromOklch(2, v)}
          />

          <Separator />

          {/* Scale name */}
          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">スケール名</Label>
            <Input
              value={scaleName}
              onChange={(e) => setScaleName(e.target.value)}
              placeholder="brand"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              CSS変数のプレフィックス（例: --{scaleName}-500）
            </p>
          </div>

          <Separator />

          <Button
            className="w-full"
            onClick={() => {
              setShowCssDialog(true);
              setCopied(false);
            }}
          >
            CSS出力
          </Button>
        </div>
      </aside>

      {/* CSS output dialog */}
      <Dialog open={showCssDialog} onOpenChange={setShowCssDialog}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>CSS出力 — OKLCHカラースケール</DialogTitle>
          </DialogHeader>
          <textarea
            className="flex-1 min-h-[300px] bg-muted text-foreground border border-border rounded-lg font-mono text-[11px] leading-relaxed p-4 resize-none outline-none focus:border-ring"
            value={cssOutput}
            readOnly
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCssDialog(false)}
            >
              閉じる
            </Button>
            <Button onClick={handleCopyCss}>
              {copied ? "コピーしました" : "クリップボードにコピー"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

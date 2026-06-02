/* ==================================================================
   Color app — home-card canvas preview.

   The color app has NO canvas in-app: it renders an OKLCH swatch scale
   as DOM. To reproduce its signature DEFAULT visual on a <canvas>, we
   run the EXACT default color math from app/apps/color/page.tsx:

     - base color hex "#2a6db6" (the page's default / reset value)
     - hexToOklch -> [L, C, H]
     - generateScale(L, C, H) -> 11 OKLCH steps (50..950)

   …then draw those 11 generated hex colors as horizontal bands across
   the canvas, top (step 50, lightest) to bottom (step 950, darkest),
   matching the order the app shows them.

   This is a static (no time uniform) Canvas2D render: draw once + on
   resize. No RAF.
================================================================== */

/* ------------------------------------------------------------------ */
/*  Color conversion utilities (verbatim from page.tsx)                */
/* ------------------------------------------------------------------ */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function srgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

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
  return (
    r >= eps && r <= max && g >= eps && g <= max && bVal >= eps && bVal <= max
  );
}

// sRGB → HSL hue (0-360, or -1 if achromatic)
function srgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.001) return -1;
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
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
    if (diff < bestDiff) {
      bestDiff = diff;
      bestH = h;
    }
  }

  // Fine search ±2°
  const coarse = bestH;
  for (let d = -2; d <= 2; d += 0.2) {
    const h = (coarse + d + 360) % 360;
    const ph = perceivedHue(oklchToHex(L, C, h));
    if (ph < 0) continue;
    const diff = hueDiff(ph, targetPerceivedHue);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestH = h;
    }
  }

  return bestH;
}

/* ------------------------------------------------------------------ */
/*  Scale generation (verbatim from page.tsx)                          */
/* ------------------------------------------------------------------ */

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
    if (diff < bestDiff) {
      bestDiff = diff;
      baseIdx = i;
    }
  });

  // 高明度 × 高彩度の色はスケール上端から離す（黄色〜黄緑の鮮やかな色向け）
  const chromaWeight = Math.min(1, baseC / 0.1);
  const effectiveSat = chromaRatio * chromaWeight;
  const pushSteps = Math.round(2 * effectiveSat * effectiveSat);
  let anchorIdx = Math.max(pushSteps, baseIdx);

  // 高彩度色が steps 300-400 にある場合、gamut cliff を越えて step 500 へ押し出す
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
    const stdAbove = SCALE_STEPS[0].lightness - SCALE_STEPS[anchorIdx].lightness;
    const newAbove = SCALE_STEPS[0].lightness - baseL;
    const stdBelow =
      SCALE_STEPS[anchorIdx].lightness - SCALE_STEPS[last].lightness;
    const newBelow = baseL - SCALE_STEPS[last].lightness;
    lightnessValues = SCALE_STEPS.map(({ lightness }, i) => {
      if (i <= anchorIdx) {
        const t =
          stdAbove > 0 ? (SCALE_STEPS[0].lightness - lightness) / stdAbove : 1;
        return SCALE_STEPS[0].lightness - t * newAbove;
      }
      const t =
        stdBelow > 0
          ? (SCALE_STEPS[anchorIdx].lightness - lightness) / stdBelow
          : 1;
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
  const colorFactor = Math.min(1, baseC / 0.01);
  const boostGate = Math.min(1, Math.max(0, (chromaRatio - 0.2) / 0.3));
  const crBoost = boostGate * 0.9 * (1 - Math.pow(1 - chromaRatio, 3)) * colorFactor;
  const peakRatio = Math.max(chromaRatio, crBoost);
  const K_C = 0.15;

  // 押し出し時: 上端の彩度（step 50 を淡くする）
  const topEndC = pushed ? 0.35 * maxChromaInGamut(lightnessValues[0], H) : 0;

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
  const hue0 =
    rawSteps[0].C > 0.005
      ? findCorrectedHue(targetHue, rawSteps[0].L, rawSteps[0].C, H)
      : H;
  const hueLast =
    rawSteps[last].C > 0.005
      ? findCorrectedHue(targetHue, rawSteps[last].L, rawSteps[last].C, H)
      : H;

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

/* ------------------------------------------------------------------ */
/*  Preview                                                            */
/* ------------------------------------------------------------------ */

// Page default / reset base color.
const DEFAULT_HEX = "#2a6db6";

export function createPreview(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");

  // Compute the default scale once (static, no animation).
  const [L, C, H] = hexToOklch(DEFAULT_HEX);
  const scale = generateScale(L, C, H);

  let ro: ResizeObserver | null = null;

  if (!ctx) {
    return () => {};
  }

  const render = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw the 11 generated scale colors as horizontal bands, lightest
    // (step 50) on top to darkest (step 950) at the bottom — the same
    // top-to-bottom order the app's ScaleSwatch renders.
    const n = scale.length;
    for (let i = 0; i < n; i++) {
      // Use ceil-based boundaries so bands tile without seams.
      const y0 = Math.floor((i / n) * h);
      const y1 = Math.floor(((i + 1) / n) * h);
      ctx.fillStyle = scale[i].hex;
      ctx.fillRect(0, y0, w, y1 - y0);
    }
  };

  render();
  ro = new ResizeObserver(render);
  ro.observe(canvas);

  return () => {
    ro?.disconnect();
    ro = null;
  };
}

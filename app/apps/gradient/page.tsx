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

/* ------------------------------------------------------------------ */
/*  Shaders                                                           */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;

uniform vec2 uResolution;
uniform float uAspect;
uniform int uGradientType;
uniform float uSpread;
uniform float uAngle;
uniform float uScale;
uniform int uColorCount;
uniform vec2 uColorPositions[8];
uniform float uColorData[24];
uniform float uNoise;
uniform float uGrain;
uniform float uStipple;
uniform float uStippleSize;
uniform float uHalftone;
uniform float uGlassAmount;
uniform float uGlassFreq;
uniform float uGlassShift;
uniform float uChromatic;
uniform float uWaveAmount;
uniform float uWaveFrequency;
uniform float uWaveAngle;
uniform float uWaveRandom;
uniform float uSeed;

/* --- Simplex noise --- */
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                     + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                             dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x2 = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x2) - 0.5;
    vec3 a0 = x2 - floor(x2 + 0.5);
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}


void main() {
    // Letterbox / pillarbox
    float canvasAspect = uResolution.x / uResolution.y;
    vec2 sc;
    if (canvasAspect > uAspect) {
        sc = vec2(uAspect / canvasAspect, 1.0);
    } else {
        sc = vec2(1.0, canvasAspect / uAspect);
    }
    vec2 uv = (vUv - 0.5) / sc + 0.5;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(vec3(0.05), 1.0);
        return;
    }

    // Wave distortion
    vec2 wuv = uv;
    if (uWaveAmount > 0.0) {
        vec2 dir = vec2(cos(uWaveAngle), sin(uWaveAngle));
        vec2 perp = vec2(-dir.y, dir.x);
        float along = dot(uv - 0.5, dir);
        float phase = along * uWaveFrequency + uSeed;
        // Add noise for organic randomness
        if (uWaveRandom > 0.0) {
            phase += snoise(uv * 3.0 + uSeed * 0.5) * uWaveRandom * 4.0;
        }
        float wave = sin(phase) * uWaveAmount * 0.08;
        wuv += perp * wave;
    }

    // Scale UV around center
    vec2 suv = (wuv - 0.5) / uScale + 0.5;

    // --- Rib effect: cylindrical lens per strip ---
    if (uGlassAmount > 0.0) {
        float freq = mix(3.0, 70.0, uGlassFreq);
        float stripIndex = floor(suv.x * freq);
        float cell = fract(suv.x * freq);
        float stripCenter = (stripIndex + 0.5) / freq;
        float stretch = 1.0 + uGlassAmount * 20.0;
        float ribX = stripCenter + (cell - 0.5) * stretch / freq;
        suv.x = ribX;
        // Progressive vertical shift per strip
        if (uGlassShift > 0.0) {
            suv.y += stripIndex * uGlassShift * 0.01;
        }
    }

    // --- Chromatic aberration: sample R/G/B at offset UVs ---
    float caShift = uChromatic * 0.03;
    vec2 uvR = suv + vec2( caShift, 0.0);
    vec2 uvG = suv;
    vec2 uvB = suv + vec2(-caShift, 0.0);

    // --- Stipple: per-pixel cell for particle spray ---
    float stippleCellSize = mix(1.5, 5.0, uStippleSize);
    vec2 stippleCellId = floor(vUv * uResolution / stippleCellSize);

    // --- Mesh gradient: weighted average (3-pass for chromatic) ---
    vec3 color = vec3(0.0);
    float twR = 0.0, twG = 0.0, twB = 0.0;
    float cR = 0.0, cG = 0.0, cB = 0.0;
    float sigma = uSpread;

    for (int i = 0; i < 8; i++) {
        if (i >= uColorCount) break;
        vec3 col = vec3(uColorData[i * 3], uColorData[i * 3 + 1], uColorData[i * 3 + 2]);

        // Distance for G (center channel)
        float dG;
        if (uGradientType == 0) {
            dG = distance(uvG, uColorPositions[i]);
        } else if (uGradientType == 1) {
            vec2 dir = vec2(cos(uAngle), sin(uAngle));
            dG = abs(dot(uvG - 0.5, dir) - dot(uColorPositions[i] - 0.5, dir));
        } else {
            dG = abs(length(uvG - 0.5) - length(uColorPositions[i] - 0.5));
        }
        if (uNoise > 0.0) {
            float n = snoise(uvG * 1.5 + uSeed * 0.3 + float(i) * 1.7) * 0.7
                    + snoise(uvG * 3.0 + uSeed * 0.7 + float(i) * 3.1) * 0.2
                    + snoise(uvG * 5.0 + uSeed * 1.1 + float(i) * 5.3) * 0.1;
            dG += n * uNoise * 0.35;
            dG = max(dG, 0.0);
        }
        float wG = exp(-dG * dG / (2.0 * sigma * sigma));
        wG = wG * wG * wG * wG * wG;

        // Stipple: use weight as probability - particles dense near source, sparse far
        if (uStipple > 0.0) {
            float r = rand(stippleCellId + float(i) * 7.13 + uSeed * 0.01);
            float hasParticle = step(r, pow(wG, 0.3 + uStipple * 0.5));
            wG = mix(wG, hasParticle, uStipple);
        }

        if (uChromatic > 0.0) {
            // Distance for R
            float dR;
            if (uGradientType == 0) {
                dR = distance(uvR, uColorPositions[i]);
            } else if (uGradientType == 1) {
                vec2 dir = vec2(cos(uAngle), sin(uAngle));
                dR = abs(dot(uvR - 0.5, dir) - dot(uColorPositions[i] - 0.5, dir));
            } else {
                dR = abs(length(uvR - 0.5) - length(uColorPositions[i] - 0.5));
            }
            if (uNoise > 0.0) {
                float n = snoise(uvR * 1.5 + uSeed * 0.3 + float(i) * 1.7) * 0.7
                        + snoise(uvR * 3.0 + uSeed * 0.7 + float(i) * 3.1) * 0.2
                        + snoise(uvR * 5.0 + uSeed * 1.1 + float(i) * 5.3) * 0.1;
                dR += n * uNoise * 0.35;
                dR = max(dR, 0.0);
            }
            float wR = exp(-dR * dR / (2.0 * sigma * sigma));
            wR = wR * wR * wR * wR * wR;
            if (uStipple > 0.0) {
                float rR = rand(stippleCellId + float(i) * 7.13 + 300.0 + uSeed * 0.01);
                wR = mix(wR, step(rR, pow(wR, 0.3 + uStipple * 0.5)), uStipple);
            }

            // Distance for B
            float dB;
            if (uGradientType == 0) {
                dB = distance(uvB, uColorPositions[i]);
            } else if (uGradientType == 1) {
                vec2 dir = vec2(cos(uAngle), sin(uAngle));
                dB = abs(dot(uvB - 0.5, dir) - dot(uColorPositions[i] - 0.5, dir));
            } else {
                dB = abs(length(uvB - 0.5) - length(uColorPositions[i] - 0.5));
            }
            if (uNoise > 0.0) {
                float n = snoise(uvB * 1.5 + uSeed * 0.3 + float(i) * 1.7) * 0.7
                        + snoise(uvB * 3.0 + uSeed * 0.7 + float(i) * 3.1) * 0.2
                        + snoise(uvB * 5.0 + uSeed * 1.1 + float(i) * 5.3) * 0.1;
                dB += n * uNoise * 0.35;
                dB = max(dB, 0.0);
            }
            float wB = exp(-dB * dB / (2.0 * sigma * sigma));
            wB = wB * wB * wB * wB * wB;
            if (uStipple > 0.0) {
                float rB = rand(stippleCellId + float(i) * 7.13 + 600.0 + uSeed * 0.01);
                wB = mix(wB, step(rB, pow(wB, 0.3 + uStipple * 0.5)), uStipple);
            }

            cR += col.r * wR; twR += wR;
            cG += col.g * wG; twG += wG;
            cB += col.b * wB; twB += wB;
        } else {
            cR += col.r * wG; twR += wG;
            cG += col.g * wG; twG += wG;
            cB += col.b * wG; twB += wG;
        }
    }

    color.r = twR > 0.0 ? cR / twR : 0.0;
    color.g = twG > 0.0 ? cG / twG : 0.0;
    color.b = twB > 0.0 ? cB / twB : 0.0;

    // --- Post-effects ---

    // Grain
    if (uGrain > 0.0) {
        float n = rand(vUv * 1000.0 + uSeed * 0.1) - 0.5;
        color += n * uGrain * 0.4;
    }

    // Halftone
    if (uHalftone > 0.0) {
        float htSize = mix(3.0, 12.0, uHalftone);
        vec2 htUV = vUv * uResolution / htSize;
        float htLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float htDist = length(fract(htUV) - 0.5);
        float htRadius = sqrt(1.0 - htLum) * 0.5;
        float htDot = smoothstep(htRadius, htRadius - 0.07, htDist);
        color = mix(color, color * htDot, uHalftone);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  Types & defaults                                                  */
/* ------------------------------------------------------------------ */

interface ColorSpot {
  color: string;
  x: number;
  y: number;
}

interface GradientParams {
  aspectPreset: string;
  customWidth: number;
  customHeight: number;
  gradientType: number;
  spread: number;
  angle: number;
  scale: number;
  noise: number;
  colors: ColorSpot[];
  grain: number;
  stipple: number;
  stippleSize: number;
  halftone: number;
  glassAmount: number;
  glassFreq: number;
  glassShift: number;
  chromatic: number;
  waveAmount: number;
  waveFrequency: number;
  waveAngle: number;
  waveRandom: number;
}

const ASPECT_PRESETS = [
  { key: "9:16", label: "スマホ (9:16)", width: 1080, height: 1920 },
  { key: "16:9", label: "デスクトップ (16:9)", width: 1920, height: 1080 },
  { key: "1:1", label: "正方形 (1:1)", width: 1080, height: 1080 },
  { key: "4:3", label: "4:3", width: 1440, height: 1080 },
  { key: "3:2", label: "3:2", width: 1620, height: 1080 },
  { key: "custom", label: "カスタム", width: 1080, height: 1920 },
];

const GRADIENT_TYPES = [
  { value: "0", label: "メッシュ" },
  { value: "1", label: "リニア" },
  { value: "2", label: "ラジアル" },
];

const DEFAULT_COLORS: ColorSpot[] = [
  { color: "#ffffff", x: 0.25, y: 0.8 },
  { color: "#888888", x: 0.75, y: 0.7 },
  { color: "#333333", x: 0.3, y: 0.25 },
  { color: "#000000", x: 0.7, y: 0.2 },
];

const DEFAULT_PARAMS: GradientParams = {
  aspectPreset: "1:1",
  customWidth: 1080,
  customHeight: 1080,
  gradientType: 0,
  spread: 0.5,
  angle: 0,
  scale: 1.0,
  noise: 0,
  colors: [...DEFAULT_COLORS],
  grain: 0,
  stipple: 0,
  stippleSize: 0.2,
  halftone: 0,
  glassAmount: 0,
  glassFreq: 0.3,
  glassShift: 0,
  chromatic: 0,
  waveAmount: 0,
  waveFrequency: 10,
  waveAngle: 100,
  waveRandom: 0,
};

/* ------------------------------------------------------------------ */
/*  Color generation                                                  */
/* ------------------------------------------------------------------ */

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateHarmoniousColors(count: number): ColorSpot[] {
  const strategies = ["analogous", "complementary", "triadic", "golden"] as const;
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const baseHue = Math.random() * 360;
  const baseSat = 60 + Math.random() * 30;
  const baseLit = 40 + Math.random() * 30;

  const hues: number[] = [];
  switch (strategy) {
    case "analogous":
      for (let i = 0; i < count; i++) {
        hues.push(baseHue + (i - (count - 1) / 2) * (60 / Math.max(count - 1, 1)));
      }
      break;
    case "complementary":
      for (let i = 0; i < count; i++) {
        const base = i % 2 === 0 ? baseHue : baseHue + 180;
        hues.push(base + (Math.random() - 0.5) * 30);
      }
      break;
    case "triadic":
      for (let i = 0; i < count; i++) {
        hues.push(baseHue + (i % 3) * 120 + (Math.random() - 0.5) * 20);
      }
      break;
    case "golden":
      for (let i = 0; i < count; i++) {
        hues.push(baseHue + i * 137.508);
      }
      break;
  }

  return hues.map((h) => ({
    color: hslToHex(
      ((h % 360) + 360) % 360,
      baseSat + (Math.random() - 0.5) * 10,
      baseLit + (Math.random() - 0.5) * 15
    ),
    x: 0.1 + Math.random() * 0.8,
    y: 0.1 + Math.random() * 0.8,
  }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function hexToRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function getOutputSize(p: GradientParams): { width: number; height: number } {
  if (p.aspectPreset === "custom") {
    return { width: p.customWidth, height: p.customHeight };
  }
  const preset = ASPECT_PRESETS.find((a) => a.key === p.aspectPreset);
  return preset
    ? { width: preset.width, height: preset.height }
    : { width: 1080, height: 1920 };
}

/** Compute the visible content rect within a container (letterbox logic) */
function getContentRect(
  containerW: number,
  containerH: number,
  targetAspect: number
) {
  if (containerW <= 0 || containerH <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  const canvasAspect = containerW / containerH;
  if (canvasAspect > targetAspect) {
    const w = containerH * targetAspect;
    return { x: (containerW - w) / 2, y: 0, w, h: containerH };
  } else {
    const h = containerW / targetAspect;
    return { x: 0, y: (containerH - h) / 2, w: containerW, h };
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

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
          {value.toFixed(step < 0.01 ? 4 : 2)}
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function GradientPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<{ renderer: any; scene: any; camera: any; material: any } | null>(null);

  const [params, setParams] = useState<GradientParams>({
    ...DEFAULT_PARAMS,
    colors: [...DEFAULT_COLORS],
  });
  const [seed, setSeed] = useState(42);
  const [containerSize, setContainerSize] = useState<[number, number]>([0, 0]);
  const draggingRef = useRef<number | null>(null);

  const renderOnce = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.renderer.render(r.scene, r.camera);
  }, []);

  /* --- Three.js setup --- */
  useEffect(() => {
    let disposed = false;

    async function setup() {
      const THREE = await import("three");
      if (disposed || !containerRef.current) return;

      const container = containerRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        preserveDrawingBuffer: true,
      });
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const colorPositions = Array.from({ length: 8 }, () => new THREE.Vector2(0, 0));
      const colorData = new Float32Array(24);
      DEFAULT_COLORS.forEach((spot, i) => {
        colorPositions[i].set(spot.x, spot.y);
        const [r, g, b] = hexToRGB(spot.color);
        colorData[i * 3] = r;
        colorData[i * 3 + 1] = g;
        colorData[i * 3 + 2] = b;
      });

      const { width, height } = getOutputSize(DEFAULT_PARAMS);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uResolution: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
          uAspect: { value: width / height },
          uGradientType: { value: 0 },
          uSpread: { value: DEFAULT_PARAMS.spread },
          uAngle: { value: 0 },
          uScale: { value: 1.0 },
          uColorCount: { value: DEFAULT_COLORS.length },
          uColorPositions: { value: colorPositions },
          uColorData: { value: colorData },
          uNoise: { value: 0 },
          uGrain: { value: 0 },
          uStipple: { value: 0 },
          uStippleSize: { value: 0.2 },
          uHalftone: { value: 0 },
          uGlassAmount: { value: 0 },
          uGlassFreq: { value: 0.3 },
          uGlassShift: { value: 0 },
          uChromatic: { value: 0 },
          uWaveAmount: { value: 0 },
          uWaveFrequency: { value: 10 },
          uWaveAngle: { value: 100 * Math.PI / 180 },
          uWaveRandom: { value: 0 },
          uSeed: { value: 42 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });

      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
      rendererRef.current = { renderer, scene, camera, material };

      setContainerSize([container.clientWidth, container.clientHeight]);
      renderer.render(scene, camera);

      const onResize = () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
        setContainerSize([container.clientWidth, container.clientHeight]);
        renderer.render(scene, camera);
      };
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    }

    const cleanupPromise = setup();
    return () => {
      disposed = true;
      cleanupPromise.then((cleanup) => cleanup?.());
      const r = rendererRef.current;
      if (r) {
        r.renderer.dispose();
        r.material.dispose();
        r.renderer.domElement.remove();
        rendererRef.current = null;
      }
    };
  }, []);

  /* --- Sync React state → uniforms + render --- */
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const u = r.material.uniforms;

    const { width, height } = getOutputSize(params);
    u.uAspect.value = width / height;
    u.uGradientType.value = params.gradientType;
    u.uSpread.value = params.spread;
    u.uAngle.value = (params.angle * Math.PI) / 180;
    u.uScale.value = params.scale;
    u.uNoise.value = params.noise;
    u.uColorCount.value = params.colors.length;

    for (let i = 0; i < 8; i++) {
      if (i < params.colors.length) {
        u.uColorPositions.value[i].set(params.colors[i].x, params.colors[i].y);
        const [cr, cg, cb] = hexToRGB(params.colors[i].color);
        u.uColorData.value[i * 3] = cr;
        u.uColorData.value[i * 3 + 1] = cg;
        u.uColorData.value[i * 3 + 2] = cb;
      } else {
        u.uColorPositions.value[i].set(0, 0);
        u.uColorData.value[i * 3] = 0;
        u.uColorData.value[i * 3 + 1] = 0;
        u.uColorData.value[i * 3 + 2] = 0;
      }
    }

    u.uGrain.value = params.grain;
    u.uStipple.value = params.stipple * 0.5;
    u.uStippleSize.value = params.stippleSize;
    u.uHalftone.value = params.halftone;
    u.uGlassAmount.value = params.glassAmount;
    u.uGlassFreq.value = params.glassFreq;
    u.uGlassShift.value = params.glassShift;
    u.uChromatic.value = params.chromatic;
    u.uWaveAmount.value = params.waveAmount;
    u.uWaveFrequency.value = params.waveFrequency;
    u.uWaveAngle.value = (params.waveAngle * Math.PI) / 180;
    u.uWaveRandom.value = params.waveRandom;
    u.uSeed.value = seed;

    renderOnce();
  }, [params, seed, renderOnce]);

  /* --- Handle dragging on canvas --- */
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = index;
    dragPosRef.current = { x: params.colors[index].x, y: params.colors[index].y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [params.colors]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current === null) return;
    const r = rendererRef.current;
    if (!r) return;
    const overlay = e.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const { width: tw, height: th } = getOutputSize(params);
    const cr = getContentRect(rect.width, rect.height, tw / th);
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const x = Math.max(0, Math.min(1, (sx - cr.x) / cr.w));
    const y = Math.max(0, Math.min(1, 1 - (sy - cr.y) / cr.h));
    const idx = draggingRef.current;
    // Update uniform + render directly, skip React state
    dragPosRef.current = { x, y };
    r.material.uniforms.uColorPositions.value[idx].set(x, y);
    r.renderer.render(r.scene, r.camera);
    // Update handle position via DOM
    const handle = overlay.children[idx] as HTMLElement;
    if (handle) {
      handle.style.left = `${cr.x + x * cr.w}px`;
      handle.style.top = `${cr.y + (1 - y) * cr.h}px`;
    }
  }, [params]);

  const handlePointerUp = useCallback(() => {
    const idx = draggingRef.current;
    const pos = dragPosRef.current;
    if (idx !== null && pos) {
      // Sync final position back to React state
      setParams((prev) => {
        const newColors = [...prev.colors];
        newColors[idx] = { ...newColors[idx], ...pos };
        return { ...prev, colors: newColors };
      });
    }
    draggingRef.current = null;
    dragPosRef.current = null;
  }, []);

  /* --- Color management --- */
  const handleShuffle = useCallback(() => {
    const newColors = generateHarmoniousColors(params.colors.length);
    setParams((prev) => ({ ...prev, colors: newColors }));
    setSeed(Math.random() * 1000);
  }, [params.colors.length]);

  const handleAddColor = useCallback(() => {
    if (params.colors.length >= 8) return;
    const newColor: ColorSpot = {
      color: hslToHex(Math.random() * 360, 60 + Math.random() * 30, 40 + Math.random() * 30),
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
    };
    setParams((prev) => ({ ...prev, colors: [...prev.colors, newColor] }));
  }, [params.colors.length]);

  const handleRemoveColor = useCallback((index: number) => {
    setParams((prev) => {
      if (prev.colors.length <= 2) return prev;
      return { ...prev, colors: prev.colors.filter((_, i) => i !== index) };
    });
  }, []);

  const handleColorChange = useCallback((index: number, color: string) => {
    setParams((prev) => {
      const newColors = [...prev.colors];
      newColors[index] = { ...newColors[index], color };
      return { ...prev, colors: newColors };
    });
  }, []);

  /* --- Reset --- */
  const handleReset = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS, colors: [...DEFAULT_COLORS] });
    setSeed(42);
  }, []);

  /* --- Download --- */
  const handleDownload = useCallback(async () => {
    const r = rendererRef.current;
    if (!r) return;

    const { width, height } = getOutputSize(params);

    r.renderer.setPixelRatio(1);
    r.renderer.setSize(width, height);
    r.material.uniforms.uResolution.value.set(width, height);
    r.material.uniforms.uAspect.value = width / height;
    r.renderer.render(r.scene, r.camera);

    const canvas = r.renderer.domElement;
    const outputName = `gradient_${width}x${height}.png`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const canShare =
      isMobile &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function";

    if (canShare) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) {
        const file = new File([blob], outputName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
          } catch {
            /* user cancelled */
          }
        }
      }
    } else {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = outputName;
      a.click();
    }

    const container = containerRef.current;
    if (container) {
      r.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      r.renderer.setSize(container.clientWidth, container.clientHeight);
      r.material.uniforms.uResolution.value.set(
        r.renderer.domElement.width,
        r.renderer.domElement.height
      );
    }
    renderOnce();
  }, [params, renderOnce]);

  /* --- Compute handle positions --- */
  const [cw, ch] = containerSize;
  const { width: tw, height: th } = getOutputSize(params);
  const contentRect = getContentRect(cw, ch, tw / th);

  /* --- Render --- */
  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-black">
      {/* Canvas area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">
        <div className="w-full h-full p-6">
          <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full" />

            {/* Handle overlay */}
            {cw > 0 && (
              <div
                className="absolute inset-0 touch-none group"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {params.colors.map((spot, i) => {
                  const left = contentRect.x + spot.x * contentRect.w;
                  const top = contentRect.y + (1 - spot.y) * contentRect.h;
                  return (
                    <div
                      key={i}
                      className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 shadow-[0_0_8px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing active:scale-125 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      style={{
                        left,
                        top,
                        backgroundColor: spot.color,
                      }}
                      onPointerDown={handlePointerDown(i)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-black/55! border-white/15! text-white/85! backdrop-blur-xl hover:bg-black/75! hover:border-white/30! hover:text-white!"
            >
              ← 戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex-1 md:flex-none md:w-80 shrink bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.25)] md:shadow-none border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden">
        <div className="px-6 py-3 md:pt-5 md:pb-4 border-b border-border shrink-0 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold -tracking-[0.01em]">
            グラデーション
          </h2>
          <Button variant="secondary" size="sm" onClick={handleReset}>
            リセット
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
          {/* Aspect ratio */}
          <SectionHeader>アスペクト比</SectionHeader>
          <div className="flex flex-col gap-2">
            <Select
              value={params.aspectPreset}
              onValueChange={(v) => setParams((prev) => ({ ...prev, aspectPreset: v }))}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {params.aspectPreset === "custom" && (
            <div className="pl-3 border-l-2 border-border flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-[13px] w-8">幅</Label>
                <input
                  type="number"
                  value={params.customWidth}
                  onChange={(e) => setParams((prev) => ({ ...prev, customWidth: Math.max(1, Number(e.target.value) || 1) }))}
                  className="flex-1 h-9 rounded-md border border-border bg-transparent px-3 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[13px] w-8">高さ</Label>
                <input
                  type="number"
                  value={params.customHeight}
                  onChange={(e) => setParams((prev) => ({ ...prev, customHeight: Math.max(1, Number(e.target.value) || 1) }))}
                  className="flex-1 h-9 rounded-md border border-border bg-transparent px-3 text-sm"
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Gradient type & params */}
          <SectionHeader>グラデーション</SectionHeader>
          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">タイプ</Label>
            <Select
              value={String(params.gradientType)}
              onValueChange={(v) => setParams((prev) => ({ ...prev, gradientType: Number(v) }))}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADIENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ParamSlider label="広がり" value={params.spread} min={0.1} max={1.0} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, spread: v }))} />
          {params.gradientType === 1 && (
            <div className="pl-3 border-l-2 border-border">
              <ParamSlider label="角度" value={params.angle} min={0} max={360} step={1} onChange={(v) => setParams((prev) => ({ ...prev, angle: v }))} />
            </div>
          )}
          <ParamSlider label="スケール" value={params.scale} min={0.5} max={3.0} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, scale: v }))} />
          <ParamSlider label="ノイズ" value={params.noise} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, noise: v }))} />

          <Separator />

          {/* Colors */}
          <SectionHeader>カラー</SectionHeader>
          <Button variant="secondary" size="sm" className="w-full" onClick={handleShuffle}>
            シャッフル
          </Button>
          <div className="flex flex-col gap-2">
            {params.colors.map((spot, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={spot.color}
                  onChange={(e) => handleColorChange(i, e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <span className="text-xs font-mono text-muted-foreground flex-1">
                  {spot.color}
                </span>
                {params.colors.length > 2 && (
                  <button
                    onClick={() => handleRemoveColor(i)}
                    className="text-muted-foreground hover:text-foreground text-sm w-6 h-6 flex items-center justify-center rounded transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {params.colors.length < 8 && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddColor}>
              + カラー追加
            </Button>
          )}

          <Separator />

          {/* Effects */}
          <SectionHeader>エフェクト</SectionHeader>
          <ParamSlider label="グレイン" value={params.grain} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, grain: v }))} />
          <ParamSlider label="粒子" value={params.stipple} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, stipple: v }))} />
          {params.stipple > 0 && (
            <div className="pl-3 border-l-2 border-border">
              <ParamSlider label="粒度" value={params.stippleSize} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, stippleSize: v }))} />
            </div>
          )}
          <ParamSlider label="ハーフトーン" value={params.halftone} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, halftone: v }))} />
          <ParamSlider label="リブ" value={params.glassAmount} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, glassAmount: v }))} />
          {params.glassAmount > 0 && (
            <div className="pl-3 border-l-2 border-border flex flex-col gap-2">
              <ParamSlider label="密度" value={params.glassFreq} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, glassFreq: v }))} />
              <ParamSlider label="ズレ" value={params.glassShift} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, glassShift: v }))} />
            </div>
          )}
          <ParamSlider label="色収差" value={params.chromatic} min={0} max={2} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, chromatic: v }))} />
          <ParamSlider label="ウェーブ" value={params.waveAmount} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, waveAmount: v }))} />
          {params.waveAmount > 0 && (
            <div className="pl-3 border-l-2 border-border flex flex-col gap-2">
              <ParamSlider label="周波数" value={params.waveFrequency} min={1} max={30} step={0.5} onChange={(v) => setParams((prev) => ({ ...prev, waveFrequency: v }))} />
              <ParamSlider label="方向" value={params.waveAngle} min={0} max={360} step={1} onChange={(v) => setParams((prev) => ({ ...prev, waveAngle: v }))} />
              <ParamSlider label="ランダム" value={params.waveRandom} min={0} max={1} step={0.01} onChange={(v) => setParams((prev) => ({ ...prev, waveRandom: v }))} />
            </div>
          )}

          <Separator />

          <Button className="w-full" onClick={handleDownload}>
            ダウンロード
          </Button>
        </div>
      </aside>
    </div>
  );
}

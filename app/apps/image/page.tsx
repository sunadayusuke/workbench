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
import { useLanguage } from "@/lib/i18n";

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

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uImageSize;

uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uExposure;
uniform float uTemperature;
uniform float uTint;
uniform float uHighlights;
uniform float uShadows;

uniform float uGlitchAmount;
uniform float uGlitchSeed;
uniform float uNoise;
uniform float uBlur;
uniform float uVignette;
uniform float uPixelate;
uniform float uHueShift;
uniform float uFade;
uniform float uDuotone;
uniform vec3 uDuotoneShadow;
uniform vec3 uDuotoneHighlight;
uniform float uHalftone;
uniform float uScanline;
uniform float uRGBShift;
uniform int uRGBShiftMode;
uniform float uRGBShiftAngle;
uniform float uWaveAmount;
uniform float uWaveFrequency;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ガウシアンぼかし（任意UVで使用可能）
vec3 sampleBlur(vec2 coord) {
  if (uBlur <= 0.0) return texture2D(uTexture, coord).rgb;

  vec2 t = uBlur / uImageSize;
  vec3 c = texture2D(uTexture, coord).rgb * 0.16;

  vec2 o1 = t;
  c += (texture2D(uTexture, coord + vec2(o1.x, 0.0)).rgb
      + texture2D(uTexture, coord - vec2(o1.x, 0.0)).rgb
      + texture2D(uTexture, coord + vec2(0.0, o1.y)).rgb
      + texture2D(uTexture, coord - vec2(0.0, o1.y)).rgb) * 0.11;

  vec2 o2 = t * 2.0;
  c += (texture2D(uTexture, coord + vec2(o2.x, 0.0)).rgb
      + texture2D(uTexture, coord - vec2(o2.x, 0.0)).rgb
      + texture2D(uTexture, coord + vec2(0.0, o2.y)).rgb
      + texture2D(uTexture, coord - vec2(0.0, o2.y)).rgb) * 0.065;

  vec2 o3 = t * 3.0;
  c += (texture2D(uTexture, coord + vec2(o3.x, 0.0)).rgb
      + texture2D(uTexture, coord - vec2(o3.x, 0.0)).rgb
      + texture2D(uTexture, coord + vec2(0.0, o3.y)).rgb
      + texture2D(uTexture, coord - vec2(0.0, o3.y)).rgb) * 0.025;

  vec2 o4 = t * 4.0;
  c += (texture2D(uTexture, coord + vec2(o4.x, 0.0)).rgb
      + texture2D(uTexture, coord - vec2(o4.x, 0.0)).rgb
      + texture2D(uTexture, coord + vec2(0.0, o4.y)).rgb
      + texture2D(uTexture, coord - vec2(0.0, o4.y)).rgb) * 0.01;

  return c;
}

void main() {
  // 1. アスペクト比マッピング（object-fit:contain 相当）
  float canvasAspect = uResolution.x / uResolution.y;
  float imageAspect = uImageSize.x / uImageSize.y;
  vec2 scale;
  if (canvasAspect > imageAspect) {
    scale = vec2(imageAspect / canvasAspect, 1.0);
  } else {
    scale = vec2(1.0, canvasAspect / imageAspect);
  }
  vec2 uv = (vUv - 0.5) / scale + 0.5;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(vec3(0.0), 1.0);
    return;
  }

  // 2. ピクセレート
  if (uPixelate > 0.0) {
    float pixelSize = mix(1.0, 64.0, uPixelate);
    vec2 texelSize = pixelSize / uImageSize;
    uv = floor(uv / texelSize) * texelSize + texelSize * 0.5;
  }

  // 3. グリッチ（映像制作風：ブロック変位 + スライスジッター + RGB分離 + スキャンライン）
  float glitchRGBSplit = 0.0;
  float glitchScanline = 0.0;
  if (uGlitchAmount > 0.0) {
    float seed = floor(uGlitchSeed);
    float amt = uGlitchAmount;

    // 大きなブロック変位
    float blockH = mix(0.03, 0.12, hash(seed * 1.1));
    float blockY = floor(uv.y / blockH) * blockH;
    float bHash = hash(blockY * 100.0 + seed);
    float blockOn = step(1.0 - amt * 0.6, bHash);
    float blockShift = (hash(blockY * 200.0 + seed + 5.0) - 0.5) * 2.0;
    uv.x += blockShift * amt * 0.18 * blockOn;

    // 細いスライスジッター
    float sliceH = mix(0.002, 0.015, hash(seed * 2.3));
    float sliceY = floor(uv.y / sliceH) * sliceH;
    float sHash = hash(sliceY * 500.0 + seed + 10.0);
    float sliceOn = step(1.0 - amt * 0.45, sHash);
    uv.x += (sHash - 0.5) * amt * 0.1 * sliceOn;

    // ランダムな縦ずれ（トラッキングエラー風）
    float trackBlock = floor(uv.y * 5.0) / 5.0;
    float trackHash = hash(trackBlock * 30.0 + seed + 20.0);
    float trackOn = step(1.0 - amt * 0.25, trackHash);
    uv.y += (hash(seed + 99.0) - 0.5) * 0.03 * amt * trackOn;

    // グリッチ領域でのRGB分離量
    glitchRGBSplit = amt * 0.012 * max(blockOn, sliceOn * 0.5);

    // スキャンライン強度
    glitchScanline = max(blockOn, sliceOn) * amt;
  }

  // Wave distortion（UV歪み）
  if (uWaveAmount > 0.0) {
    uv.x += sin(uv.y * uWaveFrequency + uGlitchSeed * 0.1) * uWaveAmount * 0.1;
    uv.y += cos(uv.x * uWaveFrequency + uGlitchSeed * 0.1) * uWaveAmount * 0.05;
  }

  // 4+5. サンプリング（ぼかし + RGBシフト + グリッチRGB分離を統合）
  vec2 rgbOffset = vec2(0.0);
  if (uRGBShift > 0.0) {
    if (uRGBShiftMode == 0) {
      // リニア: 指定角度方向にオフセット
      rgbOffset = vec2(cos(uRGBShiftAngle), sin(uRGBShiftAngle)) * uRGBShift * 0.02;
    } else {
      // ラジアル: 中心からの距離に応じたオフセット
      vec2 dir = uv - 0.5;
      float dist = length(dir);
      rgbOffset = normalize(dir + 1e-6) * dist * uRGBShift * 0.08;
    }
  }

  vec2 rgbSplitOffset = vec2(glitchRGBSplit, 0.0);
  vec3 color;
  color.r = sampleBlur(uv + rgbOffset + rgbSplitOffset).r;
  color.g = sampleBlur(uv).g;
  color.b = sampleBlur(uv - rgbOffset - rgbSplitOffset).b;

  // グリッチ：スキャンライン暗転 + 色の歪み
  if (glitchScanline > 0.0) {
    float scan = sin(uv.y * uImageSize.y * 3.14159) * 0.5 + 0.5;
    color *= mix(1.0, 0.88 + scan * 0.12, glitchScanline * 0.7);
    // 色相シフト（グリッチ領域のみ）
    float hueShift = (hash(floor(uv.y * 40.0) + uGlitchSeed) - 0.5) * glitchScanline * 0.3;
    color.r += hueShift;
    color.b -= hueShift;
  }

  // 6. 露出 → 明るさ → コントラスト → 彩度 → 色温度
  color *= pow(2.0, uExposure);
  color += uBrightness;
  color = (color - 0.5) * (1.0 + uContrast) + 0.5;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(lum), color, 1.0 + uSaturation);
  color.r += uTemperature * 0.1;
  color.b -= uTemperature * 0.1;
  color.g += uTint * 0.1;
  color.r -= uTint * 0.05;
  color.b -= uTint * 0.05;

  // Hue shift
  if (uHueShift != 0.0) {
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + uHueShift);
    color = hsv2rgb(hsv);
  }

  // 7. ハイライト/シャドウ
  float lumMask = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += uHighlights * smoothstep(0.5, 1.0, lumMask) * 0.3;
  color += uShadows * (1.0 - smoothstep(0.0, 0.5, lumMask)) * 0.3;

  // Fade（黒浮き＋ウォッシュアウト）
  if (uFade > 0.0) {
    float fadeLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    // 黒を持ち上げる
    color = max(color, vec3(uFade * 0.18));
    // 全体を中間調へ寄せる
    color = mix(color, vec3(mix(fadeLum, 0.55, 0.3)), uFade * 0.35);
  }

  // Duotone（二色調マッピング）
  if (uDuotone > 0.0) {
    float duoLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 duoColor = mix(uDuotoneShadow, uDuotoneHighlight, duoLum);
    color = mix(color, duoColor, uDuotone);
  }

  // 8. ノイズ/グレイン
  if (uNoise > 0.0) {
    float n = rand(uv * 1000.0 + uGlitchSeed * 0.01) - 0.5;
    color += n * uNoise * 0.5;
  }

  // Halftone（ドットパターン）
  if (uHalftone > 0.0) {
    float htSize = mix(3.0, 12.0, uHalftone);
    vec2 htUV = vUv * uResolution / htSize;
    float htLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float htDist = length(fract(htUV) - 0.5);
    float htRadius = sqrt(1.0 - htLum) * 0.5;
    float htDot = smoothstep(htRadius, htRadius - 0.07, htDist);
    color = mix(color, color * htDot, uHalftone);
  }

  // Scanline（水平走査線）
  if (uScanline > 0.0) {
    float sl = sin(vUv.y * uResolution.y * 1.5) * 0.5 + 0.5;
    color *= mix(1.0, sl * 0.35 + 0.65, uScanline);
  }

  // 9. ビネット
  if (uVignette > 0.0) {
    float d = length(vUv - 0.5) * 1.4;
    color *= clamp(1.0 - d * d * uVignette, 0.0, 1.0);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  Types & defaults                                                  */
/* ------------------------------------------------------------------ */

interface ImageParams {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  glitchAmount: number;
  glitchSeed: number;
  noise: number;
  blur: number;
  vignette: number;
  pixelate: number;
  hueShift: number;
  fade: number;
  duotone: number;
  duotoneShadow: string;
  duotoneHighlight: string;
  halftone: number;
  scanline: number;
  rgbShift: number;
  rgbShiftMode: number;
  rgbShiftAngle: number;
  waveAmount: number;
  waveFrequency: number;
}

const DEFAULT_PARAMS: ImageParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  glitchAmount: 0,
  glitchSeed: 0,
  noise: 0,
  blur: 0,
  vignette: 0,
  pixelate: 0,
  hueShift: 0,
  fade: 0,
  duotone: 0,
  duotoneShadow: "#000033",
  duotoneHighlight: "#ffcc00",
  halftone: 0,
  scanline: 0,
  rgbShift: 0,
  rgbShiftMode: 0,
  rgbShiftAngle: 0,
  waveAmount: 0,
  waveFrequency: 10,
};

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

function DropZone({
  onFile,
  isDragging,
}: {
  onFile: (file: File) => void;
  isDragging: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label
      className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors ${
        isDragging ? "bg-white/10" : "bg-black hover:bg-white/5"
      }`}
    >
      <div className="text-[48px] mb-4 opacity-60">🖼️</div>
      <p className="text-[15px] text-white/70 font-medium mb-1">
        {t.image.dropHint}
      </p>
      <p className="text-[13px] text-white/40">
        {t.image.clickHint}
      </p>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function ImagePage() {
  const { lang, toggle, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<{ renderer: any; scene: any; camera: any; material: any } | null>(null);
  const textureRef = useRef<{ dispose: () => void } | null>(null);
  const imageSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const [params, setParams] = useState<ImageParams>({ ...DEFAULT_PARAMS });
  const [hasImage, setHasImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("png");
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const [fileName, setFileName] = useState("image");

  const updateParam = useCallback(
    <K extends keyof ImageParams>(key: K, value: ImageParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTexture: { value: null },
          uResolution: {
            value: new THREE.Vector2(
              renderer.domElement.width,
              renderer.domElement.height
            ),
          },
          uImageSize: { value: new THREE.Vector2(1, 1) },
          uBrightness: { value: 0 },
          uContrast: { value: 0 },
          uSaturation: { value: 0 },
          uExposure: { value: 0 },
          uTemperature: { value: 0 },
          uTint: { value: 0 },
          uHighlights: { value: 0 },
          uShadows: { value: 0 },
          uGlitchAmount: { value: 0 },
          uGlitchSeed: { value: 0 },
          uNoise: { value: 0 },
          uBlur: { value: 0 },
          uVignette: { value: 0 },
          uPixelate: { value: 0 },
          uHueShift: { value: 0 },
          uFade: { value: 0 },
          uDuotone: { value: 0 },
          uDuotoneShadow: { value: new THREE.Color(0x000033) },
          uDuotoneHighlight: { value: new THREE.Color(0xffcc00) },
          uHalftone: { value: 0 },
          uScanline: { value: 0 },
          uRGBShift: { value: 0 },
          uRGBShiftMode: { value: 0 },
          uRGBShiftAngle: { value: 0 },
          uWaveAmount: { value: 0 },
          uWaveFrequency: { value: 10 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });

      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

      rendererRef.current = { renderer, scene, camera, material };

      const onResize = () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        material.uniforms.uResolution.value.set(
          renderer.domElement.width,
          renderer.domElement.height
        );
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
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  /* --- Sync React state → uniforms + render --- */
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !hasImage) return;
    const u = r.material.uniforms;
    u.uBrightness.value = params.brightness;
    u.uContrast.value = params.contrast;
    u.uSaturation.value = params.saturation;
    u.uExposure.value = params.exposure;
    u.uTemperature.value = params.temperature;
    u.uTint.value = params.tint;
    u.uHighlights.value = params.highlights;
    u.uShadows.value = params.shadows;
    u.uGlitchAmount.value = params.glitchAmount;
    u.uGlitchSeed.value = params.glitchSeed;
    u.uNoise.value = params.noise;
    u.uBlur.value = params.blur;
    u.uVignette.value = params.vignette;
    u.uPixelate.value = params.pixelate;
    u.uHueShift.value = params.hueShift;
    u.uFade.value = params.fade;
    u.uDuotone.value = params.duotone;
    (u.uDuotoneShadow.value as { set(v: string): void }).set(params.duotoneShadow);
    (u.uDuotoneHighlight.value as { set(v: string): void }).set(params.duotoneHighlight);
    u.uHalftone.value = params.halftone;
    u.uScanline.value = params.scanline;
    u.uRGBShift.value = params.rgbShift;
    u.uRGBShiftMode.value = params.rgbShiftMode;
    u.uRGBShiftAngle.value = params.rgbShiftAngle * Math.PI / 180;
    u.uWaveAmount.value = params.waveAmount;
    u.uWaveFrequency.value = params.waveFrequency;
    renderOnce();
  }, [params, hasImage, renderOnce]);

  /* --- Load image --- */
  const loadImage = useCallback(
    async (file: File) => {
      const r = rendererRef.current;
      if (!r) return;

      setFileName(file.name.replace(/\.[^.]+$/, ""));

      const THREE = await import("three");
      const url = URL.createObjectURL(file);
      const loader = new THREE.TextureLoader();
      loader.load(url, (texture) => {
        URL.revokeObjectURL(url);
        if (textureRef.current) {
          textureRef.current.dispose();
        }
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        textureRef.current = texture;
        r.material.uniforms.uTexture.value = texture;
        const img = texture.image as HTMLImageElement;
        imageSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight };
        r.material.uniforms.uImageSize.value.set(img.naturalWidth, img.naturalHeight);
        setHasImage(true);
        setParams({ ...DEFAULT_PARAMS });
        renderOnce();
      });
    },
    [renderOnce]
  );

  /* --- Drag & Drop --- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        loadImage(file);
      }
    },
    [loadImage]
  );

  /* --- Reset --- */
  const handleReset = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
  }, []);

  /* --- Download --- */
  const handleDownload = useCallback(async () => {
    const r = rendererRef.current;
    if (!r) return;

    const THREE = await import("three");
    const { width, height } = imageSizeRef.current;

    // 一時的に元画像解像度でレンダリング
    const prevWidth = r.renderer.domElement.width;
    const prevHeight = r.renderer.domElement.height;

    r.renderer.setPixelRatio(1);
    r.renderer.setSize(width, height);
    r.material.uniforms.uResolution.value.set(width, height);
    r.renderer.render(r.scene, r.camera);

    let mimeType = "image/png";
    let ext = "png";
    let quality: number | undefined;

    if (downloadFormat === "jpeg") {
      mimeType = "image/jpeg";
      ext = "jpg";
      quality = jpegQuality;
    } else if (downloadFormat === "webp") {
      mimeType = "image/webp";
      ext = "webp";
      quality = jpegQuality;
    }

    const outputName = `${fileName}_edited.${ext}`;
    const canvas = r.renderer.domElement;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const canShare =
      isMobile &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function";

    if (canShare) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
      if (blob) {
        const file = new File([blob], outputName, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
          } catch {
            // ユーザーがキャンセルした場合は無視
          }
        }
      }
    } else {
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = outputName;
      a.click();
    }

    // プレビューサイズに復帰
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
    setShowDownload(false);
  }, [downloadFormat, jpegQuality, fileName, renderOnce]);

  /* --- Render --- */
  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-black">
      {/* メインエリア */}
      <div
        className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-full h-full p-6">
          <div ref={containerRef} className="w-full h-full" />
        </div>
        {!hasImage && <DropZone onFile={loadImage} isDragging={isDragging} />}

        {/* トップバー */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-black/55! border-white/15! text-white/85! backdrop-blur-xl hover:bg-black/75! hover:border-white/30! hover:text-white!"
            >
              {t.back}
            </Button>
          </Link>
          <button
            onClick={toggle}
            className="text-[13px] font-medium bg-black/55! border border-white/15 text-white/85 backdrop-blur-xl px-3 py-1.5 rounded-lg hover:bg-black/75! select-none"
          >
            {lang === "ja" ? "EN" : "JA"}
          </button>
        </div>
      </div>

      {/* サイドバー */}
      <aside className="flex-1 md:flex-none md:w-80 shrink bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.25)] md:shadow-none border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden">
        <div className="px-6 py-3 md:pt-5 md:pb-4 border-b border-border shrink-0 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold -tracking-[0.01em]">
            {t.apps.image.name}
          </h2>
          <Button variant="secondary" size="sm" onClick={handleReset} disabled={!hasImage}>
            {t.reset}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
          {/* アップロード */}
          <label className="flex items-center justify-center gap-2 min-h-10 py-2.5 rounded-lg border border-dashed border-border text-[13px] text-muted-foreground cursor-pointer transition-colors hover:border-foreground hover:text-foreground">
            {hasImage ? t.image.changeImage : t.image.selectImage}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadImage(file);
              }}
            />
          </label>

          <Separator />

          {/* 基本補正 */}
          <SectionHeader>{t.image.basicAdjustments}</SectionHeader>
          <ParamSlider label={t.image.brightness} value={params.brightness} min={-1} max={1} step={0.01} onChange={(v) => updateParam("brightness", v)} />
          <ParamSlider label={t.image.contrast} value={params.contrast} min={-1} max={1} step={0.01} onChange={(v) => updateParam("contrast", v)} />
          <ParamSlider label={t.image.saturation} value={params.saturation} min={-1} max={1} step={0.01} onChange={(v) => updateParam("saturation", v)} />
          <ParamSlider label={t.image.exposure} value={params.exposure} min={-2} max={2} step={0.01} onChange={(v) => updateParam("exposure", v)} />
          <ParamSlider label={t.image.highlights} value={params.highlights} min={-1} max={1} step={0.01} onChange={(v) => updateParam("highlights", v)} />
          <ParamSlider label={t.image.shadows} value={params.shadows} min={-1} max={1} step={0.01} onChange={(v) => updateParam("shadows", v)} />

          <Separator />

          {/* エフェクト */}
          <SectionHeader>{t.image.effects}</SectionHeader>
          <ParamSlider label={t.image.glitch} value={params.glitchAmount} min={0} max={1} step={0.01} onChange={(v) => updateParam("glitchAmount", v)} />
          {params.glitchAmount > 0 && (
            <div className="pl-3 border-l-2 border-border">
              <ParamSlider label={t.image.seed} value={params.glitchSeed} min={0} max={100} step={1} onChange={(v) => updateParam("glitchSeed", v)} />
            </div>
          )}
          <ParamSlider label={t.image.noise} value={params.noise} min={0} max={1} step={0.01} onChange={(v) => updateParam("noise", v)} />
          <ParamSlider label={t.image.blur} value={params.blur} min={0} max={20} step={0.1} onChange={(v) => updateParam("blur", v)} />
          <ParamSlider label={t.image.vignette} value={params.vignette} min={0} max={1} step={0.01} onChange={(v) => updateParam("vignette", v)} />
          <ParamSlider label={t.image.pixelate} value={params.pixelate} min={0} max={1} step={0.01} onChange={(v) => updateParam("pixelate", v)} />
          <ParamSlider label={t.image.rgbShift} value={params.rgbShift} min={0} max={1} step={0.01} onChange={(v) => updateParam("rgbShift", v)} />
          {params.rgbShift > 0 && (
            <div className="pl-3 border-l-2 border-border flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-[13px]">{t.image.type}</Label>
                <Select
                  value={String(params.rgbShiftMode)}
                  onValueChange={(v) => updateParam("rgbShiftMode", Number(v))}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t.image.linear}</SelectItem>
                    <SelectItem value="1">{t.image.radial}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {params.rgbShiftMode === 0 && (
                <ParamSlider label={t.image.angle} value={params.rgbShiftAngle} min={0} max={360} step={1} onChange={(v) => updateParam("rgbShiftAngle", v)} />
              )}
            </div>
          )}
          <ParamSlider label={t.image.wave} value={params.waveAmount} min={0} max={1} step={0.01} onChange={(v) => updateParam("waveAmount", v)} />
          {params.waveAmount > 0 && (
            <div className="pl-3 border-l-2 border-border">
              <ParamSlider label={t.image.frequency} value={params.waveFrequency} min={1} max={50} step={0.5} onChange={(v) => updateParam("waveFrequency", v)} />
            </div>
          )}
          <ParamSlider label={t.image.halftone} value={params.halftone} min={0} max={1} step={0.01} onChange={(v) => updateParam("halftone", v)} />
          <ParamSlider label={t.image.scanline} value={params.scanline} min={0} max={1} step={0.01} onChange={(v) => updateParam("scanline", v)} />

          <Separator />

          {/* カラーエフェクト */}
          <SectionHeader>{t.image.colorEffects}</SectionHeader>
          <ParamSlider label={t.image.cyanYellow} value={params.temperature} min={-1} max={1} step={0.01} onChange={(v) => updateParam("temperature", v)} />
          <ParamSlider label={t.image.greenMagenta} value={params.tint} min={-1} max={1} step={0.01} onChange={(v) => updateParam("tint", v)} />
          <ParamSlider label={t.image.hueShift} value={params.hueShift} min={-0.5} max={0.5} step={0.01} onChange={(v) => updateParam("hueShift", v)} />
          <ParamSlider label={t.image.fade} value={params.fade} min={0} max={1} step={0.01} onChange={(v) => updateParam("fade", v)} />
          <ParamSlider label={t.image.duotone} value={params.duotone} min={0} max={1} step={0.01} onChange={(v) => updateParam("duotone", v)} />
          {params.duotone > 0 && (
            <div className="pl-3 border-l-2 border-border flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-[13px] flex-1">{t.image.shadow}</Label>
                <input
                  type="color"
                  value={params.duotoneShadow}
                  onChange={(e) => updateParam("duotoneShadow", e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-muted-foreground w-16">{params.duotoneShadow}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[13px] flex-1">{t.image.highlight}</Label>
                <input
                  type="color"
                  value={params.duotoneHighlight}
                  onChange={(e) => updateParam("duotoneHighlight", e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-muted-foreground w-16">{params.duotoneHighlight}</span>
              </div>
            </div>
          )}

          <Separator />
          <Button className="w-full" onClick={() => setShowDownload(true)} disabled={!hasImage}>
            {t.download}
          </Button>
        </div>
      </aside>

      {/* ダウンロードダイアログ */}
      <Dialog open={showDownload} onOpenChange={setShowDownload}>
        <DialogContent className="max-w-[400px]!">
          <DialogHeader>
            <DialogTitle>{t.download}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-[13px]">{t.image.format}</Label>
              <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(downloadFormat === "jpeg" || downloadFormat === "webp") && (
              <ParamSlider
                label={t.image.quality}
                value={jpegQuality}
                min={0.1}
                max={1}
                step={0.01}
                onChange={setJpegQuality}
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDownload(false)}>
                {t.cancel}
              </Button>
              <Button onClick={handleDownload}>{t.download}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

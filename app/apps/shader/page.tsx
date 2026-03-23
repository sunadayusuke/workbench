"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DragParam } from "@/components/ui/drag-param";
import { PushButton } from "@/components/ui/push-button";
import { ColorRow } from "@/components/ui/color-row";
import { AppTopBar } from "@/components/app-top-bar";
import { downloadCanvas } from "@/lib/canvas-download";

/* ------------------------------------------------------------------ */
/*  Shaders                                                           */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uWarp;
uniform float uNoiseScale;
uniform float uAberration;
uniform float uBlur;
uniform float uGrain;
uniform int uMode;
uniform float uAngle;
uniform vec3 uColorBg;
uniform vec3 uColors[8];
uniform float uIntensities[8];
uniform float uThresholds[8];
uniform int uColorCount;

varying vec2 vUv;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    vec3 g = a0 * vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw));
    return 130.0 * dot(m, g);
}

float getNoise(vec2 p) {
    float t = uTime * uSpeed;
    vec2 pm = p;
    if(uMode == 0) pm -= vec2(cos(uAngle), sin(uAngle)) * t;
    else if(uMode == 1) { pm.x += sin(pm.y + t) * 0.3; pm.y += cos(pm.x + t * 0.5) * 0.2; }
    else if(uMode == 2) { float d = length(pm); pm += (pm/max(d,0.1)) * sin(d * 3.0 - t * 1.5) * 0.15; }

    vec2 q = vec2(snoise(pm + t * 0.5), snoise(pm + 1.0));
    vec2 r = vec2(snoise(pm + 4.0 * q + vec2(1.7, 9.2) + t * 0.3), snoise(pm + 4.0 * q + vec2(8.3, 2.8) + t * 0.2));
    return snoise(pm + uWarp * r);
}

vec3 calculateColor(float n) {
    vec3 col = uColorBg;
    for (int i = 0; i < 8; i++) {
        if (i >= uColorCount) break;
        col = mix(col, uColors[i] * uIntensities[i], smoothstep(uThresholds[i], uThresholds[i] + 0.6, n));
    }
    return col;
}

vec3 getShaderCol(vec2 uv) {
    if (uAberration > 0.0) {
        float nR = getNoise(uv + vec2(uAberration, 0.0));
        float nG = getNoise(uv);
        float nB = getNoise(uv - vec2(uAberration, 0.0));
        return vec3(calculateColor(nR).r, calculateColor(nG).g, calculateColor(nB).b);
    }
    return calculateColor(getNoise(uv));
}

void main() {
    vec2 ratio = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * ratio * uNoiseScale;

    vec3 col;
    if (uBlur > 0.0) {
        float r = uBlur * 0.08;
        col = (
            getShaderCol(uv + vec2(-r,-r)) + getShaderCol(uv + vec2(0.0,-r)) + getShaderCol(uv + vec2(r,-r)) +
            getShaderCol(uv + vec2(-r, 0.0)) + getShaderCol(uv) + getShaderCol(uv + vec2(r, 0.0)) +
            getShaderCol(uv + vec2(-r, r)) + getShaderCol(uv + vec2(0.0, r)) + getShaderCol(uv + vec2(r, r))
        ) / 9.0;
    } else {
        col = getShaderCol(uv);
    }
    if (uGrain > 0.0) {
        float n = rand(vUv * 1000.0 + vec2(uTime)) - 0.5;
        col += n * uGrain * 0.4;
    }
    gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  Types & defaults                                                  */
/* ------------------------------------------------------------------ */

const MAX_COLORS = 8;

type ColorStop = { color: string; intensity: number; threshold: number; };

interface ShaderParams {
  mode: number;
  angle: number;
  speed: number;
  warp: number;
  noiseScale: number;
  aberration: number;
  blur: number;
  grain: number;
  colorBg: string;
  colors: ColorStop[];
}

const DEFAULT_PARAMS: ShaderParams = {
  mode: 3,
  angle: 0.78,
  speed: 0.15,
  warp: 3.0,
  noiseScale: 1.2,
  aberration: 0.01,
  blur: 0,
  grain: 0,
  colorBg: "#050505",
  colors: [{ color: "#ffffff", intensity: 1.2, threshold: -0.3 }],
};

/* ------------------------------------------------------------------ */
/*  Export code generator                                             */
/* ------------------------------------------------------------------ */

function generateExportCode(params: ShaderParams): string {
  const colorsArr = params.colors.map(s => `new THREE.Color('${s.color}')`).join(', ');
  const intensitiesArr = params.colors.map(s => s.intensity).join(', ');
  const thresholdsArr = params.colors.map(s => s.threshold).join(', ');

  return `<!DOCTYPE html>
<html lang="ja">
<body style="margin:0;overflow:hidden;background:#000;">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
            uMode: { value: ${params.mode} }, uAngle: { value: ${params.angle.toFixed(3)} },
            uSpeed: { value: ${params.speed.toFixed(3)} }, uWarp: { value: ${params.warp.toFixed(3)} },
            uNoiseScale: { value: ${params.noiseScale.toFixed(3)} }, uAberration: { value: ${params.aberration.toFixed(4)} },
            uBlur: { value: ${params.blur.toFixed(3)} }, uGrain: { value: ${params.grain.toFixed(3)} },
            uColorBg: { value: new THREE.Color('${params.colorBg}') },
            uColors: { value: [${colorsArr}] },
            uIntensities: { value: [${intensitiesArr}] },
            uThresholds: { value: [${thresholdsArr}] },
            uColorCount: { value: ${params.colors.length} },
        },
        vertexShader: \`${VERTEX_SHADER}\`,
        fragmentShader: \`${FRAGMENT_SHADER}\`
    });

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    });
    function animate(t) {
        material.uniforms.uTime.value = t * 0.001;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
<\/script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function ShaderPage() {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<{ uniforms: Record<string, { value: unknown }> } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [params, setParams] = useState<ShaderParams>({ ...DEFAULT_PARAMS, colors: [...DEFAULT_PARAMS.colors] });
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const outputFooterRef = useRef<HTMLDivElement>(null);
  const { copy, copied } = useClipboard();

  const updateParam = useCallback(<K extends keyof ShaderParams>(key: K, value: ShaderParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateColor = useCallback((index: number, field: keyof ColorStop, value: string | number) => {
    setParams(prev => {
      const colors = prev.colors.map((c, i) => i === index ? { ...c, [field]: value } : c);
      return { ...prev, colors };
    });
  }, []);

  const addColor = useCallback(() => {
    setParams(prev => ({
      ...prev,
      colors: [...prev.colors, { color: "#ffffff", intensity: 1.0, threshold: 0.3 }],
    }));
  }, []);

  const removeColor = useCallback((index: number) => {
    setParams(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }));
  }, []);

  /* --- Three.js setup --- */
  useEffect(() => {
    let disposed = false;

    async function setup() {
      const THREE = await import("three");
      if (disposed || !containerRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const container = containerRef.current;
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const p = DEFAULT_PARAMS;
      const colorArr = Array.from({ length: MAX_COLORS }, (_, i) =>
        new THREE.Color(i < p.colors.length ? p.colors[i].color : "#000000")
      );
      const intensityArr = Array.from({ length: MAX_COLORS }, (_, i) =>
        i < p.colors.length ? p.colors[i].intensity : 0
      );
      const thresholdArr = Array.from({ length: MAX_COLORS }, (_, i) =>
        i < p.colors.length ? p.colors[i].threshold : 0
      );

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime:       { value: 0 },
          uResolution: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
          uMode:       { value: p.mode },
          uAngle:      { value: p.angle },
          uSpeed:      { value: p.speed },
          uWarp:       { value: p.warp },
          uNoiseScale: { value: p.noiseScale },
          uAberration: { value: p.aberration },
          uBlur:       { value: p.blur },
          uGrain:      { value: p.grain },
          uColorBg:    { value: new THREE.Color(p.colorBg) },
          uColors:     { value: colorArr },
          uIntensities:{ value: intensityArr },
          uThresholds: { value: thresholdArr },
          uColorCount: { value: p.colors.length },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });
      materialRef.current = material;

      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

      const onResize = () => {
        renderer.setSize(container.clientWidth, container.clientHeight);
        material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
      };
      window.addEventListener("resize", onResize);

      let animId: number;
      const animate = (time: number) => {
        material.uniforms.uTime.value = time * 0.001;
        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animId = requestAnimationFrame(animate);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        material.dispose();
        renderer.domElement.remove();
      };
    }

    setup();
    return () => {
      disposed = true;
      cleanupRef.current?.();
    };
  }, []);

  /* --- Sync React state → uniforms --- */
  useEffect(() => {
    const m = materialRef.current;
    if (!m) return;
    const u = m.uniforms;
    u.uMode.value = params.mode;
    u.uAngle.value = params.angle;
    u.uSpeed.value = params.speed;
    u.uWarp.value = params.warp;
    u.uNoiseScale.value = params.noiseScale;
    u.uAberration.value = params.aberration;
    u.uBlur.value = params.blur;
    u.uGrain.value = params.grain;
    (u.uColorBg.value as { set(v: string): void }).set(params.colorBg);
    const colorArr = u.uColors.value as { set(v: string): void }[];
    params.colors.slice(0, MAX_COLORS).forEach((stop, i) => {
      colorArr[i].set(stop.color);
      (u.uIntensities.value as number[])[i] = stop.intensity;
      (u.uThresholds.value as number[])[i] = stop.threshold;
    });
    u.uColorCount.value = Math.min(params.colors.length, MAX_COLORS);
  }, [params]);

  /* --- Export --- */
  const handleExport = useCallback(() => {
    setExportCode(generateExportCode(params));
    setShowExport(true);
  }, [params]);

  const handleDownload = useCallback(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (canvas) downloadCanvas(canvas as HTMLCanvasElement, "shader.png");
  }, []);

  useEffect(() => {
    if (!showOutputMenu) return;
    const handler = (e: PointerEvent) => {
      if (outputFooterRef.current?.contains(e.target as Node)) return;
      setShowOutputMenu(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showOutputMenu]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#d8d8da]">
      {/* Canvas area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">
        <div ref={containerRef} className="w-full h-full" />
        <AppTopBar />
      </div>

      {/* Control surface */}
      <aside className="flex-1 md:flex-none md:w-[320px] shrink-0 bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] shadow-[0_-8px_24px_rgba(0,0,0,0.10)] md:shadow-none md:border-l md:border-[#bbbbbe] flex flex-col overflow-hidden">

        {/* Header band */}
        <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b border-[rgba(0,0,0,0.12)]">
          <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333] select-none">{t.apps.shader.name}</span>
          <PushButton size="sm" variant="dark" onClick={() => setParams({ ...DEFAULT_PARAMS, colors: [...DEFAULT_PARAMS.colors] })}>[ {t.reset} ]</PushButton>
        </div>

        {/* Scrollable interior */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Mode */}
          <div className="px-4 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-2">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.shader.mode}</span>
            <Select value={String(params.mode)} onValueChange={(v) => updateParam("mode", Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t.shader.flow}</SelectItem>
                <SelectItem value="1">{t.shader.wave}</SelectItem>
                <SelectItem value="2">{t.shader.ripple}</SelectItem>
                <SelectItem value="3">{t.shader.morph}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Motion params */}
          <div className="flex flex-col gap-2 px-4 py-4 border-b border-[rgba(0,0,0,0.08)]">
            <DragParam label={t.shader.speed} value={params.speed} min={0} max={1} step={0.01} defaultValue={DEFAULT_PARAMS.speed} onChange={(v) => updateParam("speed", v)} />
            <DragParam label={t.shader.noiseScale} value={params.noiseScale} min={0.1} max={4} step={0.1} defaultValue={DEFAULT_PARAMS.noiseScale} onChange={(v) => updateParam("noiseScale", v)} />
            <DragParam label={t.shader.distortion} value={params.warp} min={0.1} max={10} step={0.1} defaultValue={DEFAULT_PARAMS.warp} onChange={(v) => updateParam("warp", v)} />
            <DragParam label={t.shader.aberration} value={params.aberration} min={0} max={0.1} step={0.001} defaultValue={DEFAULT_PARAMS.aberration} onChange={(v) => updateParam("aberration", v)} />
            <DragParam label={t.shader.blur} value={params.blur} min={0} max={1} step={0.05} defaultValue={DEFAULT_PARAMS.blur} onChange={(v) => updateParam("blur", v)} />
            <DragParam label={t.shader.grain} value={params.grain} min={0} max={1} step={0.01} defaultValue={DEFAULT_PARAMS.grain} onChange={(v) => updateParam("grain", v)} />
          </div>

          {/* Colors */}
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.colors}</span>
              {params.colors.length < MAX_COLORS && (
                <PushButton size="sm" variant="light" onClick={addColor}>[ + ]</PushButton>
              )}
            </div>

            {/* BG */}
            <ColorRow label="BG" value={params.colorBg} onChange={(v) => updateParam("colorBg", v)} />

            {/* Dynamic color stops */}
            {params.colors.map((stop, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ColorRow
                      label={`${t.shader.colorLabel} ${i + 1}`}
                      value={stop.color}
                      onChange={(v) => updateColor(i, "color", v)}
                    />
                  </div>
                  {params.colors.length > 1 && (
                    <button
                      onClick={() => removeColor(i)}
                      className="text-[#aaa] hover:text-[#555] font-mono text-[14px] leading-none select-none transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="pl-3 border-l-2 border-[#bbbbbe] flex flex-col gap-2">
                  <DragParam label={t.shader.intensity} value={stop.intensity} min={0} max={5} step={0.1} onChange={(v) => updateColor(i, "intensity", v)} defaultValue={1.0} />
                  <DragParam label={t.shader.threshold} value={stop.threshold} min={-1} max={1} step={0.01} onChange={(v) => updateColor(i, "threshold", v)} defaultValue={-0.3} />
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* footer */}
        <div ref={outputFooterRef} className="shrink-0 px-5 py-4 border-t border-[rgba(0,0,0,0.12)] relative">
          <PushButton
            variant="dark"
            className="w-full text-center"
            onClick={() => setShowOutputMenu(v => !v)}
          >
            [ {t.shader.output} ]
          </PushButton>
          {showOutputMenu && (
            <div className="absolute bottom-[calc(100%-4px)] left-5 right-5 bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] rounded-[6px] overflow-hidden [box-shadow:0_-4px_16px_rgba(0,0,0,0.4)]">
              <button
                className="w-full px-4 py-3 text-left font-mono text-[12px] uppercase tracking-[0.12em] text-[#e0e0e2] hover:bg-[rgba(255,255,255,0.08)] transition-colors select-none border-b border-[rgba(255,255,255,0.06)]"
                onClick={() => { setShowOutputMenu(false); handleDownload(); }}
              >
                PNG — Image
              </button>
              <button
                className="w-full px-4 py-3 text-left font-mono text-[12px] uppercase tracking-[0.12em] text-[#e0e0e2] hover:bg-[rgba(255,255,255,0.08)] transition-colors select-none"
                onClick={() => { setShowOutputMenu(false); handleExport(); }}
              >
                HTML — Code
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>{t.shader.exportCodeTitle}</DialogTitle>
          </DialogHeader>
          <textarea
            className="flex-1 min-h-[300px] rounded-[3px] border border-[rgba(0,0,0,0.5)] bg-[#1a1a1a] text-[#e0e0e2] font-mono text-[12px] leading-relaxed p-4 resize-none outline-none [box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)]"
            value={exportCode}
            readOnly
          />
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 bg-transparent border border-[#242424] text-[#242424] font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#242424]/5 transition-colors select-none" onClick={() => setShowExport(false)}>
              [ {t.close} ]
            </button>
            <button className="px-4 py-2 bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none" onClick={() => copy(exportCode)}>
              [ {copied ? t.copied : t.copy} ]
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

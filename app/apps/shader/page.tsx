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
uniform int uMode;
uniform float uAngle;
uniform vec3 uColorBg;
uniform vec3 uColor1;
uniform float uIntensity1;
uniform float uThreshold1;
uniform vec3 uColor2;
uniform float uIntensity2;
uniform float uThreshold2;

varying vec2 vUv;

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
    col = mix(col, uColor1 * uIntensity1, smoothstep(uThreshold1, uThreshold1 + 0.6, n));
    col = mix(col, uColor2 * uIntensity2, smoothstep(uThreshold2, uThreshold2 + 0.4, n));
    return col;
}

void main() {
    vec2 ratio = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * ratio * uNoiseScale;

    if (uAberration > 0.0) {
        float nR = getNoise(uv + vec2(uAberration, 0.0));
        float nG = getNoise(uv);
        float nB = getNoise(uv - vec2(uAberration, 0.0));
        gl_FragColor = vec4(calculateColor(nR).r, calculateColor(nG).g, calculateColor(nB).b, 1.0);
    } else {
        float n = getNoise(uv);
        gl_FragColor = vec4(calculateColor(n), 1.0);
    }
}
`;

/* ------------------------------------------------------------------ */
/*  Types & defaults                                                  */
/* ------------------------------------------------------------------ */

interface ShaderParams {
  mode: number;
  angle: number;
  speed: number;
  warp: number;
  noiseScale: number;
  aberration: number;
  colorBg: string;
  color1: string;
  intensity1: number;
  threshold1: number;
  color2: string;
  intensity2: number;
  threshold2: number;
}

const DEFAULT_PARAMS: ShaderParams = {
  mode: 3,
  angle: 0.78,
  speed: 0.15,
  warp: 3.0,
  noiseScale: 1.2,
  aberration: 0.01,
  colorBg: "#050505",
  color1: "#ffffff",
  intensity1: 1.2,
  threshold1: -0.3,
  color2: "#2a4d69",
  intensity2: 2.0,
  threshold2: 0.2,
};

const MODES = [
  { value: "0", label: "フロー" },
  { value: "1", label: "ウェーブ" },
  { value: "2", label: "リップル" },
  { value: "3", label: "モーフ" },
];

/* ------------------------------------------------------------------ */
/*  Export code generator                                             */
/* ------------------------------------------------------------------ */

function generateExportCode(params: ShaderParams): string {
  return `<!DOCTYPE html>
<html lang="ja">
<body style="margin:0;overflow:hidden;background:#000;">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: false });
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
            uColorBg: { value: new THREE.Color('${params.colorBg}') },
            uColor1: { value: new THREE.Color('${params.color1}') }, uIntensity1: { value: ${params.intensity1} }, uThreshold1: { value: ${params.threshold1} },
            uColor2: { value: new THREE.Color('${params.color2}') }, uIntensity2: { value: ${params.intensity2} }, uThreshold2: { value: ${params.threshold2} }
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
/*  Param control row                                                 */
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

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[13px]">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 border border-border rounded-md bg-transparent cursor-pointer p-0 color-swatch"
        />
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function ShaderPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<{ uniforms: Record<string, { value: unknown }> } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [params, setParams] = useState<ShaderParams>({ ...DEFAULT_PARAMS });
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const [copied, setCopied] = useState(false);

  const updateParam = useCallback(<K extends keyof ShaderParams>(key: K, value: ShaderParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
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
      const renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const p = DEFAULT_PARAMS;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
          uMode: { value: p.mode },
          uAngle: { value: p.angle },
          uSpeed: { value: p.speed },
          uWarp: { value: p.warp },
          uNoiseScale: { value: p.noiseScale },
          uAberration: { value: p.aberration },
          uColorBg: { value: new THREE.Color(p.colorBg) },
          uColor1: { value: new THREE.Color(p.color1) },
          uIntensity1: { value: p.intensity1 },
          uThreshold1: { value: p.threshold1 },
          uColor2: { value: new THREE.Color(p.color2) },
          uIntensity2: { value: p.intensity2 },
          uThreshold2: { value: p.threshold2 },
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
    u.uIntensity1.value = params.intensity1;
    u.uThreshold1.value = params.threshold1;
    u.uIntensity2.value = params.intensity2;
    u.uThreshold2.value = params.threshold2;
    (u.uColorBg.value as { set(v: string): void }).set(params.colorBg);
    (u.uColor1.value as { set(v: string): void }).set(params.color1);
    (u.uColor2.value as { set(v: string): void }).set(params.color2);
  }, [params]);

  /* --- Export --- */
  const handleExport = useCallback(() => {
    setExportCode(generateExportCode(params));
    setShowExport(true);
    setCopied(false);
  }, [params]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(exportCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportCode]);

  return (
    <div className="fixed inset-0 z-50 flex bg-black">
      {/* Canvas area */}
      <div className="flex-1 relative min-w-0">
        <div ref={containerRef} className="w-full h-full" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex justify-between items-center p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/">
            <Button variant="outline" size="sm" className="bg-black/55! border-white/15! text-white/85! backdrop-blur-xl hover:bg-black/75! hover:border-white/30! hover:text-white!">
              ← 戻る
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExport} className="bg-black/55! border-white/15! text-white/85! backdrop-blur-xl hover:bg-black/75! hover:border-white/30! hover:text-white!">
            コード出力
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-70 shrink-0 bg-background border-l border-border flex flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold -tracking-[0.01em]">設定</h2>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
          {/* モード */}
          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">モード</Label>
            <Select
              value={String(params.mode)}
              onValueChange={(v) => updateParam("mode", Number(v))}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ParamSlider label="速度" value={params.speed} min={0} max={1} step={0.01} onChange={(v) => updateParam("speed", v)} />
          <ParamSlider label="歪み" value={params.warp} min={0.1} max={10} step={0.1} onChange={(v) => updateParam("warp", v)} />
          <ParamSlider label="ノイズスケール" value={params.noiseScale} min={0.1} max={4} step={0.1} onChange={(v) => updateParam("noiseScale", v)} />
          <ParamSlider label="色収差" value={params.aberration} min={0} max={0.1} step={0.001} onChange={(v) => updateParam("aberration", v)} />

          <Separator />

          <ColorRow label="背景色" value={params.colorBg} onChange={(v) => updateParam("colorBg", v)} />

          <Separator />

          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">カラー 1</p>
          <ColorRow label="色" value={params.color1} onChange={(v) => updateParam("color1", v)} />
          <ParamSlider label="強度" value={params.intensity1} min={0} max={5} step={0.1} onChange={(v) => updateParam("intensity1", v)} />
          <ParamSlider label="しきい値" value={params.threshold1} min={-1} max={1} step={0.01} onChange={(v) => updateParam("threshold1", v)} />

          <Separator />

          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">カラー 2</p>
          <ColorRow label="色" value={params.color2} onChange={(v) => updateParam("color2", v)} />
          <ParamSlider label="強度" value={params.intensity2} min={0} max={5} step={0.1} onChange={(v) => updateParam("intensity2", v)} />
          <ParamSlider label="しきい値" value={params.threshold2} min={-1} max={1} step={0.01} onChange={(v) => updateParam("threshold2", v)} />
        </div>
      </aside>

      {/* Export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>コード出力 — 軽量版HTML</DialogTitle>
          </DialogHeader>
          <textarea
            className="flex-1 min-h-[300px] bg-muted text-foreground border border-border rounded-lg font-mono text-[11px] leading-relaxed p-4 resize-none outline-none focus:border-ring"
            value={exportCode}
            readOnly
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowExport(false)}>
              閉じる
            </Button>
            <Button onClick={handleCopy}>
              {copied ? "コピーしました" : "クリップボードにコピー"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

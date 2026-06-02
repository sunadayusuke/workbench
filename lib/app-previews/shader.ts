/* ------------------------------------------------------------------ *
 *  Home-card preview for the Shader app.
 *
 *  Reproduces the REAL default canvas of app/apps/shader/page.tsx:
 *  the exact VERTEX_SHADER + FRAGMENT_SHADER, geometry/material setup,
 *  and DEFAULT_PARAMS (mode=3 morph, speed .15, warp 3, noiseScale 1.2,
 *  aberration .01, colorBg #050505, colors=[{#ffffff,1.2,-0.3}]).
 *
 *  Plain TypeScript — no React. Dynamic-imports three.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Shaders (verbatim from app/apps/shader/page.tsx)                   */
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
/*  Defaults (verbatim from app/apps/shader/page.tsx)                 */
/* ------------------------------------------------------------------ */

const MAX_COLORS = 8;

type ColorStop = { color: string; intensity: number; threshold: number };

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
/*  Preview runner                                                    */
/* ------------------------------------------------------------------ */

const FRAME_MS = 1000 / 40; // cap at ~40fps

export function createPreview(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  (async () => {
    const THREE = await import("three");
    if (disposed) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

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

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMode: { value: p.mode },
        uAngle: { value: p.angle },
        uSpeed: { value: p.speed },
        uWarp: { value: p.warp },
        uNoiseScale: { value: p.noiseScale },
        uAberration: { value: p.aberration },
        uBlur: { value: p.blur },
        uGrain: { value: p.grain },
        uColorBg: { value: new THREE.Color(p.colorBg) },
        uColors: { value: colorArr },
        uIntensities: { value: intensityArr },
        uThresholds: { value: thresholdArr },
        uColorCount: { value: p.colors.length },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setSize(w, h, false);
      material.uniforms.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height
      );
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = 0;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      if (document.hidden) return;
      material.uniforms.uTime.value = (now - start) / 1000;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    cleanup = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}

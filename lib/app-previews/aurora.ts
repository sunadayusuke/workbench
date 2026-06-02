/* ==================================================================
   Aurora app preview — renders the real aurora default canvas.

   Faithful: copies the EXACT VERT / FRAG shader strings, the
   ShaderMaterial / geometry / camera setup, and DEFAULT_PARAMS →
   uniform mapping verbatim from app/apps/aurora/page.tsx
   (including renderer.outputColorSpace = LinearSRGBColorSpace,
   alpha + transparent, and hexToRGB color parsing).

   Mask approximation: the real app loads a random Material Symbols
   SVG from the Iconify network API and rasterizes it into the uMask
   alpha channel. That is non-deterministic and network-bound, so the
   preview instead draws a centered soft elliptical/radial mask into an
   offscreen canvas used as the uMask texture. This shows the colored
   shape over the canvas background exactly as the shader produces it;
   only the silhouette differs from the live app's random icon.
================================================================== */

import { hexToRGB } from "@/lib/color-utils";

const FPS_MS = 25; // ~40fps cap

// --- Verbatim from app/apps/aurora/page.tsx ---
const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;

const SNOISE = `
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
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uMask;
uniform float uTime;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uWarp;
uniform float uNoiseScale;
uniform float uAberration;
uniform float uBlur;
uniform int uMode;
uniform float uAngle;
uniform vec3 uColorBg;
uniform vec3 uColor1;
uniform float uIntensity1;
uniform float uThreshold1;
uniform vec3 uCanvasBg;
uniform bool uTransparentBg;
uniform float uGrain;
varying vec2 vUv;
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
${SNOISE}
float getNoise(vec2 p){
    float t=uTime*uSpeed;
    vec2 pm=p;
    if(uMode==0)pm-=vec2(cos(uAngle),sin(uAngle))*t;
    else if(uMode==1){pm.x+=sin(pm.y+t)*.3;pm.y+=cos(pm.x+t*.5)*.2;}
    else if(uMode==2){float d=length(pm);pm+=(pm/max(d,.1))*sin(d*3.-t*1.5)*.15;}
    vec2 q=vec2(snoise(pm+t*.5),snoise(pm+1.));
    vec2 r=vec2(snoise(pm+4.*q+vec2(1.7,9.2)+t*.3),snoise(pm+4.*q+vec2(8.3,2.8)+t*.2));
    return snoise(pm+uWarp*r);
}
vec3 calcColor(float n){
    vec3 col=uColorBg;
    col=mix(col,uColor1*uIntensity1,smoothstep(uThreshold1,uThreshold1+.6,n));
    return col;
}
vec3 getShaderCol(vec2 uv){
    if(uAberration>0.){
        float nR=getNoise(uv+vec2(uAberration,0.));
        float nG=getNoise(uv);
        float nB=getNoise(uv-vec2(uAberration,0.));
        return vec3(calcColor(nR).r,calcColor(nG).g,calcColor(nB).b);
    }
    return calcColor(getNoise(uv));
}
void main(){
    vec2 ratio=vec2(uResolution.x/uResolution.y,1.);
    vec2 uv=(vUv-.5)*ratio*uNoiseScale;
    vec3 shaderCol;
    if(uBlur>0.){
        float r=uBlur*0.08;
        shaderCol=(
            getShaderCol(uv+vec2(-r,-r))+getShaderCol(uv+vec2(0.,-r))+getShaderCol(uv+vec2(r,-r))+
            getShaderCol(uv+vec2(-r,0.))+getShaderCol(uv)+getShaderCol(uv+vec2(r,0.))+
            getShaderCol(uv+vec2(-r,r))+getShaderCol(uv+vec2(0.,r))+getShaderCol(uv+vec2(r,r))
        )/9.0;
    }else{
        shaderCol=getShaderCol(uv);
    }
    if(uGrain>0.){float n=rand(vUv*uResolution+vec2(uTime))-0.5;shaderCol+=n*uGrain*0.4;}
    float maskVal=texture2D(uMask,vUv).a;
    vec3 finalColor=mix(uCanvasBg,shaderCol,maskVal);
    float alpha=uTransparentBg?maskVal:1.;
    gl_FragColor=vec4(finalColor,alpha);
}`;

type Params = {
  scale: number;
  roundness: number;
  blur: number;
  canvasBlur: number;
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
  canvasBg: string;
  transparentBg: boolean;
  grain: number;
};

const DEFAULT_PARAMS: Params = {
  scale: 0.5,
  roundness: 0,
  blur: 0.3,
  canvasBlur: 0,
  mode: 3,
  angle: 0.78,
  speed: 0.15,
  warp: 3.3,
  noiseScale: 2,
  aberration: 0.012,
  colorBg: "#4c66a4",
  color1: "#f0faff",
  intensity1: 1.1,
  threshold1: -0.28,
  canvasBg: "#f3f7fb",
  transparentBg: false,
  grain: 0,
};

// Draw a centered soft elliptical mask into the offscreen canvas alpha
// channel (mask approximation in place of the app's random Iconify SVG).
function drawMask(canvas: HTMLCanvasElement, scale: number) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  // The app fits the SVG to 0.78 * scale of the smaller dimension and
  // centers it. Emulate that footprint with a soft radial blob.
  const radius = (Math.min(w, h) / 2) * 0.78 * scale * 1.6;
  const cx = w / 2;
  const cy = h / 2;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.6, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function createPreview(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  (async () => {
    const THREE = await import("three");
    if (disposed) return;

    const p = DEFAULT_PARAMS;

    // Offscreen mask canvas → CanvasTexture (matches the app's setup)
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = 1;
    maskCanvas.height = 1;
    const maskTexture = new THREE.CanvasTexture(maskCanvas);
    maskTexture.minFilter = THREE.LinearFilter;
    maskTexture.generateMipmaps = false;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMask: { value: maskTexture },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMode: { value: p.mode },
        uAngle: { value: p.angle },
        uSpeed: { value: p.speed },
        uWarp: { value: p.warp },
        uNoiseScale: { value: p.noiseScale },
        uAberration: { value: p.aberration },
        uBlur: { value: p.blur },
        uColorBg: { value: hexToRGB(p.colorBg) },
        uColor1: { value: hexToRGB(p.color1) },
        uIntensity1: { value: p.intensity1 },
        uThreshold1: { value: p.threshold1 },
        uCanvasBg: { value: hexToRGB(p.canvasBg) },
        uTransparentBg: { value: p.transparentBg },
        uGrain: { value: p.grain },
      },
      transparent: true,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(new THREE.Mesh(geometry, material));

    let raf = 0;
    let last = 0;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setSize(w, h, false);
      // device-pixel size used for both resolution uniform and mask raster
      const pw = Math.max(1, Math.round(w * dpr));
      const ph = Math.max(1, Math.round(h * dpr));
      material.uniforms.uResolution.value.set(pw, ph);
      maskCanvas.width = pw;
      maskCanvas.height = ph;
      drawMask(maskCanvas, p.scale);
      maskTexture.needsUpdate = true;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FPS_MS) return;
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
      maskTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}

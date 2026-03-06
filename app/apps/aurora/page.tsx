'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { PushButton } from '@/components/ui/push-button';
import { DragParam } from '@/components/ui/drag-param';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n';
import { downloadCanvas, downloadBlob } from '@/lib/canvas-download';
import { hexToRGB } from '@/lib/color-utils';
import { useClipboard } from '@/hooks/use-clipboard';

const ICON_NAMES = [
  'favorite', 'star', 'bolt', 'cloud', 'music-note',
  'home', 'face', 'diamond', 'hexagon', 'pentagon',
  'rocket-launch', 'public', 'waves', 'auto-awesome', 'flare',
  'water-drop', 'local-florist', 'psychology', 'blur-on', 'grade',
];

const VERT = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;

// Exact same snoise as shader app
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
varying vec2 vUv;
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
  colorBg: '#4c66a4',
  color1: '#f0faff',
  intensity1: 1.1,
  threshold1: -0.28,
  canvasBg: '#f3f7fb',
  transparentBg: false,
};

type ThreeCtx = {
  renderer: any;
  material: any;
  maskCanvas: HTMLCanvasElement;
  maskTexture: any;
};

function injectMaskFilter(svgText: string, roundness: number): string {
  if (roundness === 0) return svgText;
  const roundPx = roundness * 2;
  const filterDef = `<defs><filter id="_af" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="${roundPx.toFixed(2)}"/>
    <feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
  </filter></defs>`;
  return svgText
    .replace(/(<svg[^>]*>)/, `$1${filterDef}<g filter="url(#_af)">`)
    .replace('</svg>', '</g></svg>');
}

function prepareSvg(svgText: string): string {
  const vb = svgText.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)/);
  const [w, h] = vb ? [vb[1], vb[2]] : ['24', '24'];
  let result = svgText;
  if (!/width=["']\d+["']/.test(result)) {
    result = result.replace(/\swidth=["'][^"']*["']/, '').replace('<svg', `<svg width="${w}"`);
  }
  if (!/height=["']\d+["']/.test(result)) {
    result = result.replace(/\sheight=["'][^"']*["']/, '').replace('<svg', `<svg height="${h}"`);
  }
  return result;
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#555]">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" className="color-swatch" value={value} onChange={e => onChange(e.target.value)} />
        <span className="text-[11px] font-mono text-[#777] tabular-nums">{value}</span>
      </div>
    </div>
  );
}

function generateExportCode(params: Params, svgData: string): string {
  const v3 = (hex: string) => {
    const [r, g, b] = hexToRGB(hex);
    return `new THREE.Vector3(${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)})`;
  };
  const processedSvg = svgData ? prepareSvg(injectMaskFilter(svgData, params.roundness)) : '';
  const blurStyle = params.canvasBlur > 0 ? `filter:blur(${(params.canvasBlur * 30).toFixed(1)}px);` : '';

  return `<!DOCTYPE html>
<html><body style="margin:0;overflow:hidden;background:${params.canvasBg};">
<canvas id="c" style="display:block;${blurStyle}"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
const SVG_DATA = ${JSON.stringify(processedSvg)};
const VERT = ${JSON.stringify(VERT)};
const FRAG = ${JSON.stringify(FRAG)};

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);

const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d');
const maskTexture = new THREE.Texture(maskCanvas);
maskTexture.minFilter = THREE.LinearFilter;
maskTexture.generateMipmaps = false;

function renderMask() {
  const dpr = Math.min(devicePixelRatio,2);
  maskCanvas.width = innerWidth * dpr;
  maskCanvas.height = innerHeight * dpr;
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  if (!SVG_DATA) return;
  const blob = new Blob([SVG_DATA], {type:'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const s = Math.min(maskCanvas.width/img.naturalWidth, maskCanvas.height/img.naturalHeight)*0.78*${params.scale};
    maskCtx.drawImage(img,(maskCanvas.width-img.naturalWidth*s)/2,(maskCanvas.height-img.naturalHeight*s)/2,img.naturalWidth*s,img.naturalHeight*s);
    URL.revokeObjectURL(url);
    maskTexture.needsUpdate = true;
  };
  img.src = url;
}
renderMask();

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const material = new THREE.ShaderMaterial({
  uniforms: {
    uMask:{value:maskTexture}, uTime:{value:0},
    uResolution:{value:new THREE.Vector2(innerWidth,innerHeight)},
    uMode:{value:${params.mode}}, uAngle:{value:${params.angle}},
    uSpeed:{value:${params.speed}}, uWarp:{value:${params.warp}},
    uNoiseScale:{value:${params.noiseScale}}, uAberration:{value:${params.aberration}}, uBlur:{value:${params.blur}},
    uColorBg:{value:${v3(params.colorBg)}},
    uColor1:{value:${v3(params.color1)}}, uIntensity1:{value:${params.intensity1}}, uThreshold1:{value:${params.threshold1}},
    uCanvasBg:{value:${v3(params.canvasBg)}}, uTransparentBg:{value:${params.transparentBg}},
  },
  vertexShader: VERT, fragmentShader: FRAG, transparent: true,
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), material));
window.addEventListener('resize', () => {
  renderer.setSize(innerWidth,innerHeight);
  material.uniforms.uResolution.value.set(innerWidth,innerHeight);
  renderMask();
});
(function animate(t){
  material.uniforms.uTime.value = t*0.001;
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
})(0);
<\/script></body></html>`;
}

export default function AuroraPage() {
  const { lang, toggle, t } = useLanguage();
  const [params, setParamsState] = useState<Params>(DEFAULT_PARAMS);
  const paramsRef = useRef<Params>(DEFAULT_PARAMS);
  const { copy, copied } = useClipboard();

  const [currentSvg, setCurrentSvg] = useState<string | null>(null);
  const [currentIconName, setCurrentIconName] = useState<string>('');
  const [isLoadingIcon, setIsLoadingIcon] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState<number | null>(null);

  const iconListRef = useRef<string[]>(ICON_NAMES);
  const iconCacheRef = useRef<Map<string, string>>(new Map());
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<ThreeCtx | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSvgRef = useRef<string>('');

  // Fetch full material-symbols icon list from Iconify
  useEffect(() => {
    fetch('https://api.iconify.design/collection?prefix=material-symbols')
      .then(r => r.json())
      .then((data: any) => {
        // Iconify /collection returns icons as an object {name: {}} not an array
        let icons: string[] = [];
        if (Array.isArray(data?.icons)) {
          icons = data.icons;
        } else if (data?.icons && typeof data.icons === 'object') {
          icons = Object.keys(data.icons);
        }
        // Also pull from uncategorized / categories if icons list is empty
        if (icons.length === 0 && Array.isArray(data?.uncategorized)) {
          icons = data.uncategorized;
        }
        if (icons.length === 0 && data?.categories && typeof data.categories === 'object') {
          for (const arr of Object.values(data.categories)) {
            if (Array.isArray(arr)) icons.push(...(arr as string[]));
          }
        }
        // Keep only base variants (exclude -outline, -sharp suffixes)
        const filtered = icons.filter((n: string) => !/-outline$|-sharp$/.test(n));
        if (filtered.length > 0) iconListRef.current = filtered;
        else if (icons.length > 0) iconListRef.current = icons;
      })
      .catch(() => {});
  }, []);


  function setParams(update: Partial<Params>) {
    setParamsState(prev => {
      const next = { ...prev, ...update };
      paramsRef.current = next;
      return next;
    });
  }

  const loadAndSetIcon = useCallback(async (name: string) => {
    const cached = iconCacheRef.current.get(name);
    if (cached) { setCurrentSvg(cached); setCurrentIconName(name); return; }
    setIsLoadingIcon(true);
    let svg: string | null = null;
    for (const col of ['material-symbols', 'material-icons']) {
      try {
        const res = await fetch(`https://api.iconify.design/${col}/${name}.svg`);
        if (res.ok) {
          const text = await res.text();
          if (text.trimStart().startsWith('<svg')) { svg = text; break; }
        }
      } catch {}
    }
    if (svg) { iconCacheRef.current.set(name, svg); setCurrentSvg(svg); setCurrentIconName(name); }
    setIsLoadingIcon(false);
  }, []);

  const updateMask = useCallback(async (svgText: string) => {
    const ctx = threeRef.current;
    if (!ctx) return;
    const { maskCanvas, maskTexture } = ctx;
    const w = maskCanvas.width;
    const h = maskCanvas.height;
    const canvasCtx = maskCanvas.getContext('2d')!;
    canvasCtx.clearRect(0, 0, w, h);

    const p = paramsRef.current;
    const processed = prepareSvg(injectMaskFilter(svgText, p.roundness));
    const blob = new Blob([processed], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        const svgW = img.naturalWidth || 24;
        const svgH = img.naturalHeight || 24;
        const scale = Math.min(w / svgW, h / svgH) * 0.78 * p.scale;
        const x = (w - svgW * scale) / 2;
        const y = (h - svgH * scale) / 2;
        canvasCtx.drawImage(img, x, y, svgW * scale, svgH * scale);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });

    maskTexture.needsUpdate = true;
  }, []);

  // Three.js setup
  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    let destroyed = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      const THREE = await import('three');
      if (destroyed) return;

      const w = area.clientWidth;
      const h = area.clientHeight;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = w;
      maskCanvas.height = h;
      const maskTexture = new THREE.CanvasTexture(maskCanvas);
      maskTexture.minFilter = THREE.LinearFilter;
      maskTexture.generateMipmaps = false;

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      area.appendChild(renderer.domElement);

      const p = paramsRef.current;
      const material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uMask:          { value: maskTexture },
          uTime:          { value: 0 },
          uResolution:    { value: new THREE.Vector2(w, h) },
          uMode:          { value: p.mode },
          uAngle:         { value: p.angle },
          uSpeed:         { value: p.speed },
          uWarp:          { value: p.warp },
          uNoiseScale:    { value: p.noiseScale },
          uAberration:    { value: p.aberration },
          uBlur:          { value: p.blur },
          uColorBg:       { value: hexToRGB(p.colorBg) },
          uColor1:        { value: hexToRGB(p.color1) },
          uIntensity1:    { value: p.intensity1 },
          uThreshold1:    { value: p.threshold1 },
          uCanvasBg:      { value: hexToRGB(p.canvasBg) },
          uTransparentBg: { value: p.transparentBg },
        },
        transparent: true,
      });

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

      threeRef.current = { renderer, material, maskCanvas, maskTexture };
      if (activeSvgRef.current) await updateMask(activeSvgRef.current);

      const t0 = performance.now();
      function render() {
        if (destroyed) return;
        rafRef.current = requestAnimationFrame(render);
        const p = paramsRef.current;
        const u = material.uniforms;
        u.uTime.value = (performance.now() - t0) / 1000;
        u.uMode.value = p.mode;
        u.uAngle.value = p.angle;
        u.uSpeed.value = p.speed;
        u.uWarp.value = p.warp;
        u.uNoiseScale.value = p.noiseScale;
        u.uAberration.value = p.aberration;
        u.uBlur.value = p.blur;
        u.uColorBg.value = hexToRGB(p.colorBg);
        u.uColor1.value = hexToRGB(p.color1);
        u.uIntensity1.value = p.intensity1;
        u.uThreshold1.value = p.threshold1;
        u.uCanvasBg.value = hexToRGB(p.canvasBg);
        u.uTransparentBg.value = p.transparentBg;
        renderer.render(scene, camera);
      }
      render();

      ro = new ResizeObserver(() => {
        if (destroyed) return;
        const nw = area.clientWidth;
        const nh = area.clientHeight;
        renderer.setSize(nw, nh);
        material.uniforms.uResolution.value.set(nw, nh);
        maskCanvas.width = nw;
        maskCanvas.height = nh;
        if (activeSvgRef.current) updateMask(activeSvgRef.current);
      });
      ro.observe(area);
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      if (threeRef.current) {
        threeRef.current.renderer.dispose();
        const canvas = threeRef.current.renderer.domElement;
        if (canvas.parentNode === area) area.removeChild(canvas);
      }
      threeRef.current = null;
    };
  }, [updateMask]);

  // CSS blur on WebGL canvas (whole-canvas)
  useEffect(() => {
    const canvas = threeRef.current?.renderer.domElement;
    if (!canvas) return;
    canvas.style.filter = params.canvasBlur > 0 ? `blur(${(params.canvasBlur * 30).toFixed(1)}px)` : '';
  }, [params.canvasBlur]);

  // Sync SVG + shape params → mask canvas
  useEffect(() => {
    if (!currentSvg) return;
    activeSvgRef.current = currentSvg;
    if (threeRef.current) updateMask(currentSvg);
  }, [currentSvg, params.roundness, params.scale, updateMask]);


  // Load initial random icon
  useEffect(() => {
    const name = ICON_NAMES[Math.floor(Math.random() * ICON_NAMES.length)];
    loadAndSetIcon(name);
  }, [loadAndSetIcon]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') return;
    const name = file.name.replace(/\.svg$/i, '');
    const reader = new FileReader();
    reader.onload = e => {
      const svg = e.target?.result as string;
      iconCacheRef.current.set(name, svg);
      setCurrentSvg(svg);
      setCurrentIconName(name);
    };
    reader.readAsText(file);
  }, []);

  function handleShuffle() {
    const list = iconListRef.current;
    const name = list[Math.floor(Math.random() * list.length)];
    loadAndSetIcon(name);
  }

  function handleReset() {
    setParamsState(DEFAULT_PARAMS);
    paramsRef.current = DEFAULT_PARAMS;
    const name = ICON_NAMES[Math.floor(Math.random() * ICON_NAMES.length)];
    loadAndSetIcon(name);
  }

  function handleDownload() {
    const canvas = threeRef.current?.renderer.domElement;
    if (canvas) downloadCanvas(canvas, 'glow.png');
  }

  function handleExport() {
    setExportCode(generateExportCode(paramsRef.current, activeSvgRef.current));
    setShowExport(true);
  }

  async function handleVideoExport(duration: number) {
    if (isRecording) return;
    const ctx = threeRef.current;
    if (!ctx) return;
    const { renderer, material } = ctx;
    const glCanvas = renderer.domElement;

    if (typeof MediaRecorder === 'undefined') {
      alert('お使いのブラウザは動画書き出しに対応していません。');
      return;
    }

    setIsRecording(true);
    setRecordingDuration(duration);

    // Store original renderer state for restoration
    const origClientW = glCanvas.clientWidth;
    const origClientH = glCanvas.clientHeight;
    const origDpr = renderer.getPixelRatio();

    try {
      // Upscale renderer for recording: 2× CSS pixels, max 1920 wide
      const scale = 2;
      const recW = Math.min(origClientW * scale, 1920);
      const recH = Math.round(recW * origClientH / origClientW);

      // Resize without updating CSS style (canvas stays visually the same size)
      renderer.setPixelRatio(1);
      renderer.setSize(recW, recH, false);
      material.uniforms.uResolution.value.set(recW, recH);

      const w = glCanvas.width;  // = recW
      const h = glCanvas.height; // = recH

      const composite = document.createElement('canvas');
      composite.width = w;
      composite.height = h;
      const ctx2d = composite.getContext('2d')!;

      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
        .find(m => MediaRecorder.isTypeSupported(m));

      const stream = composite.captureStream(30);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => {
        setIsRecording(false);
        setRecordingDuration(null);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || 'video/webm';
        const ext = finalMime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: finalMime });
        downloadBlob(blob, `glow.${ext}`);
        setIsRecording(false);
        setRecordingDuration(null);
      };

      const blurPx = paramsRef.current.canvasBlur * 30;
      let running = true;

      function drawFrame() {
        if (!running) return;
        ctx2d.clearRect(0, 0, w, h);
        if (blurPx > 0) {
          ctx2d.filter = `blur(${blurPx.toFixed(1)}px)`;
          ctx2d.drawImage(glCanvas, 0, 0, w, h);
          ctx2d.filter = 'none';
        } else {
          ctx2d.drawImage(glCanvas, 0, 0, w, h);
        }
        requestAnimationFrame(drawFrame);
      }

      ctx2d.drawImage(glCanvas, 0, 0, w, h);
      recorder.start(200);
      drawFrame();

      await new Promise(resolve => setTimeout(resolve, duration * 1000));
      running = false;
      recorder.stop();
    } catch (err) {
      console.error('Video export failed:', err);
      setIsRecording(false);
      setRecordingDuration(null);
    } finally {
      // Restore original renderer size
      renderer.setPixelRatio(origDpr);
      renderer.setSize(origClientW, origClientH);
      material.uniforms.uResolution.value.set(origClientW * origDpr, origClientH * origDpr);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-[#d8d8da]">
      {/* Canvas area */}
      <div
        ref={canvasAreaRef}
        className="h-[55vh] md:h-auto md:flex-1 relative"
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 border-2 border-dashed border-white/50 pointer-events-none">
            <span className="text-white font-mono text-[14px] uppercase tracking-[0.2em]">{t.aurora.dropSvg}</span>
          </div>
        )}
        {isRecording && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-4 z-10 pointer-events-none">
            <span className="bg-black/60 text-white font-mono text-[12px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-sm">
              ● REC {recordingDuration}s
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/"><PushButton variant="dark" size="sm">[ {t.back} ]</PushButton></Link>
          <PushButton onClick={toggle} variant="dark" size="sm">[ {lang === 'ja' ? 'EN' : 'JA'} ]</PushButton>
        </div>
      </div>

      {/* Control surface */}
      <aside className="md:w-[320px] bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] border-l border-[#bbbbbe] flex flex-col">
        <div className="flex items-center justify-between px-5 h-12 border-b border-[rgba(0,0,0,0.12)]">
          <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333]">{t.apps.aurora.name}</span>
          <PushButton size="sm" variant="dark" onClick={handleReset}>[ {t.reset} ]</PushButton>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Shape */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.aurora.shape}</span>

            <PushButton variant="dark" className="w-full text-center" onClick={() => fileInputRef.current?.click()}>
              [ {t.aurora.upload} ]
            </PushButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
            />

            {/* Sample group */}
            <div className="flex flex-col gap-2 py-2 border-y border-[rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.08)]" />
                <span className="text-[10px] font-mono text-[#aaa] uppercase tracking-[0.14em]">sample</span>
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.08)]" />
              </div>
              <PushButton variant="light" className="w-full text-center" onClick={handleShuffle}>
                [ {t.aurora.shuffle} ]
              </PushButton>
              <p className="text-[11px] font-mono text-[#999] tracking-[0.08em]">
                {isLoadingIcon ? '...' : currentIconName}
              </p>
            </div>

            <DragParam label={t.aurora.scale} value={params.scale} min={0.1} max={3} step={0.05} defaultValue={DEFAULT_PARAMS.scale} onChange={v => setParams({ scale: v })} />
            <DragParam label={t.aurora.roundness} value={params.roundness} min={0} max={1} step={0.05} defaultValue={DEFAULT_PARAMS.roundness} onChange={v => setParams({ roundness: v })} />
            <DragParam label={lang === 'ja' ? 'シェイプぼかし' : 'Shape Blur'} value={params.canvasBlur} min={0} max={1} step={0.05} defaultValue={DEFAULT_PARAMS.canvasBlur} onChange={v => setParams({ canvasBlur: v })} />
          </div>

          {/* Mode */}
          <div className="px-4 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-2">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.shader.mode}</span>
            <Select value={String(params.mode)} onValueChange={v => setParams({ mode: Number(v) })}>
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
            <DragParam label={t.shader.speed} value={params.speed} min={0} max={1} step={0.01} defaultValue={DEFAULT_PARAMS.speed} onChange={v => setParams({ speed: v })} />
            <DragParam label={t.shader.noiseScale} value={params.noiseScale} min={0.1} max={4} step={0.1} defaultValue={DEFAULT_PARAMS.noiseScale} onChange={v => setParams({ noiseScale: v })} />
            <DragParam label={t.shader.distortion} value={params.warp} min={0.1} max={10} step={0.1} defaultValue={DEFAULT_PARAMS.warp} onChange={v => setParams({ warp: v })} />
            <DragParam label={t.shader.aberration} value={params.aberration} min={0} max={0.1} step={0.001} defaultValue={DEFAULT_PARAMS.aberration} onChange={v => setParams({ aberration: v })} />
            <DragParam label={t.aurora.blur} value={params.blur} min={0} max={1} step={0.05} defaultValue={DEFAULT_PARAMS.blur} onChange={v => setParams({ blur: v })} />
          </div>

          {/* Colors */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-4">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.colors}</span>

            <ColorRow label="BG" value={params.colorBg} onChange={v => setParams({ colorBg: v })} />

            <div className="flex flex-col gap-2">
              <ColorRow label={t.shader.color1} value={params.color1} onChange={v => setParams({ color1: v })} />
              <div className="pl-3 border-l-2 border-[#bbbbbe] flex flex-col gap-2">
                <DragParam label={t.shader.intensity} value={params.intensity1} min={0} max={5} step={0.1} onChange={v => setParams({ intensity1: v })} defaultValue={DEFAULT_PARAMS.intensity1} />
                <DragParam label={t.shader.threshold} value={params.threshold1} min={-1} max={1} step={0.01} onChange={v => setParams({ threshold1: v })} defaultValue={DEFAULT_PARAMS.threshold1} />
              </div>
            </div>

          </div>

          {/* Background */}
          <div className="px-5 py-4 flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">{t.aurora.background}</span>
            <ColorRow label={t.shader.bgColor} value={params.canvasBg} onChange={v => setParams({ canvasBg: v })} />
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono text-[#555]">{t.aurora.transparent}</span>
              <ToggleSwitch active={params.transparentBg} onClick={() => setParams({ transparentBg: !params.transparentBg })} size="sm" />
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-5 py-3 border-t border-[rgba(0,0,0,0.12)] flex flex-col gap-2">
          {/* Image row */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#999] shrink-0 w-14">
              {lang === 'ja' ? '画像' : 'Image'}
            </span>
            <PushButton variant="dark" size="sm" className="flex-1 text-center whitespace-nowrap" onClick={handleDownload}>
              [ PNG ]
            </PushButton>
          </div>

          {/* Video row */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#999] shrink-0 w-14">
              {lang === 'ja' ? '動画' : 'Video'}
            </span>
            <div className="flex-1 flex gap-1.5">
              {([3, 5, 10] as const).map(sec => (
                <div key={sec} className="flex-1">
                  <PushButton
                    variant="dark"
                    size="sm"
                    className="w-full text-center whitespace-nowrap"
                    disabled={isRecording}
                    onClick={() => handleVideoExport(sec)}
                  >
                    {isRecording && recordingDuration === sec ? '[ ● ]' : `[ ${sec}s ]`}
                  </PushButton>
                </div>
              ))}
            </div>
          </div>

          {/* Code row */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#999] shrink-0 w-14">
              Code
            </span>
            <PushButton variant="dark" size="sm" className="flex-1 text-center whitespace-nowrap" onClick={handleExport}>
              [ {lang === 'ja' ? '出力' : 'EXPORT'} ]
            </PushButton>
          </div>
        </div>
      </aside>

      {/* Code export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>{t.aurora.exportCodeTitle}</DialogTitle>
          </DialogHeader>
          <textarea
            className="flex-1 min-h-[300px] rounded-[3px] border border-[rgba(0,0,0,0.5)] bg-[#1a1a1a] text-[#e0e0e2] font-mono text-[12px] leading-relaxed p-4 resize-none outline-none [box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)]"
            value={exportCode}
            readOnly
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-4 py-2 bg-transparent border border-[#242424] text-[#242424] font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#242424]/5 transition-colors select-none"
              onClick={() => setShowExport(false)}
            >
              [ {t.close} ]
            </button>
            <button
              className="px-4 py-2 bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none"
              onClick={() => copy(exportCode)}
            >
              [ {copied ? t.copied : t.copy} ]
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

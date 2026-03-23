"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AppTopBar } from "@/components/app-top-bar";
import { PushButton } from "@/components/ui/push-button";
import { DragParam } from "@/components/ui/drag-param";
import { ColorRow } from "@/components/ui/color-row";
import { useLanguage } from "@/lib/i18n";
import { downloadCanvas } from "@/lib/canvas-download";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/* ── defaults ─────────────────────────────────── */
const DEF = {
  depth: 1.6, bevel: 0.5, layerStep: 0.08,
  color: "#ffffff", bgColor: "#0d0d0d",
  exposure: 1.6, globalSat: 1.0,
  brightness: 1.0, contrast: 1.0, saturation: 1.0,
  warp: 0.0, rotation: 0,
  tile: 5, bump: 0.4,
};

/* ── scene state type ─────────────────────────── */
type SceneState = {
  renderer: any; camera: any; controls: any; scene: any;
  matcapTex: any; detailTex: any;
  mats: any[]; svgGroup: any | null;
  svgContent: string;
  depth: number; bevel: number; layerStep: number;
  uniforms: { uRotation: any; uBrightness: any; uContrast: any; uSaturation: any; uWarp: any };
  initCamPos: any | null;
};

/* ── texture → base64 helper ──────────────────── */
async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/* ── export code generator ────────────────────── */
async function generateExportCode(params: {
  depth: number; bevel: number; layerStep: number;
  color: string; bgColor: string;
  exposure: number; globalSat: number;
  brightness: number; contrast: number; saturation: number;
  warp: number; rotation: number;
  tile: number; bump: number;
}, svgContent: string): Promise<string> {
  const [matcapB64, noiseB64] = await Promise.all([
    fetchAsBase64('/badge/matcap.png'),
    fetchAsBase64('/badge/noise.png'),
  ]);

  const P = JSON.stringify(params);
  const SVG = JSON.stringify(svgContent);
  const MATCAP = JSON.stringify(matcapB64);
  const NOISE = JSON.stringify(noiseB64);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Badge</title>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.182.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.182.0/examples/jsm/"}}<\/script>
</head>
<body style="margin:0;overflow:hidden;background:${params.bgColor};">
<script type="module">
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const P = ${P};
const SVG = ${SVG};
const MATCAP_B64 = ${MATCAP};
const NOISE_B64 = ${NOISE};

(async () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color(P.bgColor));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = P.exposure;
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  if (P.globalSat !== 1) renderer.domElement.style.filter = \`saturate(\${P.globalSat})\`;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 200);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  const uniforms = {
    uRotation:   { value: P.rotation * Math.PI / 180 },
    uBrightness: { value: P.brightness },
    uContrast:   { value: P.contrast },
    uSaturation: { value: P.saturation },
    uWarp:       { value: P.warp },
  };

  const texLoader = new THREE.TextureLoader();
  const matcapTex = await new Promise(res => texLoader.load(MATCAP_B64, res));
  matcapTex.colorSpace = THREE.SRGBColorSpace;
  const detailTex = await new Promise(res => texLoader.load(NOISE_B64, res));
  detailTex.colorSpace = THREE.NoColorSpace;
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.repeat.set(P.tile, P.tile);

  const mats = []; let svgGroup = null;

  function buildFromSVG() {
    if (svgGroup) { scene.remove(svgGroup); svgGroup.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); mats.length = 0; }
    const svgData = new SVGLoader().parse(SVG);
    const allShapes = svgData.paths.flatMap(p => SVGLoader.createShapes(p));
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (const sh of allShapes) for (const pt of sh.getPoints(12)) { if (pt.x<minX) minX=pt.x; if (pt.x>maxX) maxX=pt.x; if (pt.y<minY) minY=pt.y; if (pt.y>maxY) maxY=pt.y; }
    if (!isFinite(minX)) { minX=0; minY=0; maxX=100; maxY=100; }
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    const sf=40/Math.max(maxX-minX,maxY-minY,1);
    const nm=new THREE.Matrix4().makeScale(sf,sf,1).multiply(new THREE.Matrix4().makeTranslation(-cx,cy,0));
    const shapeBBoxes=allShapes.map(sh=>{ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; for(const pt of sh.getPoints(12)){if(pt.x<x0)x0=pt.x;if(pt.x>x1)x1=pt.x;if(pt.y<y0)y0=pt.y;if(pt.y>y1)y1=pt.y;} return{x0,y0,x1,y1}; });
    const bboxOverlap=(a,b)=>!(a.x1<b.x0||b.x1<a.x0||a.y1<b.y0||b.y1<a.y0);
    const zLevels=[];
    for(let i=0;i<allShapes.length;i++){let level=0;for(let j=0;j<i;j++)if(bboxOverlap(shapeBBoxes[i],shapeBBoxes[j]))level=Math.max(level,zLevels[j]+1);zLevels.push(level);}
    const grp=new THREE.Group();
    for(let si=0;si<allShapes.length;si++){
      const shape=allShapes[si];
      const pts=shape.getPoints(20).map(p=>new THREE.Vector2(p.x,-p.y));
      const fl=new THREE.Shape(pts);
      for(const h of shape.holes)fl.holes.push(new THREE.Path(h.getPoints(20).map(p=>new THREE.Vector2(p.x,-p.y))));
      const geo=new THREE.ExtrudeGeometry([fl],{depth:Math.max(0.05,P.depth-P.bevel*2),bevelEnabled:P.bevel>0,bevelThickness:P.bevel,bevelSize:P.bevel/sf,bevelSegments:8,curveSegments:24});
      geo.applyMatrix4(nm);
      if(zLevels[si]>0)geo.translate(0,0,zLevels[si]*P.layerStep);
      geo.computeVertexNormals(); geo.computeBoundingBox();
      const bb=geo.boundingBox,pos=geo.attributes.position;
      const uvs=new Float32Array(pos.count*2);
      const ext=Math.max(bb.max.x-bb.min.x,bb.max.y-bb.min.y)||1;
      for(let i=0;i<pos.count;i++){uvs[i*2]=(pos.getX(i)-bb.min.x)/ext;uvs[i*2+1]=(pos.getY(i)-bb.min.y)/ext;}
      geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
      const mat=new THREE.MeshMatcapMaterial({matcap:matcapTex,color:new THREE.Color(P.color)});
      mat.bumpMap=detailTex; mat.bumpScale=P.bump;
      mat.onBeforeCompile=shader=>{
        shader.uniforms.uRotation=uniforms.uRotation; shader.uniforms.uBrightness=uniforms.uBrightness;
        shader.uniforms.uContrast=uniforms.uContrast; shader.uniforms.uSaturation=uniforms.uSaturation; shader.uniforms.uWarp=uniforms.uWarp;
        mat.userData.shader=shader;
        shader.fragmentShader=shader.fragmentShader
          .replace("#define MATCAP","#define MATCAP\\nuniform float uRotation; uniform float uBrightness; uniform float uContrast; uniform float uSaturation; uniform float uWarp;")
          .replace("\\tvec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;","\\tvec2 uvRaw = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\\n\\tfloat cosA = cos(uRotation), sinA = sin(uRotation);\\n\\tvec2 mc0 = uvRaw - 0.5;\\n\\tvec2 uv = vec2(cosA*mc0.x - sinA*mc0.y, sinA*mc0.x + cosA*mc0.y) + 0.5;\\n\\tuv = clamp(uv + uWarp * vec2(sin(uv.y*8.0), cos(uv.x*8.0)) * 0.06, 0.0, 1.0);")
          .replace("\\t\\tvec4 matcapColor = texture2D( matcap, uv );","\\t\\tvec4 matcapColor = texture2D( matcap, uv );\\n\\t\\tmatcapColor.rgb *= uBrightness;\\n\\t\\tmatcapColor.rgb = (matcapColor.rgb - 0.5) * uContrast + 0.5;\\n\\t\\tfloat mcLum = dot(matcapColor.rgb, vec3(0.299,0.587,0.114));\\n\\t\\tmatcapColor.rgb = mix(vec3(mcLum), matcapColor.rgb, uSaturation);\\n\\t\\tmatcapColor.rgb = clamp(matcapColor.rgb, 0.0, 1.0);");
      };
      mats.push(mat); grp.add(new THREE.Mesh(geo,mat));
    }
    const box=new THREE.Box3().setFromObject(grp);
    grp.position.sub(box.getCenter(new THREE.Vector3()));
    scene.add(grp); svgGroup=grp;
    const size=box.getSize(new THREE.Vector3()), dim=Math.max(size.x,size.y,size.z), dist=dim*2.2;
    camera.position.set(dist*0.18,dist*0.22,dist); camera.lookAt(0,0,0);
    controls.minDistance=dim*0.6; controls.maxDistance=dim*6; controls.target.set(0,0,0); controls.update();
  }

  buildFromSVG();

  scene.onBeforeRender = () => {
    renderer.toneMappingExposure = P.exposure;
    for (const m of mats) { const sh = m.userData.shader; if (!sh) continue; sh.uniforms.uRotation.value=uniforms.uRotation.value; sh.uniforms.uBrightness.value=uniforms.uBrightness.value; sh.uniforms.uContrast.value=uniforms.uContrast.value; sh.uniforms.uSaturation.value=uniforms.uSaturation.value; sh.uniforms.uWarp.value=uniforms.uWarp.value; }
  };

  window.addEventListener('resize', () => { renderer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });
  (function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); })();
})();
<\/script>
</body>
</html>`;
}

export default function BadgePage() {
  const { t } = useLanguage();
  const mountRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sc        = useRef<SceneState | null>(null);

  /* current-value refs (read inside Three.js closures) */
  const colorRef     = useRef(DEF.color);
  const bumpRef      = useRef(DEF.bump);
  const exposureRef  = useRef(DEF.exposure);

  /* React state (UI only) */
  const [depth,      setDepth]      = useState(DEF.depth);
  const [bevel,      setBevel]      = useState(DEF.bevel);
  const [color,      setColor]      = useState(DEF.color);
  const [bgColor,    setBgColor]    = useState(DEF.bgColor);
  const [exposure,   setExposure]   = useState(DEF.exposure);
  const [globalSat,  setGlobalSat]  = useState(DEF.globalSat);
  const [brightness, setBrightness] = useState(DEF.brightness);
  const [contrast,   setContrast]   = useState(DEF.contrast);
  const [saturation, setSaturation] = useState(DEF.saturation);
  const [warp,       setWarp]       = useState(DEF.warp);
  const [rotation,   setRotation]   = useState(DEF.rotation);
  const [tile,       setTile]       = useState(DEF.tile);
  const [bump,       setBump]       = useState(DEF.bump);
  const [layerStep,  setLayerStep]  = useState(DEF.layerStep);
  const [svgName,    setSvgName]    = useState<string | null>(null);
  const [hasLayers,  setHasLayers]  = useState(false);
  const [frontAnim,  setFrontAnim]  = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const [isExportingGLB, setIsExportingGLB] = useState(false);
  const outputFooterRef = useRef<HTMLDivElement>(null);
  const { copy, copied } = useClipboard();

  colorRef.current    = color;
  bumpRef.current     = bump;
  exposureRef.current = exposure;

  /* ── buildFromSVG ─────────────────────────────── */
  const buildFromSVG = useCallback(async () => {
    const s = sc.current;
    if (!s || !s.svgContent) return;
    const THREE      = await import("three");
    const { SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js");

    if (s.svgGroup) {
      s.scene.remove(s.svgGroup);
      s.svgGroup.traverse((o: any) => { if (o.isMesh) o.geometry.dispose(); });
      s.mats.length = 0;
    }

    const svgData   = new SVGLoader().parse(s.svgContent);
    const allShapes = svgData.paths.flatMap((p: any) => SVGLoader.createShapes(p));

    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (const sh of allShapes)
      for (const pt of sh.getPoints(12)) {
        if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
      }
    if (!isFinite(minX)) { minX=0; minY=0; maxX=100; maxY=100; }
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    const sf = 40 / Math.max(maxX-minX, maxY-minY, 1);
    const nm = new THREE.Matrix4()
      .makeScale(sf, sf, 1)
      .multiply(new THREE.Matrix4().makeTranslation(-cx, cy, 0));

    const shapeBBoxes = allShapes.map((sh: any) => {
      let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
      for (const pt of sh.getPoints(12)) {
        if (pt.x < x0) x0=pt.x; if (pt.x > x1) x1=pt.x;
        if (pt.y < y0) y0=pt.y; if (pt.y > y1) y1=pt.y;
      }
      return { x0, y0, x1, y1 };
    });
    const bboxOverlap = (a: any, b: any) =>
      !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);

    const zLevels: number[] = [];
    for (let i = 0; i < allShapes.length; i++) {
      let level = 0;
      for (let j = 0; j < i; j++) {
        if (bboxOverlap(shapeBBoxes[i], shapeBBoxes[j]))
          level = Math.max(level, zLevels[j] + 1);
      }
      zLevels.push(level);
    }
    setHasLayers(zLevels.some((l: number) => l > 0));
    const Z_STEP = s.layerStep;

    const grp = new THREE.Group();
    const d   = s.depth, bv = s.bevel;

    for (let si = 0; si < allShapes.length; si++) {
      const shape = allShapes[si];
      const pts = shape.getPoints(20).map((p: any) => new THREE.Vector2(p.x, -p.y));
      const fl  = new THREE.Shape(pts);
      for (const h of shape.holes)
        fl.holes.push(new THREE.Path(h.getPoints(20).map((p: any) => new THREE.Vector2(p.x, -p.y))));

      const geo = new THREE.ExtrudeGeometry([fl], {
        depth: Math.max(0.05, d - bv*2),
        bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv/sf,
        bevelSegments: 8, curveSegments: 24,
      });
      geo.applyMatrix4(nm);
      if (zLevels[si] > 0) geo.translate(0, 0, zLevels[si] * Z_STEP);
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb  = geo.boundingBox!;
      const pos = geo.attributes.position as any;
      const uvs = new Float32Array(pos.count * 2);
      const ext = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) || 1;
      for (let i = 0; i < pos.count; i++) {
        uvs[i*2]   = (pos.getX(i) - bb.min.x) / ext;
        uvs[i*2+1] = (pos.getY(i) - bb.min.y) / ext;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

      const mat = new THREE.MeshMatcapMaterial({
        matcap: s.matcapTex,
        color: new THREE.Color(colorRef.current),
      });
      mat.bumpMap   = s.detailTex;
      mat.bumpScale = bumpRef.current;

      const su = s.uniforms;
      mat.onBeforeCompile = (shader: any) => {
        shader.uniforms.uRotation   = su.uRotation;
        shader.uniforms.uBrightness = su.uBrightness;
        shader.uniforms.uContrast   = su.uContrast;
        shader.uniforms.uSaturation = su.uSaturation;
        shader.uniforms.uWarp       = su.uWarp;
        mat.userData.shader = shader;

        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#define MATCAP",
            "#define MATCAP\nuniform float uRotation; uniform float uBrightness; uniform float uContrast; uniform float uSaturation; uniform float uWarp;"
          )
          .replace(
            "\tvec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;",
            "\tvec2 uvRaw = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\n\tfloat cosA = cos(uRotation), sinA = sin(uRotation);\n\tvec2 mc0 = uvRaw - 0.5;\n\tvec2 uv = vec2(cosA*mc0.x - sinA*mc0.y, sinA*mc0.x + cosA*mc0.y) + 0.5;\n\tuv = clamp(uv + uWarp * vec2(sin(uv.y*8.0), cos(uv.x*8.0)) * 0.06, 0.0, 1.0);"
          )
          .replace(
            "\t\tvec4 matcapColor = texture2D( matcap, uv );",
            "\t\tvec4 matcapColor = texture2D( matcap, uv );\n\t\tmatcapColor.rgb *= uBrightness;\n\t\tmatcapColor.rgb = (matcapColor.rgb - 0.5) * uContrast + 0.5;\n\t\tfloat mcLum = dot(matcapColor.rgb, vec3(0.299,0.587,0.114));\n\t\tmatcapColor.rgb = mix(vec3(mcLum), matcapColor.rgb, uSaturation);\n\t\tmatcapColor.rgb = clamp(matcapColor.rgb, 0.0, 1.0);"
          );
      };

      s.mats.push(mat);
      grp.add(new THREE.Mesh(geo, mat));
    }

    const box = new THREE.Box3().setFromObject(grp);
    grp.position.sub(box.getCenter(new THREE.Vector3()));
    s.scene.add(grp);
    s.svgGroup = grp;

    const size = box.getSize(new THREE.Vector3());
    const dim  = Math.max(size.x, size.y, size.z);
    const dist = dim * 2.2;
    s.camera.position.set(dist*0.18, dist*0.22, dist);
    s.camera.lookAt(0, 0, 0);
    s.controls.minDistance = dim * 0.6;
    s.controls.maxDistance = dim * 6;
    s.controls.target.set(0, 0, 0);
    s.controls.update();
    s.initCamPos = s.camera.position.clone();
  }, []);

  /* ── Three.js init ────────────────────────────── */
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    let animId = 0;
    let destroyed = false;
    let rendererRef: any = null;
    let roRef: ResizeObserver | null = null;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (destroyed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      rendererRef = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(new THREE.Color(DEF.bgColor));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = DEF.exposure;
      container.appendChild(renderer.domElement);
      canvasRef.current = renderer.domElement;

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
      camera.position.set(0, 0, 200);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping   = true;
      controls.dampingFactor   = 0.07;
      controls.autoRotate      = true;
      controls.autoRotateSpeed = 1.2;
      controls.addEventListener("start", () => { controls.autoRotate = false; });

      const loader    = new THREE.TextureLoader();
      const matcapTex = await new Promise<any>(res => loader.load("/badge/matcap.png", res));
      matcapTex.colorSpace = THREE.SRGBColorSpace;
      const detailTex = await new Promise<any>(res => loader.load("/badge/noise.png", res));
      detailTex.colorSpace = THREE.NoColorSpace;
      detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
      detailTex.repeat.set(DEF.tile, DEF.tile);
      if (destroyed) return;

      const uniforms = {
        uRotation:   { value: 0.0 },
        uBrightness: { value: 1.0 },
        uContrast:   { value: 1.0 },
        uSaturation: { value: 1.0 },
        uWarp:       { value: 0.0 },
      };

      sc.current = {
        renderer, camera, controls, scene,
        matcapTex, detailTex,
        mats: [], svgGroup: null,
        svgContent: "",
        depth: DEF.depth, bevel: DEF.bevel, layerStep: DEF.layerStep,
        uniforms,
        initCamPos: null,
      };

      scene.onBeforeRender = () => {
        if (!sc.current) return;
        for (const m of sc.current.mats) {
          const shader = m.userData.shader;
          if (!shader) continue;
          shader.uniforms.uRotation.value   = uniforms.uRotation.value;
          shader.uniforms.uBrightness.value = uniforms.uBrightness.value;
          shader.uniforms.uContrast.value   = uniforms.uContrast.value;
          shader.uniforms.uSaturation.value = uniforms.uSaturation.value;
          shader.uniforms.uWarp.value       = uniforms.uWarp.value;
        }
        renderer.toneMappingExposure = exposureRef.current;
      };

      const ro = new ResizeObserver(() => {
        const w = container.clientWidth, h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      roRef = ro;
      ro.observe(container);
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();

      const animate = () => {
        if (destroyed) return;
        animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      setSceneReady(true);
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      roRef?.disconnect();
      if (rendererRef) {
        if (container.contains(rendererRef.domElement)) container.removeChild(rendererRef.domElement);
        rendererRef.dispose();
      }
      sc.current = null;
      setSceneReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── load default SVG once scene is ready ─────── */
  useEffect(() => {
    if (!sceneReady) return;
    fetch("/badge/Apple_logo.svg")
      .then(r => r.text())
      .then(svg => {
        if (!sc.current) return;
        sc.current.svgContent = svg;
        setSvgName("Apple_logo");
        buildFromSVG();
      });
  }, [sceneReady, buildFromSVG]);

  /* ── Front View animation ─────────────────────── */
  const handleFrontView = useCallback(() => {
    const s = sc.current;
    if (!s) return;
    s.controls.autoRotate = false;
    setFrontAnim(true);
    const startPos    = s.camera.position.clone();
    const startTarget = s.controls.target.clone();
    const endDist     = s.initCamPos ? s.initCamPos.length() : s.camera.position.length();
    const endPos      = { x: 0, y: 0, z: endDist };
    const endTarget   = { x: 0, y: 0, z: 0 };
    const dur = 600, t0 = performance.now();
    const tick = (now: number) => {
      const raw  = Math.min((now - t0) / dur, 1);
      const ease = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;
      s.camera.position.lerpVectors(startPos, endPos as any, ease);
      s.controls.target.lerpVectors(startTarget, endTarget as any, ease);
      s.controls.update();
      if (raw < 1) requestAnimationFrame(tick);
      else setFrontAnim(false);
    };
    requestAnimationFrame(tick);
  }, []);

  /* ── param handlers ───────────────────────────── */
  const updateDepth = useCallback((v: number) => {
    setDepth(v); if (sc.current) { sc.current.depth = v; buildFromSVG(); }
  }, [buildFromSVG]);

  const updateBevel = useCallback((v: number) => {
    setBevel(v); if (sc.current) { sc.current.bevel = v; buildFromSVG(); }
  }, [buildFromSVG]);

  const updateColor = useCallback((v: string) => {
    setColor(v); colorRef.current = v;
    if (sc.current) for (const m of sc.current.mats) m.color?.set(v);
  }, []);

  const updateBgColor = useCallback((v: string) => {
    setBgColor(v); sc.current?.renderer.setClearColor(v);
  }, []);

  const updateExposure = useCallback((v: number) => {
    setExposure(v); exposureRef.current = v;
  }, []);

  const updateGlobalSat = useCallback((v: number) => {
    setGlobalSat(v);
    if (canvasRef.current) canvasRef.current.style.filter = v === 1 ? "" : `saturate(${v})`;
  }, []);

  const updateBrightness = useCallback((v: number) => {
    setBrightness(v); if (sc.current) sc.current.uniforms.uBrightness.value = v;
  }, []);
  const updateContrast = useCallback((v: number) => {
    setContrast(v); if (sc.current) sc.current.uniforms.uContrast.value = v;
  }, []);
  const updateSaturation = useCallback((v: number) => {
    setSaturation(v); if (sc.current) sc.current.uniforms.uSaturation.value = v;
  }, []);
  const updateWarp = useCallback((v: number) => {
    setWarp(v); if (sc.current) sc.current.uniforms.uWarp.value = v;
  }, []);
  const updateRotation = useCallback((v: number) => {
    setRotation(v); if (sc.current) sc.current.uniforms.uRotation.value = v * Math.PI / 180;
  }, []);
  const updateTile = useCallback((v: number) => {
    setTile(v); sc.current?.detailTex?.repeat.set(v, v);
  }, []);
  const updateBump = useCallback((v: number) => {
    setBump(v); bumpRef.current = v;
    if (sc.current) for (const m of sc.current.mats) m.bumpScale = v;
  }, []);
  const updateLayerStep = useCallback((v: number) => {
    setLayerStep(v); if (sc.current) { sc.current.layerStep = v; buildFromSVG(); }
  }, [buildFromSVG]);

  /* ── SVG upload ───────────────────────────────── */
  const handleSvgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSvgName(file.name.replace(/\.svg$/i, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!sc.current) return;
      sc.current.svgContent = ev.target?.result as string;
      buildFromSVG();
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [buildFromSVG]);

  /* ── reset ────────────────────────────────────── */
  const handleReset = useCallback(() => {
    setDepth(DEF.depth);     if (sc.current) sc.current.depth = DEF.depth;
    setBevel(DEF.bevel);     if (sc.current) sc.current.bevel = DEF.bevel;
    setColor(DEF.color);     colorRef.current = DEF.color;
    if (sc.current) for (const m of sc.current.mats) m.color?.set(DEF.color);
    setBgColor(DEF.bgColor); sc.current?.renderer.setClearColor(DEF.bgColor);
    setExposure(DEF.exposure); exposureRef.current = DEF.exposure;
    setGlobalSat(DEF.globalSat);
    if (canvasRef.current) canvasRef.current.style.filter = "";
    setBrightness(DEF.brightness); if (sc.current) sc.current.uniforms.uBrightness.value = DEF.brightness;
    setContrast(DEF.contrast);     if (sc.current) sc.current.uniforms.uContrast.value   = DEF.contrast;
    setSaturation(DEF.saturation); if (sc.current) sc.current.uniforms.uSaturation.value = DEF.saturation;
    setWarp(DEF.warp);             if (sc.current) sc.current.uniforms.uWarp.value        = DEF.warp;
    setRotation(DEF.rotation);     if (sc.current) sc.current.uniforms.uRotation.value    = 0;
    setTile(DEF.tile);             sc.current?.detailTex?.repeat.set(DEF.tile, DEF.tile);
    setBump(DEF.bump); bumpRef.current = DEF.bump;
    if (sc.current) for (const m of sc.current.mats) m.bumpScale = DEF.bump;
    setLayerStep(DEF.layerStep); if (sc.current) sc.current.layerStep = DEF.layerStep;
    buildFromSVG();
  }, [buildFromSVG]);

  /* ── download ─────────────────────────────────── */
  const handleDownload = useCallback(() => {
    if (canvasRef.current) downloadCanvas(canvasRef.current, "badge.png");
  }, []);

  /* ── export ───────────────────────────────────── */
  const handleExport = useCallback(async () => {
    if (!sc.current?.svgContent) return;
    setIsExporting(true);
    try {
      const code = await generateExportCode(
        { depth, bevel, layerStep, color, bgColor, exposure, globalSat, brightness, contrast, saturation, warp, rotation, tile, bump },
        sc.current.svgContent,
      );
      setExportCode(code);
      setShowExport(true);
    } finally {
      setIsExporting(false);
    }
  }, [depth, bevel, layerStep, color, bgColor, exposure, globalSat, brightness, contrast, saturation, warp, rotation, tile, bump]);

  /* ── GLB export ───────────────────────────────── */
  const handleExportGLB = useCallback(async () => {
    const s = sc.current;
    if (!s?.svgGroup) return;
    setIsExportingGLB(true);
    try {
      const THREE = await import("three");
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");

      // MeshMatcapMaterial is non-standard GLTF → use MeshStandardMaterial
      // so matcap/bump textures embed properly in the GLB
      const origMats: any[] = [];
      const cleanMats: any[] = [];
      s.svgGroup.traverse((obj: any) => {
        if (!obj.isMesh) return;
        origMats.push(obj.material);
        const m = new THREE.MeshStandardMaterial({
          map:       s.matcapTex,   // matcap as base color → embeds in GLB
          bumpMap:   s.detailTex,
          bumpScale: bumpRef.current,
          color:     new THREE.Color(colorRef.current),
          roughness: 0.4,
          metalness: 0.6,
        });
        cleanMats.push(m);
        obj.material = m;
      });

      const exporter = new GLTFExporter();
      exporter.parse(
        s.svgGroup,
        async (result: ArrayBuffer | { [key: string]: unknown }) => {
          if (!(result instanceof ArrayBuffer)) return;
          // Restore original materials
          let i = 0;
          s.svgGroup!.traverse((obj: any) => {
            if (!obj.isMesh) return;
            obj.material = origMats[i];
            cleanMats[i].dispose();
            i++;
          });

          const JSZip = (await import("jszip")).default;
          const zip  = new JSZip();
          const base = svgName?.replace(/\.svg$/i, "") || "badge";
          zip.file(`${base}.glb`, result);

          const matcapBlob = await fetch("/badge/matcap.png").then(r => r.blob());
          zip.file("matcap.png", matcapBlob);
          if (bumpRef.current > 0) {
            const noiseBlob = await fetch("/badge/noise.png").then(r => r.blob());
            zip.file("noise.png", noiseBlob);
          }

          const zipBlob = await zip.generateAsync({ type: "blob" });
          const url     = URL.createObjectURL(zipBlob);
          const a       = document.createElement("a");
          a.href        = url;
          a.download    = `${base}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          setIsExportingGLB(false);
        },
        (err: unknown) => {
          console.error("GLTFExporter error", err);
          setIsExportingGLB(false);
        },
        { binary: true },
      );
    } catch (e) {
      console.error(e);
      setIsExportingGLB(false);
    }
  }, [svgName]);

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
    <div className="fixed inset-0 flex flex-col md:flex-row bg-[#d8d8da]">
      {/* canvas */}
      <div ref={mountRef} className="h-[55vh] md:h-auto md:flex-1 relative overflow-hidden bg-[#0a0a0a]">
        <AppTopBar />
        {!svgName && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/20 select-none">
              {t.badge.uploadPrompt}
            </p>
          </div>
        )}
        {svgName && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <PushButton variant="dark" size="sm" onClick={handleFrontView} disabled={frontAnim}>
              [ {t.badge.frontView} ]
            </PushButton>
          </div>
        )}
      </div>

      {/* sidebar */}
      <aside className="md:w-[320px] bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] border-l border-[#bbbbbe] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-[rgba(0,0,0,0.12)] shrink-0">
          <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333] select-none">{t.apps.badge.name}</span>
          <PushButton size="sm" variant="dark" onClick={handleReset}>[ {t.reset} ]</PushButton>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Shape */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.badge.shape}</span>
            <PushButton variant="dark" className="w-full text-center" onClick={() => fileInputRef.current?.click()}>
              [ {svgName ?? t.badge.uploadSvg} ]
            </PushButton>
            <input ref={fileInputRef} type="file" accept=".svg" className="hidden" onChange={handleSvgUpload} />
            <DragParam label={t.badge.depth}  value={depth}     min={0.5} max={10} step={0.1}  defaultValue={DEF.depth}     onChange={updateDepth} />
            <DragParam label={t.badge.bevel}  value={bevel}     min={0}   max={2}  step={0.05} defaultValue={DEF.bevel}     onChange={updateBevel} />
            {hasLayers && <DragParam label={t.badge.layer} value={layerStep} min={0} max={1} step={0.01} defaultValue={DEF.layerStep} onChange={updateLayerStep} />}
          </div>

          {/* Customize */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.badge.customize}</span>
            <ColorRow label={t.shader.color1} value={color}   onChange={updateColor} />
            <ColorRow label={t.shader.bgColor} value={bgColor} onChange={updateBgColor} />
            <DragParam label={t.badge.exposure}   value={exposure}  min={0.1} max={4} step={0.05} defaultValue={DEF.exposure}  onChange={updateExposure} />
            <DragParam label={t.badge.saturation} value={globalSat} min={0}   max={3} step={0.05} defaultValue={DEF.globalSat} onChange={updateGlobalSat} />
          </div>

          {/* Matcap */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.badge.matcap}</span>
            <DragParam label={t.badge.rotation}   value={rotation}   min={0}   max={360} step={1}    defaultValue={DEF.rotation}   onChange={updateRotation} />
            <DragParam label={t.badge.brightness}  value={brightness} min={0.1} max={3}   step={0.05} defaultValue={DEF.brightness} onChange={updateBrightness} />
            <DragParam label={t.badge.contrast}    value={contrast}   min={0.1} max={3}   step={0.05} defaultValue={DEF.contrast}   onChange={updateContrast} />
            <DragParam label={t.badge.saturation}  value={saturation} min={0}   max={3}   step={0.05} defaultValue={DEF.saturation} onChange={updateSaturation} />
            <DragParam label={t.badge.warp}        value={warp}       min={0}   max={1}   step={0.02} defaultValue={DEF.warp}       onChange={updateWarp} />
          </div>

          {/* Detail */}
          <div className="px-5 py-4 flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.badge.detail}</span>
            <DragParam label={t.badge.tile} value={tile} min={1} max={30}  step={1}    defaultValue={DEF.tile} onChange={updateTile} />
            <DragParam label={t.badge.bump} value={bump} min={0} max={1.5} step={0.05} defaultValue={DEF.bump} onChange={updateBump} />
          </div>

        </div>

        {/* footer */}
        <div ref={outputFooterRef} className="shrink-0 px-5 py-4 border-t border-[rgba(0,0,0,0.12)] relative">
          <PushButton
            variant="dark"
            className="w-full text-center"
            disabled={!svgName}
            onClick={() => setShowOutputMenu(v => !v)}
          >
            [ {t.badge.output} ]
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
                className="w-full px-4 py-3 text-left font-mono text-[12px] uppercase tracking-[0.12em] text-[#e0e0e2] hover:bg-[rgba(255,255,255,0.08)] transition-colors select-none disabled:opacity-40 border-b border-[rgba(255,255,255,0.06)]"
                disabled={isExporting}
                onClick={() => { setShowOutputMenu(false); handleExport(); }}
              >
                {isExporting ? "..." : "HTML — Code"}
              </button>
              <button
                className="w-full px-4 py-3 text-left font-mono text-[12px] uppercase tracking-[0.12em] text-[#e0e0e2] hover:bg-[rgba(255,255,255,0.08)] transition-colors select-none disabled:opacity-40"
                disabled={isExportingGLB}
                onClick={() => { setShowOutputMenu(false); handleExportGLB(); }}
              >
                {isExportingGLB ? "..." : "GLB — 3D"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>{t.apps.badge.name} — Export</DialogTitle>
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

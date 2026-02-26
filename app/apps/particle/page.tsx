"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
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
import { DragParam } from "@/components/ui/drag-param";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { PushButton } from "@/components/ui/push-button";
import { hexToRGB } from "@/lib/color-utils";
import { downloadCanvas } from "@/lib/canvas-download";
import { useClipboard } from "@/hooks/use-clipboard";

/* ------------------------------------------------------------------ */
/*  Shaders                                                           */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = `
attribute vec3 aTargetPosition;
attribute float aRandom;
attribute float aSize;

uniform float uTime;
uniform float uParticleSize;
uniform float uSizeVariation;
uniform float uSpeed;
uniform float uNoiseScale;
uniform float uTurbulence;
uniform int uAnimMode;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform float uFormationSpread;
uniform float uScatter;
uniform float uScatterDistance;
uniform float uFormationScale;
uniform vec2 uMouse;
uniform float uMouseGravity;
uniform float uMouseRadius;
uniform float uMouseActive;
uniform vec2 uResolution;

varying float vRandom;
varying float vBrightness;
varying float vColorMix;

uniform float uColorSpeed;
uniform float uColorFreq;

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

void main() {
    float t = uTime * uSpeed;
    float seed = aRandom * 100.0;
    float phase = aRandom * 6.28318;

    // --- Compute target position ---
    vec3 target = aTargetPosition;
    float sc = uFormationScale;
    if (uFormationSpread > 0.0) {
        target.x += snoise(vec2(aRandom * 50.0, t * 0.3)) * uFormationSpread * 0.12 * sc;
        target.y += snoise(vec2(aRandom * 50.0 + 100.0, t * 0.3)) * uFormationSpread * 0.12 * sc;
    }

    // Scatter
    float scatterMask = smoothstep(1.0 - uScatter - 0.15, 1.0 - uScatter + 0.15, aRandom);
    float pDist = uScatterDistance * sc * (0.15 + 0.85 * fract(aRandom * 127.1));
    target.x += snoise(vec2(aRandom * 37.0, t * 0.2 + 33.0)) * pDist * scatterMask;
    target.y += snoise(vec2(aRandom * 41.0 + 13.0, t * 0.2 + 77.0)) * pDist * scatterMask;

    // --- Animation offset ---
    vec2 anim = vec2(0.0);

    if (uAnimMode == 0) {
        // Flow — multi-octave simplex drift
        float nx = snoise(target.xy * uNoiseScale * 0.8 + t * 0.3 + seed)
                 + 0.5 * snoise(target.xy * uNoiseScale * 1.6 + t * 0.5 + seed + 50.0)
                 + 0.25 * snoise(target.xy * uNoiseScale * 3.2 + t * 0.7 + seed + 100.0);
        float ny = snoise(target.xy * uNoiseScale * 0.8 + t * 0.3 + seed + 200.0)
                 + 0.5 * snoise(target.xy * uNoiseScale * 1.6 + t * 0.5 + seed + 250.0)
                 + 0.25 * snoise(target.xy * uNoiseScale * 3.2 + t * 0.7 + seed + 300.0);
        anim = vec2(nx, ny) * uTurbulence * 0.035;
    } else if (uAnimMode == 1) {
        // Wave — gentle oscillation with noise modulation
        float nMod = snoise(target.xy * uNoiseScale + t * 0.2 + seed) * 0.5 + 0.5;
        anim.x = sin(target.y * uWaveFrequency * uNoiseScale * 0.5 + t * 2.0 + phase) * uWaveAmplitude * 0.04 * (0.5 + nMod);
        anim.y = cos(target.x * uWaveFrequency * uNoiseScale * 0.35 + t * 1.5 + phase) * uWaveAmplitude * 0.03 * (0.5 + nMod);
    } else if (uAnimMode == 3) {
        // Diffusion — radial pulse with noise
        float d = length(target.xy);
        float pulse = sin(d * 6.0 - t * 2.0 + phase) * 0.03 * uTurbulence;
        vec2 radial = target.xy / max(d, 0.01);
        anim = radial * pulse;
        anim.x += snoise(target.xy * uNoiseScale * 1.5 + t * 0.3 + seed) * 0.02 * uTurbulence;
        anim.y += snoise(target.xy * uNoiseScale * 1.5 + t * 0.3 + seed + 100.0) * 0.02 * uTurbulence;
    }

    // --- Final position ---
    vec3 pos = target + vec3(anim * sc, 0.0);

    // Mouse interaction — gravitational attraction (1/r force like reference site)
    // uMouseGravity ramps up when mouse is slow/still, decreases when fast
    vec2 mouseDisp = vec2(0.0);
    float mouseProximity = 0.0;
    if (uMouseActive > 0.5 && uMouseGravity > 0.001) {
        vec2 toMouse = uMouse - pos.xy;
        float dist = length(toMouse);
        vec2 dir = toMouse / max(dist, 0.001);

        // 1/r gravitational force — stronger when mouse lingers
        float gravity = uMouseGravity / max(dist, 0.06);
        // Soft distance fade
        float fade = exp(-dist * dist / (uMouseRadius * uMouseRadius * 3.0));
        float force = gravity * fade;

        // Per-particle variation
        float variation = 0.5 + 1.0 * fract(aRandom * 127.1);

        mouseDisp = dir * force * variation * 0.04;
        mouseProximity = fade * uMouseGravity;
    }
    pos.xy += mouseDisp;

    // Size — smaller base with variation
    float sizeVar = mix(1.0, 0.3 + aSize * 1.4, uSizeVariation);
    float pixelSize = uParticleSize * sizeVar;
    pixelSize *= uResolution.y / 800.0;

    vRandom = aRandom;
    vBrightness = 1.0 + mouseProximity * 0.15;

    // Color gradient — position-based blend so nearby particles share color
    vColorMix = sin(uColorSpeed * uTime + uColorFreq * (pos.x + pos.y) * 3.14159) * 0.5 + 0.5;

    // Aspect ratio correction
    float aspect = uResolution.x / uResolution.y;
    gl_Position = vec4(pos.x / aspect, pos.y, 0.0, 1.0);
    gl_PointSize = pixelSize;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform float uOpacity;
uniform vec3 uColors[5];
uniform int uColorCount;

varying float vRandom;
varying float vBrightness;
varying float vColorMix;

void main() {
    // Cosine-based soft alpha (same as reference site)
    vec2 tmpCoord = 0.5 * cos(6.28318 * gl_PointCoord + 3.14159) + 0.5;
    float alpha = tmpCoord.x * tmpCoord.y;

    // Smooth gradient blend through color palette using vColorMix
    vec3 col;
    if (uColorCount <= 1) {
        col = uColors[0];
    } else if (uColorCount == 2) {
        // Reference site style: simple mix between 2 colors
        col = mix(uColors[0], uColors[1], vColorMix);
    } else {
        // Multi-color: map vColorMix across palette
        float t = vColorMix * float(uColorCount - 1);
        int idx = int(floor(t));
        float f = fract(t);
        vec3 c0 = uColors[0];
        vec3 c1 = uColors[0];
        if (idx == 0) { c0 = uColors[0]; c1 = uColors[1]; }
        else if (idx == 1) { c0 = uColors[1]; c1 = uColors[min(2, uColorCount - 1)]; }
        else if (idx == 2) { c0 = uColors[2]; c1 = uColors[min(3, uColorCount - 1)]; }
        else if (idx == 3) { c0 = uColors[3]; c1 = uColors[min(4, uColorCount - 1)]; }
        else { c0 = uColors[4]; c1 = uColors[4]; }
        col = mix(c0, c1, f);
    }
    col *= vBrightness;

    gl_FragColor = vec4(col, alpha * uOpacity);
}
`;

/* ------------------------------------------------------------------ */
/*  Types & defaults                                                  */
/* ------------------------------------------------------------------ */

interface ParticleParams {
  particleCount: number;
  particleSize: number;
  sizeVariation: number;
  colorBg: string;
  colorBgTransparent: boolean;
  colors: string[];
  colorSpeed: number;
  colorFreq: number;
  blending: number; // THREE.NormalBlending=1, AdditiveBlending=2, SubtractiveBlending=3, MultiplyBlending=4
  opacity: number;
  animMode: number;
  speed: number;
  noiseScale: number;
  turbulence: number;
  waveFrequency: number;
  waveAmplitude: number;
  formationMode: number;
  inputText: string;
  formationScale: number;
  formationSpread: number;
  scatter: number;
  scatterDistance: number;
  mouseInteraction: boolean;
  mouseGravity: number;
  svgData: string;
}

const DEFAULT_PARAMS: ParticleParams = {
  particleCount: 80000,
  particleSize: 2.5,
  sizeVariation: 0.5,
  colorBg: "#050510",
  colorBgTransparent: false,
  colors: ["#f472b6", "#60a5fa"],
  colorSpeed: 2.0,
  colorFreq: 1.0,
  blending: 1,
  opacity: 0.2,
  animMode: 0,
  speed: 0.5,
  noiseScale: 2.0,
  turbulence: 0.5,
  waveFrequency: 8,
  waveAmplitude: 0.25,
  formationMode: 1,
  inputText: "",
  formationScale: 1.0,
  formationSpread: 0.25,
  scatter: 0.5,
  scatterDistance: 0.15,
  mouseInteraction: true,
  mouseGravity: 1.0,
  svgData: "",
};

const MAX_PARTICLES = 500000;

const PARTICLE_COUNT_VALUES = [
  { value: "30000",  ja: "3万",  en: "30K" },
  { value: "50000",  ja: "5万",  en: "50K" },
  { value: "80000",  ja: "8万",  en: "80K" },
  { value: "100000", ja: "10万", en: "100K" },
  { value: "150000", ja: "15万", en: "150K" },
  { value: "200000", ja: "20万", en: "200K" },
  { value: "300000", ja: "30万", en: "300K" },
  { value: "500000", ja: "50万", en: "500K" },
];

const ANIM_MODE_VALUES = ["0", "1", "3"] as const;
const FORMATION_MODE_VALUES = [
  { value: "0" }, { value: "1" }, { value: "2" },
  { value: "4" }, { value: "5" }, { value: "6" },
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Render content to offscreen canvas and sample pixel positions */
function sampleCanvasPixels(
  count: number,
  scale: number,
  drawFn: (ctx: CanvasRenderingContext2D, size: number) => void
): Float32Array | null {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  drawFn(ctx, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const candidates: [number, number][] = [];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      if (imageData.data[idx + 3] > 128) {
        candidates.push([px, py]);
      }
    }
  }

  if (candidates.length === 0) return null;

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [px, py] = candidates[Math.floor(Math.random() * candidates.length)];
    positions[i * 3] = (px / size - 0.5) * 2 * scale * 0.5;
    positions[i * 3 + 1] = (0.5 - py / size) * 2 * scale * 0.5;
    positions[i * 3 + 2] = 0;
  }
  return positions;
}

/** Generate target positions for formation shapes */
function generateFormation(
  mode: number,
  count: number,
  scale: number,
  text: string,
  svgImage?: HTMLImageElement | null
): Float32Array {
  const positions = new Float32Array(count * 3);

  if (mode === 0) {
    // Free: random spread
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = 0;
    }
    return positions;
  } else if (mode === 1) {
    // Sphere: surface distribution projected to 2D
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.4 * scale;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.9 + Math.cos(phi) * r * 0.3;
      positions[i * 3 + 2] = 0;
    }
    return positions;
  } else if (mode === 2) {
    // Cube: surface distribution
    for (let i = 0; i < count; i++) {
      const face = Math.floor(Math.random() * 6);
      const u = (Math.random() - 0.5) * 2;
      const v = (Math.random() - 0.5) * 2;
      const s = 0.3 * scale;
      let x = 0, y = 0;
      if (face === 0) { x = u * s; y = v * s; } // front
      else if (face === 1) { x = u * s; y = s; } // top edge
      else if (face === 2) { x = u * s; y = -s; } // bottom edge
      else if (face === 3) { x = s; y = v * s; } // right edge
      else if (face === 4) { x = -s; y = v * s; } // left edge
      else { x = u * s; y = v * s * 0.8; } // back (slightly smaller for depth)
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0;
    }
    return positions;
  } else if (mode === 4) {
    // Ring
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = (0.3 + (Math.random() - 0.5) * 0.06) * scale;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(theta) * r;
      positions[i * 3 + 2] = 0;
    }
    return positions;
  } else if (mode === 5) {
    const result = sampleCanvasPixels(count, scale, (ctx, size) => {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const displayText = text || "A";
      let fontSize = displayText.length <= 2 ? 280 : displayText.length <= 4 ? 180 : 120;
      const maxWidth = size * 0.9;
      ctx.font = `bold ${fontSize}px "SF Mono", "Fira Code", monospace`;
      while (ctx.measureText(displayText).width > maxWidth && fontSize > 40) {
        fontSize -= 10;
        ctx.font = `bold ${fontSize}px "SF Mono", "Fira Code", monospace`;
      }
      ctx.fillText(displayText, size / 2, size / 2, maxWidth);
    });
    if (result) return result;
  } else if (mode === 6 && svgImage) {
    const result = sampleCanvasPixels(count, scale, (ctx, size) => {
      ctx.drawImage(svgImage, 0, 0, size, size);
    });
    if (result) return result;
  }

  // Fallback
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 2] = 0;
  }
  return positions;
}

/* ------------------------------------------------------------------ */
/*  Export code generator                                              */
/* ------------------------------------------------------------------ */

function colorsToUniform(colors: string[] | undefined): number[][] {
  const cols = colors && colors.length > 0 ? colors : ["#7b68ee"];
  const result: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const c = cols[Math.min(i, cols.length - 1)];
    result.push(hexToRGB(c));
  }
  return result;
}

function generateFormationCode(mode: number, scale: number, text: string, svgData: string): string {
  const s = scale.toFixed(2);
  const pixelSampleCode = (srcSetup: string) =>
    `{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.clearRect(0,0,512,512);${srcSetup}const d=x.getImageData(0,0,512,512),cands=[];for(let py=0;py<512;py++)for(let px=0;px<512;px++)if(d.data[(py*512+px)*4+3]>128)cands.push([px,py]);if(cands.length)for(let i=0;i<MAX;i++){const[px,py]=cands[Math.floor(Math.random()*cands.length)];tgt[i*3]=(px/512-0.5)*2*${s}*0.5;tgt[i*3+1]=(0.5-py/512)*2*${s}*0.5;}}`;
  switch (mode) {
    case 1: // Sphere
      return `for(let i=0;i<MAX;i++){const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=0.4*${s};tgt[i*3]=Math.sin(ph)*Math.cos(th)*r;tgt[i*3+1]=Math.sin(ph)*Math.sin(th)*r*0.9+Math.cos(ph)*r*0.3;}`;
    case 2: // Cube
      return `for(let i=0;i<MAX;i++){const f=Math.floor(Math.random()*6),u=(Math.random()-0.5)*2,v=(Math.random()-0.5)*2,s=0.3*${s};let x=0,y=0;if(f===0){x=u*s;y=v*s;}else if(f===1){x=u*s;y=s;}else if(f===2){x=u*s;y=-s;}else if(f===3){x=s;y=v*s;}else if(f===4){x=-s;y=v*s;}else{x=u*s;y=v*s*0.8;}tgt[i*3]=x;tgt[i*3+1]=y;}`;
    case 4: // Ring
      return `for(let i=0;i<MAX;i++){const th=Math.random()*Math.PI*2,r=(0.3+(Math.random()-0.5)*0.06)*${s};tgt[i*3]=Math.cos(th)*r;tgt[i*3+1]=Math.sin(th)*r;}`;
    case 5: // Text
      return pixelSampleCode(`x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';const txt=${JSON.stringify(text || "A")};let fs=txt.length<=2?280:txt.length<=4?180:120;x.font='bold '+fs+'px sans-serif';while(x.measureText(txt).width>460&&fs>40){fs-=10;x.font='bold '+fs+'px sans-serif';}x.fillText(txt,256,256,460);`);
    case 6: // SVG
      if (svgData) {
        return `{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.clearRect(0,0,512,512);x.drawImage(img,0,0,512,512);const d=x.getImageData(0,0,512,512),cands=[];for(let py=0;py<512;py++)for(let px=0;px<512;px++)if(d.data[(py*512+px)*4+3]>128)cands.push([px,py]);if(cands.length)for(let i=0;i<MAX;i++){const[px,py]=cands[Math.floor(Math.random()*cands.length)];tgt[i*3]=(px/512-0.5)*2*${s}*0.5;tgt[i*3+1]=(0.5-py/512)*2*${s}*0.5;}const a=geo.getAttribute('aTargetPosition');a.array.set(tgt);a.needsUpdate=true;};img.src="${svgData}";}`;
      }
      return `for(let i=0;i<MAX;i++){tgt[i*3]=(Math.random()-0.5)*4;tgt[i*3+1]=(Math.random()-0.5)*2;}`;
    default: // Free
      return `for(let i=0;i<MAX;i++){tgt[i*3]=(Math.random()-0.5)*4;tgt[i*3+1]=(Math.random()-0.5)*2;}`;
  }
}

function generateExportCode(params: ParticleParams): string {
  const colorData = colorsToUniform(params.colors);
  const cols = params.colors && params.colors.length > 0 ? params.colors : ["#f472b6"];
  const [br, bg, bb] = hexToRGB(params.colorBg);
  const transparent = params.colorBgTransparent;
  const formationCode = generateFormationCode(params.formationMode, params.formationScale, params.inputText, params.svgData);
  return `<!DOCTYPE html>
<html lang="ja">
<body style="margin:0;overflow:hidden;background:${transparent ? "transparent" : params.colorBg};">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
    const MAX = ${params.particleCount};
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: ${transparent} });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    ${transparent ? "renderer.setClearColor(0x000000, 0);" : `renderer.setClearColor(new THREE.Color(${br.toFixed(3)}, ${bg.toFixed(3)}, ${bb.toFixed(3)}));`}
    document.body.appendChild(renderer.domElement);

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    const tgt = new Float32Array(MAX * 3);
    const rnd = new Float32Array(MAX);
    const siz = new Float32Array(MAX);
    const aspect = innerWidth / innerHeight;
    for (let i = 0; i < MAX; i++) {
        pos[i*3] = (Math.random()-0.5)*2*aspect;
        pos[i*3+1] = (Math.random()-0.5)*2;
        rnd[i] = Math.random();
        siz[i] = Math.random();
    }
    ${formationCode}
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTargetPosition', new THREE.BufferAttribute(tgt, 3));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setDrawRange(0, MAX);

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: {value:0}, uResolution: {value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height)},
            uParticleSize: {value:${params.particleSize}}, uSizeVariation: {value:${params.sizeVariation}},
            uOpacity: {value:${params.opacity}},
            uColors: {value: [${colorData.map(c => `new THREE.Vector3(${c[0].toFixed(3)},${c[1].toFixed(3)},${c[2].toFixed(3)})`).join(",")}]},
            uColorCount: {value:${cols.length}},
            uColorSpeed: {value:${params.colorSpeed}},
            uColorFreq: {value:${params.colorFreq}},
            uAnimMode: {value:${params.animMode}}, uSpeed: {value:${params.speed}},
            uNoiseScale: {value:${params.noiseScale}}, uTurbulence: {value:${params.turbulence}},
            uWaveFrequency: {value:${params.waveFrequency}}, uWaveAmplitude: {value:${params.waveAmplitude}},
            uFormationSpread: {value:${params.formationSpread}}, uScatter: {value:${params.scatter}}, uScatterDistance: {value:${params.scatterDistance}}, uFormationScale: {value:${params.formationScale}},
            uMouse: {value: new THREE.Vector2(-10,-10)},
            uMouseGravity: {value:0},
            uMouseRadius: {value:0.35},
            uMouseActive: {value:0},
        },
        vertexShader: \`${VERTEX_SHADER}\`,
        fragmentShader: \`${FRAGMENT_SHADER}\`,
        transparent: true, depthWrite: false, blending: ${params.blending},
    });
    scene.add(new THREE.Points(geo, mat));
    addEventListener('resize', () => {
        renderer.setSize(innerWidth, innerHeight);
        mat.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    });
    ${params.mouseInteraction ? `
    let mX=-10,mY=-10,pX=-10,pY=-10,mSpd=0,mGrv=0,mAct=false;
    const cv=renderer.domElement;
    cv.addEventListener('mousemove',(e)=>{
        mAct=true;const r=cv.getBoundingClientRect(),a=r.width/r.height;
        pX=mX;pY=mY;mX=((e.clientX-r.left)/r.width*2-1)*a;mY=-((e.clientY-r.top)/r.height*2-1);
    });
    cv.addEventListener('mouseleave',()=>{mAct=false;});
    ` : ""}
    let lt=0;
    function animate(t) {
        const dt=Math.min((t-lt)*0.001,0.05);lt=t;
        mat.uniforms.uTime.value = t * 0.001;
        ${params.mouseInteraction ? `
        const dx=mX-pX,dy=mY-pY;mSpd+=(Math.sqrt(dx*dx+dy*dy)-mSpd)*0.15;pX=mX;pY=mY;
        if(mAct){const tg=1/(1+mSpd*80),rs=tg>mGrv?1.5*dt:6*dt;mGrv+=(tg-mGrv)*Math.min(rs,1);}
        else{mGrv*=Math.max(1-3*dt,0);}
        mat.uniforms.uMouse.value.set(mX,mY);
        mat.uniforms.uMouseGravity.value=mGrv*${params.mouseGravity.toFixed(1)};
        mat.uniforms.uMouseActive.value=mAct?1:0;
        ` : ""}
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
<\/script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

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
      <Label className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#242424]">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 border border-[#242424] bg-transparent cursor-pointer p-0 color-swatch"
        />
        <span className="text-[12px] font-mono text-[#242424]">
          {value}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function ParticlePage() {
  const { lang, toggle, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderer: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    camera: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geometry: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: any;
  } | null>(null);

  const [params, setParams] = useState<ParticleParams>({ ...DEFAULT_PARAMS });
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const textDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedText, setDebouncedText] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const { copy, copied } = useClipboard();
  const [svgFileName, setSvgFileName] = useState("");
  const svgInputRef = useRef<HTMLInputElement>(null);
  const svgImageRef = useRef<HTMLImageElement | null>(null);

  const updateParam = useCallback(
    <K extends keyof ParticleParams>(key: K, value: ParticleParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS, colors: [...DEFAULT_PARAMS.colors] });
  }, []);

  // Handle SVG file upload
  const handleSvgUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSvgFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const svgText = reader.result as string;
        const blob = new Blob([svgText], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = 512;
          c.height = 512;
          const ctx = c.getContext("2d");
          if (ctx) {
            const padding = 512 * 0.1;
            const drawSize = 512 - padding * 2;
            const aspect = img.naturalWidth / img.naturalHeight || 1;
            let dw = drawSize,
              dh = drawSize;
            if (aspect > 1) dh = drawSize / aspect;
            else dw = drawSize * aspect;
            ctx.drawImage(img, (512 - dw) / 2, (512 - dh) / 2, dw, dh);
            const dataUrl = c.toDataURL("image/png");
            const preImg = new Image();
            preImg.onload = () => {
              svgImageRef.current = preImg;
              updateParam("svgData", dataUrl);
              updateParam("formationMode", 6);
            };
            preImg.src = dataUrl;
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [updateParam]
  );

  // Debounce text input
  useEffect(() => {
    if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
    textDebounceRef.current = setTimeout(() => {
      setDebouncedText(params.inputText);
    }, 300);
    return () => {
      if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
    };
  }, [params.inputText]);

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
        alpha: true,
      });
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);
      renderer.setClearColor(DEFAULT_PARAMS.colorBg, 1);

      const geometry = new THREE.BufferGeometry();
      const posArray = new Float32Array(MAX_PARTICLES * 3);
      const targetArray = new Float32Array(MAX_PARTICLES * 3);
      const randomArray = new Float32Array(MAX_PARTICLES);
      const sizeArray = new Float32Array(MAX_PARTICLES);

      const initAspect = container.clientWidth / container.clientHeight;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        posArray[i * 3] = (Math.random() - 0.5) * 2 * initAspect;
        posArray[i * 3 + 1] = (Math.random() - 0.5) * 2;
        posArray[i * 3 + 2] = 0;
        randomArray[i] = Math.random();
        sizeArray[i] = Math.random();
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
      geometry.setAttribute("aTargetPosition", new THREE.BufferAttribute(targetArray, 3));
      geometry.setAttribute("aRandom", new THREE.BufferAttribute(randomArray, 1));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizeArray, 1));
      geometry.setDrawRange(0, DEFAULT_PARAMS.particleCount);

      const initColors = colorsToUniform(DEFAULT_PARAMS.colors).map(
        (c) => new THREE.Vector3(c[0], c[1], c[2])
      );

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uResolution: {
            value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height),
          },
          uParticleSize: { value: DEFAULT_PARAMS.particleSize },
          uSizeVariation: { value: DEFAULT_PARAMS.sizeVariation },
          uOpacity: { value: DEFAULT_PARAMS.opacity },
          uColors: { value: initColors },
          uColorCount: { value: DEFAULT_PARAMS.colors.length },
          uColorSpeed: { value: DEFAULT_PARAMS.colorSpeed },
          uColorFreq: { value: DEFAULT_PARAMS.colorFreq },
          uAnimMode: { value: DEFAULT_PARAMS.animMode },
          uSpeed: { value: DEFAULT_PARAMS.speed },
          uNoiseScale: { value: DEFAULT_PARAMS.noiseScale },
          uTurbulence: { value: DEFAULT_PARAMS.turbulence },
          uWaveFrequency: { value: DEFAULT_PARAMS.waveFrequency },
          uWaveAmplitude: { value: DEFAULT_PARAMS.waveAmplitude },
          uFormationSpread: { value: DEFAULT_PARAMS.formationSpread },
          uScatter: { value: DEFAULT_PARAMS.scatter },
          uScatterDistance: { value: DEFAULT_PARAMS.scatterDistance },
          uFormationScale: { value: DEFAULT_PARAMS.formationScale },
          uMouse: { value: new THREE.Vector2(-10, -10) },
          uMouseGravity: { value: 0 },
          uMouseRadius: { value: 0.35 },
          uMouseActive: { value: 0 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      threeRef.current = { renderer, scene, camera, material, geometry, points };

      // Generate initial formation
      const formation = generateFormation(
        DEFAULT_PARAMS.formationMode,
        MAX_PARTICLES,
        DEFAULT_PARAMS.formationScale,
        ""
      );
      const targetAttr = geometry.getAttribute("aTargetPosition");
      (targetAttr.array as Float32Array).set(formation);
      targetAttr.needsUpdate = true;

      const onResize = () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        material.uniforms.uResolution.value.set(
          renderer.domElement.width,
          renderer.domElement.height
        );
      };
      window.addEventListener("resize", onResize);

      const canvas = renderer.domElement;
      let mouseX = -10, mouseY = -10;
      let prevMouseX = -10, prevMouseY = -10;
      let mouseSpeed = 0;
      let mouseGravity = 0;
      let mouseActive = false;

      const onMouseMove = (e: MouseEvent) => {
        if (!paramsRef.current.mouseInteraction) {
          mouseActive = false;
          return;
        }
        mouseActive = true;
        const rect = canvas.getBoundingClientRect();
        const aspect = rect.width / rect.height;
        const mx = ((e.clientX - rect.left) / rect.width * 2 - 1) * aspect;
        const my = -((e.clientY - rect.top) / rect.height * 2 - 1);
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        mouseX = mx;
        mouseY = my;
      };
      const onMouseLeave = () => {
        mouseActive = false;
      };
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mouseleave", onMouseLeave);

      let animId: number;
      let lastTime = 0;
      const animate = (time: number) => {
        const dt = Math.min((time - lastTime) * 0.001, 0.05);
        lastTime = time;
        material.uniforms.uTime.value = time * 0.001;

        // Compute mouse speed (smoothed)
        const dx = mouseX - prevMouseX;
        const dy = mouseY - prevMouseY;
        const rawSpeed = Math.sqrt(dx * dx + dy * dy);
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        mouseSpeed += (rawSpeed - mouseSpeed) * 0.15;

        // Force disable when toggle is off
        if (!paramsRef.current.mouseInteraction) mouseActive = false;

        // Gravity ramps up when mouse is slow/still, drops when fast
        if (mouseActive) {
          // Slow mouse → gravity grows toward 1.0; fast mouse → gravity drops toward ~0.1
          const targetGravity = 1.0 / (1.0 + mouseSpeed * 80.0);
          // Ramp up slowly (gathering feel), drop quickly
          const rampSpeed = targetGravity > mouseGravity ? 1.5 * dt : 6.0 * dt;
          mouseGravity += (targetGravity - mouseGravity) * Math.min(rampSpeed, 1.0);
        } else {
          // Decay gravity when mouse leaves
          mouseGravity *= Math.max(1.0 - 3.0 * dt, 0);
        }

        material.uniforms.uMouse.value.set(mouseX, mouseY);
        material.uniforms.uMouseGravity.value = mouseGravity * paramsRef.current.mouseGravity;
        material.uniforms.uMouseActive.value = mouseActive ? 1.0 : 0.0;

        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mouseleave", onMouseLeave);
      };
    }

    const cleanupPromise = setup();
    return () => {
      disposed = true;
      cleanupPromise.then((cleanup) => cleanup?.());
      const r = threeRef.current;
      if (r) {
        r.renderer.dispose();
        r.material.dispose();
        r.geometry.dispose();
        r.renderer.domElement.remove();
        threeRef.current = null;
      }
    };
  }, []);

  /* --- Sync React state → uniforms --- */
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    const u = t.material.uniforms;
    u.uParticleSize.value = params.particleSize;
    u.uSizeVariation.value = params.sizeVariation;
    u.uOpacity.value = params.opacity;
    u.uAnimMode.value = params.animMode;
    u.uSpeed.value = params.speed;
    u.uNoiseScale.value = params.noiseScale;
    u.uTurbulence.value = params.turbulence;
    u.uWaveFrequency.value = params.waveFrequency;
    u.uWaveAmplitude.value = params.waveAmplitude;
    u.uFormationSpread.value = params.formationSpread;
    u.uScatter.value = params.scatter;
    u.uScatterDistance.value = params.scatterDistance;
    u.uFormationScale.value = params.formationScale;

    const cols = params.colors && params.colors.length > 0 ? params.colors : ["#7b68ee"];
    const colorVecs = colorsToUniform(cols);
    for (let i = 0; i < 5; i++) {
      u.uColors.value[i].set(colorVecs[i][0], colorVecs[i][1], colorVecs[i][2]);
    }
    u.uColorCount.value = cols.length;
    u.uColorSpeed.value = params.colorSpeed;
    u.uColorFreq.value = params.colorFreq;

    t.geometry.setDrawRange(0, params.particleCount);
  }, [params]);

  /* --- Update formation on mode/scale/text change --- */
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;

    const formation = generateFormation(
      params.formationMode,
      MAX_PARTICLES,
      params.formationScale,
      debouncedText,
      svgImageRef.current
    );
    const targetAttr = t.geometry.getAttribute("aTargetPosition");
    (targetAttr.array as Float32Array).set(formation);
    targetAttr.needsUpdate = true;
  }, [params.formationMode, params.formationScale, debouncedText, params.svgData]);

  /* --- Update background color --- */
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    if (params.colorBgTransparent) {
      t.renderer.setClearColor(0x000000, 0);
    } else {
      t.renderer.setClearColor(params.colorBg, 1);
    }
  }, [params.colorBg, params.colorBgTransparent]);

  /* --- Update blending mode --- */
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    t.material.blending = params.blending;
    // SubtractiveBlending (3) and MultiplyBlending (4) require premultipliedAlpha
    t.material.premultipliedAlpha = params.blending === 3 || params.blending === 4;
    t.material.needsUpdate = true;
  }, [params.blending]);

  /* --- Download --- */
  const handleDownload = useCallback(async () => {
    const t = threeRef.current;
    if (!t) return;
    await downloadCanvas(t.renderer.domElement, "particle.png");
  }, []);

  /* --- Export code --- */
  const handleExport = useCallback(() => {
    setExportCode(generateExportCode(params));
    setShowExport(true);
  }, [params]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#d8d8da]">
      {/* Canvas area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">
        <div ref={containerRef} className="w-full h-full" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/">
            <PushButton variant="dark" size="sm">[ {t.back} ]</PushButton>
          </Link>
          <PushButton onClick={toggle} variant="dark" size="sm">
            [ {lang === "ja" ? "EN" : "JA"} ]
          </PushButton>
        </div>
      </div>

      {/* Control surface */}
      <aside className="flex-1 md:flex-none md:w-[320px] shrink-0 bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] shadow-[0_-8px_24px_rgba(0,0,0,0.10)] md:shadow-none md:border-l md:border-[#bbbbbe] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b border-[rgba(0,0,0,0.12)]">
          <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333] select-none">{t.apps.particle.name}</span>
          <PushButton size="sm" variant="dark" onClick={() => setParams({ ...DEFAULT_PARAMS })}>[ {t.reset} ]</PushButton>
        </div>

        {/* Scrollable interior */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Formation section */}
          <div className="px-5 py-4 flex flex-col gap-3 border-b border-[rgba(0,0,0,0.08)]">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.particle.formation}</span>
            <div className="flex flex-col gap-2">
              <Select
                value={String(params.formationMode)}
                onValueChange={(v) => updateParam("formationMode", Number(v))}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATION_MODE_VALUES.map((m) => {
                    const labels: Record<string, string> = {
                      "0": t.particle.free, "1": t.particle.sphere, "2": t.particle.cube,
                      "4": t.particle.ring, "5": t.particle.text, "6": t.particle.svg,
                    };
                    return <SelectItem key={m.value} value={m.value}>{labels[m.value]}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            {params.formationMode === 5 && (
              <div className="pl-3 border-l-2 border-[#bbbbbe]">
                <div className="flex flex-col gap-2">
                  <Label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#555]">{t.particle.text}</Label>
                  <input
                    type="text"
                    value={params.inputText}
                    onChange={(e) => updateParam("inputText", e.target.value)}
                    placeholder={t.particle.enterText}
                    className="h-9 w-full rounded-[3px] border border-[rgba(0,0,0,0.5)] bg-[#1a1a1a] text-[#e0e0e2] px-3 font-mono text-[12px] outline-none [box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)] focus:[box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35),0_0_0_1px_var(--led-green)] placeholder:text-[#505050]"
                  />
                </div>
              </div>
            )}
            {params.formationMode === 6 && (
              <div className="pl-3 border-l-2 border-[#bbbbbe]">
                <div className="flex flex-col gap-2">
                  <input
                    ref={svgInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={handleSvgUpload}
                    className="hidden"
                  />
                  <button
                    className="w-full py-2 px-4 bg-transparent border border-[#bbbbbe] text-[#333] font-mono text-[11px] uppercase tracking-[0.10em] hover:bg-[#242424]/5 transition-colors select-none"
                    onClick={() => svgInputRef.current?.click()}
                  >
                    {t.particle.selectSvg}
                  </button>
                  {svgFileName && (
                    <p className="text-[12px] font-mono text-[#333] truncate">{svgFileName}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Select
                value={String(params.particleCount)}
                onValueChange={(v) => updateParam("particleCount", Number(v))}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICLE_COUNT_VALUES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {lang === "ja" ? c.ja : c.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ANIM MODE: select */}
          <div className="px-4 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.particle.mode}</span>
              <Select value={String(params.animMode)} onValueChange={(v) => updateParam("animMode", Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t.particle.flow.toUpperCase()}</SelectItem>
                  <SelectItem value="1">{t.particle.wave.toUpperCase()}</SelectItem>
                  <SelectItem value="2">{t.particle.diffusion.toUpperCase()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Knob row: SIZE / SPEED / OPCT / SCALE */}
          <div className="flex flex-col gap-2 px-4 py-4 border-b border-[rgba(0,0,0,0.08)]">
            <DragParam
              label={t.particle.size}
              value={params.particleSize}
              min={0.5} max={5} step={0.1}
              onChange={(v) => updateParam("particleSize", v)}
              accent="blue"
              defaultValue={DEFAULT_PARAMS.particleSize}
            />
            <DragParam
              label={t.particle.speed}
              value={params.speed}
              min={0} max={2} step={0.01}
              onChange={(v) => updateParam("speed", v)}
              accent="ochre"
              defaultValue={DEFAULT_PARAMS.speed}
            />
            <DragParam
              label={t.particle.opacity}
              value={params.opacity}
              min={0.1} max={1.0} step={0.01}
              onChange={(v) => updateParam("opacity", v)}
              accent="grey"
              defaultValue={DEFAULT_PARAMS.opacity}
            />
            <DragParam
              label={t.particle.scale}
              value={params.formationScale}
              min={0.1} max={5.0} step={0.05}
              onChange={(v) => updateParam("formationScale", v)}
              accent="orange"
              defaultValue={DEFAULT_PARAMS.formationScale}
            />
          </div>

          {/* Fader bank: TURB / SCATTER / NOISE / SIZE-V / VARIATION */}
          <div className="flex flex-col gap-2 px-4 py-4 border-b border-[rgba(0,0,0,0.08)]">
            <DragParam label={t.particle.turbulence} value={params.turbulence} min={0} max={3} step={0.01} onChange={(v) => updateParam("turbulence", v)} accent="blue" defaultValue={DEFAULT_PARAMS.turbulence} />
            <DragParam label={t.particle.scatter} value={params.scatter} min={0} max={1} step={0.01} onChange={(v) => updateParam("scatter", v)} accent="ochre" defaultValue={DEFAULT_PARAMS.scatter} />
            <DragParam label={t.particle.noiseScale} value={params.noiseScale} min={0.5} max={5} step={0.1} onChange={(v) => updateParam("noiseScale", v)} accent="grey" defaultValue={DEFAULT_PARAMS.noiseScale} />
            <DragParam label={t.particle.sizeVariation} value={params.sizeVariation} min={0} max={1} step={0.01} onChange={(v) => updateParam("sizeVariation", v)} accent="orange" defaultValue={DEFAULT_PARAMS.sizeVariation} />
            <DragParam label={t.particle.variation} value={params.formationSpread} min={0} max={2} step={0.01} onChange={(v) => updateParam("formationSpread", v)} accent="blue" defaultValue={DEFAULT_PARAMS.formationSpread} />
          </div>

          {/* Interaction section */}
          <div className="px-5 py-4 flex flex-col gap-3 border-b border-[rgba(0,0,0,0.08)]">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.particle.interaction}</span>
            <ToggleSwitch
              active={params.mouseInteraction}
              onClick={() => updateParam("mouseInteraction", !params.mouseInteraction)}
              label={t.particle.mouseHover}
              size="sm"
            />
            {params.mouseInteraction && (
              <div className="pl-3 border-l-2 border-[#bbbbbe]">
                <DragParam
                  label={t.particle.attraction}
                  value={params.mouseGravity}
                  min={0.1} max={5} step={0.1}
                  onChange={(v) => updateParam("mouseGravity", v)}
                  accent="blue"
                  defaultValue={DEFAULT_PARAMS.mouseGravity}
                />
              </div>
            )}
          </div>

          {/* Color section */}
          <div className="flex-1 px-5 py-4 flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777] select-none">{t.colors}</span>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-mono uppercase tracking-[0.10em] text-[#555] shrink-0">{t.particle.blending}</span>
              <Select value={String(params.blending)} onValueChange={(v) => updateParam("blending", Number(v))}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t.particle.blendNormal}</SelectItem>
                  <SelectItem value="2">{t.particle.blendAdditive}</SelectItem>
                  <SelectItem value="3">{t.particle.blendSubtractive}</SelectItem>
                  <SelectItem value="4">{t.particle.blendMultiply}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ToggleSwitch
              active={params.colorBgTransparent}
              onClick={() => updateParam("colorBgTransparent", !params.colorBgTransparent)}
              label={t.particle.transparentBg}
              size="sm"
            />
            {!params.colorBgTransparent && (
              <ColorRow
                label={t.particle.bgColor}
                value={params.colorBg}
                onChange={(v) => updateParam("colorBg", v)}
              />
            )}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#555]">{t.particle.particleColor}</Label>
                {(params.colors || []).length < 5 && (
                  <button
                    type="button"
                    onClick={() => updateParam("colors", [...(params.colors || ["#7b68ee"]), "#ffffff"])}
                    className="text-[11px] font-mono text-[#555] hover:text-[#333] transition-colors"
                  >
                    {t.particle.addColor}
                  </button>
                )}
              </div>
              {(params.colors || ["#7b68ee"]).map((color, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...(params.colors || ["#7b68ee"])];
                      newColors[i] = e.target.value;
                      updateParam("colors", newColors);
                    }}
                    className="size-7 border border-[#bbbbbe] bg-transparent cursor-pointer p-0 color-swatch"
                  />
                  <span className="text-[12px] font-mono text-[#333] flex-1">{color}</span>
                  {(params.colors || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newColors = (params.colors || ["#7b68ee"]).filter((_, j) => j !== i);
                        updateParam("colors", newColors);
                      }}
                      className="text-[11px] font-mono text-[#777] hover:text-[#333] transition-colors px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Action buttons */}
        <div className="shrink-0 px-5 py-4 border-t border-[rgba(0,0,0,0.12)] flex flex-col gap-2">
          <PushButton variant="dark" className="w-full text-center" onClick={handleExport}>
            [ {t.particle.exportCode} ]
          </PushButton>
          <PushButton variant="light" className="w-full text-center" onClick={handleDownload}>
            [ {t.particle.exportImage} ]
          </PushButton>
        </div>
      </aside>

      {/* Export dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
          <DialogHeader>
            <DialogTitle>{t.particle.exportCodeTitle}</DialogTitle>
          </DialogHeader>
          <textarea
            className="flex-1 min-h-[300px] rounded-[3px] border border-[rgba(0,0,0,0.5)] bg-[#1a1a1a] text-[#e0e0e2] font-mono text-[12px] leading-relaxed p-4 resize-none outline-none [box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)]"
            value={exportCode}
            readOnly
          />
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 bg-transparent border border-[#242424] text-[#242424] font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#242424]/5 transition-colors select-none" onClick={() => setShowExport(false)}>
              {t.close}
            </button>
            <button className="px-4 py-2 bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none" onClick={() => copy(exportCode)}>
              {copied ? t.copied : t.copy}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Particle app — home card preview                                   */
/*                                                                     */
/*  Reproduces app/apps/particle/page.tsx at its DEFAULT_PARAMS:       */
/*  THREE.Points + ShaderMaterial, sphere formation, flow animation,   */
/*  pink→blue color blend, dark #050510 background.                    */
/*                                                                     */
/*  The shader strings, uniform setup and default values below are     */
/*  copied verbatim from the app page. Mouse interaction is disabled   */
/*  in the card (no pointer), matching the app's idle/default state.   */
/* ------------------------------------------------------------------ */

/* --- hexToRGB (verbatim from lib/color-utils.ts) --- */
function hexToRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/* --- Shaders (verbatim from the app page) --- */

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

/* --- DEFAULT_PARAMS (the subset that drives the default render) --- */
const DEFAULT = {
  particleCount: 80000,
  particleSize: 2.5,
  sizeVariation: 0.5,
  colorBg: "#050510",
  colors: ["#f472b6", "#60a5fa"] as string[],
  colorSpeed: 2.0,
  colorFreq: 1.0,
  opacity: 0.2,
  animMode: 0,
  speed: 0.5,
  noiseScale: 2.0,
  turbulence: 0.5,
  waveFrequency: 8,
  waveAmplitude: 0.25,
  formationMode: 1,
  formationScale: 1.0,
  formationSpread: 0.25,
  scatter: 0.5,
  scatterDistance: 0.15,
};

/* --- colorsToUniform (verbatim logic from the app page) --- */
function colorsToUniform(colors: string[]): number[][] {
  const cols = colors && colors.length > 0 ? colors : ["#7b68ee"];
  const result: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const c = cols[Math.min(i, cols.length - 1)];
    result.push(hexToRGB(c));
  }
  return result;
}

/* --- generateFormation: sphere (mode 1), verbatim from the app page --- */
function generateSphereFormation(count: number, scale: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.4 * scale;
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.9 + Math.cos(phi) * r * 0.3;
    positions[i * 3 + 2] = 0;
  }
  return positions;
}

const FRAME_MS = 25; // ~40fps cap

export function createPreview(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  (async () => {
    const THREE = await import("three");
    if (disposed) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(DEFAULT.colorBg, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const count = DEFAULT.particleCount;
    const geometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    const randomArray = new Float32Array(count);
    const sizeArray = new Float32Array(count);

    const rect0 = canvas.getBoundingClientRect();
    const initAspect = Math.max(1, rect0.width) / Math.max(1, rect0.height);
    for (let i = 0; i < count; i++) {
      posArray[i * 3] = (Math.random() - 0.5) * 2 * initAspect;
      posArray[i * 3 + 1] = (Math.random() - 0.5) * 2;
      posArray[i * 3 + 2] = 0;
      randomArray[i] = Math.random();
      sizeArray[i] = Math.random();
    }

    const targetArray = generateSphereFormation(count, DEFAULT.formationScale);

    geometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute("aTargetPosition", new THREE.BufferAttribute(targetArray, 3));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randomArray, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizeArray, 1));
    geometry.setDrawRange(0, count);

    const initColors = colorsToUniform(DEFAULT.colors).map(
      (c) => new THREE.Vector3(c[0], c[1], c[2])
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new THREE.Vector2(1, 1),
        },
        uParticleSize: { value: DEFAULT.particleSize },
        uSizeVariation: { value: DEFAULT.sizeVariation },
        uOpacity: { value: DEFAULT.opacity },
        uColors: { value: initColors },
        uColorCount: { value: DEFAULT.colors.length },
        uColorSpeed: { value: DEFAULT.colorSpeed },
        uColorFreq: { value: DEFAULT.colorFreq },
        uAnimMode: { value: DEFAULT.animMode },
        uSpeed: { value: DEFAULT.speed },
        uNoiseScale: { value: DEFAULT.noiseScale },
        uTurbulence: { value: DEFAULT.turbulence },
        uWaveFrequency: { value: DEFAULT.waveFrequency },
        uWaveAmplitude: { value: DEFAULT.waveAmplitude },
        uFormationSpread: { value: DEFAULT.formationSpread },
        uScatter: { value: DEFAULT.scatter },
        uScatterDistance: { value: DEFAULT.scatterDistance },
        uFormationScale: { value: DEFAULT.formationScale },
        // Mouse interaction is idle in the card (no pointer) — defaults.
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

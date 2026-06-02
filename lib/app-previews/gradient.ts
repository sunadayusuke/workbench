/* ------------------------------------------------------------------ *
 *  Home-card preview for the Gradient app.
 *
 *  Reproduces the REAL default canvas of app/apps/gradient/page.tsx:
 *  the exact mesh-gradient ShaderMaterial (VERTEX_SHADER / FRAGMENT_SHADER),
 *  the same full-screen PlaneGeometry(2,2) + OrthographicCamera, and the
 *  verbatim DEFAULT_PARAMS / DEFAULT_COLORS mapped to uniforms exactly as
 *  the page's Three.js setup does.
 *
 *  The app is STATIC at its default state (no uTime / RAF — the page only
 *  renders once on setup and on resize), so this preview renders once and
 *  re-renders on resize. No animation loop.
 * ------------------------------------------------------------------ */

/* --- hexToRGB (mirrors lib/color-utils.ts) --- */
function hexToRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/* ------------------------------------------------------------------ */
/*  Shaders — copied verbatim from app/apps/gradient/page.tsx          */
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
/*  Defaults — copied verbatim from app/apps/gradient/page.tsx         */
/* ------------------------------------------------------------------ */

interface ColorSpot {
  color: string;
  x: number;
  y: number;
}

const DEFAULT_COLORS: ColorSpot[] = [
  { color: "#ffffff", x: 0.25, y: 0.8 },
  { color: "#888888", x: 0.75, y: 0.7 },
  { color: "#333333", x: 0.3, y: 0.25 },
  { color: "#000000", x: 0.7, y: 0.2 },
];

// DEFAULT_PARAMS values used by the canvas (aspect 1:1 → 1080x1080).
const DEFAULT_PARAMS = {
  gradientType: 0,
  spread: 0.5,
  angle: 0,
  scale: 1.0,
  noise: 0,
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
  outputWidth: 1080,
  outputHeight: 1080,
  seed: 42,
};

/* ------------------------------------------------------------------ */
/*  Preview                                                            */
/* ------------------------------------------------------------------ */

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
    });
    // Match the page: shader does manual sRGB handling, colors passed as raw floats.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Build uniforms from DEFAULT_COLORS / DEFAULT_PARAMS, exactly as the page does.
    const colorPositions = Array.from({ length: 8 }, () => new THREE.Vector2(0, 0));
    const colorData = new Float32Array(24);
    DEFAULT_COLORS.forEach((spot, i) => {
      colorPositions[i].set(spot.x, spot.y);
      const [r, g, b] = hexToRGB(spot.color);
      colorData[i * 3] = r;
      colorData[i * 3 + 1] = g;
      colorData[i * 3 + 2] = b;
    });

    const aspect = DEFAULT_PARAMS.outputWidth / DEFAULT_PARAMS.outputHeight;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uAspect: { value: aspect },
        uGradientType: { value: DEFAULT_PARAMS.gradientType },
        uSpread: { value: DEFAULT_PARAMS.spread },
        uAngle: { value: (DEFAULT_PARAMS.angle * Math.PI) / 180 },
        uScale: { value: DEFAULT_PARAMS.scale },
        uColorCount: { value: DEFAULT_COLORS.length },
        uColorPositions: { value: colorPositions },
        uColorData: { value: colorData },
        uNoise: { value: DEFAULT_PARAMS.noise },
        uGrain: { value: DEFAULT_PARAMS.grain },
        uStipple: { value: DEFAULT_PARAMS.stipple * 0.5 },
        uStippleSize: { value: DEFAULT_PARAMS.stippleSize },
        uHalftone: { value: DEFAULT_PARAMS.halftone },
        uGlassAmount: { value: DEFAULT_PARAMS.glassAmount },
        uGlassFreq: { value: DEFAULT_PARAMS.glassFreq },
        uGlassShift: { value: DEFAULT_PARAMS.glassShift },
        uChromatic: { value: DEFAULT_PARAMS.chromatic },
        uWaveAmount: { value: DEFAULT_PARAMS.waveAmount },
        uWaveFrequency: { value: DEFAULT_PARAMS.waveFrequency },
        uWaveAngle: { value: (DEFAULT_PARAMS.waveAngle * Math.PI) / 180 },
        uWaveRandom: { value: DEFAULT_PARAMS.waveRandom },
        uSeed: { value: DEFAULT_PARAMS.seed },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setSize(w, h, false);
      material.uniforms.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height
      );
      renderer.render(scene, camera);
    };

    // Static app: render once + on resize (no animation loop).
    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);

    cleanup = () => {
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

/* ------------------------------------------------------------------ *
 *  Home-card preview for the Image app.
 *
 *  Reproduces app/apps/image/page.tsx's REAL default canvas:
 *  a fullscreen shader sampling uTexture ("/sample/default.png") with
 *  every effect uniform at its DEFAULT value (0). The shader is STATIC
 *  (no uTime), so we render once after the texture loads + on resize.
 *  If the texture 404s, we fall back to a neutral gradient.
 *
 *  Shader strings, geometry/material setup, and DEFAULT_PARAMS are
 *  copied verbatim from the app page.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Shaders (verbatim from app/apps/image/page.tsx)                   */
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
/*  Defaults (verbatim from app/apps/image/page.tsx DEFAULT_PARAMS)   */
/* ------------------------------------------------------------------ */

const DEFAULT_PARAMS = {
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

const SAMPLE_URL = "/sample/default.png";

/* ------------------------------------------------------------------ */
/*  createPreview                                                     */
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
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uImageSize: { value: new THREE.Vector2(1, 1) },
        uBrightness: { value: DEFAULT_PARAMS.brightness },
        uContrast: { value: DEFAULT_PARAMS.contrast },
        uSaturation: { value: DEFAULT_PARAMS.saturation },
        uExposure: { value: DEFAULT_PARAMS.exposure },
        uTemperature: { value: DEFAULT_PARAMS.temperature },
        uTint: { value: DEFAULT_PARAMS.tint },
        uHighlights: { value: DEFAULT_PARAMS.highlights },
        uShadows: { value: DEFAULT_PARAMS.shadows },
        uGlitchAmount: { value: DEFAULT_PARAMS.glitchAmount },
        uGlitchSeed: { value: DEFAULT_PARAMS.glitchSeed },
        uNoise: { value: DEFAULT_PARAMS.noise },
        uBlur: { value: DEFAULT_PARAMS.blur },
        uVignette: { value: DEFAULT_PARAMS.vignette },
        uPixelate: { value: DEFAULT_PARAMS.pixelate },
        uHueShift: { value: DEFAULT_PARAMS.hueShift },
        uFade: { value: DEFAULT_PARAMS.fade },
        uDuotone: { value: DEFAULT_PARAMS.duotone },
        uDuotoneShadow: { value: new THREE.Color(DEFAULT_PARAMS.duotoneShadow) },
        uDuotoneHighlight: { value: new THREE.Color(DEFAULT_PARAMS.duotoneHighlight) },
        uHalftone: { value: DEFAULT_PARAMS.halftone },
        uScanline: { value: DEFAULT_PARAMS.scanline },
        uRGBShift: { value: DEFAULT_PARAMS.rgbShift },
        uRGBShiftMode: { value: DEFAULT_PARAMS.rgbShiftMode },
        uRGBShiftAngle: { value: (DEFAULT_PARAMS.rgbShiftAngle * Math.PI) / 180 },
        uWaveAmount: { value: DEFAULT_PARAMS.waveAmount },
        uWaveFrequency: { value: DEFAULT_PARAMS.waveFrequency },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let texture: { dispose: () => void } | null = null;

    const resize = () => {
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

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // Default texture. STATIC shader → render once after load + on resize.
    new THREE.TextureLoader().load(
      SAMPLE_URL,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        texture = tex;
        material.uniforms.uTexture.value = tex;
        const img = tex.image as HTMLImageElement;
        material.uniforms.uImageSize.value.set(img.naturalWidth, img.naturalHeight);
        renderer.render(scene, camera);
      },
      undefined,
      () => {
        // 404 / load error: leave a neutral gradient fallback in place.
        if (disposed) return;
        drawNeutralGradient(canvas);
      }
    );

    cleanup = () => {
      ro.disconnect();
      material.dispose();
      geometry.dispose();
      if (texture) texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}

/* ------------------------------------------------------------------ */
/*  Neutral gradient fallback (texture 404)                           */
/* ------------------------------------------------------------------ */

function drawNeutralGradient(canvas: HTMLCanvasElement) {
  // Re-acquiring a 2D context after a WebGL context fails on most
  // browsers, so render the fallback onto a fresh detached canvas and
  // blit it via CSS background instead. Cheaper: just paint a CSS gradient.
  canvas.style.background =
    "linear-gradient(135deg, #d8d8da 0%, #c8c8ca 50%, #bbbbbe 100%)";
}

// webp-encode.ts — still-WebP frame encoder (webp + compress apps).
//
// One frame in, one still WebP out. The path is decided once per run:
//   1. canvas.toBlob("image/webp") — Chrome / Edge / Firefox 96+. Native, fast.
//   2. libwebp wasm, self-hosted in public/jsquash-webp/ — Safari, which has no
//      WebP canvas encoder. Loaded through a *variable* URL so no bundler ever
//      touches it (see that directory's README for what breaks otherwise).
// Both are libwebp underneath, so the two paths look the same at equal quality.
//
// Error messages double as translation keys (`errorEncoderLoadFailed`,
// `errorEncodeUnsupported`); callers map them to whatever their app shows.

const WASM_LOAD_TIMEOUT_MS = 15000;

// TS's typed-array generics reject Uint8Array<ArrayBufferLike> against BlobPart;
// our buffers are always plain ArrayBuffers, so this cast is safe.
export const asBlobPart = (u: Uint8Array): BlobPart => u as unknown as BlobPart;

// Minimal SIMD module — the same probe wasm-feature-detect's `simd()` compiles.
// Inlined to keep the wasm encoder path dependency-free.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0,
  65, 0, 253, 15, 253, 98, 11,
]);

/** libwebp WebPConfig. Every field is required by the embind signature. */
interface WebPEncodeOptions {
  quality: number;
  target_size: number;
  target_PSNR: number;
  method: number;
  sns_strength: number;
  filter_strength: number;
  filter_sharpness: number;
  filter_type: number;
  partitions: number;
  segments: number;
  pass: number;
  show_compressed: number;
  preprocessing: number;
  autofilter: number;
  partition_limit: number;
  alpha_compression: number;
  alpha_filtering: number;
  alpha_quality: number;
  lossless: number;
  exact: number;
  image_hint: number;
  emulate_jpeg_size: number;
  thread_level: number;
  low_memory: number;
  near_lossless: number;
  use_delta_palette: number;
  use_sharp_yuv: number;
}

// Verbatim from @jsquash/webp@1.5.0 `meta.js` (`defaultOptions`), which in turn
// mirrors struct WebPConfig in libwebp's encode.h. Only `quality` is overridden.
const WEBP_DEFAULT_OPTIONS: WebPEncodeOptions = {
  quality: 75,
  target_size: 0,
  target_PSNR: 0,
  method: 4,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0,
};

interface WebPEncoderModule {
  encode(
    data: BufferSource,
    width: number,
    height: number,
    options: WebPEncodeOptions,
  ): Uint8Array | null;
}

type WebPModuleFactory = (
  moduleOptions?: Record<string, unknown>,
) => Promise<WebPEncoderModule>;

export interface FrameEncoder {
  /**
   * Encodes the frame now on the canvas. `image` holds the very same pixels —
   * the caller already read them back — so the wasm path can encode them
   * directly instead of asking the canvas a second time.
   */
  encode: (
    canvas: HTMLCanvasElement,
    quality: number,
    image: ImageData,
  ) => Promise<Uint8Array>;
  /** true when `encode` takes its pixels from the ImageData (the wasm path). */
  usesImageData: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function encodeWithCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Uint8Array> {
  // Blink switches to lossless (VP8L) at exactly 1.0, which balloons the frame
  // and makes this path behave unlike the wasm one (always lossy) — stay under.
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", Math.min(quality / 100, 0.995));
  });
  // toBlob quietly falls back to PNG when it can't produce the requested type,
  // so check what actually came back — PNG bytes muxed into a WebP container
  // would give a file nothing can play.
  if (!blob || blob.size === 0 || blob.type !== "image/webp") {
    throw new Error("errorEncodeUnsupported");
  }
  return new Uint8Array(await blob.arrayBuffer());
}

/** Probes for a native WebP canvas encoder (false on Safari). */
function canvasEncodesWebP(): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    return probe.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

// The wasm module is a module-level singleton: loaded once, reused by every
// frame and every conversion. A failed load resets the cache so a retry can
// try again (same pattern as the ffmpeg fallback's getFFmpeg()).
let webpEncoderPromise: Promise<WebPEncoderModule> | null = null;

async function initWasmEncoder(): Promise<WebPEncoderModule> {
  const simd = WebAssembly.validate(SIMD_PROBE);
  // A *variable* URL, deliberately: a literal would make the bundler chunk the
  // Emscripten glue, whose `import.meta.url` then resolves to a file:// path in
  // dev (wasm 404s) and whose `var Module` gets declared twice. Imported as a
  // plain URL the browser loads it natively and the glue finds its own .wasm
  // next to itself. See public/jsquash-webp/README.md.
  const glueUrl = `${window.location.origin}/jsquash-webp/webp_enc${
    simd ? "_simd" : ""
  }.js`;
  const glue = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ glueUrl);
  const factory = glue.default as WebPModuleFactory | undefined;
  if (typeof factory !== "function") throw new Error("errorEncoderLoadFailed");
  // Don't let Emscripten run anything on its own — we only call encode().
  return factory({ noInitialRun: true });
}

function loadWasmEncoder(): Promise<WebPEncoderModule> {
  if (!webpEncoderPromise) {
    webpEncoderPromise = withTimeout(
      initWasmEncoder(),
      WASM_LOAD_TIMEOUT_MS,
      "errorEncoderLoadFailed",
    ).catch((error) => {
      webpEncoderPromise = null; // failed load must not poison later attempts
      throw error;
    });
  }
  return webpEncoderPromise;
}

/** Picks the encoding path this browser can actually use, once per run. */
export async function createFrameEncoder(): Promise<FrameEncoder> {
  if (canvasEncodesWebP()) {
    return { encode: encodeWithCanvas, usesImageData: false };
  }

  // Safari path: libwebp compiled to wasm, fetched only when we get here. A
  // failure here is a *load* problem (offline, timeout), not "no WebP support".
  let module: WebPEncoderModule;
  try {
    module = await loadWasmEncoder();
  } catch {
    throw new Error("errorEncoderLoadFailed");
  }

  return {
    usesImageData: true,
    encode: async (_canvas, quality, image) => {
      const encoded = module.encode(image.data, image.width, image.height, {
        ...WEBP_DEFAULT_OPTIONS,
        quality,
      });
      if (!encoded || encoded.length === 0) throw new Error("errorEncodeUnsupported");
      // Copy out of the module's memory — the heap can move under our feet.
      return new Uint8Array(encoded);
    },
  };
}

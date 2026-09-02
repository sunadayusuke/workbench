// video-to-webp.ts — client-side animated WebP conversion (webp app).
//
// Two frame sources feed one pipeline: frame source → still WebP per frame →
// `lib/webp-anim.ts` muxer.
//   - video: seek a <video> frame by frame at the requested fps
//   - images: one still image per frame, in the order given
// Decode, encode and mux all happen locally — nothing leaves the browser.
//
// Frame encoding itself lives in `lib/webp-encode.ts` (canvas.toBlob, or libwebp
// wasm on Safari), shared with the compress app.
//
// Every frame is read back once before it is encoded, which pays for two things:
// a frame identical to the one before it is dropped and its time handed to the
// frame already in the animation (see the DUP_* constants), and — when the
// caller asks — the background colour is keyed out to transparency.
//
// The per-frame still WebPs are handed back alongside the animation: the app
// zips them for the "frame images" export, so no frame is ever encoded twice.

import { buildAnimatedWebP } from "./webp-anim";
import { asBlobPart, createFrameEncoder, type FrameEncoder } from "./webp-encode";

/** `"original" | "half" | "quarter"` scale the source; a number is a target width in px. */
export type WebpResolution = "original" | "half" | "quarter" | number;

/** Background removal: see `keyBackground` for what the numbers mean. */
export interface TransparentBackground {
  /** Background colour to remove, as 0–255 channels. */
  color: [number, number, number];
  /** Normalised distance (0–1) under which a pixel is pure background. */
  threshold: number;
}

export interface VideoToWebpOptions {
  /** Frames sampled per second of source video; in image mode it sets the frame delay. */
  fps: number;
  /** Still-WebP quality, 1–100. */
  quality: number;
  resolution: WebpResolution;
  /** 0 = loop forever. */
  loopCount: number;
  /** Omitted (or undefined) keeps every frame opaque. */
  transparent?: TransparentBackground;
}

/** Error messages thrown by the conversion; they double as translation keys. */
export type WebpErrorKey =
  | "errorVideoLoad"
  | "errorImageLoad"
  | "errorSeekFailed"
  | "errorEncoderLoadFailed"
  | "errorEncodeUnsupported"
  | "errorConvertFailed";

/** Thrown message when the caller aborts — not a failure worth showing. */
export const CANCELLED = "cancelled";

export interface WebpConversionResult {
  /** The muxed animated WebP. */
  blob: Blob;
  /** Every frame as a still WebP, in display order (reused for the frame ZIP). */
  frames: Uint8Array[];
  width: number;
  height: number;
  /** Frames the animation actually holds — the same as `frames.length`. */
  frameCount: number;
  /** Sampled frames that were folded into the frame before them as duplicates. */
  mergedCount: number;
}

const SEEK_TIMEOUT_MS = 5000;
const LOAD_TIMEOUT_MS = 20000;
/** Two seeks closer than this are the same position as far as the browser cares. */
const SEEK_EPSILON = 1e-3;

// ── Duplicate-frame detection ────────────────────────────────────────────────
// Animated WebP compresses every frame on its own, so a video that holds still
// pays full price for each identical frame. Sampling a real 8s clip at 12fps,
// 29 of its 96 frames repeated the one before them — dropping those took ~30%
// off the file with nothing visible to show for it.
//
// The thresholds are measured, not guessed: across a static stretch, 0.0–0.8%
// of the sampled pixels moved by more than 8 per channel (encoder noise), while
// the subtlest *real* movement in the same clip moved 1.2%+. A tolerance of 12
// with a 0.5% cut-off sits between the two with room on either side.
/** Compare every Nth pixel — a whole-frame walk buys no extra accuracy here. */
const DUP_PIXEL_STRIDE = 4;
/** Per-channel difference below which a pixel counts as unchanged. */
const DUP_CHANNEL_TOLERANCE = 12;
/** Above this share of changed samples the frames are genuinely different. */
const DUP_MAX_CHANGED_RATIO = 0.005;

/** Rings of border pixels `detectBackgroundColor` tallies (outer edge first). */
const BG_RING_DEPTH = 2;
/** Frames are scaled into this box before detection — the ring is enough. */
const BG_DETECT_MAX_EDGE = 640;

/**
 * Normalised distance at which a pixel is fully foreground: anything this far
 * from the background colour is solid, and the flood fill will not cross it.
 * Fixed rather than exposed — the UI's tolerance moves the *other* end of the
 * ramp, and a ceiling below 1.0 keeps the fill from leaking through antialiased
 * outlines while staying clear of real subject colours.
 */
const KEY_SOLID_DISTANCE = 0.9;

/**
 * Distances are kept as bytes rather than floats: 1B/px instead of 4 across
 * buffers that are allocated once per *run*. The rounding costs at most
 * `0.5/255 / span` of alpha, and the UI's widest tolerance (0.40) still leaves
 * `span = 0.5` — under one alpha level either way.
 */
const KEY_DISTANCE_STEPS = 255;

/** Working buffers for `keyBackground`, sized once and reused by every frame. */
export interface KeyScratch {
  /** Per-pixel distance from the background colour, 0–255. */
  distance: Uint8Array;
  /** Flood-fill membership. Cleared at the top of every call. */
  region: Uint8Array;
  /** BFS queue of pixel indices; a pixel is enqueued at most once. */
  queue: Int32Array;
}

/**
 * Allocates `keyBackground`'s working buffers for a canvas of `pixels` pixels.
 * Keying a whole animation re-allocated ~6 bytes per pixel per frame otherwise —
 * hundreds of MB of churn on a long 1080p clip, all of it immediately garbage.
 */
export function createKeyScratch(pixels: number): KeyScratch {
  return {
    distance: new Uint8Array(pixels),
    region: new Uint8Array(pixels),
    queue: new Int32Array(pixels),
  };
}

/** Where frames come from — the rest of the pipeline doesn't care which. */
interface FrameSource {
  width: number;
  height: number;
  count: number;
  /** Whether the canvas keeps an alpha channel (image letterboxing needs it). */
  alpha: boolean;
  /** Paints frame `index`; must fill or clear the whole canvas itself. */
  draw: (index: number, ctx: CanvasRenderingContext2D) => Promise<void>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Output dimensions for a source size, keeping the aspect ratio. */
export function resolveOutputSize(
  srcWidth: number,
  srcHeight: number,
  resolution: WebpResolution,
): { width: number; height: number } {
  const safeW = Math.max(1, Math.floor(srcWidth));
  const safeH = Math.max(1, Math.floor(srcHeight));

  let width: number;
  if (typeof resolution === "number") {
    // Never upscale: a bigger canvas adds bytes, not detail.
    width = Math.min(safeW, Math.max(1, Math.floor(resolution)));
  } else {
    const scale = resolution === "half" ? 0.5 : resolution === "quarter" ? 0.25 : 1;
    width = Math.max(1, Math.round(safeW * scale));
  }
  // Guard the height against rounding to 0 on very wide sources.
  const height = Math.max(1, Math.round((width * safeH) / safeW));
  return { width, height };
}

/** Frames a video conversion would produce; 0 when the duration isn't usable yet. */
export function estimateFrameCount(durationSec: number, fps: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.max(1, Math.floor(durationSec * fps));
}

/** Natural-order sort by filename, so frame_2 lands before frame_10. */
export function sortImageFiles(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error(CANCELLED);
}

/** Awaits `promise`, but rejects with CANCELLED the moment `signal` aborts. */
function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error(CANCELLED)), {
        once: true,
      });
    }),
  ]);
}

/**
 * Resolves once the element has frame 0 decoded (readyState >= HAVE_CURRENT_DATA);
 * `loadedmetadata` alone wouldn't guarantee the first drawImage has anything.
 */
function waitForVideoData(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("errorVideoLoad"));
    };
    timer = setTimeout(onError, LOAD_TIMEOUT_MS);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Re-seeking to the position we're already parked at fires no `seeked` event
    // — frame 0 of every conversion hits exactly that case.
    if (
      !video.seeking &&
      video.readyState >= 2 &&
      Math.abs(video.currentTime - time) < SEEK_EPSILON
    ) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("errorSeekFailed"));
    };
    // A seek that never completes would hang the whole run — time it out.
    timer = setTimeout(onError, SEEK_TIMEOUT_MS);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("errorImageLoad");
  }
}

/**
 * Whether two frames are the same picture as far as a viewer is concerned.
 * See the DUP_* constants for where the thresholds come from.
 */
function isDuplicateFrame(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  const step = DUP_PIXEL_STRIDE * 4; // RGBA
  let sampled = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i += step) {
    sampled++;
    // RGB only, and always the *source* pixels: alpha is computed from the
    // colour, so comparing it adds no information and amplifies edge noise
    // (measured: 8 fewer merges on a real clip once keying was switched on).
    if (
      Math.abs(a[i] - b[i]) > DUP_CHANNEL_TOLERANCE ||
      Math.abs(a[i + 1] - b[i + 1]) > DUP_CHANNEL_TOLERANCE ||
      Math.abs(a[i + 2] - b[i + 2]) > DUP_CHANNEL_TOLERANCE
    ) {
      changed++;
    }
  }
  return sampled > 0 && changed / sampled < DUP_MAX_CHANGED_RATIO;
}

/**
 * Removes the background colour from a frame, in place. Pure byte work — no
 * canvas, no DOM — so it can be unit-tested under plain Node.
 *
 * Two ideas do the work, and both are there to fix something a plain "distance
 * from the key colour" keyer gets wrong:
 *
 * 1. **The distance is normalised per channel.** `|P − B|` is divided by how far
 *    that channel *can* travel away from the background, `max(B, 255 − B)`.
 *    GIMP's Color-to-Alpha divides by `255 − B`, which blows up on a near-white
 *    backdrop: with B = 253, a pixel one step brighter than the noise floor
 *    would come out half transparent.
 * 2. **Only the region connected to the frame border is touched.** A flood fill
 *    starts at the edges and spreads through pixels that look like background,
 *    stopping at anything solid. Colours *inside* the subject — the white of an
 *    eye, a cream-coloured page — are never reached, so they stay opaque.
 *    Measured on the real clip: those pages went from 71% semi-transparent to
 *    100% opaque.
 *
 * Pixels inside the region get their alpha from the distance rescaled out of
 * `[threshold, KEY_SOLID_DISTANCE]` and *scaled by the alpha they came in with*,
 * so a source that already had transparency only ever gets more of it. On a
 * pixel that arrived opaque the background is then un-blended out of the colour
 * (`C = Fg·a + Bg·(1−a)` solved for Fg) so edges keep the subject's own colour
 * instead of a halo of the backdrop. A pixel that arrived translucent is left
 * alone: un-blending assumes the backdrop is *behind* it, and for that pixel it
 * demonstrably wasn't.
 *
 * @param scratch reusable working buffers, sized for at least `width * height`
 *   pixels (see `createKeyScratch`). Omit it and one is allocated per call —
 *   fine for a one-off, wasteful across a whole animation.
 */
export function keyBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: TransparentBackground,
  scratch?: KeyScratch,
): void {
  const total = width * height;
  if (total <= 0 || data.length < total * 4) return;

  const bg = opts.color;
  // Per-channel span: how far this channel can get from the background at all.
  const scale = [
    Math.max(1, Math.max(bg[0], 255 - bg[0])),
    Math.max(1, Math.max(bg[1], 255 - bg[1])),
    Math.max(1, Math.max(bg[2], 255 - bg[2])),
  ];

  const { distance, region, queue } =
    scratch && scratch.region.length >= total ? scratch : createKeyScratch(total);
  region.fill(0, 0, total); // a reused region map still holds the last frame

  for (let p = 0, i = 0; p < total; p++, i += 4) {
    // Already invisible (image mode letterboxes the canvas). Treat it as pure
    // background so the fill can travel through it, and leave its RGB alone.
    if (data[i + 3] === 0) {
      distance[p] = 0;
      continue;
    }
    let far = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(data[i + c] - bg[c]) / scale[c];
      if (d > far) far = d;
    }
    distance[p] = Math.round(far * KEY_DISTANCE_STEPS);
  }

  // Flood fill (4-neighbour) inward from every border pixel that still looks
  // like background. One Int32Array queue is enough: a pixel is enqueued once.
  const solidCut = KEY_SOLID_DISTANCE * KEY_DISTANCE_STEPS;
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (!region[p] && distance[p] < solidCut) {
      region[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p + width < total) push(p + width);
  }

  const low = clamp(opts.threshold, 0, KEY_SOLID_DISTANCE);
  const span = Math.max(1e-6, KEY_SOLID_DISTANCE - low);
  for (let p = 0; p < total; p++) {
    if (!region[p]) continue; // outside the fill — solid subject, left as-is
    const a = clamp((distance[p] / KEY_DISTANCE_STEPS - low) / span, 0, 1);
    const i = p * 4;
    if (a <= 0) {
      data[i + 3] = 0; // background, sensor noise and all
      continue;
    }
    const sourceAlpha = data[i + 3];
    if (a < 1 && sourceAlpha === 255) {
      // Uint8ClampedArray rounds and clamps on assignment.
      for (let c = 0; c < 3; c++) data[i + c] = (data[i + c] - bg[c] * (1 - a)) / a;
    }
    data[i + 3] = Math.round(a * sourceAlpha);
  }
}

/**
 * Guesses a frame's background colour: the most common colour along its outer
 * border, counted verbatim. A keyed source has a flat backdrop, so the border
 * is where it is guaranteed to show — and the mode of a flat backdrop is the
 * backdrop. Falls back to white on an empty image.
 */
export function detectBackgroundColor(image: ImageData): [number, number, number] {
  const { width, height, data } = image;
  const counts = new Map<number, number>();
  let best = 0xffffff;
  let bestCount = 0;

  const tally = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    // Pack RGB into one int so the tally is a plain number → count map.
    const packed = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const next = (counts.get(packed) ?? 0) + 1;
    counts.set(packed, next);
    if (next > bestCount) {
      bestCount = next;
      best = packed;
    }
  };

  for (let ring = 0; ring < BG_RING_DEPTH; ring++) {
    const right = width - 1 - ring;
    const bottom = height - 1 - ring;
    if (right < ring || bottom < ring) break; // rings met in the middle
    for (let x = ring; x <= right; x++) {
      tally(x, ring);
      tally(x, bottom);
    }
    for (let y = ring + 1; y < bottom; y++) {
      tally(ring, y);
      tally(right, y);
    }
  }
  return [(best >> 16) & 0xff, (best >> 8) & 0xff, best & 0xff];
}

/** Draws every frame of a source onto one reused canvas and muxes the result. */
async function muxFrameSource(
  source: FrameSource,
  opts: VideoToWebpOptions,
  encoder: FrameEncoder,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<WebpConversionResult> {
  const key = opts.transparent;
  // One canvas for the whole run — only the encoded bytes are kept per frame.
  // Every frame is now read back (duplicate detection, and keying on top of it),
  // so willReadFrequently is worth asking for whichever encoder we ended up with.
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", {
    // Keying punches holes in otherwise opaque frames — it needs the channel.
    alpha: source.alpha || !!key,
    willReadFrequently: true,
  });
  if (!ctx) throw new Error("errorConvertFailed");

  const fps = clamp(Math.round(opts.fps), 1, 60);
  const quality = clamp(Math.round(opts.quality), 1, 100);
  const frameDurationMs = Math.max(1, Math.round(1000 / fps));
  // Keying's working buffers, allocated once and handed to every frame.
  const keyScratch = key ? createKeyScratch(source.width * source.height) : undefined;

  onProgress?.(0, source.count);

  const frames: Uint8Array[] = [];
  const durations: number[] = [];
  /**
   * Source pixels of the last frame that was *kept* — not simply the last one
   * drawn, and never the keyed version: comparing what came out of the source
   * keeps the merge count identical whether or not keying is on.
   */
  let kept: Uint8ClampedArray | null = null;
  let mergedCount = 0;

  for (let index = 0; index < source.count; index++) {
    throwIfAborted(signal);
    await source.draw(index, ctx);
    throwIfAborted(signal);

    // One readback per frame, shared by the duplicate check and the keying.
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (kept && isDuplicateFrame(kept, image.data)) {
      // Identical to the frame already in the animation: don't encode (or key)
      // it again, just hold that one on screen for this frame's share of time.
      durations[durations.length - 1] += frameDurationMs;
      mergedCount++;
    } else {
      // Snapshot the source pixels before keying rewrites the buffer in place.
      kept = key ? new Uint8ClampedArray(image.data) : image.data;
      if (key) {
        keyBackground(image.data, canvas.width, canvas.height, key, keyScratch);
        // The canvas path encodes what the canvas holds, so keyed pixels have
        // to go back before toBlob sees them.
        if (!encoder.usesImageData) ctx.putImageData(image, 0, 0);
      }
      frames.push(await encoder.encode(canvas, quality, image));
      durations.push(frameDurationMs);
    }
    onProgress?.(index + 1, source.count);
  }

  const bytes = buildAnimatedWebP(
    frames.map((frameBytes, i) => ({ bytes: frameBytes, durationMs: durations[i] })),
    {
      width: source.width,
      height: source.height,
      loopCount: Math.max(0, Math.round(opts.loopCount)),
    },
  );
  return {
    blob: new Blob([asBlobPart(bytes)], { type: "image/webp" }),
    frames,
    width: source.width,
    height: source.height,
    frameCount: frames.length,
    mergedCount,
  };
}

/**
 * Converts a video file into an animated WebP by sampling it at `opts.fps`.
 *
 * @param onProgress called with (frames encoded, total frames).
 * @param signal aborting rejects with `CANCELLED` at the next frame boundary.
 */
export async function convertVideoToWebP(
  file: File,
  opts: VideoToWebpOptions,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<WebpConversionResult> {
  throwIfAborted(signal);
  // Raced against the signal so cancelling works even while the wasm encoder is
  // still loading — that wait is the longest thing before the frame loop.
  const encoder = await raceAbort(createFrameEncoder(), signal);
  throwIfAborted(signal);

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await waitForVideoData(video);
    throwIfAborted(signal);

    const duration = video.duration;
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      throw new Error("errorVideoLoad");
    }

    const fps = clamp(Math.round(opts.fps), 1, 60);
    const { width, height } = resolveOutputSize(
      video.videoWidth,
      video.videoHeight,
      opts.resolution,
    );

    const source: FrameSource = {
      width,
      height,
      count: estimateFrameCount(duration, fps),
      // Video frames are opaque, which keeps ALPH chunks out of the output —
      // unless keying is on, and that turns the channel back on by itself.
      alpha: false,
      draw: async (index, ctx) => {
        // Seeking to exactly `duration` can leave `seeked` unfired — stay short of it.
        // Raced against the signal so cancelling doesn't have to sit through the
        // seek timeout (and doesn't come back as a seek failure).
        await raceAbort(seekTo(video, Math.min(index / fps, duration - 0.0001)), signal);
        // A keyed canvas has alpha, so a video carrying its own transparency
        // would let the previous frame show through what it doesn't cover.
        if (opts.transparent) ctx.clearRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);
      },
    };
    return await muxFrameSource(source, opts, encoder, onProgress, signal);
  } finally {
    // Detach the source so the decoder lets go of the file before the URL dies.
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Muxes still images into an animated WebP, one image per frame, **in the order
 * given** (callers sort with `sortImageFiles`). The canvas is sized from the
 * FIRST image; other sizes are centred with `contain` and the leftover area
 * stays transparent.
 */
export async function convertImagesToWebP(
  files: File[],
  opts: VideoToWebpOptions,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<WebpConversionResult> {
  if (files.length === 0) throw new Error("errorImageLoad");
  throwIfAborted(signal);
  const encoder = await raceAbort(createFrameEncoder(), signal);
  throwIfAborted(signal);

  const first = await decodeImage(files[0]);
  const { width, height } = resolveOutputSize(first.width, first.height, opts.resolution);
  first.close();
  throwIfAborted(signal);

  const source: FrameSource = {
    width,
    height,
    count: files.length,
    alpha: true, // letterboxing around odd-sized frames stays transparent
    draw: async (index, ctx) => {
      const bitmap = await decodeImage(files[index]);
      try {
        ctx.clearRect(0, 0, width, height);
        // contain: fit inside the canvas without cropping, centred.
        const scale = Math.min(width / bitmap.width, height / bitmap.height);
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        ctx.drawImage(
          bitmap,
          Math.round((width - w) / 2),
          Math.round((height - h) / 2),
          w,
          h,
        );
      } finally {
        // Decode one image at a time: never hold a pile of bitmaps in memory.
        bitmap.close();
      }
    },
  };
  return muxFrameSource(source, opts, encoder, onProgress, signal);
}

/** Draws a frame into a (possibly shrunk) canvas and hands back its pixels. */
function readFramePixels(
  frame: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
): ImageData {
  // Detection only walks the border, so shrink big frames first — reading a 4K
  // frame back would allocate tens of MB for a handful of useful pixels, and a
  // flat backdrop (the only thing worth keying) survives the scale unchanged.
  const scale = Math.min(1, BG_DETECT_MAX_EDGE / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("errorConvertFailed");
  ctx.drawImage(frame, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

async function readFirstVideoFrame(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    // readyState >= HAVE_CURRENT_DATA means frame 0 is decoded and the element
    // is still parked on it, so there's nothing to seek to.
    await waitForVideoData(video);
    if (!video.videoWidth || !video.videoHeight) throw new Error("errorVideoLoad");
    return readFramePixels(video, video.videoWidth, video.videoHeight);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Background colour of a source's first frame, for seeding the chroma-key
 * swatch. Runs on its own element, so the page's preview is untouched. Returns
 * null instead of throwing: a guess that didn't work out is no reason to fail
 * anything — the caller just keeps its default.
 */
export async function detectSourceBackground(
  file: File,
  isVideo: boolean,
): Promise<[number, number, number] | null> {
  try {
    let image: ImageData;
    if (isVideo) {
      image = await readFirstVideoFrame(file);
    } else {
      const bitmap = await decodeImage(file);
      try {
        image = readFramePixels(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    }
    return detectBackgroundColor(image);
  } catch {
    return null;
  }
}

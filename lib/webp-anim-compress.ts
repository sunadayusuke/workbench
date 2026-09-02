// webp-anim-compress.ts — re-compresses an animated WebP (compress app).
//
// The plain image path bakes a WebP down to one still frame: `createImageBitmap`
// hands back frame 0 and everything after it is lost. This one keeps the
// animation — demux, replay, re-encode, re-mux:
//
//   1. `parseAnimatedWebP` reads the frames back out of the file.
//   2. Each frame is decoded on its own (wrapped as a still WebP) and composited
//      onto a canvas *buffer* exactly the way the container spec says to: honour
//      the previous frame's dispose method, then blend or replace this frame's
//      rectangle. Compositing is plain array work rather than canvas drawing, so
//      the model is testable under Node and the blend itself never round-trips
//      through premultiplied alpha (decoding and encoding still cross a canvas
//      once each).
//   3. The composited state is diffed against the previous one, and only the
//      changed rectangle is re-encoded. A frame that changed nothing at all is
//      dropped and its time handed to the frame before it.
//   4. Every output frame is written no-blend / dispose-none, i.e. it *replaces*
//      its rectangle. That keeps *blending* error out of repeat compressions —
//      nothing is ever alpha-blended on top of already-lossy pixels. The lossy
//      re-encode itself still costs a generation each time, as it always does.
//
// Error messages are the compress app's own `ErrorKey`s, thrown as `Error`.

import {
  buildAnimatedWebP,
  parseAnimatedWebP,
  wrapFrameAsStillWebP,
  type AnimatedWebPFrame,
  type AnimatedWebPFrameInfo,
  type ParsedAnimatedWebP,
} from "./webp-anim";
import { asBlobPart, createFrameEncoder, type FrameEncoder } from "./webp-encode";

/**
 * Ceiling on the canvas we will allocate for, in pixels — 8192², i.e. 256MiB per
 * RGBA buffer and two of them. VP8X stores width and height as 24-bit fields, so
 * a hostile (or simply broken) file can declare 20000×20000 and take the tab
 * down with it before a single frame has been decoded.
 */
const MAX_CANVAS_PIXELS = 1 << 26;

/** A rectangle on the canvas, in pixels. */
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnimatedWebPCompressOptions {
  /** Still-WebP quality, 1–100. */
  quality: number;
}

// ── Pure compositing (no DOM — unit-tested under Node) ───────────────────────

/** Clears `rect` back to transparent black — what "dispose to background" does. */
export function clearRectRGBA(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  rect: FrameRect,
): void {
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * canvasWidth + rect.x) * 4;
    canvas.fill(0, start, start + rect.width * 4);
  }
}

/**
 * Draws a frame's pixels into `rect`.
 *
 * `blend: "none"` overwrites the rectangle. `blend: "alpha"` is the container
 * spec's source-over, written out on unpremultiplied channels:
 *   outA = srcA + dstA · (1 − srcA)
 *   outC = (srcC · srcA + dstC · dstA · (1 − srcA)) / outA
 */
export function drawRectRGBA(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  rect: FrameRect,
  src: Uint8ClampedArray,
  blend: "alpha" | "none",
): void {
  for (let row = 0; row < rect.height; row++) {
    const dstRow = ((rect.y + row) * canvasWidth + rect.x) * 4;
    const srcRow = row * rect.width * 4;
    for (let col = 0; col < rect.width; col++) {
      const d = dstRow + col * 4;
      const s = srcRow + col * 4;
      const srcA = src[s + 3];
      const dstA = canvas[d + 3];
      // Replacing is not just the "none" case: an opaque source, or a canvas
      // with nothing under it, gives exactly the source either way.
      if (blend === "none" || srcA === 255 || dstA === 0) {
        canvas[d] = src[s];
        canvas[d + 1] = src[s + 1];
        canvas[d + 2] = src[s + 2];
        canvas[d + 3] = srcA;
        continue;
      }
      if (srcA === 0) continue; // nothing to add — leave what's underneath

      const inv = 1 - srcA / 255;
      const outA = srcA + dstA * inv; // > 0 here: srcA ≥ 1
      for (let c = 0; c < 3; c++) {
        canvas[d + c] = (src[s + c] * srcA + canvas[d + c] * dstA * inv) / outA;
      }
      canvas[d + 3] = outA; // Uint8ClampedArray rounds on assignment
    }
  }
}

/**
 * Smallest rectangle covering every pixel that differs between the two canvas
 * states, or null when they are identical. Exact RGBA comparison: the point is
 * "can this frame be skipped entirely", not "does it look close enough".
 */
export function changedBounds(
  previous: Uint8ClampedArray,
  next: Uint8ClampedArray,
  width: number,
  height: number,
): FrameRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 4;
      if (
        previous[i] !== next[i] ||
        previous[i + 1] !== next[i + 1] ||
        previous[i + 2] !== next[i + 2] ||
        previous[i + 3] !== next[i + 3]
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Snaps the origin down to even coordinates, growing the rectangle to keep the
 * same pixels covered. ANMF stores X/Y halved, so an odd offset is unwritable —
 * and growing is the only direction that can't drop a changed pixel.
 */
export function alignRectEven(rect: FrameRect): FrameRect {
  const x = rect.x - (rect.x & 1);
  const y = rect.y - (rect.y & 1);
  return {
    x,
    y,
    width: rect.width + (rect.x - x),
    height: rect.height + (rect.y - y),
  };
}

/**
 * Copies `rect` out of the canvas as a standalone RGBA buffer. The explicit
 * `ArrayBuffer` argument is what lets the result go straight into an ImageData —
 * a bare `Uint8ClampedArray` widens to ArrayBufferLike, which that rejects.
 */
export function cropRGBA(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  rect: FrameRect,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(rect.width * rect.height * 4);
  const rowBytes = rect.width * 4;
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * canvasWidth + rect.x) * 4;
    out.set(canvas.subarray(start, start + rowBytes), row * rowBytes);
  }
  return out;
}

// ── Browser side ─────────────────────────────────────────────────────────────

function create2dContext(willReadFrequently: boolean): CanvasRenderingContext2D {
  const ctx = document
    .createElement("canvas")
    .getContext("2d", { alpha: true, willReadFrequently });
  if (!ctx) throw new Error("errorEncodeFailed");
  return ctx;
}

/** Decodes one frame on its own and hands back its unpremultiplied pixels. */
async function decodeFramePixels(
  frame: AnimatedWebPFrameInfo,
  ctx: CanvasRenderingContext2D,
): Promise<Uint8ClampedArray> {
  const still = wrapFrameAsStillWebP(frame);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(
      new Blob([asBlobPart(still)], { type: "image/webp" }),
    );
  } catch {
    throw new Error("errorDecodeFailed");
  }
  try {
    // Assigning the size also clears the canvas, so nothing of the frame before
    // it can survive underneath a frame with transparency.
    ctx.canvas.width = frame.width;
    ctx.canvas.height = frame.height;
    ctx.drawImage(bitmap, 0, 0);
  } finally {
    bitmap.close();
  }
  return ctx.getImageData(0, 0, frame.width, frame.height).data;
}

/** Encodes one rectangle of the composited canvas as a still WebP. */
async function encodeRect(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  rect: FrameRect,
  encoder: FrameEncoder,
  quality: number,
  ctx: CanvasRenderingContext2D,
): Promise<Uint8Array> {
  const image = new ImageData(
    cropRGBA(canvas, canvasWidth, rect),
    rect.width,
    rect.height,
  );
  ctx.canvas.width = rect.width;
  ctx.canvas.height = rect.height;
  ctx.putImageData(image, 0, 0);
  try {
    return await encoder.encode(ctx.canvas, quality, image);
  } catch {
    // The encoder's own keys (errorEncodeUnsupported / errorEncoderLoadFailed)
    // are the webp app's vocabulary — compress only has the one.
    throw new Error("errorEncodeFailed");
  }
}

function rectOf(frame: AnimatedWebPFrameInfo): FrameRect {
  return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
}

/**
 * Re-compresses an animated WebP, animation intact.
 *
 * @param onProgress called with 0–1 as frames are processed.
 * @returns the re-muxed file, or the untouched original when re-encoding didn't
 *   beat it — this never hands back something bigger than it was given.
 */
export async function compressAnimatedWebP(
  file: File,
  opts: AnimatedWebPCompressOptions,
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  let parsed: ParsedAnimatedWebP;
  try {
    parsed = parseAnimatedWebP(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("errorDecodeFailed");
  }
  const { width, height, loopCount, frames } = parsed;

  try {
    // Refuse an absurd canvas before allocating for it, not after.
    if (width * height > MAX_CANVAS_PIXELS) throw new Error("errorDecodeFailed");
    // A frame reaching outside the canvas is malformed — libwebp rejects those
    // outright, so no player would agree with whatever we made of it. (Width and
    // height can't be zero: the file stores them as size − 1.)
    for (const frame of frames) {
      if (frame.x + frame.width > width || frame.y + frame.height > height) {
        throw new Error("errorDecodeFailed");
      }
    }

    const quality = Math.max(1, Math.min(100, Math.round(opts.quality)));
    const encoder = await createFrameEncoder();
    // Both canvases are read back every frame — the decode one through
    // getImageData, the encode one through toBlob — so neither wants a GPU
    // texture round trip.
    const decodeCtx = create2dContext(true);
    const encodeCtx = create2dContext(true);

    // The canvas starts fully transparent, as the spec's background colour does
    // for every player that ignores it (all of them, in practice).
    const canvas = new Uint8ClampedArray(width * height * 4);
    const previous = new Uint8ClampedArray(width * height * 4);
    const out: AnimatedWebPFrame[] = [];

    for (const [index, frame] of frames.entries()) {
      onProgress?.(index / frames.length);

      const before = index > 0 ? frames[index - 1] : null;
      if (before && before.dispose === "background") {
        clearRectRGBA(canvas, width, rectOf(before));
      }
      drawRectRGBA(
        canvas,
        width,
        rectOf(frame),
        await decodeFramePixels(frame, decodeCtx),
        frame.blend,
      );

      // Frame 0 always covers the canvas; after that only what moved is written.
      const bounds =
        index === 0
          ? { x: 0, y: 0, width, height }
          : changedBounds(previous, canvas, width, height);
      if (!bounds) {
        // Identical to what's already on screen: hold that frame for longer
        // instead of spending a whole frame on saying nothing.
        out[out.length - 1].durationMs += frame.durationMs;
        continue;
      }

      const rect = alignRectEven(bounds);
      out.push({
        bytes: await encodeRect(canvas, width, rect, encoder, quality, encodeCtx),
        durationMs: frame.durationMs,
        ...rect,
      });
      previous.set(canvas);
    }

    const muxed = buildAnimatedWebP(out, { width, height, loopCount });
    onProgress?.(1);
    // Already-tight sources (or a very high quality setting) can come out bigger.
    if (muxed.length >= file.size) return { blob: file, ext: "webp" };
    return {
      blob: new Blob([asBlobPart(muxed)], { type: "image/webp" }),
      ext: "webp",
    };
  } catch (error) {
    const message = (error as Error)?.message;
    if (message === "errorDecodeFailed") throw error;
    throw new Error("errorEncodeFailed");
  }
}

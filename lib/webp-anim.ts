// webp-anim.ts — animated WebP muxer / demuxer (webp + compress apps).
//
// Muxing: combines a series of *still* WebP files into one animated WebP — each
// frame's image chunks (ALPH / VP8 / VP8L) are pulled out of their RIFF
// container and re-wrapped in an ANMF chunk.
// Demuxing: the reverse — reads the frames back out of an existing animation so
// they can be re-encoded (the compress app) without flattening the animation.
// Pure byte manipulation — no DOM, no canvas, no browser APIs — so the unit
// tests can run all of it under plain Node.
//
// Layout, per the WebP Container Specification (RIFF-based):
//   "RIFF" + uint32LE(size) + "WEBP" | VP8X | ANIM | ANMF × frames
// Every chunk is `FourCC + uint32LE(payload size) + payload`.
//
// The rule that bites hardest: a chunk whose payload length is ODD gets one
// 0x00 pad byte, and the size field does NOT count that byte. Frame data inside
// ANMF is itself a chunk sequence, so the same padding applies there. Getting it
// wrong still decodes in some viewers, which makes it easy to ship broken.

/** One frame's image data: ALPH (optional) + VP8/VP8L, still in chunk form. */
export interface WebPFrameChunks {
  /** ALPH?+VP8/VP8L concatenated as complete, padded RIFF chunks. */
  chunks: Uint8Array;
  hasAlpha: boolean;
}

/** A frame of the animation: a complete still WebP plus how long it shows. */
export interface AnimatedWebPFrame {
  /** A complete still WebP file. */
  bytes: Uint8Array;
  /**
   * Display time in ms. Usually Math.round(1000 / fps), but a frame that stood
   * in for identical ones after it carries their time too.
   */
  durationMs: number;
  /**
   * Where the frame sits on the canvas. Left out, the frame covers the whole
   * canvas at (0,0) — what a plain video/image conversion produces.
   *
   * x and y must be EVEN: ANMF stores them halved, so an odd offset cannot be
   * expressed at all. Snapping is the caller's call to make, not ours.
   */
  x?: number;
  y?: number;
  /** Defaults to the canvas size. */
  width?: number;
  height?: number;
}

export interface AnimatedWebPOptions {
  /** Canvas width. Every frame is assumed to be exactly this size. */
  width: number;
  height: number;
  /** 0 = loop forever. */
  loopCount: number;
}

const RIFF_HEADER_SIZE = 12; // "RIFF" + uint32 + "WEBP"
const CHUNK_HEADER_SIZE = 8; // FourCC + uint32
const VP8X_PAYLOAD_SIZE = 10;
const ANIM_PAYLOAD_SIZE = 6;
const ANMF_HEADER_SIZE = 16;

// VP8X feature flags (byte 0, from the MSB: Rsv Rsv I L E X A R).
const VP8X_ANIMATION = 0x02;
const VP8X_ALPHA = 0x10;

// ANMF flags byte: reserved(6) | blending(1) | disposal(1).
const ANMF_BLEND_NONE = 0x02;
const ANMF_DISPOSE_BACKGROUND = 0x01;
// 0x02 = do NOT blend onto the canvas, do NOT dispose. "No blend" means a frame
// simply *replaces* the pixels under its rectangle — which is what we want for
// transparent frames too (alpha-blending would let earlier frames show through
// the holes), and what keeps a partial frame a plain, lossless-to-repeat patch.
const ANMF_NO_BLEND_NO_DISPOSE = ANMF_BLEND_NONE;

const MAX_DIMENSION = 1 << 24; // canvas / frame size fields are 24-bit
const MAX_DURATION_MS = (1 << 24) - 1;
const MAX_LOOP_COUNT = 0xffff;

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function writeFourCC(out: Uint8Array, offset: number, fourCC: string): void {
  for (let i = 0; i < 4; i++) out[offset + i] = fourCC.charCodeAt(i);
}

function writeU16LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >>> 8) & 0xff;
}

function writeU24LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >>> 8) & 0xff;
  out[offset + 2] = (value >>> 16) & 0xff;
}

function writeU32LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >>> 8) & 0xff;
  out[offset + 2] = (value >>> 16) & 0xff;
  out[offset + 3] = (value >>> 24) & 0xff;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Wraps a payload as a complete RIFF chunk, zero-padded to an even length. */
function makeChunk(fourCC: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(
    CHUNK_HEADER_SIZE + payload.length + (payload.length & 1),
  );
  writeFourCC(out, 0, fourCC);
  writeU32LE(out, 4, payload.length); // size excludes the pad byte
  out.set(payload, CHUNK_HEADER_SIZE);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Wraps complete chunks in a RIFF/WEBP container. */
function buildRiff(chunks: Uint8Array[]): Uint8Array {
  let bodySize = 0;
  for (const chunk of chunks) bodySize += chunk.length;

  const out = new Uint8Array(RIFF_HEADER_SIZE + bodySize);
  writeFourCC(out, 0, "RIFF");
  writeU32LE(out, 4, 4 + bodySize); // "WEBP" + every chunk, padding included
  writeFourCC(out, 8, "WEBP");
  let offset = RIFF_HEADER_SIZE;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** One chunk located inside a buffer; `payloadEnd` excludes the pad byte. */
interface ChunkRef {
  fourCC: string;
  payloadStart: number;
  payloadEnd: number;
}

/**
 * Lists the RIFF chunks in `[start, end)`. Every offset is bounds-checked and
 * the walk only ever moves forward, so a lying size field truncates the list
 * instead of reading past the buffer or spinning.
 */
function listChunks(bytes: Uint8Array, start: number, end: number): ChunkRef[] {
  const found: ChunkRef[] = [];
  let offset = start;
  while (offset + CHUNK_HEADER_SIZE <= end) {
    const fourCC = readFourCC(bytes, offset);
    const size = readU32LE(bytes, offset + 4);
    const payloadStart = offset + CHUNK_HEADER_SIZE;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > end) break; // truncated — keep what we have
    found.push({ fourCC, payloadStart, payloadEnd });
    offset = payloadEnd + (size & 1); // odd payload → skip the pad byte
  }
  return found;
}

/**
 * End of the RIFF body. The declared size wins when it fits — trailing bytes
 * after a well-formed file are not ours to read — otherwise the buffer does.
 */
function riffBodyEnd(bytes: Uint8Array): number {
  const declared = CHUNK_HEADER_SIZE + readU32LE(bytes, 4);
  return declared >= RIFF_HEADER_SIZE && declared <= bytes.length
    ? declared
    : bytes.length;
}

/**
 * Picks the ALPH / VP8 / VP8L chunks out of a chunk list and re-emits them in
 * spec order. Everything else (VP8X, ICCP, EXIF, XMP, anything unknown) is
 * dropped on purpose — the animation writes its own header chunks.
 */
function collectImageChunks(bytes: Uint8Array, chunks: ChunkRef[]): WebPFrameChunks {
  let alph: Uint8Array | null = null;
  let image: Uint8Array | null = null;
  let hasAlpha = false;

  for (const { fourCC, payloadStart, payloadEnd } of chunks) {
    if (fourCC === "ALPH") {
      alph = makeChunk(fourCC, bytes.subarray(payloadStart, payloadEnd));
      hasAlpha = true;
    } else if (fourCC === "VP8 " || fourCC === "VP8L") {
      // `VP8 ` has a trailing space: a `startsWith("VP8")` test would also match
      // VP8L and mangle lossless frames.
      image = makeChunk(fourCC, bytes.subarray(payloadStart, payloadEnd));
      // A lossless frame can carry alpha inside the VP8L bitstream with no ALPH
      // chunk present, so flag alpha conservatively.
      if (fourCC === "VP8L") hasAlpha = true;
    }
  }

  if (!image) throw new Error("noImageChunk");
  // ALPH must precede the image chunk, whatever order the source used.
  return { chunks: alph ? concat([alph, image]) : image, hasAlpha };
}

/**
 * Extracts the image chunks of a complete still WebP file. The source VP8X is
 * dropped on purpose — the animation gets its own. Throws when the file holds no
 * VP8/VP8L chunk at all.
 */
export function extractImageChunks(webpBytes: Uint8Array): WebPFrameChunks {
  if (webpBytes.length < RIFF_HEADER_SIZE) throw new Error("webpTooShort");
  if (readFourCC(webpBytes, 0) !== "RIFF" || readFourCC(webpBytes, 8) !== "WEBP") {
    throw new Error("notWebP");
  }
  return collectImageChunks(
    webpBytes,
    listChunks(webpBytes, RIFF_HEADER_SIZE, webpBytes.length),
  );
}

/** Frame rectangle on the canvas, defaulted and validated against it. */
function resolveFrameRect(
  frame: AnimatedWebPFrame,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; width: number; height: number } {
  const x = Math.round(frame.x ?? 0);
  const y = Math.round(frame.y ?? 0);
  const width = Math.round(frame.width ?? canvasWidth);
  const height = Math.round(frame.height ?? canvasHeight);

  if (![x, y, width, height].every(Number.isFinite)) {
    throw new Error("invalidFrameRect");
  }
  // ANMF stores X/Y halved, so an odd offset simply cannot be written. Rounding
  // it here would move the frame by a pixel without telling anyone.
  if (x % 2 !== 0 || y % 2 !== 0) throw new Error("oddFrameOffset");
  if (
    x < 0 ||
    y < 0 ||
    width < 1 ||
    height < 1 ||
    x + width > canvasWidth ||
    y + height > canvasHeight
  ) {
    throw new Error("invalidFrameRect");
  }
  return { x, y, width, height };
}

/**
 * Muxes complete still WebP files into one animated WebP.
 *
 * @param frames full still WebP files with their display times, in display
 *   order. A frame's pixel size must match its rectangle — `x`/`y`/`width`/
 *   `height` if given, the whole canvas otherwise — because the ANMF headers are
 *   written from those numbers, not read back from the bitstreams.
 */
export function buildAnimatedWebP(
  frames: AnimatedWebPFrame[],
  opts: AnimatedWebPOptions,
): Uint8Array {
  if (frames.length === 0) throw new Error("noFrames");
  const width = Math.round(opts.width);
  const height = Math.round(opts.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new Error("invalidCanvasSize");
  }

  const loopCount = clampInt(opts.loopCount, 0, MAX_LOOP_COUNT);

  // Rectangles first: a frame that can't be placed is worth knowing about before
  // every bitstream has been copied.
  const rects = frames.map((frame) => resolveFrameRect(frame, width, height));
  const extracted = frames.map((frame) => extractImageChunks(frame.bytes));
  const hasAlpha = extracted.some((frame) => frame.hasAlpha);

  const vp8x = new Uint8Array(VP8X_PAYLOAD_SIZE);
  vp8x[0] = VP8X_ANIMATION | (hasAlpha ? VP8X_ALPHA : 0);
  // bytes 1–3: reserved (0)
  writeU24LE(vp8x, 4, width - 1);
  writeU24LE(vp8x, 7, height - 1);

  const anim = new Uint8Array(ANIM_PAYLOAD_SIZE);
  // bytes 0–3: background color as B,G,R,A. Left fully transparent; the first
  // frame covers the whole canvas and replaces it, so it never shows through.
  writeU16LE(anim, 4, loopCount); // 0 = infinite

  const chunks: Uint8Array[] = [makeChunk("VP8X", vp8x), makeChunk("ANIM", anim)];

  for (const [index, frame] of extracted.entries()) {
    const rect = rects[index];
    const payload = new Uint8Array(ANMF_HEADER_SIZE + frame.chunks.length);
    // Frame X/Y are stored halved (the spec multiplies them by 2 when reading),
    // so a full-canvas frame at (0,0) is simply zero.
    writeU24LE(payload, 0, rect.x / 2);
    writeU24LE(payload, 3, rect.y / 2);
    writeU24LE(payload, 6, rect.width - 1);
    writeU24LE(payload, 9, rect.height - 1);
    writeU24LE(payload, 12, clampInt(frames[index].durationMs, 0, MAX_DURATION_MS));
    payload[15] = ANMF_NO_BLEND_NO_DISPOSE;
    // Frame data: the chunks as-is. Each one is already even-length, so the ANMF
    // payload (16 + even) stays even and never needs padding of its own.
    payload.set(frame.chunks, ANMF_HEADER_SIZE);
    chunks.push(makeChunk("ANMF", payload));
  }

  return buildRiff(chunks);
}

// ── Demuxing ─────────────────────────────────────────────────────────────────

/** One frame of an existing animation, as read back out of its ANMF chunk. */
export interface AnimatedWebPFrameInfo {
  /** Canvas coordinates. Real pixels — the file stores X/Y halved. */
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number;
  /** "alpha" = blend onto the canvas; "none" = replace the rectangle. */
  blend: "alpha" | "none";
  /** "background" = clear this frame's rectangle before the next one is drawn. */
  dispose: "none" | "background";
  /** ALPH?+VP8/VP8L, still in chunk form — same shape as `WebPFrameChunks`. */
  chunks: Uint8Array;
  hasAlpha: boolean;
}

export interface ParsedAnimatedWebP {
  /** Canvas size from VP8X (stored as size − 1). */
  width: number;
  height: number;
  /** 0 = loop forever. */
  loopCount: number;
  frames: AnimatedWebPFrameInfo[];
}

/**
 * Whether these bytes are an *animated* WebP. Only the first chunk is read (the
 * spec puts VP8X there), so a 32-byte prefix of the file is enough — handy when
 * the alternative is buffering a whole file to find out. Never throws: anything
 * short, truncated or simply not a WebP answers false.
 */
export function isAnimatedWebP(bytes: Uint8Array): boolean {
  const minimum = RIFF_HEADER_SIZE + CHUNK_HEADER_SIZE + VP8X_PAYLOAD_SIZE;
  if (bytes.length < minimum) return false;
  if (readFourCC(bytes, 0) !== "RIFF" || readFourCC(bytes, 8) !== "WEBP") return false;
  if (readFourCC(bytes, RIFF_HEADER_SIZE) !== "VP8X") return false;
  if (readU32LE(bytes, RIFF_HEADER_SIZE + 4) < VP8X_PAYLOAD_SIZE) return false;
  return (bytes[RIFF_HEADER_SIZE + CHUNK_HEADER_SIZE] & VP8X_ANIMATION) !== 0;
}

/** Reads one ANMF payload spanning `[start, end)`. */
function readAnmfFrame(
  bytes: Uint8Array,
  start: number,
  end: number,
): AnimatedWebPFrameInfo {
  const flags = bytes[start + 15];
  return {
    // X/Y are stored halved, so they always come back even.
    x: readU24LE(bytes, start) * 2,
    y: readU24LE(bytes, start + 3) * 2,
    width: readU24LE(bytes, start + 6) + 1,
    height: readU24LE(bytes, start + 9) + 1,
    durationMs: readU24LE(bytes, start + 12),
    blend: (flags & ANMF_BLEND_NONE) !== 0 ? "none" : "alpha",
    dispose: (flags & ANMF_DISPOSE_BACKGROUND) !== 0 ? "background" : "none",
    ...collectImageChunks(bytes, listChunks(bytes, start + ANMF_HEADER_SIZE, end)),
  };
}

/**
 * Reads an animated WebP back into its frames. Chunks that carry no animation
 * (ICCP, EXIF, XMP, anything unknown) are skipped at both levels.
 *
 * Throws on a still WebP or a file too broken to read — callers that just want
 * to know which one they have should ask `isAnimatedWebP` first.
 */
export function parseAnimatedWebP(bytes: Uint8Array): ParsedAnimatedWebP {
  if (bytes.length < RIFF_HEADER_SIZE) throw new Error("webpTooShort");
  if (readFourCC(bytes, 0) !== "RIFF" || readFourCC(bytes, 8) !== "WEBP") {
    throw new Error("notWebP");
  }

  let width = 0;
  let height = 0;
  let loopCount = 0;
  let hasAnim = false;
  const frames: AnimatedWebPFrameInfo[] = [];

  for (const chunk of listChunks(bytes, RIFF_HEADER_SIZE, riffBodyEnd(bytes))) {
    const { fourCC, payloadStart, payloadEnd } = chunk;
    const size = payloadEnd - payloadStart;
    if (fourCC === "VP8X" && size >= VP8X_PAYLOAD_SIZE) {
      width = readU24LE(bytes, payloadStart + 4) + 1;
      height = readU24LE(bytes, payloadStart + 7) + 1;
    } else if (fourCC === "ANIM" && size >= ANIM_PAYLOAD_SIZE) {
      loopCount = readU16LE(bytes, payloadStart + 4);
      hasAnim = true;
    } else if (fourCC === "ANMF" && size >= ANMF_HEADER_SIZE) {
      frames.push(readAnmfFrame(bytes, payloadStart, payloadEnd));
    }
  }

  if (!hasAnim || frames.length === 0) throw new Error("notAnimatedWebP");
  if (width < 1 || height < 1) throw new Error("invalidCanvasSize");
  return { width, height, loopCount, frames };
}

/**
 * Re-wraps one frame as a standalone still WebP, so `createImageBitmap` (or any
 * decoder) can open it. The container is always the extended form: an ALPH chunk
 * is only legal after a VP8X, and writing one unconditionally keeps lossy,
 * lossless and alpha frames on the same path.
 */
export function wrapFrameAsStillWebP(frame: AnimatedWebPFrameInfo): Uint8Array {
  const width = Math.round(frame.width);
  const height = Math.round(frame.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new Error("invalidFrameRect");
  }

  const vp8x = new Uint8Array(VP8X_PAYLOAD_SIZE);
  vp8x[0] = frame.hasAlpha ? VP8X_ALPHA : 0; // no animation flag: this is a still
  writeU24LE(vp8x, 4, width - 1);
  writeU24LE(vp8x, 7, height - 1);

  return buildRiff([makeChunk("VP8X", vp8x), frame.chunks]);
}

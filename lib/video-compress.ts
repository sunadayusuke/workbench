// video-compress.ts — client-side MP4/MOV compression (compress app).
//
// Primary path: WebCodecs. mediabunny handles demux/mux and drives the browser's
// *built-in* hardware encoders, which is an order of magnitude faster than wasm and
// unlocks AV1 — far smaller files than H.264 at the same perceived quality. It's
// pure TS/ESM, so there's nothing to download at runtime and no COOP/COEP headers
// (which we deliberately never add site-wide, as they break third-party embeds).
//
// Fallback path: `lib/video-compress-ffmpeg.ts` (single-thread ffmpeg.wasm, x264).
// Used when the browser has no WebCodecs, can't encode the requested codecs, or
// can't decode the input (ProRes and friends). It costs a ~30MB core download, so
// it's strictly a last resort.
//
// Output is always MP4 (AAC audio), even for .mov input. If the re-encode ends up
// larger than the source (already-optimized inputs), the original file is returned
// unchanged so we never inflate.

import type { VideoCodec } from "mediabunny";

export type VideoQuality = "high" | "balanced" | "max";
/** `auto` picks the smallest codec the browser can encode: AV1 → VP9 → H.264. */
export type VideoFormat = "auto" | "h264";
/** Short-side cap in pixels; `0` keeps the source resolution. */
export type VideoResolution = 0 | 1440 | 1080 | 720 | 480;

export interface VideoCompressOptions {
  quality: VideoQuality;
  format: VideoFormat;
  resolution: VideoResolution;
  removeAudio: boolean;
}

// Audio is re-encoded to AAC at these bitrates (matched to the ffmpeg fallback).
const AUDIO_BITRATES: Record<VideoQuality, number> = {
  high: 160_000,
  balanced: 128_000,
  max: 96_000,
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function evenify(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

// Caps the short side at `cap` (never upscales), keeping aspect ratio. Dimensions
// are forced even because most encoders reject odd ones.
function fitShortSide(
  width: number,
  height: number,
  cap: VideoResolution,
): { width: number; height: number } {
  const short = Math.min(width, height);
  if (cap <= 0 || short <= cap) {
    return { width: evenify(width), height: evenify(height) };
  }
  const scale = cap / short;
  return width <= height
    ? { width: cap, height: evenify(height * scale) }
    : { width: evenify(width * scale), height: cap };
}

async function encodeWithWebCodecs(
  file: File,
  opts: VideoCompressOptions,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    QUALITY_HIGH,
    QUALITY_LOW,
    QUALITY_MEDIUM,
    canEncodeAudio,
    getFirstEncodableVideoCodec,
  } = await import("mediabunny");

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("noVideoTrack");

    // Display dimensions already account for pixel aspect ratio and rotation.
    const size = fitShortSide(
      await videoTrack.getDisplayWidth(),
      await videoTrack.getDisplayHeight(),
      opts.resolution,
    );

    const candidates: VideoCodec[] =
      opts.format === "h264" ? ["avc"] : ["av1", "vp9", "avc"];
    const videoCodec = await getFirstEncodableVideoCodec(candidates, {
      width: size.width,
      height: size.height,
    });
    if (!videoCodec) throw new Error("noEncodableVideoCodec");

    const audioBitrate = AUDIO_BITRATES[opts.quality];
    const audioTrack = await input.getPrimaryAudioTrack();
    // Without an AAC encoder the audio would just be dropped, leaving a silent
    // video — hand the file to ffmpeg instead. Skipped when the user asked to
    // remove the audio: no audio encoder is needed in that case, so this is
    // exactly the escape hatch for browsers (Firefox) without an AAC encoder.
    if (
      !opts.removeAudio &&
      audioTrack &&
      !(await canEncodeAudio("aac", { bitrate: audioBitrate }))
    ) {
      throw new Error("noEncodableAudioCodec");
    }

    // Quality constants scale the bitrate by codec, resolution and frame rate,
    // which a fixed bitrate can't do across AV1/VP9/H.264.
    const quality =
      opts.quality === "high"
        ? QUALITY_HIGH
        : opts.quality === "balanced"
          ? QUALITY_MEDIUM
          : QUALITY_LOW;

    const target = new BufferTarget();
    const output = new Output({
      // Metadata up front so the result plays before it's fully downloaded.
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });

    const conversion = await Conversion.init({
      input,
      output,
      // Passing an explicit bitrate forces a transcode, so a same-codec input is
      // re-encoded rather than remuxed unchanged.
      video: {
        codec: videoCodec,
        bitrate: quality,
        width: size.width,
        height: size.height,
        fit: "fill",
      },
      audio: opts.removeAudio ? { discard: true } : { codec: "aac", bitrate: audioBitrate },
      showWarnings: false,
    });

    if (!conversion.isValid) throw new Error("invalidConversion");
    // A discarded video/audio track means silent data loss (undecodable source,
    // no encodable target …) — let ffmpeg have a go at it instead. An audio track
    // discarded because *we* asked for `discard: true` is expected, not data loss.
    if (
      conversion.discardedTracks.some(
        (d) =>
          d.track.type === "video" ||
          (d.track.type === "audio" && d.reason !== "discarded_by_user"),
      )
    ) {
      throw new Error("discardedTrack");
    }

    conversion.onProgress = (p) => onProgress?.(Math.max(0, Math.min(1, p)));
    await conversion.execute();

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) throw new Error("emptyOutput");
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}

export async function compressVideo(
  file: File,
  opts: VideoCompressOptions,
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const origExt = extensionOf(file.name) || "mp4";

  if (typeof VideoEncoder !== "undefined") {
    try {
      const blob = await encodeWithWebCodecs(file, opts, onProgress);
      // Never hand back a bigger file — return the untouched original instead.
      if (blob.size >= file.size) return { blob: file, ext: origExt };
      return { blob, ext: "mp4" };
    } catch {
      // Any WebCodecs failure falls through to the wasm encoder below.
      onProgress?.(0);
    }
  }

  const { compressVideoWithFfmpeg } = await import("./video-compress-ffmpeg");
  return compressVideoWithFfmpeg(file, opts, onProgress);
}

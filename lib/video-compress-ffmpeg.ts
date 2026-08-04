// video-compress-ffmpeg.ts — ffmpeg.wasm fallback path for the compress app.
//
// This is the *fallback* encoder: `lib/video-compress.ts` prefers WebCodecs via
// mediabunny and only reaches for this module when the browser has no VideoEncoder,
// can't encode the requested codecs, or fails to decode the input (ProRes etc.).
//
// Uses the single-thread @ffmpeg/core (no COOP/COEP / SharedArrayBuffer needed).
// The ~30MB core + class worker are fetched from unpkg once and turned into
// same-origin blob URLs via toBlobURL(), so no cross-origin-isolation headers are
// required. The FFmpeg instance is a module-level singleton so the heavy core
// loads only on the first video and is reused across the queue.
//
// Output is always H.264 MP4 (AAC audio) regardless of whether the input was .mp4
// or .mov. If the re-encode ends up larger than the source (already-optimized
// inputs), the original file is returned unchanged so we never inflate.

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { VideoCompressOptions, VideoQuality } from "./video-compress";

interface VideoPreset {
  crf: number;
  preset: string; // x264 speed/efficiency preset
  audioBitrate: string;
}

// x264 CRF: lower = higher quality/bigger. Speed presets stay fast-ish because
// single-thread wasm is slow. Downscaling comes from the user-chosen resolution.
const PRESETS: Record<VideoQuality, VideoPreset> = {
  high: { crf: 23, preset: "veryfast", audioBitrate: "160k" },
  balanced: { crf: 28, preset: "veryfast", audioBitrate: "128k" },
  max: { crf: 31, preset: "superfast", audioBitrate: "96k" },
};

const CORE_VERSION = "0.12.9";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    // Worker loading has to thread three needles:
    //  1. classWorkerURL is a *variable* (not the literal
    //     `new URL("./worker.js", import.meta.url)`), so Turbopack never tries to
    //     bundle the worker — bundling fails on its dynamic import() ("expression
    //     too dynamic"). We self-host the ESM worker under /ffmpeg/ instead.
    //  2. That worker is the ESM build, which uses a *native* `import(coreURL)`
    //     (unlike the UMD worker's webpack-internal require that can't resolve an
    //     external blob), so it can load an arbitrary blob/CDN core at runtime.
    //  3. It's a module worker reading `import(coreURL).default`, so coreURL must
    //     be the ESM core (has `export default`), NOT the UMD core.
    // toBlobURL makes the core/wasm same-origin, so no COOP/COEP is required.
    const coreBase = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
    await ff.load({
      classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null; // allow a later retry
    throw e;
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

// Caps the *short* side at `cap` without ever upscaling, keeping aspect ratio and
// forcing even dimensions (x264 requires them). -2 lets scale derive the other side.
// Commas inside the expressions are escaped because a bare comma would be read as
// a filter separator in the filtergraph.
function shortSideScaleFilter(cap: number): string {
  const w = `if(gt(iw\\,ih)\\,-2\\,min(${cap}\\,trunc(iw/2)*2))`;
  const h = `if(gt(iw\\,ih)\\,min(${cap}\\,trunc(ih/2)*2)\\,-2)`;
  return `scale=${w}:${h}`;
}

export async function compressVideoWithFfmpeg(
  file: File,
  opts: VideoCompressOptions,
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  let ff: FFmpeg;
  try {
    ff = await getFFmpeg();
  } catch {
    throw new Error("errorVideoLoadFailed");
  }

  const { fetchFile } = await import("@ffmpeg/util");
  const preset = PRESETS[opts.quality];
  const inName = extensionOf(file.name) === "mov" ? "input.mov" : "input.mp4";
  const outName = "output.mp4";
  const origExt = extensionOf(file.name) || "mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.max(0, Math.min(1, progress)));
  };
  ff.on("progress", progressHandler);

  const cleanup = async () => {
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
  };

  try {
    await ff.writeFile(inName, await fetchFile(file));

    const args = [
      "-i", inName,
      "-c:v", "libx264",
      "-preset", preset.preset,
      "-crf", String(preset.crf),
    ];
    if (opts.resolution > 0) {
      args.push("-vf", shortSideScaleFilter(opts.resolution));
    }
    if (opts.removeAudio) {
      args.push("-an");
    } else {
      args.push("-c:a", "aac", "-b:a", preset.audioBitrate);
    }
    args.push("-movflags", "+faststart", outName);

    await ff.exec(args);

    const data = (await ff.readFile(outName)) as Uint8Array;
    if (!data || data.length === 0) throw new Error("errorVideoFailed");
    // readFile's Uint8Array may be typed as SharedArrayBuffer-backed; cast to a
    // plain BlobPart (the single-thread core returns a normal ArrayBuffer).
    const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
    await cleanup();

    // Never hand back a bigger file — return the untouched original instead.
    if (blob.size >= file.size) {
      return { blob: file, ext: origExt };
    }
    return { blob, ext: "mp4" };
  } catch (e) {
    await cleanup();
    if ((e as Error).message?.startsWith("errorVideo")) throw e;
    throw new Error("errorVideoFailed");
  } finally {
    ff.off("progress", progressHandler);
  }
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { AppTopBar } from "@/components/app-top-bar";
import { ButtonSelect } from "@/components/ui/button-select";
import { ColorRow } from "@/components/ui/color-row";
import { ControlPanel } from "@/components/ui/control-panel";
import { ControlRow } from "@/components/ui/control-row";
import { DragParam } from "@/components/ui/drag-param";
import { NestedGroup } from "@/components/ui/nested-group";
import { PanelSection } from "@/components/ui/panel-section";
import { PushButton } from "@/components/ui/push-button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/canvas-download";
import { cn } from "@/lib/utils";
import {
  CANCELLED,
  convertImagesToWebP,
  convertVideoToWebP,
  detectSourceBackground,
  estimateFrameCount,
  resolveOutputSize,
  sortImageFiles,
  type WebpErrorKey,
  type WebpResolution,
} from "@/lib/video-to-webp";

type ResMode = "original" | "half" | "quarter" | "width";
type SourceKind = "video" | "images";
type PageErrorKey = WebpErrorKey | "errorTooLarge";

interface Source {
  kind: SourceKind;
  /** video: the single file; images: every frame, in display order. */
  files: File[];
  totalSize: number;
  /** Object URL of the video, or of the first image. */
  previewUrl: string;
}

interface SourceMeta {
  width: number;
  height: number;
  /** Seconds; 0 in image mode. */
  duration: number;
}

interface Result {
  blob: Blob;
  url: string;
  size: number;
  /** Frames in the animation, after duplicates were folded together. */
  frameCount: number;
  mergedCount: number;
  /** Whether this output was keyed — the preview needs a checkerboard then. */
  transparent: boolean;
}

const DEFAULT_FPS = 12;
const DEFAULT_QUALITY = 80;
const DEFAULT_WIDTH = 480;
const DEFAULT_LOOPS = 3;
const DEFAULT_BG_COLOR = "#ffffff";
const DEFAULT_TOLERANCE = 10;
/** The 1–40 slider maps onto the keyer's normalised 0–1 distance. */
const TOLERANCE_TO_THRESHOLD = 0.01;

// Checkerboard behind a keyed result, so the holes in it read as transparent
// rather than as white. One conic gradient, 12px squares — no asset needed.
const CHECKER_STYLE: React.CSSProperties = {
  backgroundColor: "var(--wb-0)",
  backgroundImage:
    "repeating-conic-gradient(var(--wb-100) 0% 25%, var(--wb-0) 0% 50%)",
  backgroundSize: "24px 24px",
};

// Both paths hold every frame in memory, same reasoning as the compress app.
const MAX_TOTAL_SIZE = 300 * 1024 * 1024;
const FRAME_WARN_THRESHOLD = 1000;
const LARGE_OUTPUT_SIZE = 15 * 1024 * 1024;

// Keyed by the union itself, so a new WebpErrorKey can't be forgotten here:
// a missing (or misspelled) key fails to compile.
const ERROR_KEY_FLAGS: Record<WebpErrorKey, true> = {
  errorVideoLoad: true,
  errorImageLoad: true,
  errorSeekFailed: true,
  errorEncoderLoadFailed: true,
  errorEncodeUnsupported: true,
  errorConvertFailed: true,
};
const ERROR_KEYS = new Set<string>(Object.keys(ERROR_KEY_FLAGS));

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** "#rrggbb" → 0–255 channels; anything malformed keys against white. */
function hexToRgb255(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return [255, 255, 255];
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Picks the frame source from a drop / file selection: any video wins (first
 * one), otherwise every image becomes a frame. Files with an unknown MIME type
 * are handed to <video>, which is the real authority on what it can play.
 */
function pickSource(files: File[]): { kind: SourceKind; files: File[] } | null {
  if (files.length === 0) return null;
  const video = files.find((f) => f.type.toLowerCase().startsWith("video/"));
  if (video) return { kind: "video", files: [video] };
  const images = files.filter((f) => f.type.toLowerCase().startsWith("image/"));
  if (images.length > 0) return { kind: "images", files: sortImageFiles(images) };
  return { kind: "video", files: [files[0]] };
}

/** The muxer throws its own messages — anything unmapped is a generic failure. */
function toErrorKey(message: string): WebpErrorKey {
  return ERROR_KEYS.has(message) ? (message as WebpErrorKey) : "errorConvertFailed";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-wb-500">{label}</span>
      <span className="text-wb-700 tabular-nums">{value}</span>
    </div>
  );
}

export default function WebpPage() {
  const { t } = useLanguage();

  const [source, setSource] = useState<Source | null>(null);
  const [meta, setMeta] = useState<SourceMeta | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [errorKey, setErrorKey] = useState<PageErrorKey | null>(null);

  const [fps, setFps] = useState(DEFAULT_FPS);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [resMode, setResMode] = useState<ResMode>("original");
  const [customWidth, setCustomWidth] = useState(DEFAULT_WIDTH);
  const [infinite, setInfinite] = useState(true);
  const [loops, setLoops] = useState(DEFAULT_LOOPS);
  const [transparent, setTransparent] = useState(false);
  const [bgColor, setBgColor] = useState(DEFAULT_BG_COLOR);
  const [keyTolerance, setKeyTolerance] = useState(DEFAULT_TOLERANCE);

  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showSource, setShowSource] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceUrlRef = useRef("");
  const resultUrlRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  /** Bumped whenever the source changes, so a slow detection can't win a race. */
  const bgDetectRef = useRef(0);

  const releaseSource = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = "";
    }
  }, []);

  const releaseResult = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }
    setResult(null);
  }, []);

  // Release object URLs on unmount, and stop any conversion still running —
  // otherwise it finishes into a dead component and leaks its result URL.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  // A settings change makes the existing output stale — drop it and let the user
  // re-run the (expensive) conversion deliberately.
  useEffect(() => {
    releaseResult();
  }, [
    fps,
    quality,
    resMode,
    customWidth,
    infinite,
    loops,
    transparent,
    bgColor,
    keyTolerance,
    releaseResult,
  ]);

  const acceptFiles = useCallback(
    (list: FileList | File[]) => {
      const picked = pickSource(Array.from(list));
      if (!picked) return;

      // A conversion still running belongs to the file being replaced — let it
      // finish and its result would be shown against the *new* source.
      abortRef.current?.abort();
      releaseResult();
      releaseSource();
      setMeta(null);
      setShowSource(true);

      const totalSize = picked.files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        setSource(null);
        setErrorKey("errorTooLarge");
        return;
      }

      const previewUrl = URL.createObjectURL(picked.files[0]);
      sourceUrlRef.current = previewUrl;
      setErrorKey(null);
      setSource({ ...picked, totalSize, previewUrl });

      // Seed the key colour from the source's own first frame. Detection runs on
      // its own element and is allowed to fail: white is the right guess for the
      // flat backdrops this is for, and it's what the swatch shows meanwhile.
      const generation = ++bgDetectRef.current;
      setBgColor(DEFAULT_BG_COLOR);
      const isVideo = picked.kind === "video";
      void detectSourceBackground(picked.files[0], isVideo).then((rgb) => {
        if (rgb && bgDetectRef.current === generation) setBgColor(rgbToHex(rgb));
      });
    },
    [releaseResult, releaseSource],
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) acceptFiles(e.target.files);
      e.target.value = "";
    },
    [acceptFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) acceptFiles(e.dataTransfer.files);
    },
    [acceptFiles],
  );

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      if (
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        setMeta(null);
        setErrorKey("errorVideoLoad");
        return;
      }
      setMeta({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      });
      setErrorKey(null);
    },
    [],
  );

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const image = e.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) {
      setMeta(null);
      setErrorKey("errorImageLoad");
      return;
    }
    // Canvas size comes from the first image; the rest are contained inside it.
    setMeta({ width: image.naturalWidth, height: image.naturalHeight, duration: 0 });
    setErrorKey(null);
  }, []);

  const handleSourceError = useCallback(() => {
    setMeta(null);
    setErrorKey(source?.kind === "images" ? "errorImageLoad" : "errorVideoLoad");
  }, [source]);

  const resolution: WebpResolution = resMode === "width" ? customWidth : resMode;
  const output = meta ? resolveOutputSize(meta.width, meta.height, resolution) : null;
  const totalFrames = !source
    ? 0
    : source.kind === "images"
      ? source.files.length
      : meta
        ? estimateFrameCount(meta.duration, fps)
        : 0;

  const isImages = source?.kind === "images";
  const sourceLabel = isImages ? t.webp.sourceImages : t.webp.sourceVideo;
  const outputBaseName = source ? stripExtension(source.files[0].name) : "animation";
  // In image mode the first frame's name is already taken by the source file.
  const webpName = isImages ? `${outputBaseName}-anim.webp` : `${outputBaseName}.webp`;

  const handleConvert = useCallback(async () => {
    if (!source || !meta || converting) return;

    const controller = new AbortController();
    abortRef.current = controller;
    releaseResult();
    setErrorKey(null);
    setProgress({ done: 0, total: totalFrames });
    setConverting(true);

    const opts = {
      fps,
      quality,
      resolution,
      loopCount: infinite ? 0 : loops,
      transparent: transparent
        ? {
            color: hexToRgb255(bgColor),
            threshold: keyTolerance * TOLERANCE_TO_THRESHOLD,
          }
        : undefined,
    };
    const onProgress = (done: number, total: number) => setProgress({ done, total });

    try {
      const converted =
        source.kind === "video"
          ? await convertVideoToWebP(source.files[0], opts, onProgress, controller.signal)
          : await convertImagesToWebP(source.files, opts, onProgress, controller.signal);
      // A cancel that lands on the very last frame still has to be honoured —
      // otherwise this URL would never be revoked.
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(converted.blob);
      resultUrlRef.current = url;
      setResult({
        blob: converted.blob,
        url,
        size: converted.blob.size,
        frameCount: converted.frameCount,
        mergedCount: converted.mergedCount,
        transparent,
      });
      setShowSource(false);
    } catch (e) {
      const message = (e as Error).message;
      if (message !== CANCELLED) setErrorKey(toErrorKey(message));
    } finally {
      abortRef.current = null;
      setConverting(false);
    }
  }, [
    source,
    meta,
    converting,
    releaseResult,
    totalFrames,
    fps,
    quality,
    resolution,
    infinite,
    loops,
    transparent,
    bgColor,
    keyTolerance,
  ]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDownloadWebp = useCallback(async () => {
    if (!result) return;
    await downloadBlob(result.blob, webpName);
  }, [result, webpName]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    // A detection still in flight belongs to the source being thrown away.
    bgDetectRef.current++;
    releaseResult();
    releaseSource();
    setSource(null);
    setMeta(null);
    setErrorKey(null);
    setProgress({ done: 0, total: 0 });
    setShowSource(true);
    setFps(DEFAULT_FPS);
    setQuality(DEFAULT_QUALITY);
    setResMode("original");
    setCustomWidth(DEFAULT_WIDTH);
    setInfinite(true);
    setLoops(DEFAULT_LOOPS);
    setTransparent(false);
    setBgColor(DEFAULT_BG_COLOR);
    setKeyTolerance(DEFAULT_TOLERANCE);
  }, [releaseResult, releaseSource]);

  const canConvert = !!source && !!meta && !converting && totalFrames > 0;
  const reduction =
    result && source && source.totalSize > 0
      ? (1 - result.size / source.totalSize) * 100
      : 0;

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-wb-50">
      {/* Preview area: drop zone → source preview → generated WebP */}
      <div
        className="relative flex h-[35vh] min-w-0 shrink-0 flex-col md:h-auto md:flex-1"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AppTopBar />

        <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-16 md:p-6 md:pt-20">
          {!source ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={[
                "flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-[14px]",
                "border-2 border-dashed transition-colors select-none cursor-pointer",
                isDragOver
                  ? "border-wb-green bg-[rgba(13,202,122,0.06)]"
                  : "border-wb-300 bg-wb-0 hover:border-wb-400",
              ].join(" ")}
            >
              <span className="text-[14px] font-semibold text-wb-900 md:text-[15px]">
                {t.webp.dropHint}
              </span>
              <span className="text-[12px] text-wb-500">{t.webp.clickHint}</span>
              <span className="mt-1 text-[12px] text-wb-400">
                {t.webp.supportedTypes}
              </span>
              <span className="text-[12px] text-wb-400">{t.webp.maxNote}</span>
            </button>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center">
              {source.kind === "video" ? (
                <video
                  src={source.previewUrl}
                  muted
                  playsInline
                  loop
                  controls
                  onLoadedMetadata={handleLoadedMetadata}
                  onError={handleSourceError}
                  className={cn(
                    "max-h-full max-w-full rounded-[10px]",
                    // Only ever hidden while the generated WebP is on show —
                    // dropping the result (a settings change) brings this back.
                    result && !showSource && "hidden",
                  )}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source.previewUrl}
                  alt=""
                  onLoad={handleImageLoad}
                  onError={handleSourceError}
                  className={cn(
                    "max-h-full max-w-full rounded-[10px] object-contain",
                    result && !showSource && "hidden",
                  )}
                />
              )}

              {result && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.url}
                    alt=""
                    style={result.transparent ? CHECKER_STYLE : undefined}
                    className={cn(
                      "max-h-full max-w-full rounded-[10px] object-contain",
                      showSource && "hidden",
                    )}
                  />
                  {/* Top-centered so it clears the video's native controls. */}
                  <ButtonSelect
                    className="absolute left-1/2 top-2 z-10 -translate-x-1/2"
                    value={showSource ? "source" : "webp"}
                    options={[
                      { value: "source", label: sourceLabel },
                      { value: "webp", label: t.webp.webpOutput },
                    ]}
                    onChange={(v) => setShowSource(v === "source")}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {/* Control panel */}
      <ControlPanel
        title={t.apps.webp.name}
        footerClassName="flex-col items-stretch gap-0"
        footer={
          <>
            <div className="flex flex-row-reverse items-center gap-2 md:flex-row">
              <PushButton
                variant="light"
                className="shrink-0"
                onClick={handleReset}
                disabled={!source || converting}
              >
                {t.reset}
              </PushButton>
              {converting ? (
                <PushButton variant="dark" className="flex-1" onClick={handleCancel}>
                  {t.cancel}
                </PushButton>
              ) : result ? (
                <PushButton variant="dark" className="flex-1" onClick={handleDownloadWebp}>
                  {t.download}
                </PushButton>
              ) : (
                <PushButton
                  variant="dark"
                  className="flex-1"
                  onClick={handleConvert}
                  disabled={!canConvert}
                >
                  {t.webp.convert}
                </PushButton>
              )}
            </div>
            {converting && (
              <p className="mt-2 text-center text-[12px] text-wb-500 tabular-nums">
                {t.webp.converting} {progress.done} / {progress.total}
              </p>
            )}
          </>
        }
      >
        {/* Source info */}
        {source && (
          <PanelSection title={isImages ? t.webp.imageInfo : t.webp.videoInfo}>
            {isImages && (
              <InfoRow label={t.webp.imageCount} value={String(source.files.length)} />
            )}
            {meta && (
              <InfoRow
                label={t.webp.resolution}
                value={`${meta.width}×${meta.height}`}
              />
            )}
            {!isImages && meta && (
              <InfoRow label={t.webp.duration} value={`${meta.duration.toFixed(2)}s`} />
            )}
            <InfoRow label={t.webp.fileSize} value={fmtBytes(source.totalSize)} />
          </PanelSection>
        )}

        {errorKey && (
          <PanelSection>
            <p className="text-[12px] leading-relaxed text-wb-600">
              {t.webp[errorKey]}
            </p>
          </PanelSection>
        )}

        {/* Settings — locked while a conversion is running. `inert` also blocks
            keyboard access, which pointer-events alone doesn't. */}
        <PanelSection
          title={t.settings}
          inert={converting || undefined}
          className={converting ? "pointer-events-none opacity-50" : undefined}
        >
          <DragParam
            label={t.webp.fps}
            value={fps}
            min={1}
            max={60}
            step={1}
            defaultValue={DEFAULT_FPS}
            onChange={setFps}
          />

          <Select value={resMode} onValueChange={(v) => setResMode(v as ResMode)}>
            <SelectTrigger label={t.webp.outputResolution}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">{t.webp.resolutionOriginal}</SelectItem>
              <SelectItem value="half">{t.webp.resolutionHalf}</SelectItem>
              <SelectItem value="quarter">{t.webp.resolutionQuarter}</SelectItem>
              <SelectItem value="width">{t.webp.resolutionCustom}</SelectItem>
            </SelectContent>
          </Select>
          {resMode === "width" && (
            <NestedGroup>
              <DragParam
                label={t.webp.width}
                value={customWidth}
                min={64}
                max={1920}
                step={2}
                defaultValue={DEFAULT_WIDTH}
                onChange={setCustomWidth}
              />
            </NestedGroup>
          )}

          <DragParam
            label={t.webp.quality}
            value={quality}
            min={1}
            max={100}
            step={1}
            defaultValue={DEFAULT_QUALITY}
            onChange={setQuality}
          />

          <ControlRow label={t.webp.infiniteLoop}>
            <ToggleSwitch active={infinite} onClick={() => setInfinite((v) => !v)} />
          </ControlRow>
          {!infinite && (
            <NestedGroup>
              <DragParam
                label={t.webp.loopCount}
                value={loops}
                min={1}
                max={100}
                step={1}
                defaultValue={DEFAULT_LOOPS}
                onChange={setLoops}
              />
            </NestedGroup>
          )}

          <ControlRow label={t.webp.transparentBg}>
            <ToggleSwitch active={transparent} onClick={() => setTransparent((v) => !v)} />
          </ControlRow>
          {transparent && (
            <NestedGroup>
              <ColorRow label={t.webp.bgColor} value={bgColor} onChange={setBgColor} />
              <DragParam
                label={t.webp.keyTolerance}
                value={keyTolerance}
                min={1}
                max={40}
                step={1}
                defaultValue={DEFAULT_TOLERANCE}
                onChange={setKeyTolerance}
              />
            </NestedGroup>
          )}

          {output && totalFrames > 0 && (
            <>
              <InfoRow
                label={t.webp.outputDimensions}
                value={`${output.width}×${output.height}`}
              />
              {/* In image mode the count is fixed and already shown above. */}
              {!isImages && (
                <InfoRow label={t.webp.estimatedFrames} value={String(totalFrames)} />
              )}
            </>
          )}
          {totalFrames > FRAME_WARN_THRESHOLD && (
            <p className="text-[12px] leading-relaxed text-wb-600">
              {t.webp.framesWarning}
            </p>
          )}
        </PanelSection>

        {/* Output */}
        {result && source && (
          <PanelSection title={t.webp.result}>
            <InfoRow label={sourceLabel} value={fmtBytes(source.totalSize)} />
            <InfoRow label={t.webp.webpOutput} value={fmtBytes(result.size)} />
            <InfoRow
              label={t.webp.frameCount}
              value={
                result.mergedCount > 0
                  ? t.webp.mergedFrames
                      .replace("{frames}", String(result.frameCount))
                      .replace("{n}", String(result.mergedCount))
                  : String(result.frameCount)
              }
            />
            <div className="flex justify-between border-t border-wb-200 pt-1 text-[13px] font-semibold">
              <span className="text-wb-900">
                {reduction >= 0 ? t.webp.reduction : t.webp.increase}
              </span>
              <span
                className={
                  reduction >= 0
                    ? "text-wb-green tabular-nums"
                    : "text-wb-600 tabular-nums"
                }
              >
                {reduction >= 0 ? "−" : "+"}
                {Math.abs(reduction).toFixed(1)}%
              </span>
            </div>
            {/* Frame-by-frame compression losing to a video codec is expected, not
                a fault — say so instead of letting a "+180%" stand on its own.
                Image sources have no such baseline, so they don't get this. */}
            {!isImages && result.size > source.totalSize && (
              <p className="text-[12px] leading-relaxed text-wb-600">
                {t.webp.largerThanSource}
              </p>
            )}
            {result.size > LARGE_OUTPUT_SIZE && (
              <p className="text-[12px] leading-relaxed text-wb-600">
                {t.webp.largeOutputWarning}
              </p>
            )}
          </PanelSection>
        )}

        {/* Privacy */}
        <PanelSection border={false} className="flex-1">
          <p className="text-[12px] leading-relaxed text-wb-500">{t.webp.privacy}</p>
        </PanelSection>
      </ControlPanel>
    </div>
  );
}

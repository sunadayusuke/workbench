"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { AppTopBar } from "@/components/app-top-bar";
import { PushButton } from "@/components/ui/push-button";
import { DragParam } from "@/components/ui/drag-param";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/canvas-download";

type Format = "webp" | "jpeg" | "png" | "avif" | "original";
type Status = "pending" | "processing" | "done" | "error";
type ErrorKey =
  | "errorTooLarge"
  | "errorUnsupported"
  | "errorDecodeFailed"
  | "errorEncodeFailed"
  | "errorAvifNotSupported"
  | "errorTooManyFiles";

interface Item {
  id: string;
  file: File;
  thumbUrl: string;
  originalSize: number;
  status: Status;
  outputBlob?: Blob;
  outputUrl?: string;
  outputExt?: string;
  outputSize?: number;
  outputWidth?: number;
  outputHeight?: number;
  errorKey?: ErrorKey;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 50;
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

const EXT_MAP: Record<Exclude<Format, "original">, string> = {
  webp: "webp",
  jpeg: "jpg",
  png: "png",
  avif: "avif",
};

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function buildOutputName(originalName: string, ext: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}.${ext}`;
}

function resolveOutputFormat(format: Format, fileType: string): Exclude<Format, "original"> {
  if (format !== "original") return format;
  const t = fileType.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("avif")) return "avif";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpeg";
  return "png"; // gif → png fallback
}

async function encodeImage(
  file: File,
  format: Format,
  quality: number,
  maxLongSide: number,
): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const err = new Error("errorDecodeFailed");
    throw err;
  }

  let width = bitmap.width;
  let height = bitmap.height;
  if (maxLongSide > 0 && Math.max(width, height) > maxLongSide) {
    const ratio = maxLongSide / Math.max(width, height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("errorEncodeFailed");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outFormat = resolveOutputFormat(format, file.type);
  const mime = `image/${outFormat}`;
  const useQuality = outFormat !== "png";
  const q = useQuality ? quality / 100 : undefined;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, q);
  });

  if (!blob || blob.size === 0) {
    if (outFormat === "avif") throw new Error("errorAvifNotSupported");
    throw new Error("errorEncodeFailed");
  }
  // toBlob silently falls back to image/png if the requested type is unsupported.
  if (blob.type !== mime && outFormat === "avif") {
    throw new Error("errorAvifNotSupported");
  }

  return { blob, ext: EXT_MAP[outFormat], width, height };
}

export default function CompressPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(80);
  const [maxLongSide, setMaxLongSide] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [topError, setTopError] = useState<ErrorKey | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const paramsRef = useRef({ format, quality, maxLongSide });
  paramsRef.current = { format, quality, maxLongSide };

  const genRef = useRef(0);
  const isProcessingRef = useRef(false);

  // Re-process when format/quality/resize changes — invalidate any prior outputs.
  useEffect(() => {
    genRef.current++;
    setItems((prev) =>
      prev.map((i) => {
        if (i.status === "error") return i;
        if (i.outputUrl) URL.revokeObjectURL(i.outputUrl);
        return {
          ...i,
          status: "pending",
          outputBlob: undefined,
          outputUrl: undefined,
          outputExt: undefined,
          outputSize: undefined,
          outputWidth: undefined,
          outputHeight: undefined,
        };
      }),
    );
  }, [format, quality, maxLongSide]);

  // Sequential processing queue.
  useEffect(() => {
    if (isProcessingRef.current) return;
    if (!items.some((i) => i.status === "pending")) return;

    isProcessingRef.current = true;

    const run = async () => {
      while (true) {
        const next = itemsRef.current.find((i) => i.status === "pending");
        if (!next) break;

        const myGen = genRef.current;
        const p = paramsRef.current;

        setItems((prev) =>
          prev.map((i) => (i.id === next.id ? { ...i, status: "processing" } : i)),
        );

        try {
          const r = await encodeImage(next.file, p.format, p.quality, p.maxLongSide);
          if (myGen !== genRef.current) continue;
          const outputUrl = URL.createObjectURL(r.blob);
          setItems((prev) =>
            prev.map((i) =>
              i.id === next.id
                ? {
                    ...i,
                    status: "done",
                    outputBlob: r.blob,
                    outputUrl,
                    outputExt: r.ext,
                    outputSize: r.blob.size,
                    outputWidth: r.width,
                    outputHeight: r.height,
                  }
                : i,
            ),
          );
        } catch (e) {
          if (myGen !== genRef.current) continue;
          const key = (e as Error).message as ErrorKey;
          setItems((prev) =>
            prev.map((i) =>
              i.id === next.id ? { ...i, status: "error", errorKey: key } : i,
            ),
          );
        }
      }
    };

    run().finally(() => {
      isProcessingRef.current = false;
      // Items added during the run wouldn't have triggered the effect (guarded by
      // isProcessingRef). Force a re-render so the effect re-evaluates.
      if (itemsRef.current.some((i) => i.status === "pending")) {
        setItems((prev) => [...prev]);
      }
    });
  }, [items]);

  // Release object URLs on unmount.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.thumbUrl);
        if (i.outputUrl) URL.revokeObjectURL(i.outputUrl);
      });
    };
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    setItems((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        setTopError("errorTooManyFiles");
        return prev;
      }
      const truncated = incoming.length > remaining;
      if (truncated) setTopError("errorTooManyFiles");
      else setTopError(null);

      const toAdd = incoming.slice(0, remaining);
      const newItems: Item[] = toAdd.map((file) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const thumbUrl = URL.createObjectURL(file);
        const base: Item = {
          id,
          file,
          thumbUrl,
          originalSize: file.size,
          status: "pending",
        };
        if (file.size > MAX_SIZE) {
          return { ...base, status: "error", errorKey: "errorTooLarge" };
        }
        if (!SUPPORTED_TYPES.includes(file.type.toLowerCase())) {
          return { ...base, status: "error", errorKey: "errorUnsupported" };
        }
        return base;
      });
      return [...prev, ...newItems];
    });
  }, []);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles],
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
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleClear = useCallback(() => {
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      if (i.outputUrl) URL.revokeObjectURL(i.outputUrl);
    });
    setItems([]);
    setTopError(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.thumbUrl);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleDownloadOne = useCallback(async (item: Item) => {
    if (!item.outputBlob || !item.outputExt) return;
    await downloadBlob(item.outputBlob, buildOutputName(item.file.name, item.outputExt));
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const done = itemsRef.current.filter(
      (i) => i.status === "done" && i.outputBlob && i.outputExt,
    );
    if (done.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set<string>();
      for (const item of done) {
        let name = buildOutputName(item.file.name, item.outputExt!);
        if (used.has(name)) {
          const dot = name.lastIndexOf(".");
          const base = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          let n = 1;
          while (used.has(`${base}-${n}${ext}`)) n++;
          name = `${base}-${n}${ext}`;
        }
        used.add(name);
        zip.file(name, item.outputBlob!);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      await downloadBlob(blob, `compressed-${Date.now()}.zip`);
    } finally {
      setIsZipping(false);
    }
  }, []);

  const doneItems = items.filter((i) => i.status === "done");
  const activeForTotals = items.filter((i) => i.status !== "error");
  const totalOriginal = activeForTotals.reduce((s, i) => s + i.originalSize, 0);
  const totalCompressed = doneItems.reduce((s, i) => s + (i.outputSize || 0), 0);
  const allDone = activeForTotals.length > 0 && activeForTotals.every((i) => i.status === "done");
  const totalReduction =
    allDone && totalOriginal > 0 ? (1 - totalCompressed / totalOriginal) * 100 : 0;

  const totalPending = items.filter(
    (i) => i.status === "pending" || i.status === "processing",
  ).length;
  const processedCount = items.filter((i) => i.status !== "pending" && i.status !== "processing").length;

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-[#d8d8da]">
      {/* Main area: drop zone + file list */}
      <div
        className="relative flex-1 min-h-0 flex flex-col"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AppTopBar />

        {/* Drop zone */}
        <div className="px-4 pt-16 pb-3 md:px-6 md:pt-20 md:pb-4 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={[
              "w-full h-32 md:h-36 rounded-[14px] flex flex-col items-center justify-center gap-1.5",
              "border-2 border-dashed transition-colors select-none cursor-pointer",
              "[box-shadow:inset_0_1px_3px_rgba(0,0,0,0.04)]",
              isDragOver
                ? "border-[#e84a1b] bg-[rgba(232,74,27,0.06)]"
                : "border-[#bbbbbe] bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] hover:border-[#888]",
            ].join(" ")}
          >
            <span className="text-[13px] md:text-[15px] font-mono uppercase tracking-[0.18em] text-[#333]">
              {t.compress.dropHint}
            </span>
            <span className="text-[11px] font-mono text-[#777]">
              {t.compress.clickHint}
            </span>
            <span className="text-[10px] font-mono text-[#888] mt-1 tracking-[0.08em]">
              {t.compress.supportedTypes}
            </span>
            <span className="text-[10px] font-mono text-[#999]">{t.compress.maxNote}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            multiple
            className="hidden"
            onChange={handleSelect}
          />
          {topError && (
            <p className="mt-2 text-[11px] font-mono text-[#b54e2c]">
              {t.compress[topError]}
            </p>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pb-6">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[12px] font-mono uppercase tracking-[0.14em] text-[#999] select-none">
              {t.compress.empty}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  errorLabel={item.errorKey ? t.compress[item.errorKey] : ""}
                  processingLabel={t.compress.processingItem}
                  pendingLabel={t.compress.pending}
                  largerLabel={t.compress.larger}
                  onDownload={() => handleDownloadOne(item)}
                  onRemove={() => handleRemove(item.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Control panel */}
      <aside className="flex-1 md:flex-none md:w-[320px] min-h-0 bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] shadow-[0_-8px_24px_rgba(0,0,0,0.10)] md:shadow-none md:border-l md:border-[#bbbbbe] flex flex-col">
        <div className="flex items-center justify-between px-5 h-12 border-b border-[rgba(0,0,0,0.12)] shrink-0">
          <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333]">
            {t.apps.compress.name}
          </span>
          <PushButton
            size="sm"
            variant="dark"
            onClick={handleClear}
            disabled={items.length === 0}
          >
            [ {t.compress.clearAll} ]
          </PushButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {/* Format */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">
              {t.compress.format}
            </span>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webp">WebP</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="avif">AVIF</SelectItem>
                <SelectItem value="original">{t.compress.formatOriginal}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <DragParam
              label={t.compress.quality}
              value={quality}
              min={1}
              max={100}
              step={1}
              defaultValue={80}
              onChange={setQuality}
              accent="orange"
            />
            {(format === "png" ||
              (format === "original" &&
                items.some((i) => i.file.type.includes("png")))) && (
              <p className="text-[10px] font-mono text-[#999] leading-relaxed">
                {t.compress.pngLossless}
              </p>
            )}
          </div>

          {/* Resize */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-3">
            <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">
              {t.compress.resize}
            </span>
            <Select
              value={String(maxLongSide)}
              onValueChange={(v) => setMaxLongSide(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t.compress.noResize}</SelectItem>
                <SelectItem value="1024">1024px</SelectItem>
                <SelectItem value="1920">1920px</SelectItem>
                <SelectItem value="2560">2560px</SelectItem>
                <SelectItem value="3840">3840px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Totals */}
          {doneItems.length > 0 && (
            <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)] flex flex-col gap-2">
              <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]">
                {t.compress.totals}
              </span>
              <div className="flex justify-between text-[11px] font-mono text-[#444]">
                <span className="uppercase tracking-[0.08em] text-[#777]">
                  {t.compress.before}
                </span>
                <span className="tabular-nums">{fmtBytes(totalOriginal)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-[#444]">
                <span className="uppercase tracking-[0.08em] text-[#777]">
                  {t.compress.after}
                </span>
                <span className="tabular-nums">{fmtBytes(totalCompressed)}</span>
              </div>
              {allDone && (
                <div className="flex justify-between text-[11px] font-mono font-bold pt-1 border-t border-[rgba(0,0,0,0.08)]">
                  <span className="uppercase tracking-[0.08em] text-[#333]">
                    {t.compress.reduction}
                  </span>
                  <span
                    className={
                      totalReduction >= 0
                        ? "text-[#1a8014] tabular-nums"
                        : "text-[#b54e2c] tabular-nums"
                    }
                  >
                    {totalReduction >= 0 ? "−" : "+"}
                    {Math.abs(totalReduction).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Privacy */}
          <div className="px-5 py-4 flex-1">
            <p className="text-[10px] font-mono text-[#777] leading-relaxed">
              {t.compress.privacy}
            </p>
          </div>
        </div>

        {/* Footer: download all */}
        <div className="shrink-0 px-5 py-4 border-t border-[rgba(0,0,0,0.12)]">
          <PushButton
            variant="dark"
            className="w-full text-center"
            onClick={handleDownloadAll}
            disabled={doneItems.length === 0 || isZipping}
          >
            [ {isZipping ? t.compress.zipping : t.compress.downloadAll} ]
          </PushButton>
          {totalPending > 0 && (
            <p className="text-[10px] font-mono text-[#777] text-center mt-2 uppercase tracking-[0.10em] tabular-nums">
              {t.compress.processingProgress} {processedCount}/{items.length}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  errorLabel: string;
  processingLabel: string;
  pendingLabel: string;
  largerLabel: string;
  onDownload: () => void;
  onRemove: () => void;
}

function ItemRow({
  item,
  errorLabel,
  processingLabel,
  pendingLabel,
  largerLabel,
  onDownload,
  onRemove,
}: ItemRowProps) {
  const reduction =
    item.outputSize && item.originalSize > 0
      ? (1 - item.outputSize / item.originalSize) * 100
      : null;
  const larger = reduction !== null && reduction < 0;

  return (
    <li className="flex items-center gap-3 p-2.5 rounded-[8px] bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] border border-[#bbbbbe] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.6)]">
      {/* Thumb */}
      <div className="shrink-0 w-12 h-12 rounded-[4px] bg-[#1a1a1a] overflow-hidden border border-[rgba(0,0,0,0.3)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[11px] font-mono text-[#1a1a1a] truncate" title={item.file.name}>
          {item.file.name}
        </p>
        {item.status === "error" ? (
          <p className="text-[10px] font-mono text-[#b54e2c] truncate">{errorLabel}</p>
        ) : item.status === "done" ? (
          <div className="flex items-baseline gap-2 text-[10px] font-mono text-[#555] tabular-nums">
            <span>{fmtBytes(item.originalSize)}</span>
            <span className="text-[#999]">→</span>
            <span>{fmtBytes(item.outputSize!)}</span>
            {reduction !== null && (
              <span
                className={
                  larger ? "ml-auto text-[#b54e2c]" : "ml-auto text-[#1a8014]"
                }
              >
                {larger ? "+" : "−"}
                {Math.abs(reduction).toFixed(1)}%
                {larger ? ` ${largerLabel}` : ""}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[10px] font-mono text-[#777] uppercase tracking-[0.10em]">
            {item.status === "processing" ? processingLabel : pendingLabel}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.status === "processing" && (
          <div className="w-4 h-4 border-2 border-[#1a1a1a]/20 border-t-[#1a1a1a] rounded-full animate-spin" />
        )}
        {item.status === "done" && (
          <PushButton size="sm" variant="dark" onClick={onDownload}>
            [ ↓ ]
          </PushButton>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="text-[#777] hover:text-[#b54e2c] text-[16px] leading-none font-mono px-1.5 select-none transition-colors"
        >
          ×
        </button>
      </div>
    </li>
  );
}

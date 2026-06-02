"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { AppTopBar } from "@/components/app-top-bar";
import { PushButton } from "@/components/ui/push-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/canvas-download";

type Format = "webp" | "jpeg" | "png" | "original";
type Status = "pending" | "processing" | "done" | "error";
type ErrorKey =
  | "errorTooLarge"
  | "errorUnsupported"
  | "errorDecodeFailed"
  | "errorEncodeFailed"
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
  errorKey?: ErrorKey;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 50;
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// JPEG/WebP lossy quality (0-1 scale for canvas.toBlob).
const JPEG_WEBP_QUALITY = 0.8;
// PNG palette color count for UPNG quantization. Lower = smaller files, more
// posterization. ~128 targets TinyPNG-like ~70% reduction on typical inputs.
const PNG_COLORS = 128;

const EXT_MAP: Record<Exclude<Format, "original">, string> = {
  webp: "webp",
  jpeg: "jpg",
  png: "png",
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
  if (t.includes("jpeg") || t.includes("jpg")) return "jpeg";
  return "png"; // gif/avif → png fallback
}

async function encodeImage(
  file: File,
  format: Format,
): Promise<{ blob: Blob; ext: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const err = new Error("errorDecodeFailed");
    throw err;
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("errorEncodeFailed");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const outFormat = resolveOutputFormat(format, file.type);
  let blob: Blob;

  if (outFormat === "png") {
    // UPNG with color quantization — TinyPNG-style. quality 100 = lossless, lower
    // values quantize to fewer palette colors (8-bit indexed PNG).
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const UPNG = (await import("upng-js")).default;
    const buf = UPNG.encode([imgData.data.buffer], canvas.width, canvas.height, PNG_COLORS);
    blob = new Blob([buf], { type: "image/png" });
  } else {
    const mime = `image/${outFormat}`;
    const result = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mime, JPEG_WEBP_QUALITY);
    });
    if (!result || result.size === 0) throw new Error("errorEncodeFailed");
    blob = result;
  }

  // In "original" mode the user wants compression without format change. Fall back
  // to the source file when re-encoding can't beat the original size.
  if (format === "original" && blob.size >= file.size) {
    return { blob: file, ext: EXT_MAP[outFormat] };
  }

  return { blob, ext: EXT_MAP[outFormat] };
}

export default function CompressPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<Format>("original");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [topError, setTopError] = useState<ErrorKey | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const formatRef = useRef(format);
  formatRef.current = format;

  const genRef = useRef(0);
  const isProcessingRef = useRef(false);

  // Re-process when format changes — invalidate any prior outputs.
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
        };
      }),
    );
  }, [format]);

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
        const currentFormat = formatRef.current;

        setItems((prev) =>
          prev.map((i) => (i.id === next.id ? { ...i, status: "processing" } : i)),
        );

        try {
          const r = await encodeImage(next.file, currentFormat);
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
    <div className="fixed inset-0 flex flex-col md:flex-row bg-wb-50">
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
              isDragOver
                ? "border-wb-green bg-[rgba(13,202,122,0.06)]"
                : "border-wb-300 bg-wb-0 hover:border-wb-400",
            ].join(" ")}
          >
            <span className="text-[14px] md:text-[15px] font-semibold text-wb-900">
              {t.compress.dropHint}
            </span>
            <span className="text-[12px] text-wb-500">
              {t.compress.clickHint}
            </span>
            <span className="text-[12px] text-wb-400 mt-1">
              {t.compress.supportedTypes}
            </span>
            <span className="text-[12px] text-wb-400">{t.compress.maxNote}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleSelect}
          />
          {topError && (
            <p className="mt-2 text-[12px] text-wb-600">
              {t.compress[topError]}
            </p>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 md:px-6 pb-6">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[13px] text-wb-400 select-none">
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
      <aside className="relative flex-1 md:flex-none md:w-[320px] min-h-0 bg-wb-0 shadow-[0_-8px_24px_rgba(12,12,16,0.08)] md:shadow-none md:border-l md:border-wb-200 flex flex-col">
        <div className="shrink-0 px-5 pt-6 pb-3">
          <span className="text-[18px] font-medium text-wb-900 select-none">
            {t.apps.compress.name}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col pb-[88px]">
          {/* Format */}
          <div className="px-5 py-4 border-b border-wb-200 flex flex-col gap-3">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger label={t.compress.format}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">{t.compress.formatOriginal}</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Totals */}
          {doneItems.length > 0 && (
            <div className="px-5 py-4 border-b border-wb-200 flex flex-col gap-2">
              <span className="text-[15px] font-medium text-wb-900 select-none">
                {t.compress.totals}
              </span>
              <div className="flex justify-between text-[13px] text-wb-700">
                <span className="text-wb-500">
                  {t.compress.before}
                </span>
                <span className="tabular-nums">{fmtBytes(totalOriginal)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-wb-700">
                <span className="text-wb-500">
                  {t.compress.after}
                </span>
                <span className="tabular-nums">{fmtBytes(totalCompressed)}</span>
              </div>
              {allDone && (
                <div className="flex justify-between text-[13px] font-semibold pt-1 border-t border-wb-200">
                  <span className="text-wb-900">
                    {t.compress.reduction}
                  </span>
                  <span
                    className={
                      totalReduction >= 0
                        ? "text-wb-green tabular-nums"
                        : "text-wb-600 tabular-nums"
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
            <p className="text-[12px] text-wb-500 leading-relaxed">
              {t.compress.privacy}
            </p>
          </div>
        </div>

        {/* Footer: reset + download all */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col p-4 backdrop-blur-[6px] bg-gradient-to-t from-white to-transparent">
          <div className="flex items-center gap-2">
            <PushButton
              variant="light"
              className="shrink-0"
              onClick={handleClear}
              disabled={items.length === 0}
            >
              {t.compress.clearAll}
            </PushButton>
            <PushButton
              variant="dark"
              className="flex-1"
              onClick={handleDownloadAll}
              disabled={doneItems.length === 0 || isZipping}
            >
              {isZipping ? t.compress.zipping : t.compress.downloadAll}
            </PushButton>
          </div>
          {totalPending > 0 && (
            <p className="text-[12px] text-wb-500 text-center mt-2 tabular-nums">
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
    <li className="flex items-center gap-3 p-2.5 rounded-[10px] bg-wb-50 border border-wb-200">
      {/* Thumb */}
      <div className="shrink-0 w-12 h-12 rounded-[8px] bg-wb-100 overflow-hidden border border-wb-200">
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
        <p className="text-[13px] text-wb-900 truncate" title={item.file.name}>
          {item.file.name}
        </p>
        {item.status === "error" ? (
          <p className="text-[12px] text-wb-600 truncate">{errorLabel}</p>
        ) : item.status === "done" ? (
          <div className="flex items-baseline gap-2 text-[12px] text-wb-500 tabular-nums">
            <span>{fmtBytes(item.originalSize)}</span>
            <span className="text-wb-400">→</span>
            <span>{fmtBytes(item.outputSize!)}</span>
            {reduction !== null && (
              <span
                className={
                  larger ? "ml-auto text-wb-600" : "ml-auto text-wb-green"
                }
              >
                {larger ? "+" : "−"}
                {Math.abs(reduction).toFixed(1)}%
                {larger ? ` ${largerLabel}` : ""}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-wb-500">
            {item.status === "processing" ? processingLabel : pendingLabel}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.status === "processing" && (
          <div className="w-4 h-4 border-2 border-wb-300 border-t-wb-900 rounded-full animate-spin" />
        )}
        {item.status === "done" && (
          <PushButton size="sm" variant="dark" onClick={onDownload}>
            ↓
          </PushButton>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="text-wb-400 hover:text-wb-900 text-[16px] leading-none px-1.5 select-none transition-colors"
        >
          ×
        </button>
      </div>
    </li>
  );
}

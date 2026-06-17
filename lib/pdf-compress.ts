// pdf-compress.ts — Acrobat-style client-side PDF size reduction.
//
// Strategy (mirrors Acrobat's "Reduce File Size"): walk the PDF object tree,
// find embedded raster image XObjects, downsample + re-encode them as JPEG, and
// replace the streams in place. Text and vector content are left untouched, so
// the document stays selectable and sharp — only the heavy image payload shrinks.
// Finally we re-serialize with object streams for structural compaction.
//
// Everything runs in the browser: images are decoded via createImageBitmap /
// canvas, Flate streams are inflated with the native DecompressionStream. No
// data leaves the page.

import type {
  PDFDict as TPDFDict,
  PDFDocument as TPDFDocument,
  PDFRawStream as TPDFRawStream,
} from "pdf-lib";

export type PdfQuality = "high" | "balanced" | "max";

// TS's typed-array generics reject Uint8Array<ArrayBufferLike> against BlobPart;
// our buffers are always plain ArrayBuffers, so this cast is safe.
const asBlobPart = (u: Uint8Array): BlobPart => u as unknown as BlobPart;

interface Preset {
  /** JPEG re-encode quality (0–1 for canvas.toBlob). */
  quality: number;
  /** Target resolution: images displayed above this DPI are downsampled to it. */
  dpi: number;
  /** Longest-edge pixel cap, used only when an image's on-page DPI can't be measured. */
  maxEdgeFallback: number;
}

// Mirrors Acrobat / Ghostscript "Print / eBook / Screen". Resolution (DPI) is the
// dominant lever — it's what makes the presets meaningfully different across all
// image sizes; JPEG quality is the secondary lever.
const PRESETS: Record<PdfQuality, Preset> = {
  high: { quality: 0.85, dpi: 300, maxEdgeFallback: 2600 },
  balanced: { quality: 0.6, dpi: 150, maxEdgeFallback: 1500 },
  max: { quality: 0.38, dpi: 72, maxEdgeFallback: 900 },
};

// Skip images smaller than this — re-encoding tiny icons rarely helps and risks
// churn. Applied to the longest edge.
const MIN_EDGE = 200;
// Skip image streams whose encoded payload is below this — not worth touching.
const MIN_STREAM_BYTES = 8 * 1024;

/** Inflate a zlib (FlateDecode) stream using the browser's DecompressionStream. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const stream = new Blob([asBlobPart(bytes)]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Number of color components declared in a JPEG's SOF marker (3 = YCbCr, 4 = CMYK). */
function jpegComponents(bytes: Uint8Array): number {
  let i = 2; // skip SOI (FF D8)
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    // SOF0–SOF15, excluding DHT(C4) / JPG(C8) / DAC(CC).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return bytes[i + 9];
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // standalone markers carry no length
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) break;
    i += 2 + len;
  }
  return 3;
}

/** Draw a source image onto a canvas (optionally downscaled) and JPEG-encode it. */
async function recodeToJpeg(
  source: CanvasImageSource,
  w: number,
  h: number,
  maxEdge: number,
  quality: number,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  let tw = w;
  let th = h;
  if (maxEdge && Math.max(w, h) > maxEdge) {
    const s = maxEdge / Math.max(w, h);
    tw = Math.max(1, Math.round(w * s));
    th = Math.max(1, Math.round(h * s));
  }
  // Degenerate sizes make some encoders return null; not worth recompressing.
  if (tw < 8 || th < 8) return null;
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Flatten onto white so any (already-separate-SMask) base draws predictably.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(source, 0, 0, tw, th);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob || blob.size === 0) return null;
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: tw,
    height: th,
  };
}

/**
 * Compress a PDF by re-encoding its embedded images. Returns the smaller of the
 * recompressed result and the original (never inflates the file).
 */
export async function compressPdf(
  file: File,
  quality: PdfQuality,
): Promise<{ blob: Blob; ext: string }> {
  const preset = PRESETS[quality];
  const { PDFDocument, PDFName, PDFNumber, PDFArray, PDFRawStream, PDFRef, PDFDict } =
    await import("pdf-lib");

  const srcBytes = new Uint8Array(await file.arrayBuffer());

  let doc: TPDFDocument;
  try {
    doc = await PDFDocument.load(srcBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    throw new Error("errorPdfFailed");
  }

  const ctx = doc.context;
  const nm = (s: string) => PDFName.of(s);

  const lookupNum = (dict: TPDFDict, key: string): number | null => {
    const v = dict.lookup(nm(key));
    return v instanceof PDFNumber ? v.asNumber() : null;
  };

  // Resolve a /ColorSpace entry to a component count for raw (Flate) samples.
  // Returns null for spaces we won't safely interpret (Indexed, CMYK, etc.).
  const colorComponents = (dict: TPDFDict): number | null => {
    const cs = dict.lookup(nm("ColorSpace"));
    // Output is hardcoded DeviceRGB, so only accept device / ICC RGB-family
    // sources. CalRGB/CalGray (calibrated), Indexed, Separation, DeviceN and Lab
    // are skipped — relabeling them DeviceRGB would shift or scramble colors.
    if (cs instanceof PDFName) {
      const s = cs.toString();
      if (s === "/DeviceRGB") return 3;
      if (s === "/DeviceGray") return 1;
      return null;
    }
    if (cs instanceof PDFArray && cs.size() >= 1) {
      const head = cs.get(0);
      if (head?.toString() === "/ICCBased") {
        const stream = cs.lookup(1, PDFRawStream);
        const n = stream ? lookupNum(stream.dict, "N") : null;
        return n === 1 || n === 3 ? n : null;
      }
    }
    return null;
  };

  const indexed = ctx.enumerateIndirectObjects();

  // First pass: collect every image used as a soft mask (/SMask) or explicit
  // mask (/Mask) by another image. These must NOT be recompressed — a soft mask
  // has to stay a single-component DeviceGray image; rewriting it as a 3-channel
  // DeviceRGB JPEG yields an invalid mask, and strict viewers (Preview/Acrobat)
  // then drop the *parent* image entirely. This is the "images disappeared" bug.
  const maskRefs = new Set<string>();
  for (const [, obj] of indexed) {
    if (!(obj instanceof PDFRawStream)) continue;
    for (const key of ["SMask", "Mask"]) {
      const v = obj.dict.get(nm(key));
      if (v instanceof PDFRef) maskRefs.add(v.toString());
    }
  }

  // Measure each image's on-page display size (in PDF points) by interpreting the
  // content streams' graphics state — an image's painted size is the unit square
  // transformed by the current CTM. This lets us downsample to a target DPI like
  // Acrobat instead of a blunt pixel cap, so the quality presets differ markedly.
  // Any parse failure is harmless: the image just falls back to a pixel cap.
  async function collectDisplaySizes(): Promise<Map<number, { w: number; h: number }>> {
    const sizes = new Map<number, { w: number; h: number }>();
    const asNum = (v: unknown): number =>
      v instanceof PDFNumber ? v.asNumber() : 0;
    // 3×3 affine concat: result transforms a point by `a` then `b`.
    const mul = (a: number[], b: number[]): number[] => [
      a[0] * b[0] + a[1] * b[2],
      a[0] * b[1] + a[1] * b[3],
      a[2] * b[0] + a[3] * b[2],
      a[2] * b[1] + a[3] * b[3],
      a[4] * b[0] + a[5] * b[2] + b[4],
      a[4] * b[1] + a[5] * b[3] + b[5],
    ];
    const streamText = async (s: TPDFRawStream): Promise<string> => {
      const f = s.dict.lookup(nm("Filter"));
      let bytes: Uint8Array | null = null;
      if (!f) bytes = s.contents;
      else if (f instanceof PDFName && f.toString() === "/FlateDecode") {
        try {
          bytes = await inflate(s.contents);
        } catch {
          bytes = null;
        }
      }
      return bytes ? new TextDecoder("latin1").decode(bytes) : "";
    };
    const inheritedResources = (leaf: TPDFDict): TPDFDict | null => {
      let node: unknown = leaf;
      for (let g = 0; node && g < 32; g++) {
        const n = node as TPDFDict;
        const r = n.lookup(nm("Resources"));
        if (r instanceof PDFDict) return r;
        const parent = n.get(nm("Parent"));
        node = parent instanceof PDFRef ? ctx.lookup(parent) : null;
      }
      return null;
    };

    const interpret = async (
      text: string,
      ctm: number[],
      resources: TPDFDict | null,
      depth: number,
      seen: Set<number>,
    ): Promise<void> => {
      if (depth > 8 || !text) return;
      const xres = resources?.lookup(nm("XObject"));
      const xobjs = xres instanceof PDFDict ? xres : null;
      const ws = (c: string) =>
        c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\x00";
      const delim = "()<>[]{}/%";
      const gstack: number[][] = [];
      const nums: number[] = [];
      let lastName: string | null = null;
      const N = text.length;
      let i = 0;
      while (i < N) {
        const c = text[i];
        if (ws(c)) {
          i++;
          continue;
        }
        if (c === "%") {
          while (i < N && text[i] !== "\n" && text[i] !== "\r") i++;
          continue;
        }
        if (c === "(") {
          let d = 1;
          i++;
          while (i < N && d > 0) {
            const cc = text[i++];
            if (cc === "\\") i++;
            else if (cc === "(") d++;
            else if (cc === ")") d--;
          }
          nums.length = 0;
          lastName = null;
          continue;
        }
        if (c === "<" && text[i + 1] === "<") {
          let d = 1;
          i += 2;
          while (i < N && d > 0) {
            if (text[i] === "<" && text[i + 1] === "<") {
              d++;
              i += 2;
            } else if (text[i] === ">" && text[i + 1] === ">") {
              d--;
              i += 2;
            } else i++;
          }
          nums.length = 0;
          lastName = null;
          continue;
        }
        if (c === "<") {
          while (i < N && text[i] !== ">") i++;
          i++;
          continue;
        }
        if (c === "[" || c === "]" || c === "{" || c === "}") {
          i++;
          continue;
        }
        if (c === "/") {
          i++;
          let s = "";
          while (i < N && !ws(text[i]) && !delim.includes(text[i])) s += text[i++];
          lastName = s;
          continue;
        }
        if (c === "+" || c === "-" || c === "." || (c >= "0" && c <= "9")) {
          let s = "";
          while (i < N && /[0-9.+\-eE]/.test(text[i])) s += text[i++];
          const v = parseFloat(s);
          if (!Number.isNaN(v)) nums.push(v);
          continue;
        }
        let op = "";
        while (i < N && !ws(text[i]) && !delim.includes(text[i])) op += text[i++];
        if (op === "q") gstack.push(ctm);
        else if (op === "Q") {
          if (gstack.length) ctm = gstack.pop()!;
        } else if (op === "cm") {
          if (nums.length >= 6) ctm = mul(nums.slice(-6), ctm);
        } else if (op === "Do" && lastName && xobjs) {
          const v = xobjs.get(nm(lastName));
          const target = v instanceof PDFRef ? ctx.lookup(v) : null;
          const objNum = v instanceof PDFRef ? v.objectNumber : null;
          if (target instanceof PDFRawStream) {
            const sub = target.dict.get(nm("Subtype"))?.toString();
            if (sub === "/Image" && objNum != null) {
              const w = Math.hypot(ctm[0], ctm[1]);
              const h = Math.hypot(ctm[2], ctm[3]);
              const prev = sizes.get(objNum);
              if (!prev || w * h > prev.w * prev.h) sizes.set(objNum, { w, h });
            } else if (sub === "/Form" && objNum != null && !seen.has(objNum)) {
              seen.add(objNum);
              const mtx = target.dict.lookup(nm("Matrix"));
              const fm =
                mtx instanceof PDFArray && mtx.size() === 6
                  ? [0, 1, 2, 3, 4, 5].map((k) => asNum(mtx.lookup(k)))
                  : [1, 0, 0, 1, 0, 0];
              const fres = target.dict.lookup(nm("Resources"));
              await interpret(
                await streamText(target),
                mul(fm, ctm),
                fres instanceof PDFDict ? fres : resources,
                depth + 1,
                seen,
              );
              seen.delete(objNum);
            }
          }
        } else if (op === "BI") {
          const ei = text.indexOf("EI", i);
          i = ei < 0 ? N : ei + 2;
        }
        nums.length = 0;
        lastName = null;
      }
    };

    try {
      for (const page of doc.getPages()) {
        try {
          const res = inheritedResources(page.node as unknown as TPDFDict);
          const cval = page.node.lookup(nm("Contents"));
          let text = "";
          if (cval instanceof PDFRawStream) text = await streamText(cval);
          else if (cval instanceof PDFArray) {
            for (let k = 0; k < cval.size(); k++) {
              const s = cval.lookup(k);
              if (s instanceof PDFRawStream) text += "\n" + (await streamText(s));
            }
          }
          await interpret(text, [1, 0, 0, 1, 0, 0], res, 0, new Set());
        } catch {
          // ignore a bad page; its images just use the pixel-cap fallback
        }
      }
    } catch {
      return sizes;
    }
    return sizes;
  }

  const displaySizes = await collectDisplaySizes();

  let recompressed = 0;

  for (const [ref, obj] of indexed) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;

    const subtype = dict.get(nm("Subtype"));
    if (!subtype || !subtype.toString().includes("Image")) continue;

    // Never touch an image that serves as another image's mask (see above).
    if (maskRefs.has(ref.toString())) continue;

    // Skip stencil masks and anything with a custom Decode array — re-encoding
    // would invalidate the sample mapping.
    const imageMask = dict.lookup(nm("ImageMask"));
    if (imageMask && imageMask.toString() === "true") continue;
    if (dict.lookup(nm("Decode"))) continue;

    // Color-key masking (/Mask as an array) matches exact sample values, which a
    // lossy re-encode would shift — leave those images untouched.
    if (dict.get(nm("Mask")) instanceof PDFArray) continue;

    const width = lookupNum(dict, "Width");
    const height = lookupNum(dict, "Height");
    if (!width || !height) continue;
    if (Math.max(width, height) < MIN_EDGE) continue;

    const encoded = obj.contents;
    if (encoded.length < MIN_STREAM_BYTES) continue;

    // Only single-filter streams are safe to reinterpret. A /Filter array is a
    // chain (e.g. [/ASCII85Decode /DCTDecode]); substring-matching its text would
    // misclassify it and feed wrapped bytes to the wrong decoder.
    const filter = dict.lookup(nm("Filter"));
    if (filter instanceof PDFArray) continue;
    const filterStr = filter instanceof PDFName ? filter.toString() : "";
    const isDCT = filterStr === "/DCTDecode";
    const isFlate = filterStr === "/FlateDecode";

    try {
      let source: CanvasImageSource | null = null;

      if (isDCT) {
        // Stream bytes are a self-contained JPEG. Skip CMYK (4-comp) — browsers
        // decode Adobe CMYK JPEGs inconsistently (color inversion risk).
        if (jpegComponents(encoded) === 4) continue;
        source = await createImageBitmap(
          new Blob([asBlobPart(encoded)], { type: "image/jpeg" }),
        );
      } else if (isFlate) {
        const bpc = lookupNum(dict, "BitsPerComponent");
        if (bpc !== 8) continue;
        // Predictors (DecodeParms) re-arrange the bytes — skip rather than risk
        // corrupting the raster.
        if (dict.lookup(nm("DecodeParms")) || dict.lookup(nm("DP"))) continue;
        const comps = colorComponents(dict);
        if (comps !== 1 && comps !== 3) continue;

        const raw = await inflate(encoded);
        const px = width * height;
        // Exact match only: an over-long buffer means the real component count
        // differs from what /ColorSpace claims (e.g. 4-channel under a lying
        // ICCBased N=3), which would misalign the whole raster.
        if (raw.length !== px * comps) continue;

        const rgba = new Uint8ClampedArray(px * 4);
        if (comps === 1) {
          for (let p = 0, s = 0; p < px; p++) {
            const g = raw[s++];
            rgba[p * 4] = g;
            rgba[p * 4 + 1] = g;
            rgba[p * 4 + 2] = g;
            rgba[p * 4 + 3] = 255;
          }
        } else {
          for (let p = 0, s = 0; p < px; p++) {
            rgba[p * 4] = raw[s++];
            rgba[p * 4 + 1] = raw[s++];
            rgba[p * 4 + 2] = raw[s++];
            rgba[p * 4 + 3] = 255;
          }
        }
        const tmp = document.createElement("canvas");
        tmp.width = width;
        tmp.height = height;
        const tctx = tmp.getContext("2d");
        if (!tctx) continue;
        tctx.putImageData(new ImageData(rgba, width, height), 0, 0);
        source = tmp;
      } else {
        continue; // unsupported filter (CCITT, JPX, JBIG2, multi-filter…)
      }

      // Decide the downsample target (longest-edge pixels):
      //  • A masked base keeps its original size so the untouched grayscale mask
      //    stays aligned — recompress colour only, never downscale.
      //  • Otherwise downsample to the preset's target DPI based on the image's
      //    measured on-page size; fall back to a pixel cap if size is unknown.
      const hasMask = !!(dict.get(nm("SMask")) || dict.get(nm("Mask")));
      let targetMaxEdge: number;
      const disp = displaySizes.get(ref.objectNumber);
      if (hasMask) {
        targetMaxEdge = 0;
      } else if (disp && disp.w > 0 && disp.h > 0) {
        const effDpi = Math.max((width * 72) / disp.w, (height * 72) / disp.h);
        const scale = Math.min(1, preset.dpi / effDpi);
        targetMaxEdge = scale < 1 ? Math.round(Math.max(width, height) * scale) : 0;
      } else {
        targetMaxEdge = preset.maxEdgeFallback;
      }
      const out = await recodeToJpeg(
        source,
        width,
        height,
        targetMaxEdge,
        preset.quality,
      );
      if (source instanceof ImageBitmap) source.close();
      if (!out) continue;
      if (out.bytes.length >= encoded.length) continue; // never grow a stream

      // Build a fresh image dict, carrying forward transparency references.
      const newDict = ctx.obj({}) as TPDFDict;
      newDict.set(nm("Type"), nm("XObject"));
      newDict.set(nm("Subtype"), nm("Image"));
      newDict.set(nm("Width"), PDFNumber.of(out.width));
      newDict.set(nm("Height"), PDFNumber.of(out.height));
      newDict.set(nm("BitsPerComponent"), PDFNumber.of(8));
      newDict.set(nm("ColorSpace"), nm("DeviceRGB"));
      newDict.set(nm("Filter"), nm("DCTDecode"));
      newDict.set(nm("Length"), PDFNumber.of(out.bytes.length));
      // The mask objects themselves are never recompressed (see maskRefs), so
      // copying these references preserves a valid base + grayscale-mask pair.
      const smask = dict.get(nm("SMask"));
      if (smask) newDict.set(nm("SMask"), smask);
      const mask = dict.get(nm("Mask"));
      if (mask) newDict.set(nm("Mask"), mask); // /Mask arrays already skipped above

      ctx.assign(ref, PDFRawStream.of(newDict, out.bytes));
      recompressed++;
    } catch {
      // Leave this image untouched on any decode/encode failure.
      continue;
    }
  }

  let outBytes: Uint8Array;
  try {
    outBytes = await doc.save({ useObjectStreams: true });
  } catch {
    throw new Error("errorPdfFailed");
  }

  // Re-open the output to confirm it's a structurally valid PDF with the same
  // page count. If anything regressed, ship the untouched original instead.
  try {
    const check = await PDFDocument.load(outBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    if (check.getPageCount() !== doc.getPageCount()) {
      return { blob: file, ext: "pdf" };
    }
  } catch {
    return { blob: file, ext: "pdf" };
  }

  // Fall back to the original if re-serialization didn't actually help.
  if (outBytes.length >= srcBytes.length) {
    return { blob: file, ext: "pdf" };
  }
  return {
    blob: new Blob([asBlobPart(outBytes)], { type: "application/pdf" }),
    ext: "pdf",
  };
}

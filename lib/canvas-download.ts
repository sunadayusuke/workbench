export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const canShare =
    isMobile &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  if (canShare) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        /* user cancelled */
      }
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  quality = 1
): Promise<void> {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const canShare =
    isMobile &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  if (canShare) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );
    if (blob) {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch {
          /* user cancelled */
        }
      }
    }
  } else {
    const a = document.createElement("a");
    a.href = canvas.toDataURL(mimeType, quality);
    a.download = filename;
    a.click();
  }
}

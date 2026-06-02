"use client";

import { useEffect, useRef, useState } from "react";

/* ==================================================================
   AppPreview — renders each app's REAL default canvas on its home card.

   Each lib/app-previews/<key>.ts exports
     createPreview(canvas) => cleanup
   which reproduces that app's actual default render (same shaders /
   draws / DEFAULT_PARAMS). We lazily mount via IntersectionObserver
   (only while on/near screen) and tear down off-screen so WebGL
   contexts stay bounded.
================================================================== */

type PreviewModule = { createPreview: (canvas: HTMLCanvasElement) => () => void };

const LOADERS: Record<string, () => Promise<PreviewModule>> = {
  color:    () => import("@/lib/app-previews/color"),
  shader:   () => import("@/lib/app-previews/shader"),
  image:    () => import("@/lib/app-previews/image"),
  compress: () => import("@/lib/app-previews/compress"),
  easing:   () => import("@/lib/app-previews/easing"),
  gradient: () => import("@/lib/app-previews/gradient"),
  particle: () => import("@/lib/app-previews/particle"),
  dotmap:   () => import("@/lib/app-previews/dotmap"),
  signal:   () => import("@/lib/app-previews/signal"),
  aurora:   () => import("@/lib/app-previews/aurora"),
  badge:    () => import("@/lib/app-previews/badge"),
};

export function AppPreview({ appKey, className }: { appKey: string; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setVisible(e.isIntersecting)),
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    const loader = LOADERS[appKey];
    if (!canvas || !loader) return;

    let cleanup: (() => void) | null = null;
    let disposed = false;

    loader()
      .then((mod) => {
        if (disposed) return;
        cleanup = mod.createPreview(canvas);
      })
      .catch((err) => {
        console.error(`[AppPreview] failed to load preview for "${appKey}"`, err);
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [visible, appKey]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

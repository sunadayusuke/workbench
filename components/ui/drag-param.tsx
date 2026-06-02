"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DragParamProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  defaultValue?: number;
  /** legacy prop — kept for API compatibility, no longer affects styling */
  accent?: "blue" | "ochre" | "grey" | "orange" | "white" | "green";
  className?: string;
}

/* Exact values from Figma 1342:2862 (ink-alpha overlays on #f3f4f4). */
const C = {
  borderRest: "rgba(12,12,16,0.05)",
  borderActive: "rgba(12,12,16,0.12)",
  labelRest: "rgba(12,12,16,0.46)",
  labelActive: "rgba(12,12,16,0.2)",
  value: "rgba(12,12,16,0.64)",
  fillRest: "rgba(12,12,16,0.05)",
  fillActive: "rgba(12,12,16,0.12)",
  thumbRest: "rgba(12,12,16,0.2)",
  thumbActive: "rgba(12,12,16,0.46)",
};

export function DragParam({
  label,
  value,
  min,
  max,
  step,
  onChange,
  defaultValue,
  className,
}: DragParamProps) {
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const currentValue = useRef(value);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    // Don't overwrite the float accumulator while the user is dragging.
    if (!isDragging.current) {
      currentValue.current = value;
    }
  }, [value]);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);
  const snap = useCallback((v: number) => Math.round(v / step) * step, [step]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    lastX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastX.current;
    lastX.current = e.clientX;
    const sensitivity = (max - min) / 200;
    // Store the raw float so small per-frame deltas accumulate correctly.
    // Only snap when emitting to onChange.
    const rawNext = clamp(currentValue.current + deltaX * sensitivity);
    currentValue.current = rawNext;
    onChange(snap(rawNext));
  }, [min, max, clamp, snap, onChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) {
      currentValue.current = defaultValue;
      onChange(defaultValue);
    }
  }, [defaultValue, onChange]);

  const active = hovering || dragging;
  const ratio = max === min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));

  const displayValue =
    step < 1
      ? value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1)
      : Math.round(value).toString();

  return (
    <div
      className={cn(
        "relative flex h-10 w-full touch-none cursor-ew-resize select-none items-center gap-1 overflow-hidden rounded-[12px] border bg-wb-50 px-4 shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)] transition-colors",
        className
      )}
      style={{ borderColor: active ? C.borderActive : C.borderRest }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onDoubleClick={handleDoubleClick}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      {/* label */}
      <span
        className="pointer-events-none min-w-0 flex-1 truncate text-[14px] leading-normal transition-colors"
        style={{ color: active ? C.labelActive : C.labelRest }}
      >
        {label}
      </span>

      {/* value */}
      <span
        className="pointer-events-none shrink-0 text-right text-[14px] leading-normal tabular-nums"
        style={{ color: C.value }}
      >
        {displayValue}
      </span>

      {/* value-proportional fill (rounded, clips the thumb) */}
      <div
        className="pointer-events-none absolute left-[-1px] top-[-1px] h-10 overflow-hidden rounded-[12px] transition-colors"
        style={{
          width: `calc(${ratio} * (100% - 16px) + 16px)`,
          background: active ? C.fillActive : C.fillRest,
        }}
      >
        <div
          className="absolute right-[8px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition-colors"
          style={{ background: active ? C.thumbActive : C.thumbRest }}
        />
      </div>
    </div>
  );
}

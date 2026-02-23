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
  accent?: "blue" | "ochre" | "grey" | "orange" | "white" | "green";
  className?: string;
}

const ACCENT_COLORS: Record<NonNullable<DragParamProps["accent"]>, string> = {
  blue:   "#1e3246",
  ochre:  "#b59257",
  grey:   "#858585",
  orange: "#e84a1b",
  white:  "#c8c8ca",
  green:  "#4af626",
};

const CAP_W = 28; // px

export function DragParam({
  label,
  value,
  min,
  max,
  step,
  onChange,
  defaultValue,
  accent = "blue",
  className,
}: DragParamProps) {
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const currentValue = useRef(value);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);
  const snap  = useCallback((v: number) => Math.round(v / step) * step, [step]);

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
    const next = clamp(snap(currentValue.current + deltaX * sensitivity));
    currentValue.current = next;
    onChange(next);
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

  const ratio = max === min ? 0 : (value - min) / (max - min);

  const displayValue =
    step < 1
      ? value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1)
      : Math.round(value).toString();

  return (
    <div className={cn("flex flex-col gap-1.5 w-full select-none", className)}>
      {/* Label + value */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px" }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "0.10em", color: "#666", lineHeight: 1 }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums", color: "#1a1a1a", lineHeight: 1 }}>
          {displayValue}
        </span>
      </div>

      {/* Track + cap */}
      <div
        style={{ position: "relative", height: 18, cursor: "ew-resize" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Track groove */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: "translateY(-50%)",
            height: 6,
            borderRadius: 3,
            background: "#cacaca",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.22), inset 0 2px 5px rgba(0,0,0,0.10)",
          }}
        />

        {/* Accent fill */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: `calc(${ratio * 100}% - ${ratio * CAP_W}px + ${CAP_W / 2}px)`,
            transform: "translateY(-50%)",
            height: 6,
            borderRadius: 3,
            background: ACCENT_COLORS[accent],
            opacity: 0.55,
            pointerEvents: "none",
          }}
        />

        {/* Cap */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `calc(${ratio * 100}% - ${ratio * CAP_W}px)`,
            transform: "translateY(-50%)",
            width: CAP_W,
            height: 18,
            borderRadius: 4,
            background: dragging
              ? "linear-gradient(180deg, #e4e4e6 0%, #d4d4d6 100%)"
              : "linear-gradient(180deg, #f8f8fa 0%, #e8e8ea 100%)",
            boxShadow: dragging
              ? "0 1px 2px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.65)"
              : "0 2px 4px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Vertical grip lines (for horizontal fader) */}
          <div style={{ display: "flex", flexDirection: "row", gap: 3, alignItems: "center" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ width: 1, height: 10, borderRadius: 0.5, background: "rgba(0,0,0,0.22)" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

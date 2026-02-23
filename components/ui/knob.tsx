"use client";

import { useRef, useCallback, useEffect } from "react";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color?: "blue" | "ochre" | "grey" | "orange" | "white";
  defaultValue?: number;
}

const CAP_COLORS: Record<NonNullable<KnobProps["color"]>, string> = {
  blue:   "#1e3246",
  ochre:  "#b59257",
  grey:   "#858585",
  orange: "#e84a1b",
  white:  "#f0f0f2",
};

const INDICATOR_COLORS: Record<NonNullable<KnobProps["color"]>, string> = {
  blue:   "#ffffff",
  ochre:  "#ffffff",
  grey:   "#ffffff",
  orange: "#ffffff",
  white:  "#333333",
};

export function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  color = "blue",
  defaultValue,
}: KnobProps) {
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const currentValue = useRef(value);

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const snap = useCallback(
    (v: number) => Math.round(v / step) * step,
    [step]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      lastY.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      const deltaY = lastY.current - e.clientY; // up = positive
      lastY.current = e.clientY;
      const range = max - min;
      const sensitivity = range / 200;
      const next = clamp(snap(currentValue.current + deltaY * sensitivity));
      currentValue.current = next;
      onChange(next);
    },
    [min, max, clamp, snap, onChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) {
      currentValue.current = defaultValue;
      onChange(defaultValue);
    }
  }, [defaultValue, onChange]);

  // Map value to rotation: -135° (min) → +135° (max)
  const ratio = max === min ? 0 : (value - min) / (max - min);
  const rotation = -135 + ratio * 270;

  const capColor = CAP_COLORS[color];
  const indicatorColor = INDICATOR_COLORS[color];

  const displayValue =
    step < 1
      ? value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1)
      : Math.round(value).toString();

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      {/* Socket + Cap */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--socket-bg)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.8)",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Cap */}
        <div
          style={{
            position: "absolute",
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: capColor,
            transform: `rotate(${rotation}deg)`,
            boxShadow:
              "0 4px 6px rgba(0,0,0,0.3), 0 8px 12px rgba(0,0,0,0.1), inset 0 2px 3px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)",
            cursor: isDragging.current ? "grabbing" : "grab",
          }}
        >
          {/* Indicator line */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "8%",
              transform: "translateX(-50%)",
              width: 2,
              height: 8,
              borderRadius: 1,
              background: indicatorColor,
              opacity: 0.9,
            }}
          />
        </div>
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink-dark)",
          lineHeight: 1,
        }}
      >
        {label}
      </span>

      {/* Value */}
      <span
        style={{
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          color: "var(--ink-subtle)",
          lineHeight: 1,
          minWidth: 32,
          textAlign: "center",
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}

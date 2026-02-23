"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface PhysicalFaderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  channelNumber?: string;
}

const TRACK_HEIGHT = 120;
const CAP_HEIGHT = 24;

export function PhysicalFader({
  label,
  value,
  min,
  max,
  onChange,
  channelNumber,
}: PhysicalFaderProps) {
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const currentValue = useRef(value);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      lastY.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      forceUpdate((n) => n + 1);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      const deltaY = lastY.current - e.clientY; // up = positive
      lastY.current = e.clientY;
      const range = max - min;
      const sensitivity = range / (TRACK_HEIGHT - CAP_HEIGHT);
      const next = clamp(currentValue.current + deltaY * sensitivity);
      currentValue.current = next;
      onChange(next);
    },
    [min, max, clamp, onChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      forceUpdate((n) => n + 1);
    },
    []
  );

  // Cap position: bottom% relative to track
  const ratio = max === min ? 0 : (value - min) / (max - min);
  const capBottom = ratio * (TRACK_HEIGHT - CAP_HEIGHT);

  const displayValue =
    typeof value === "number"
      ? Math.abs(value) < 10
        ? value.toFixed(2)
        : value.toFixed(1)
      : String(value);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none" style={{ width: 36 }}>
      {/* Channel number */}
      {channelNumber && (
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "var(--ink-subtle)",
            letterSpacing: "0.08em",
          }}
        >
          {channelNumber}
        </span>
      )}

      {/* Track + Cap container */}
      <div
        className="relative"
        style={{ width: 16, height: TRACK_HEIGHT }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Track */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: "100%",
            borderRadius: 4,
            background: "var(--aluminum-dark)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2), inset 0 2px 6px rgba(0,0,0,0.1)",
          }}
        />

        {/* Cap */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: capBottom,
            width: 16,
            height: CAP_HEIGHT,
            borderRadius: 4,
            background: "linear-gradient(180deg, #f8f8f8 0%, #e8e8e8 100%)",
            boxShadow:
              "0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
            cursor: isDragging.current ? "grabbing" : "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Grip lines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 1,
                  borderRadius: 0.5,
                  background: "rgba(0,0,0,0.25)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: 8,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-dark)",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 36,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      {/* Value */}
      <span
        style={{
          fontSize: 8,
          fontFamily: "var(--font-mono)",
          color: "var(--ink-subtle)",
          lineHeight: 1,
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}

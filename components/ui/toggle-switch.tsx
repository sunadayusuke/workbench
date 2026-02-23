"use client";

interface ToggleSwitchProps {
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  label?: string;
}

export function ToggleSwitch({ active, onClick, size = "md", label }: ToggleSwitchProps) {
  // trackH - 2 (border top + bottom) - thumbD  must be >= 0 and even for gap
  const trackW = size === "sm" ? 48 : 64;
  const trackH = size === "sm" ? 24 : 32;
  const thumbD = size === "sm" ? 20 : 28;
  const ledD   = size === "sm" ?  8 : 10;
  // position within the inner box (height = trackH - 2 due to border)
  const gap = (trackH - 2 - thumbD) / 2; // 1px

  return (
    <div className="flex items-center gap-2.5 select-none">
      <button
        onClick={onClick}
        style={{
          position: "relative",
          width: trackW,
          height: trackH,
          background: "linear-gradient(180deg, #1a1a1a 0%, #2c2c2c 100%)",
          borderRadius: trackH / 2,
          border: "1px solid rgba(0,0,0,0.6)",
          boxShadow: active
            ? `inset 0 2px 4px rgba(0,0,0,0.55), 0 0 10px rgba(74,246,38,0.35)`
            : `inset 0 2px 4px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05)`,
          cursor: "pointer",
          transition: "box-shadow 100ms ease",
          flexShrink: 0,
        }}
      >
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: gap,
            // inner width = trackW - 2; ON: inner width - thumbD - gap
            left: active ? trackW - 2 - thumbD - gap : gap,
            width: thumbD,
            height: thumbD,
            borderRadius: "50%",
            background: "linear-gradient(145deg, #f4f4f6 0%, #d4d4d6 100%)",
            boxShadow: active
              ? `0 0 6px var(--led-green), 0 1px 4px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.85)`
              : `0 1px 4px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.85)`,
            transition: "left 100ms ease, box-shadow 100ms ease",
          }}
        >
          {/* LED dot */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: ledD,
              height: ledD,
              borderRadius: "50%",
              background: active ? "var(--led-green)" : "#999",
              boxShadow: active ? "0 0 5px var(--led-green)" : "none",
              transition: "background 80ms ease, box-shadow 80ms ease",
            }}
          />
        </div>
      </button>

      {label && (
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-dark)",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

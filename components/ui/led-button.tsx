"use client";

interface LedButtonProps {
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  label?: string;
}

const SIZES = {
  sm: 28,
  md: 36,
};

const LED_SIZES = {
  sm: 8,
  md: 10,
};

export function LedButton({ active, onClick, size = "md", label }: LedButtonProps) {
  const dim = SIZES[size];
  const ledDim = LED_SIZES[size];

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <button
        onClick={onClick}
        style={{
          width: dim,
          height: dim,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)",
          border: "1px solid rgba(0,0,0,0.4)",
          boxShadow: active
            ? `0 0 8px var(--led-green), inset 0 1px 2px rgba(0,0,0,0.3)`
            : `0 2px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(0,0,0,0.3)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "box-shadow 80ms ease",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: ledDim,
            height: ledDim,
            borderRadius: "50%",
            background: active ? "var(--led-green)" : "var(--led-off)",
            boxShadow: active ? `0 0 4px var(--led-green)` : "none",
            transition: "background 80ms ease, box-shadow 80ms ease",
          }}
        />
      </button>

      {label && (
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
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

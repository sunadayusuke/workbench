"use client";

interface ToggleSwitchProps {
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  label?: string;
}

/* Toggle — Figma 1342:2890 (track 36×20, white capsule thumb 20×16, green #0dca7a). */
export function ToggleSwitch({ active, onClick, size = "md", label }: ToggleSwitchProps) {
  const trackW = size === "sm" ? 32 : 36;
  const trackH = size === "sm" ? 18 : 20;
  const thumbW = size === "sm" ? 18 : 20;
  const thumbH = size === "sm" ? 14 : 16;
  const inset = 2;

  const Switch = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        position: "relative",
        width: trackW,
        height: trackH,
        background: active ? "var(--wb-green)" : "var(--wb-300)",
        borderRadius: 9999,
        cursor: "pointer",
        transition: "background 220ms ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: inset,
          left: active ? trackW - thumbW - inset : inset,
          width: thumbW,
          height: thumbH,
          borderRadius: 9999,
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(12,12,16,0.22), 0 1px 3px rgba(12,12,16,0.10)",
          transition: "left 240ms cubic-bezier(0.22,0.61,0.36,1)",
        }}
      />
    </button>
  );

  if (!label) return <div className="inline-flex select-none">{Switch}</div>;

  return (
    <div className="flex h-10 w-full select-none items-center gap-1 rounded-[12px] border border-[rgba(12,12,16,0.05)] bg-wb-50 pl-4 pr-3.5 shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)]">
      <span className="min-w-0 flex-1 truncate text-[14px] leading-normal text-[rgba(12,12,16,0.46)]">{label}</span>
      {Switch}
    </div>
  );
}

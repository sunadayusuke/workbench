"use client";

import { cn } from "@/lib/utils";

interface PushButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "light" | "dark" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const VARIANT_STYLES: Record<NonNullable<PushButtonProps["variant"]>, React.CSSProperties> = {
  light: { background: "var(--cap-white)", color: "var(--ink-dark)" },
  dark:  { background: "#242424",          color: "#f0f0f2" },
  accent:{ background: "var(--cap-orange)",color: "#ffffff" },
};

// box-shadow as Tailwind class so active: pseudo can override it
const VARIANT_SHADOW: Record<NonNullable<PushButtonProps["variant"]>, string> = {
  light:  "[box-shadow:0_3px_0_#c2c2c4,0_4px_4px_rgba(0,0,0,0.15)] active:[box-shadow:0_0_0_#c2c2c4,inset_0_2px_4px_rgba(0,0,0,0.1)]",
  dark:   "[box-shadow:0_3px_0_#111,0_4px_4px_rgba(0,0,0,0.25)]     active:[box-shadow:0_0_0_#111,inset_0_2px_4px_rgba(0,0,0,0.2)]",
  accent: "[box-shadow:0_3px_0_#a03412,0_4px_4px_rgba(0,0,0,0.15)] active:[box-shadow:0_0_0_#a03412,inset_0_2px_4px_rgba(0,0,0,0.1)]",
};

const SIZE_CLASSES: Record<NonNullable<PushButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2 text-[12px]",
  lg: "px-5 py-2.5 text-[13px]",
};

export function PushButton({
  children,
  onClick,
  variant = "light",
  size = "md",
  className,
  disabled,
  type = "button",
}: PushButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-mono uppercase tracking-[0.12em] select-none rounded-[6px]",
        "transition-[transform,box-shadow] duration-[50ms]",
        "active:translate-y-[3px]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANT_SHADOW[variant],
        SIZE_CLASSES[size],
        className
      )}
      style={VARIANT_STYLES[variant]}
    >
      {children}
    </button>
  );
}

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
  light: {
    background: "var(--cap-white)",
    color: "var(--ink-dark)",
    boxShadow: "0 3px 0 #c2c2c4",
  },
  dark: {
    background: "#242424",
    color: "#f0f0f2",
    boxShadow: "0 3px 0 #111111",
  },
  accent: {
    background: "var(--cap-orange)",
    color: "#ffffff",
    boxShadow: "0 3px 0 #a03412",
  },
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
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-mono uppercase tracking-[0.12em] select-none transition-[transform,box-shadow] duration-75",
        "active:translate-y-[3px] active:[box-shadow:none]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        SIZE_CLASSES[size],
        className
      )}
      style={variantStyle}
    >
      {children}
    </button>
  );
}

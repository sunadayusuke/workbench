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

/* Pill buttons — Figma 1342:2975 (リセット) / 1342:2979 (出力). */
const VARIANT_CLASSES: Record<NonNullable<PushButtonProps["variant"]>, string> = {
  dark: "bg-wb-900 text-wb-0 border border-[rgba(12,12,16,0.12)] hover:bg-wb-800 active:bg-wb-950",
  light: "bg-wb-0 text-wb-900 border border-[rgba(12,12,16,0.12)] hover:bg-wb-50 active:bg-wb-100",
  accent: "bg-wb-green text-wb-0 border border-[rgba(12,12,16,0.12)] hover:opacity-90 active:opacity-100",
};

const SIZE_CLASSES: Record<NonNullable<PushButtonProps["size"]>, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-4 text-[15px]",
  lg: "h-11 px-5 text-[15px]",
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
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold leading-none select-none",
        "shadow-[0px_2px_36px_-8px_rgba(0,0,0,0.16)] backdrop-blur-[20px]",
        "transition-[background-color,opacity,transform] duration-100",
        "active:scale-[0.98]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

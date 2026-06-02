"use client";

import { cn } from "@/lib/utils";

interface ButtonSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface ButtonSelectProps<T extends string | number> {
  value: T;
  options: ButtonSelectOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}

/* Frosted mini segmented control — Figma 1342:2989 (white/70 + white border,
   active = white chip + drop-shadow, inactive = opacity-40, 12px SemiBold). */
export function ButtonSelect<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: ButtonSelectProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex select-none items-center gap-px rounded-full border border-white bg-white/70 p-[3px]",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex h-[22px] items-center justify-center rounded-full px-1.5 text-[12px] font-semibold leading-none text-wb-900 transition-opacity",
              active ? "bg-wb-0 drop-shadow-[0px_4px_6px_rgba(0,0,0,0.06)]" : "opacity-40 hover:opacity-70"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

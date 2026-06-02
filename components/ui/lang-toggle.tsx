"use client";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Segmented JA / EN control with a sliding white indicator — Figma 1340:2508. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, toggle } = useLanguage();
  const langs = ["ja", "en"] as const;
  const index = lang === "en" ? 1 : 0;

  return (
    <div
      className={cn(
        "relative inline-flex select-none items-center gap-px rounded-full border border-white bg-white/70 p-1 backdrop-blur-[20px]",
        "shadow-[0px_2px_36px_-8px_rgba(0,0,0,0.16)]",
        className
      )}
    >
      {/* sliding white indicator */}
      <span
        aria-hidden
        className="absolute left-1 top-1 h-7 w-9 rounded-full bg-wb-0 drop-shadow-[0px_4px_6px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
        style={{ transform: `translateX(${index * 37}px)` }}
      />
      {langs.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => { if (!active) toggle(); }}
            aria-pressed={active}
            className={cn(
              "relative z-10 flex h-7 w-9 items-center justify-center rounded-full text-[13px] font-semibold leading-none transition-colors",
              active ? "text-wb-900" : "text-[rgba(12,12,16,0.26)] hover:text-[rgba(12,12,16,0.5)]"
            )}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

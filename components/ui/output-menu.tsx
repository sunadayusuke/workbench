"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PushButton } from "@/components/ui/push-button";

const OutputMenuContext = createContext<{ close: () => void }>({ close: () => {} });

/** Returns the close() fn of the enclosing OutputMenu (for custom popup rows). */
export function useOutputMenuClose() {
  return useContext(OutputMenuContext).close;
}

interface OutputMenuProps {
  label: React.ReactNode;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Footer output popup (zinc). The wrapper is `display:contents` so the dark
 * trigger participates directly in the footer flex row (and stays flex-1
 * next to a shrink-0 reset). The popup positions against ControlPanel's
 * absolute footer — its nearest positioned ancestor.
 */
export function OutputMenu({ label, disabled, className, children }: OutputMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <OutputMenuContext.Provider value={{ close }}>
      <div ref={wrapRef} className="contents">
        <PushButton
          variant="dark"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn("flex-1", className)}
        >
          {label}
        </PushButton>
        {open && (
          <div className="absolute bottom-[calc(100%+6px)] left-5 right-5 bg-wb-0 border border-wb-200 rounded-[12px] overflow-hidden shadow-[0_-4px_20px_rgba(12,12,16,0.14)]">
            {children}
          </div>
        )}
      </div>
    </OutputMenuContext.Provider>
  );
}

interface OutputMenuItemProps {
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function OutputMenuItem({ onSelect, disabled, children }: OutputMenuItemProps) {
  const close = useOutputMenuClose();
  return (
    <button
      disabled={disabled}
      className="w-full px-4 py-3 text-left text-[13px] text-wb-700 hover:bg-wb-50 transition-colors select-none border-b border-wb-200 last:border-b-0 disabled:opacity-40"
      onClick={() => {
        close();
        onSelect();
      }}
    >
      {children}
    </button>
  );
}

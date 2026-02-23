import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Dark LCD-screen style
        "h-8 w-full min-w-0 rounded-[3px] px-2.5 py-1",
        "border border-[rgba(0,0,0,0.5)]",
        "bg-[#1a1a1a] text-[#e0e0e2]",
        "font-mono text-[11px]",
        "[box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)]",
        "placeholder:text-[#505050]",
        "transition-[box-shadow] duration-75 outline-none",
        "focus-visible:[box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35),0_0_0_1px_var(--led-green)]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }

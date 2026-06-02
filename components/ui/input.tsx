import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Light pill style
        "h-10 w-full min-w-0 rounded-[10px] px-3.5 py-2",
        "bg-wb-50 text-wb-900",
        "text-[13px]",
        "placeholder:text-wb-400",
        "transition-[box-shadow,background-color] duration-100 outline-none",
        "hover:bg-wb-100 focus-visible:bg-wb-50 focus-visible:ring-2 focus-visible:ring-wb-900",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }

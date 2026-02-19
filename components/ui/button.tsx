import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.10em] transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default: "bg-[#242424] text-white hover:bg-[#333] active:bg-[#1a1a1a]",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-[#242424] text-[#242424] bg-transparent hover:bg-[#242424]/10 active:bg-[#242424]/20",
        secondary: "border border-[#242424] text-[#242424] bg-transparent hover:bg-[#242424]/10 active:bg-[#242424]/20",
        ghost: "text-[#242424] hover:bg-[#242424]/10 active:bg-[#242424]/20",
        link: "text-[#242424] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-6 px-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
        "icon-xs": "size-6",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

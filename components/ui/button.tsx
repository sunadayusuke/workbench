import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[14px] font-medium leading-none transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-wb-900",
  {
    variants: {
      variant: {
        default: "bg-wb-900 text-wb-0 hover:bg-wb-800 active:bg-wb-950",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-wb-200 text-wb-900 bg-wb-0 hover:bg-wb-50 active:bg-wb-100",
        secondary: "bg-wb-50 text-wb-900 hover:bg-wb-100 active:bg-wb-200",
        ghost: "text-wb-900 hover:bg-wb-50 active:bg-wb-100",
        link: "text-wb-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 px-2.5",
        sm: "h-8 px-3",
        lg: "h-11 px-6",
        icon: "size-10",
        "icon-xs": "size-7",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
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

"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow rounded-full data-[orientation=horizontal]:h-[4px] data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[4px]"
        style={{
          backgroundColor: "#FFFFFF",
          boxShadow: "inset 0 1px 1px rgba(0,0,0,0.08)",
        }}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full rounded-full"
          style={{ backgroundColor: "#242424" }}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-4 shrink-0 rounded-full cursor-grab active:cursor-grabbing focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          style={{
            background: "#FAFAF8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.22), 0 0 0 1px #242424",
          }}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }

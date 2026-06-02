"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  label,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
  label?: string
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        // Pill style — Figma 1342:2783 (rounded-12, bg #f3f4f4, border ink-a/50)
        "relative flex w-full items-center justify-between gap-1 cursor-pointer select-none",
        "text-[14px] text-[rgba(12,12,16,0.64)]",
        "rounded-[12px] border border-[rgba(12,12,16,0.05)] bg-wb-50 pl-4 pr-2.5",
        "shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)]",
        "transition-colors duration-100 outline-none hover:bg-wb-100",
        "focus-visible:ring-2 focus-visible:ring-wb-900 focus-visible:ring-offset-0",
        "data-[size=default]:h-10 data-[size=sm]:h-9",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[placeholder]:text-[rgba(12,12,16,0.46)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        className
      )}
      {...props}
    >
      {label && (
        <span className="min-w-0 flex-1 truncate text-left text-[14px] leading-normal text-[rgba(12,12,16,0.46)]">
          {label}
        </span>
      )}
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronsUpDownIcon className="size-5 shrink-0 text-[rgba(12,12,16,0.46)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          // Light popover style
          "z-50 min-w-[8rem] overflow-hidden",
          "rounded-[12px] border border-wb-200",
          "bg-wb-0 text-wb-700",
          "shadow-[0_8px_28px_rgba(12,12,16,0.14),0_2px_8px_rgba(12,12,16,0.08)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1 text-[11px] text-wb-500", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 pr-7 outline-none select-none",
        "text-[13px] text-wb-700",
        "focus:bg-wb-50 focus:text-wb-900 data-[state=checked]:text-wb-900",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5 text-wb-900" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-wb-100", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1 text-wb-400", className)}
      {...props}
    >
      <ChevronUpIcon className="size-3" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1 text-wb-400", className)}
      {...props}
    >
      <ChevronDownIcon className="size-3" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

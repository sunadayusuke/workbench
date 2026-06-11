import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Read-only / editable code textarea (zinc inset). Sizing via className. */
export const CodeField = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function CodeField({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "rounded-[10px] border border-wb-200 bg-wb-50 text-wb-900 font-mono text-[12px] leading-relaxed p-4 resize-none outline-none focus-visible:ring-2 focus-visible:ring-wb-900",
        className
      )}
      {...props}
    />
  );
});

/** Single-line text input (zinc inset). Override text size via className. */
export const TextField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextField({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-[10px] border border-wb-200 bg-wb-50 text-wb-900 px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-wb-900 placeholder:text-wb-400",
        className
      )}
      {...props}
    />
  );
});

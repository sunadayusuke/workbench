import { cn } from "@/lib/utils";

interface CircleButtonProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}

/** Round add (＋) button used in section headers. */
export function CircleButton({
  onClick,
  className,
  children,
  "aria-label": ariaLabel,
}: CircleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border border-wb-100 bg-wb-0 text-[14px] font-semibold leading-none text-wb-900 shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)] transition-colors hover:bg-wb-50",
        className
      )}
    >
      {children}
    </button>
  );
}

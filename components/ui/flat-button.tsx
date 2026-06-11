import { cn } from "@/lib/utils";

interface FlatButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<FlatButtonProps["variant"]>, string> = {
  solid: "bg-wb-900 text-wb-0 hover:bg-wb-800 active:bg-wb-950",
  outline: "bg-wb-0 border border-wb-200 text-wb-900 hover:bg-wb-50",
};

/** Dialog / inline flat button (zinc). Labels are raw text (no brackets). */
export function FlatButton({
  children,
  onClick,
  variant = "solid",
  type = "button",
  disabled,
  className,
}: FlatButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 px-4 rounded-[10px] text-[14px] font-medium transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

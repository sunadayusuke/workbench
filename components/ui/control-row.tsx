import { cn } from "@/lib/utils";

/** Pill row hosting a label + a trailing control (segmented control, etc). */
export function ControlRow({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center gap-1 rounded-[12px] border border-[rgba(12,12,16,0.05)] bg-wb-50 pl-4 pr-3.5 shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)]",
        className
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[14px] leading-normal text-[rgba(12,12,16,0.46)]">
        {label}
      </span>
      {children}
    </div>
  );
}

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Color rows — Figma 1342:2892 (labeled, no remove) / 1349:2537 (labeled + remove)
   / 1349:2523 (unlabeled + remove). 22px circle swatch, integrated × close. */
export function ColorRow({
  label,
  value,
  onChange,
  onRemove,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
}) {
  const hex = (
    <span className="text-[13px] leading-normal tabular-nums text-[rgba(12,12,16,0.64)]">{value}</span>
  );
  const swatch = (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="color-swatch"
    />
  );

  return (
    <div
      className={cn(
        "flex h-10 w-full items-center gap-1 rounded-[12px] border border-[rgba(12,12,16,0.05)] bg-wb-50 shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)]",
        label ? "pl-4" : "pl-3.5",
        onRemove ? "pr-2.5" : "pr-3.5"
      )}
    >
      {label ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[14px] leading-normal text-[rgba(12,12,16,0.46)]">
            {label}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {hex}
            {swatch}
          </div>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {swatch}
          {hex}
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="remove"
          className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[rgba(12,12,16,0.46)] transition-colors hover:bg-[rgba(12,12,16,0.05)]"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

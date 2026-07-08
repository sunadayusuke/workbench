import { X } from "lucide-react";

/* Removable list row — same pill shell as ColorRow but label-only (no swatch).
   Used for list entries whose only action is removal (e.g. focus-country list). */
export function RemovableRow({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex h-10 w-full items-center gap-1 rounded-[12px] border border-[rgba(12,12,16,0.05)] bg-wb-50 pl-4 pr-2.5 shadow-[0px_2px_2px_0px_rgba(0,0,0,0.02)]">
      <span className="min-w-0 flex-1 truncate text-[14px] leading-normal text-[rgba(12,12,16,0.46)]">
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove"
        className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[rgba(12,12,16,0.46)] transition-colors hover:bg-[rgba(12,12,16,0.05)]"
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface ControlPanelProps {
  title: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  footerClassName?: string;
  children: React.ReactNode;
}

/**
 * Right-side aside shell (zinc). Footer is an ABSOLUTE overlay over the
 * scroll area, so the aside is `relative` and the scroll body reserves
 * `pb-[88px]`. OutputMenu popups position against this footer.
 */
export function ControlPanel({
  title,
  headerAction,
  footer,
  className,
  footerClassName,
  children,
}: ControlPanelProps) {
  return (
    <aside
      className={cn(
        "relative flex-1 md:flex-none md:w-[320px] shrink-0 bg-wb-0 shadow-[0_-8px_24px_rgba(12,12,16,0.08)] md:shadow-none md:border-l md:border-wb-200 flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="shrink-0 px-5 pt-6 pb-3 flex items-center justify-between">
        <span className="text-[18px] font-medium text-wb-900 select-none">{title}</span>
        {headerAction}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col pb-[88px]">
        {children}
      </div>
      {footer != null && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-start gap-2 p-4 backdrop-blur-[6px] bg-gradient-to-t from-white to-transparent",
            footerClassName
          )}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}

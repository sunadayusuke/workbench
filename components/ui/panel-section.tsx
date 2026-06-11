import { cn } from "@/lib/utils";

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("text-[15px] font-medium text-wb-900 select-none", className)}>
      {children}
    </span>
  );
}

interface PanelSectionProps {
  title?: string;
  titleAction?: React.ReactNode;
  border?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PanelSection({
  title,
  titleAction,
  border = true,
  className,
  children,
}: PanelSectionProps) {
  return (
    <div
      className={cn(
        "px-5 py-4 flex flex-col gap-2",
        border && "border-b border-wb-200",
        className
      )}
    >
      {title && titleAction ? (
        <div className="flex items-center justify-between">
          <SectionTitle>{title}</SectionTitle>
          {titleAction}
        </div>
      ) : title ? (
        <SectionTitle>{title}</SectionTitle>
      ) : null}
      {children}
    </div>
  );
}

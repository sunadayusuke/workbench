import { cn } from "@/lib/utils";

/** Indented frame for child parameters (left rule). */
export function NestedGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("pl-3 border-l-2 border-wb-100 flex flex-col gap-2", className)}>
      {children}
    </div>
  );
}

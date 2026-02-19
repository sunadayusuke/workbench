export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-[#242424] select-none">
      {children}
    </p>
  );
}

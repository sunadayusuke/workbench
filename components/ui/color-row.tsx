export function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#242424]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="color-swatch"
        />
        <span className="text-[12px] font-mono text-[#242424]">{value}</span>
      </div>
    </div>
  );
}

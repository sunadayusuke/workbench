import { cn } from "@/lib/utils";

/** `.color-swatch` default size (globals.css). */
const DEFAULT_SWATCH_SIZE = 22;

interface ColorSwatchProps {
  value: string;
  onChange: (v: string) => void;
  size?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Round color-picker input. Wraps the global `.color-swatch` style. Pass
 * `size` to override the 22px default (inline width/height). Used by bare
 * swatches (e.g. the color app's local ColorInput); ColorRow stays the
 * canonical labeled row.
 */
export function ColorSwatch({ value, onChange, size, className, disabled }: ColorSwatchProps) {
  const style =
    size && size !== DEFAULT_SWATCH_SIZE
      ? { width: `${size}px`, height: `${size}px` }
      : undefined;
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={style}
      className={cn("color-swatch", className)}
    />
  );
}

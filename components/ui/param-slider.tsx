"use client";

import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}

export function ParamSlider({ label, value, min, max, step, onChange, unit }: ParamSliderProps) {
  const decimals = step < 0.01 ? 3 : step < 1 ? 2 : 0;
  const display = unit ? `${value.toFixed(decimals)}${unit}` : value.toFixed(decimals);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <Label className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#242424]">{label}</Label>
        <span className="text-[12px] font-mono text-[#242424] tabular-nums">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

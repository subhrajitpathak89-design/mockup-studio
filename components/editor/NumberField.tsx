"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Multiplier applied for display only, e.g. 100 to show a percentage. */
  displayScale?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

/**
 * Slider plus numeric input, kept in sync. The text input holds a draft string
 * while focused so typing "-" or "0." does not get clobbered mid-keystroke.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  displayScale = 1,
  suffix,
  onChange,
}: NumberFieldProps) {
  const display = round(value * displayScale);
  // The draft only exists while the field has focus, so typing "-" or "0."
  // is not clobbered mid-keystroke. Otherwise the store value is shown.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(display);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed / displayScale));
      onChange(clamped);
    }
    setDraft(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            value={shown}
            onFocus={(e) => setDraft(e.target.value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-7 w-16 px-2 text-right text-xs tabular-nums"
          />
          {suffix ? (
            <span className="w-3 text-xs text-muted-foreground">{suffix}</span>
          ) : null}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

"use client";

import { useCallback, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The native `<input type="color">` opens the operating system's picker, which
 * on Windows is a modal dialog that covers the canvas — so you cannot see what
 * the colour is doing to the scene while you choose it. This one lives in a
 * popover beside the panel and writes on every move, so the scene updates
 * under the cursor.
 */
export function ColorPicker({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Quick picks shown under the gradient area. */
  swatches?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <HexField value={value} onChange={onChange} />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${label} — pick a colour`}
              style={{ background: value }}
              className="size-7 shrink-0 cursor-pointer rounded-lg border border-white/15 shadow-inner transition-transform hover:scale-105"
            />
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-60 p-3">
            <PickerBody value={value} onChange={onChange} swatches={swatches} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/** Editable hex, committed on blur or Enter so half-typed values never apply. */
function HexField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // Null means "not being edited", so the field simply shows the live value
  // and there is no copy of it to keep in sync.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  const commit = () => {
    const normalised = draft === null ? null : normaliseHex(draft);
    setDraft(null);
    if (normalised) onChange(normalised);
  };

  return (
    <input
      value={shown}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      spellCheck={false}
      aria-label="Hex colour"
      className="w-[70px] rounded-md border border-transparent bg-white/[0.04] px-1.5 py-1 text-right font-mono text-[11px] uppercase text-muted-foreground outline-none transition-colors focus:border-white/15 focus:text-foreground"
    />
  );
}

function PickerBody({
  value,
  onChange,
  swatches,
}: {
  value: string;
  onChange: (value: string) => void;
  swatches?: string[];
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Hue is kept locally: a fully black or white colour has no hue of its own,
  // and recomputing it from the hex would snap the slider back to red the
  // moment you drag into a corner.
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [lastHex, setLastHex] = useState(value);

  // Adjusting state during render — React's own answer to deriving from
  // props — rather than an effect, which would paint one stale frame first.
  if (value !== lastHex) {
    setLastHex(value);
    if (hsvToHex(hsv) !== value.toLowerCase()) setHsv(hexToHsv(value));
  }

  const applyFromArea = useCallback(
    (clientX: number, clientY: number) => {
      const rect = areaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = clamp01((clientX - rect.left) / rect.width);
      const v = 1 - clamp01((clientY - rect.top) / rect.height);
      setHsv((prev) => {
        const next = { ...prev, s, v };
        onChange(hsvToHex(next));
        return next;
      });
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <div
        ref={areaRef}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          applyFromArea(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) applyFromArea(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
        }}
        className="relative h-32 w-full cursor-crosshair touch-none rounded-lg border border-white/10"
      >
        <span
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={hsv.h}
        aria-label="Hue"
        onChange={(e) => {
          const h = Number(e.target.value);
          setHsv((prev) => {
            const next = { ...prev, h };
            onChange(hsvToHex(next));
            return next;
          });
        }}
        className="h-3 w-full cursor-pointer appearance-none rounded-full border border-white/10 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{
          background:
            "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
      />

      {swatches?.length ? (
        <div className="grid grid-cols-8 gap-1.5">
          {swatches.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={hex}
              onClick={() => onChange(hex)}
              style={{ background: hex }}
              className={cn(
                "aspect-square rounded-md ring-1 transition-transform hover:scale-110",
                hex.toLowerCase() === value.toLowerCase()
                  ? "ring-2 ring-sky-400"
                  : "ring-white/15",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function normaliseHex(raw: string): string | null {
  const clean = raw.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(clean)) return null;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return `#${full.toLowerCase()}`;
}

interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function hexToHsv(hex: string): Hsv {
  const normalised = normaliseHex(hex) ?? "#000000";
  const r = parseInt(normalised.slice(1, 3), 16) / 255;
  const g = parseInt(normalised.slice(3, 5), 16) / 255;
  const b = parseInt(normalised.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

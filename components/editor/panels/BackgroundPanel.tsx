"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/editor/NumberField";
import {
  BACKGROUND_PRESETS,
  LIGHTING_PRESETS,
  SHADOW_PRESETS,
} from "@/lib/project/schema";
import {
  backgroundActions,
  lightingActions,
  shadowActions,
} from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import type { BackgroundState, BackgroundType, GradientKind } from "@/types";
import { cn } from "@/lib/utils";

export function BackgroundPanel() {
  const background = useProjectStore((s) => s.scene.background);
  const shadow = useProjectStore((s) => s.scene.shadow);
  const lighting = useProjectStore((s) => s.scene.lighting);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Presets
        </p>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              aria-label={preset.label}
              onClick={() => backgroundActions.apply(preset.value)}
              style={{ background: swatch(preset.value) }}
              className="aspect-square rounded-md ring-1 ring-white/10 transition-transform hover:scale-105"
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(["solid", "gradient", "grid"] as BackgroundType[]).map((type) => (
            <Button
              key={type}
              size="sm"
              variant={background.type === type ? "default" : "outline"}
              onClick={() => backgroundActions.patch({ type })}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>

        <ColorRow
          label="Color 1"
          value={background.color1}
          onChange={(color1) => backgroundActions.patch({ color1 })}
        />
        {background.type !== "solid" ? (
          <ColorRow
            label={background.type === "grid" ? "Line color" : "Color 2"}
            value={background.color2}
            onChange={(color2) => backgroundActions.patch({ color2 })}
          />
        ) : null}

        {background.type === "gradient" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["linear", "radial"] as GradientKind[]).map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant={background.gradientKind === kind ? "default" : "outline"}
                  onClick={() => backgroundActions.patch({ gradientKind: kind })}
                  className="capitalize"
                >
                  {kind}
                </Button>
              ))}
            </div>
            {background.gradientKind === "linear" ? (
              <NumberField
                label="Angle"
                value={background.angle}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(angle) => backgroundActions.patch({ angle })}
              />
            ) : null}
          </>
        ) : null}

        {background.type === "grid" ? (
          <>
            <NumberField
              label="Grid size"
              value={background.gridSize}
              min={8}
              max={240}
              step={1}
              onChange={(gridSize) => backgroundActions.patch({ gridSize })}
            />
            <NumberField
              label="Grid opacity"
              value={background.gridOpacity}
              min={0}
              max={1}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={(gridOpacity) => backgroundActions.patch({ gridOpacity })}
            />
          </>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Shadow
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SHADOW_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="outline"
              onClick={() => shadowActions.apply(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <NumberField
          label="Opacity"
          value={shadow.opacity}
          min={0}
          max={1}
          step={0.01}
          displayScale={100}
          suffix="%"
          onChange={(opacity) => shadowActions.patch({ opacity })}
        />
        <NumberField
          label="Blur"
          value={shadow.blur}
          min={0}
          max={200}
          step={1}
          onChange={(blur) => shadowActions.patch({ blur })}
        />
        <NumberField
          label="Offset X"
          value={shadow.offsetX}
          min={-300}
          max={300}
          step={1}
          onChange={(offsetX) => shadowActions.patch({ offsetX })}
        />
        <NumberField
          label="Offset Y"
          value={shadow.offsetY}
          min={-300}
          max={300}
          step={1}
          onChange={(offsetY) => shadowActions.patch({ offsetY })}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lighting
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LIGHTING_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="outline"
              onClick={() => lightingActions.apply(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <NumberField
          label="Intensity"
          value={lighting.intensity}
          min={0}
          max={1}
          step={0.01}
          displayScale={100}
          suffix="%"
          onChange={(intensity) => lightingActions.patch({ intensity })}
        />
        <NumberField
          label="Angle"
          value={lighting.angle}
          min={0}
          max={360}
          step={1}
          suffix="°"
          onChange={(angle) => lightingActions.patch({ angle })}
        />
        <NumberField
          label="Softness"
          value={lighting.softness}
          min={0}
          max={1}
          step={0.01}
          displayScale={100}
          suffix="%"
          onChange={(softness) => lightingActions.patch({ softness })}
        />
      </section>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase text-muted-foreground">
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "size-7 cursor-pointer rounded border border-border bg-transparent p-0.5",
          )}
        />
      </div>
    </div>
  );
}

function swatch(bg: BackgroundState) {
  if (bg.type === "solid") return bg.color1;
  if (bg.type === "grid")
    return `repeating-linear-gradient(0deg, ${bg.color2} 0 1px, ${bg.color1} 1px 8px), ${bg.color1}`;
  return bg.gradientKind === "radial"
    ? `radial-gradient(circle, ${bg.color1}, ${bg.color2})`
    : `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})`;
}

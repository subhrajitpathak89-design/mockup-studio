"use client";

import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
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
    <>
      <PanelSection title="Background">
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              aria-label={preset.label}
              onClick={() => backgroundActions.apply(preset.value)}
              style={{ background: swatch(preset.value) }}
              className="aspect-square rounded-xl ring-1 ring-white/10 transition-transform hover:scale-105"
            />
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {(["solid", "gradient", "grid", "rails"] as BackgroundType[]).map((type) => (
            <SegmentButton
              key={type}
              active={background.type === type}
              onClick={() => backgroundActions.setType(type)}
            >
              {type}
            </SegmentButton>
          ))}
        </div>

        <ColorRow
          label={background.type === "rails" ? "Upper beams" : "Color 1"}
          value={background.color1}
          onChange={(color1) => backgroundActions.patch({ color1 })}
        />
        {background.type !== "solid" ? (
          <ColorRow
            label={
              background.type === "grid"
                ? "Line color"
                : background.type === "rails"
                  ? "Lower beams"
                  : "Color 2"
            }
            value={background.color2}
            onChange={(color2) => backgroundActions.patch({ color2 })}
          />
        ) : null}

        {background.type === "gradient" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["linear", "radial"] as GradientKind[]).map((kind) => (
                <SegmentButton
                  key={kind}
                  active={background.gradientKind === kind}
                  onClick={() => backgroundActions.patch({ gradientKind: kind })}
                >
                  {kind}
                </SegmentButton>
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

        {background.type === "rails" ? (
          <>
            <NumberField
              label="Beams"
              value={background.railCount}
              min={1}
              max={12}
              step={1}
              onChange={(railCount) => backgroundActions.patch({ railCount })}
            />
            <NumberField
              label="Flare"
              value={background.railSpread}
              min={0}
              max={1.5}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={(railSpread) => backgroundActions.patch({ railSpread })}
            />
            <NumberField
              label="Glow"
              value={background.railGlow}
              min={0}
              max={1.5}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={(railGlow) => backgroundActions.patch({ railGlow })}
            />
            <NumberField
              label="Drift speed"
              value={background.railSpeed}
              min={0}
              max={2}
              step={0.01}
              onChange={(railSpeed) => backgroundActions.patch({ railSpeed })}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Rails drift with the timeline, so they animate in preview and
              export without needing a preset.
            </p>
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
      </PanelSection>

      <PanelSection title="Shadow">
        <div className="grid grid-cols-3 gap-2">
          {SHADOW_PRESETS.map((p) => (
            <SegmentButton key={p.id} onClick={() => shadowActions.apply(p.value)}>
              {p.label}
            </SegmentButton>
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
      </PanelSection>

      <PanelSection title="Lighting">
        <div className="grid grid-cols-3 gap-2">
          {LIGHTING_PRESETS.map((p) => (
            <SegmentButton key={p.id} onClick={() => lightingActions.apply(p.value)}>
              {p.label}
            </SegmentButton>
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
      </PanelSection>
    </>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors",
        active
          ? "border-white/20 bg-white/10 text-foreground"
          : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
      )}
    >
      {children}
    </button>
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
          className="size-7 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
        />
      </div>
    </div>
  );
}

function swatch(bg: BackgroundState) {
  if (bg.type === "solid") return bg.color1;
  if (bg.type === "grid")
    return `repeating-linear-gradient(0deg, ${bg.color2} 0 1px, ${bg.color1} 1px 8px), ${bg.color1}`;
  if (bg.type === "rails")
    // Streaks over a hot centre line — a small stand-in for the real beams.
    return [
      "repeating-linear-gradient(96deg, rgba(255,255,255,0.45) 0 1.5px, transparent 1.5px 7px)",
      "radial-gradient(130% 38% at 50% 50%, rgba(255,255,255,0.95), transparent 72%)",
      `linear-gradient(180deg, ${bg.color1}, #0b0b0f 50%, ${bg.color2})`,
    ].join(", ");
  return bg.gradientKind === "radial"
    ? `radial-gradient(circle, ${bg.color1}, ${bg.color2})`
    : `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})`;
}


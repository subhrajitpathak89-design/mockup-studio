"use client";

import { ColorPicker } from "@/components/editor/ColorPicker";
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
import { BACKGROUND_SHADERS } from "@/lib/canvas/shaders";
import { BACKDROPS, backdropThumb, backdropUrl } from "@/lib/canvas/unsplash";
import type { BackgroundState, BackgroundType, GradientKind } from "@/types";
import { cn } from "@/lib/utils";

export function BackgroundPanel() {
  const background = useProjectStore((s) => s.scene.background);
  const shadow = useProjectStore((s) => s.scene.shadow);
  const lighting = useProjectStore((s) => s.scene.lighting);

  return (
    <>
      <PanelSection title="Background">
        {/* Type first, then the one gallery that belongs to it. Showing every
            preset of every type at once put two near-identical photo grids on
            the same panel. */}
        <div className="grid grid-cols-3 gap-2">
          {(
            ["solid", "gradient", "grid", "shader", "image"] as BackgroundType[]
          ).map((type) => (
            <SegmentButton
              key={type}
              active={background.type === type}
              onClick={() => backgroundActions.setType(type)}
            >
              {type}
            </SegmentButton>
          ))}
        </div>

        {background.type === "solid" ? (
          <div className="grid grid-cols-6 gap-2 pt-1">
            {SOLID_SWATCHES.map((hex) => (
              <button
                key={hex}
                title={hex}
                aria-label={hex}
                onClick={() => backgroundActions.patch({ color1: hex })}
                style={{ background: hex }}
                className={cn(
                  "aspect-square rounded-lg ring-1 transition-transform hover:scale-110",
                  background.color1.toLowerCase() === hex
                    ? "ring-2 ring-sky-400"
                    : "ring-white/10",
                )}
              />
            ))}
          </div>
        ) : null}

        {background.type === "gradient" || background.type === "grid" ? (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {BACKGROUND_PRESETS.filter(
              (preset) => preset.value.type === background.type,
            ).map((preset) => (
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
        ) : null}

{/* A photo backdrop has no colours of its own to set. */}
        {background.type !== "image" ? (
          <>
            <ColorPicker
              label={background.type === "shader" ? "Tint 1" : "Color 1"}
              value={background.color1}
              swatches={SOLID_SWATCHES}
              onChange={(color1) => backgroundActions.patch({ color1 })}
            />
            {background.type !== "solid" ? (
              <ColorPicker
                label={
                  background.type === "grid"
                    ? "Line color"
                    : background.type === "shader"
                      ? "Tint 2"
                      : "Color 2"
                }
                value={background.color2}
                swatches={ACCENT_SWATCHES}
                onChange={(color2) => backgroundActions.patch({ color2 })}
              />
            ) : null}
          </>
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

        {background.type === "shader" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {BACKGROUND_SHADERS.map((shader) => (
                <button
                  key={shader.id}
                  onClick={() => backgroundActions.patch({ shaderId: shader.id })}
                  className={cn(
                    "relative aspect-[16/9] overflow-hidden rounded-lg ring-1 transition-transform hover:scale-105",
                    background.shaderId === shader.id
                      ? "ring-2 ring-sky-400"
                      : "ring-white/10",
                  )}
                  style={{
                    background: shaderSwatch(
                      shader.id,
                      background.color1,
                      background.color2,
                    ),
                  }}
                >
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-3 pb-1 text-[10px] font-medium text-white">
                    {shader.label}
                  </span>
                </button>
              ))}
            </div>
            <NumberField
              label="Speed"
              value={background.shaderSpeed}
              min={0}
              max={3}
              step={0.05}
              onChange={(shaderSpeed) => backgroundActions.patch({ shaderSpeed })}
            />
            <NumberField
              label="Amplitude"
              value={background.shaderAmplitude}
              min={0}
              max={2}
              step={0.05}
              onChange={(shaderAmplitude) =>
                backgroundActions.patch({ shaderAmplitude })
              }
            />
            <NumberField
              label="Scale"
              value={background.shaderScale}
              min={0.2}
              max={4}
              step={0.05}
              onChange={(shaderScale) => backgroundActions.patch({ shaderScale })}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Shaders run on the GPU against the timeline clock, so they animate
              in preview and come out of export frame-exact.
            </p>
          </>
        ) : null}

        {background.type === "image" ? (
          <>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {BACKDROPS.map((shot) => {
                const url = backdropUrl(shot.photo);
                return (
                  <button
                    key={shot.id}
                    title={shot.label}
                    aria-label={shot.label}
                    onClick={() => backgroundActions.patch({ imageUrl: url })}
                    className={cn(
                      "aspect-[16/10] overflow-hidden rounded-lg ring-1 transition-transform hover:scale-105",
                      background.imageUrl === url
                        ? "ring-2 ring-sky-400"
                        : "ring-white/10",
                    )}
                  >
                    {/* A plain img, not next/image: these are hotlinked from
                        Unsplash's CDN and never optimised by us. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={backdropThumb(shot.photo)}
                      alt={shot.label}
                      className="size-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
            <NumberField
              label="Dim"
              value={background.imageDim}
              min={0}
              max={0.85}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={(imageDim) => backgroundActions.patch({ imageDim })}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Photos from{" "}
              <a
                href="https://unsplash.com"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Unsplash
              </a>
              , loaded from their CDN — so a backdrop needs a connection the
              first time you use it.
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

/** Grounds that read well behind a device: neutrals first, then colour. */
const SOLID_SWATCHES = [
  "#000000", "#0b0c0f", "#111827", "#1f2937", "#374151", "#64748b",
  "#e5e7eb", "#f8fafc", "#1e1b4b", "#4338ca", "#0f766e", "#14b8a6",
  "#7c2d12", "#ea580c", "#831843", "#db2777", "#365314", "#84cc16",
];

/** Second-colour picks — brighter, since they sit on top of a ground. */
const ACCENT_SWATCHES = [
  "#f8fafc", "#94a3b8", "#38bdf8", "#0ea5e9", "#6366f1", "#a855f7",
  "#f472b6", "#fb7185", "#fb923c", "#facc15", "#34d399", "#22d3ee",
  "#0b0c0f", "#1e293b", "#4c1d95", "#075985",
];

/** A CSS stand-in for each shader, for the picker tiles. */
function shaderSwatch(id: string, c1: string, c2: string) {
  switch (id) {
    case "silk":
      // Smooth folds rather than hard stripes — the shader has no hard edges.
      return `linear-gradient(115deg, ${c1}, ${c2} 28%, ${c1} 52%, ${c2} 78%, ${c1})`;
    case "iridescence":
      return `conic-gradient(from 210deg, ${c1}, ${c2}, #f8fafc, ${c1})`;
    case "chrome":
      return [
        `radial-gradient(120% 100% at 30% 35%, rgba(255,255,255,0.55), transparent 55%)`,
        `linear-gradient(135deg, ${c1}, ${c2} 40%, ${c1} 65%, ${c2})`,
      ].join(", ");
    default:
      return [
        "radial-gradient(120% 90% at 50% 110%, rgba(255,255,255,0.35), transparent 60%)",
        `linear-gradient(90deg, ${c1}, ${c2})`,
      ].join(", ");
  }
}

function swatch(bg: BackgroundState) {
  if (bg.type === "solid") return bg.color1;
  if (bg.type === "grid")
    return `repeating-linear-gradient(0deg, ${bg.color2} 0 1px, ${bg.color1} 1px 8px), ${bg.color1}`;
  if (bg.type === "image") return `url(${bg.imageUrl}) center/cover`;
  if (bg.type === "shader")
    // A hint of the real thing; the shader itself only exists on the canvas.
    return [
      "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.35), transparent 60%)",
      `linear-gradient(140deg, ${bg.color1}, ${bg.color2})`,
    ].join(", ");
  return bg.gradientKind === "radial"
    ? `radial-gradient(circle, ${bg.color1}, ${bg.color2})`
    : `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})`;
}


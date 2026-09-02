"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Layers,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import {
  TEXT_ANIMATION_PRESETS,
  TEXT_STYLE_PRESETS,
} from "@/lib/animation/textPresets";
import { FONT_OPTIONS, fontById } from "@/lib/fonts";
import { textActions } from "@/lib/project/actions";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { TextAlign, TextItem, TextWeight } from "@/types";
import { cn } from "@/lib/utils";

const ALIGN_ICONS: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

const SWATCHES = ["#ffffff", "#0f172a", "#38bdf8", "#f472b6", "#fbbf24", "#4ade80"];

export function TextPanel() {
  const texts = useProjectStore((s) => s.scene.texts);
  const selectedId = useEditorStore((s) => s.selectedTextId);
  const selected = texts.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <Button
        className="w-full rounded-xl"
        onClick={() => {
          const id = textActions.add();
          useEditorStore.getState().selectText(id);
        }}
      >
        <Plus className="size-4" /> Add text
      </Button>

      {texts.length > 0 ? (
        <PanelSection title="Layers">
          <ul className="space-y-1">
            {texts.map((item, index) => (
              <li key={item.id}>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors",
                    selectedId === item.id
                      ? "border-white/20 bg-white/10"
                      : "border-transparent hover:bg-white/[0.04]",
                  )}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => useEditorStore.getState().selectText(item.id)}
                  >
                    <Type className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs">
                      {item.content.split("\n")[0] || "Empty"}
                    </span>
                    {item.layer === "behind" ? (
                      <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                        behind
                      </span>
                    ) : null}
                  </button>
                  <IconAction
                    label="Move up"
                    disabled={index === texts.length - 1}
                    onClick={() => textActions.reorder(item.id, 1)}
                  >
                    <ArrowUp className="size-3" />
                  </IconAction>
                  <IconAction
                    label="Move down"
                    disabled={index === 0}
                    onClick={() => textActions.reorder(item.id, -1)}
                  >
                    <ArrowDown className="size-3" />
                  </IconAction>
                  <IconAction
                    label="Duplicate text"
                    onClick={() => textActions.duplicate(item.id)}
                  >
                    <Copy className="size-3" />
                  </IconAction>
                  <IconAction
                    label="Delete text"
                    destructive
                    onClick={() => {
                      textActions.remove(item.id);
                      if (selectedId === item.id)
                        useEditorStore.getState().selectText(null);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </IconAction>
                </div>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : (
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Captions follow the camera and can sit in front of the device or
          behind it, so they end up in the preview and the export too.
        </p>
      )}

      {selected ? <TextEditor item={selected} /> : null}
    </>
  );
}

function TextEditor({ item }: { item: TextItem }) {
  const animations = useProjectStore((s) => s.scene.animations);
  const set = (patch: Partial<TextItem>) => textActions.patch(item.id, patch);

  const appliedAnimations = new Set(
    animations
      .filter((a) => a.targetId === item.id)
      .map((a) => a.presetId.split(":")[0]),
  );

  const font = fontById(item.fontId);
  const weights = font.weights;

  return (
    <>
      <PanelSection title="Content">
        <textarea
          value={item.content}
          onChange={(e) => set({ content: e.target.value })}
          rows={3}
          placeholder="Type a caption…"
          className="w-full resize-y rounded-lg border border-white/[0.08] bg-black/30 p-2 text-xs outline-none focus-visible:border-white/25"
        />
      </PanelSection>

      <PanelSection title="Style presets">
        <div className="grid grid-cols-3 gap-2">
          {TEXT_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => textActions.applyStyle(item.id, preset.value)}
              style={{ fontFamily: fontById(preset.value.fontId ?? "system").family }}
              className="truncate rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Font">
        <div className="grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() =>
                set({
                  fontId: f.id,
                  // Not every family ships every weight; snap to the nearest.
                  weight: nearestWeight(item.weight, f.weights),
                })
              }
              style={{ fontFamily: f.family }}
              className={cn(
                "truncate rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                item.fontId === f.id
                  ? "border-white/20 bg-white/10 text-foreground"
                  : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {weights.map((w) => (
            <button
              key={w}
              onClick={() => set({ weight: w as TextWeight })}
              className={cn(
                "flex-1 rounded-lg border py-1 text-[11px] transition-colors",
                item.weight === w
                  ? "border-white/20 bg-white/10"
                  : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(["left", "center", "right"] as TextAlign[]).map((align) => {
            const Icon = ALIGN_ICONS[align];
            return (
              <button
                key={align}
                aria-label={`Align ${align}`}
                onClick={() => set({ align })}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-lg border transition-colors",
                  item.align === align
                    ? "border-white/20 bg-white/10"
                    : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            );
          })}
        </div>

        <NumberField
          label="Size"
          value={item.size}
          min={12}
          max={400}
          step={1}
          onChange={(size) => set({ size })}
        />
        <NumberField
          label="Letter spacing"
          value={item.letterSpacing}
          min={-20}
          max={40}
          step={0.5}
          onChange={(letterSpacing) => set({ letterSpacing })}
        />
        <NumberField
          label="Line height"
          value={item.lineHeight}
          min={0.8}
          max={2.5}
          step={0.05}
          onChange={(lineHeight) => set({ lineHeight })}
        />
      </PanelSection>

      <PanelSection title="Animation">
        <div className="grid grid-cols-2 gap-2">
          {TEXT_ANIMATION_PRESETS.map((preset) => {
            const active = appliedAnimations.has(preset.id);
            return (
              <button
                key={preset.id}
                onClick={() =>
                  active
                    ? textActions.removeAnimation(item.id, preset.id)
                    : textActions.applyAnimation(item.id, preset.id)
                }
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                  active
                    ? "border-white/20 bg-white/10 text-foreground"
                    : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Text clips appear on the Text track — tune their timing there or in
          the Animation panel.
        </p>
      </PanelSection>

      <PanelSection title="Colour">
        <div className="flex items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              aria-label={`Colour ${c}`}
              onClick={() => set({ color: c })}
              style={{ background: c }}
              className={cn(
                "size-7 rounded-lg ring-1 transition-transform hover:scale-110",
                item.color.toLowerCase() === c ? "ring-white/70" : "ring-white/15",
              )}
            />
          ))}
          <input
            type="color"
            aria-label="Custom colour"
            value={item.color}
            onChange={(e) => set({ color: e.target.value })}
            className="size-7 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
          />
        </div>
        <NumberField
          label="Opacity"
          value={item.opacity}
          min={0}
          max={1}
          step={0.01}
          displayScale={100}
          suffix="%"
          onChange={(opacity) => set({ opacity })}
        />
      </PanelSection>

      <PanelSection title="Placement">
        <div className="grid grid-cols-2 gap-2">
          {(["front", "behind"] as const).map((layer) => (
            <button
              key={layer}
              onClick={() => textActions.setLayer(item.id, layer)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] capitalize transition-colors",
                item.layer === layer
                  ? "border-white/20 bg-white/10 text-foreground"
                  : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground",
              )}
            >
              <Layers className="size-3" />
              {layer === "front" ? "In front" : "Behind"}
            </button>
          ))}
        </div>

        <NumberField
          label="Position X"
          value={item.position.x}
          min={-1600}
          max={1600}
          step={1}
          onChange={(x) => set({ position: { ...item.position, x } })}
        />
        <NumberField
          label="Position Y"
          value={item.position.y}
          min={-1600}
          max={1600}
          step={1}
          onChange={(y) => set({ position: { ...item.position, y } })}
        />
        <NumberField
          label="Rotation"
          value={item.rotation}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(rotation) => set({ rotation })}
        />
        <Label className="block pt-1 text-[11px] font-normal text-muted-foreground">
          Drag the caption on canvas, or its corner anchors to resize.
        </Label>
      </PanelSection>
    </>
  );
}

function IconAction({
  label,
  onClick,
  children,
  disabled,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn(
        "size-6 shrink-0 rounded-md text-muted-foreground",
        destructive ? "hover:text-destructive" : "hover:text-foreground",
      )}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function nearestWeight(weight: number, available: number[]): TextWeight {
  return available.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  ) as TextWeight;
}

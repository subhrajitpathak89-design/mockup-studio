"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import { imageFromDataTransfer, readImageFile } from "@/lib/canvas/imageCache";
import { TEXT_ANIMATION_PRESETS } from "@/lib/animation/textPresets";
import { overlayActions } from "@/lib/project/actions";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { BlendMode } from "@/types";
import { cn } from "@/lib/utils";

const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "soft-light", label: "Soft light" },
  { id: "luminosity", label: "Luminosity" },
];

export function OverlayPanel() {
  const overlays = useProjectStore((s) => s.scene.overlays);
  const canvasWidth = useProjectStore((s) => s.project.width);
  const animations = useProjectStore((s) => s.scene.animations);
  const selectedId = useEditorStore((s) => s.selectedOverlayId);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = overlays.find((o) => o.id === selectedId) ?? null;
  const set = (patch: Parameters<typeof overlayActions.patch>[1]) =>
    item && overlayActions.patch(item.id, patch);

  const accept = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, width, height } = await readImageFile(file);
      const id = overlayActions.add(
        dataUrl,
        width,
        height,
        file.name.replace(/\.[^.]+$/, ""),
        canvasWidth,
      );
      useEditorStore.getState().selectOverlay(id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file");
    }
  };

  const appliedPresets = item
    ? TEXT_ANIMATION_PRESETS.filter((preset) =>
        animations.some((a) => a.presetId === `${preset.id}:${item.id}`),
      ).map((p) => p.id)
    : [];

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void accept(imageFromDataTransfer(e.dataTransfer));
        }}
        className={cn(
          "rounded-xl border border-dashed p-5 text-center transition-colors",
          dragging
            ? "border-sky-400/60 bg-sky-400/10"
            : "border-white/15 bg-white/[0.02]",
        )}
      >
        <ImagePlus className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-2 text-xs font-medium">Drop a logo or badge</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sits on the scene, not inside the device
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 rounded-lg"
          onClick={() => input.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void accept(e.target.files?.[0])}
        />
      </div>

      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}

      {overlays.length > 0 ? (
        <PanelSection title="Overlays">
          <div className="space-y-1">
            {overlays.map((o) => (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                  o.id === selectedId
                    ? "border-sky-400/50 bg-sky-400/[0.08]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/15",
                )}
              >
                <button
                  onClick={() => useEditorStore.getState().selectOverlay(o.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {/* A data URL already in memory; next/image would only add a
                      proxy hop. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={o.src}
                    alt=""
                    className="size-7 shrink-0 rounded object-contain"
                  />
                  <span className="truncate text-[11px]">{o.name}</span>
                </button>
                <button
                  aria-label={`Move ${o.name} up`}
                  onClick={() => overlayActions.reorder(o.id, 1)}
                  className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  aria-label={`Move ${o.name} down`}
                  onClick={() => overlayActions.reorder(o.id, -1)}
                  className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  <ArrowDown className="size-3" />
                </button>
                <button
                  aria-label={`Delete ${o.name}`}
                  onClick={() => {
                    overlayActions.remove(o.id);
                    if (selectedId === o.id)
                      useEditorStore.getState().selectOverlay(null);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-red-400"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </PanelSection>
      ) : null}

      {item ? (
        <>
          <PanelSection title="Transform">
            <NumberField
              label="Width"
              value={item.width}
              min={20}
              max={4000}
              step={10}
              onChange={(width) => set({ width })}
            />
            <NumberField
              label="Position X"
              value={item.position.x}
              min={-2000}
              max={2000}
              step={1}
              onChange={(x) => set({ position: { ...item.position, x } })}
            />
            <NumberField
              label="Position Y"
              value={item.position.y}
              min={-2000}
              max={2000}
              step={1}
              onChange={(y) => set({ position: { ...item.position, y } })}
            />
            <NumberField
              label="Scale"
              value={item.scale}
              min={0.1}
              max={4}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={(scale) => set({ scale })}
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

          <PanelSection title="Blending">
            <div className="grid grid-cols-2 gap-2">
              {BLEND_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => set({ blendMode: mode.id })}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                    (item.blendMode ?? "normal") === mode.id
                      ? "border-white/20 bg-white/10 text-foreground"
                      : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <NumberField
              label="Shadow"
              value={item.shadowBlur}
              min={0}
              max={80}
              step={1}
              onChange={(shadowBlur) => set({ shadowBlur })}
            />
          </PanelSection>

          <PanelSection title="Placement">
            <div className="grid grid-cols-2 gap-2">
              {(["front", "behind"] as const).map((layer) => (
                <Button
                  key={layer}
                  size="sm"
                  className="rounded-lg"
                  variant={item.layer === layer ? "default" : "outline"}
                  onClick={() => set({ layer })}
                >
                  <Layers className="size-3" />
                  {layer === "front" ? "In front" : "Behind"}
                </Button>
              ))}
            </div>
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              Behind puts the overlay under the device, so the mockup occludes
              it.
            </p>
          </PanelSection>

          <PanelSection title="Animation">
            <div className="grid grid-cols-2 gap-2">
              {TEXT_ANIMATION_PRESETS.map((preset) => {
                const on = appliedPresets.includes(preset.id);
                return (
                  <Button
                    key={preset.id}
                    size="sm"
                    className="rounded-lg"
                    variant={on ? "default" : "outline"}
                    onClick={() =>
                      on
                        ? overlayActions.removeAnimation(item.id, preset.id)
                        : overlayActions.applyAnimation(item.id, preset.id)
                    }
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              The caption presets, applied to an image — an overlay animates the
              same four properties a caption does.
            </p>
          </PanelSection>
        </>
      ) : overlays.length > 0 ? (
        <p className="px-1 text-center text-[11px] text-muted-foreground">
          Pick an overlay above to edit it.
        </p>
      ) : null}
    </>
  );
}

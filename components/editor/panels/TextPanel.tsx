"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import { textActions } from "@/lib/project/actions";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { TextAlign, TextItem, TextWeight } from "@/types";
import { cn } from "@/lib/utils";

const WEIGHTS: TextWeight[] = [400, 500, 600, 700, 800];
const ALIGN_ICONS: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

const SWATCHES = [
  "#ffffff",
  "#0f172a",
  "#38bdf8",
  "#f472b6",
  "#fbbf24",
  "#4ade80",
];

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
            {texts.map((item) => (
              <li key={item.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
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
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 shrink-0 rounded-md"
                    aria-label="Duplicate text"
                    onClick={() => textActions.duplicate(item.id)}
                  >
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                    aria-label="Delete text"
                    onClick={() => {
                      textActions.remove(item.id);
                      if (selectedId === item.id)
                        useEditorStore.getState().selectText(null);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : (
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Captions sit above the device and move with the camera, so they end up
          in the preview and the export too.
        </p>
      )}

      {selected ? <TextEditor item={selected} /> : null}
    </>
  );
}

function TextEditor({ item }: { item: TextItem }) {
  const set = (patch: Partial<TextItem>) => textActions.patch(item.id, patch);

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
        <p className="text-[11px] text-muted-foreground">
          Enter starts a new line.
        </p>
      </PanelSection>

      <PanelSection title="Type">
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

        <div className="flex gap-1">
          {WEIGHTS.map((w) => (
            <button
              key={w}
              onClick={() => set({ weight: w })}
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
          You can also drag the caption directly on the canvas.
        </Label>
      </PanelSection>
    </>
  );
}

"use client";

import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import { ANIMATION_PRESETS } from "@/lib/animation/presets";
import { EASING_OPTIONS } from "@/lib/animation/easing";
import { animationActions, screenActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import type { EasingName } from "@/types";
import { cn } from "@/lib/utils";

export function AnimationPanel() {
  const animations = useProjectStore((s) => s.scene.animations);
  const scroll = useProjectStore((s) => s.scene.screen.scroll);
  const hasScreenshot = useProjectStore((s) => !!s.scene.screen.source);

  const applied = Array.from(new Set(animations.map((a) => a.presetId)));

  return (
    <>
      <PanelSection
        title="Presets"
        action={
          applied.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => animationActions.clear()}
            >
              Clear all
            </Button>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {ANIMATION_PRESETS.map((preset) => {
            const active = applied.includes(preset.id);
            return (
              <button
                key={preset.id}
                title={preset.description}
                onClick={() =>
                  active
                    ? animationActions.removePreset(preset.id)
                    : animationActions.applyPreset(preset.id)
                }
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  active
                    ? "border-white/20 bg-white/10 text-foreground"
                    : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
                )}
              >
                <span className="font-medium">{preset.label}</span>
                {active ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </PanelSection>

      {applied.length > 0 ? (
        <div className="space-y-2">
          <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Applied animations
          </h3>
          <div className="space-y-3">
            {applied.map((presetId) => (
              <AppliedPreset key={presetId} presetId={presetId} />
            ))}
          </div>
        </div>
      ) : null}

      <PanelSection
        title="UI Scroll"
        action={
          <Switch
            id="ui-scroll"
            checked={scroll.enabled}
            disabled={!hasScreenshot}
            onCheckedChange={(enabled) => screenActions.setScroll({ enabled })}
          />
        }
      >
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Scrolls a tall screenshot inside the device while the device itself
          stays still.
        </p>

        {scroll.enabled ? (
          <div className="space-y-3">
            <NumberField
              label="Scroll amount"
              value={scroll.amount}
              min={0}
              max={1}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={(amount) => screenActions.setScroll({ amount })}
            />
            <NumberField
              label="Duration"
              value={scroll.duration}
              min={0.1}
              max={20}
              step={0.1}
              suffix="s"
              onChange={(duration) => screenActions.setScroll({ duration })}
            />
            <NumberField
              label="Delay"
              value={scroll.delay}
              min={0}
              max={10}
              step={0.1}
              suffix="s"
              onChange={(delay) => screenActions.setScroll({ delay })}
            />
            <EasingSelect
              value={scroll.easing}
              onChange={(easing) => screenActions.setScroll({ easing })}
            />
          </div>
        ) : null}
      </PanelSection>
    </>
  );
}

function AppliedPreset({ presetId }: { presetId: string }) {
  // Select the stable array and narrow it here — returning a fresh array from
  // the selector would give the store a new snapshot on every render.
  const animations = useProjectStore((s) => s.scene.animations);
  const clips = animations.filter((a) => a.presetId === presetId);
  if (clips.length === 0) return null;

  const lead = clips[0];

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{lead.label}</span>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={`Remove ${lead.label}`}
          onClick={() => animationActions.removePreset(presetId)}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <NumberField
        label="Duration"
        value={lead.duration}
        min={0.1}
        max={20}
        step={0.1}
        suffix="s"
        onChange={(duration) =>
          animationActions.patchPreset(presetId, { duration })
        }
      />
      <NumberField
        label="Delay"
        value={lead.delay}
        min={0}
        max={10}
        step={0.1}
        suffix="s"
        onChange={(delay) => animationActions.patchPreset(presetId, { delay })}
      />
      <EasingSelect
        value={lead.easing}
        onChange={(easing) => animationActions.patchPreset(presetId, { easing })}
      />

      <Separator />

      <p className="text-[11px] font-medium text-muted-foreground">Values</p>
      {clips.map((clip) => (
        <div key={clip.id} className="grid grid-cols-2 gap-2">
          <NumberField
            label={`${shortProperty(clip.property)} from`}
            value={clip.from}
            min={valueRange(clip.property)[0]}
            max={valueRange(clip.property)[1]}
            step={valueStep(clip.property)}
            onChange={(from) => animationActions.patchClip(clip.id, { from })}
          />
          <NumberField
            label="to"
            value={clip.to}
            min={valueRange(clip.property)[0]}
            max={valueRange(clip.property)[1]}
            step={valueStep(clip.property)}
            onChange={(to) => animationActions.patchClip(clip.id, { to })}
          />
        </div>
      ))}
    </div>
  );
}

function EasingSelect({
  value,
  onChange,
}: {
  value: EasingName;
  onChange: (value: EasingName) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">Easing</Label>
      <Select value={value} onValueChange={(v) => onChange(v as EasingName)}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EASING_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function shortProperty(property: string) {
  return property.replace("device.", "").replace("camera.", "cam ").replace(".", " ");
}

function valueRange(property: string): [number, number] {
  if (property.includes("opacity")) return [0, 1];
  if (property.includes("scale") || property.includes("zoom")) return [0.1, 3];
  if (property.includes("rotation")) return [-180, 180];
  return [-1200, 1200];
}

function valueStep(property: string) {
  return property.includes("opacity") ||
    property.includes("scale") ||
    property.includes("zoom")
    ? 0.01
    : 1;
}

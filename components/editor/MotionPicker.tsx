"use client";

import { Check } from "lucide-react";
import { PanelSection } from "@/components/editor/Surface";
import { ANIMATION_PRESETS } from "@/lib/animation/presets";
import { SIMPLE_MOTION_PRESETS } from "@/lib/config";
import { animationActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

/**
 * The whole motion surface when the timeline is hidden: pick one canned move
 * or none at all. One preset at a time on purpose — combining them is what the
 * timeline is for, and this is meant to be a single decision, not an editor.
 */
export function MotionPicker() {
  const animations = useProjectStore((s) => s.scene.animations);

  const active =
    animations.find((a) => SIMPLE_MOTION_PRESETS.includes(a.presetId as never))
      ?.presetId ?? null;

  const options = SIMPLE_MOTION_PRESETS.map((id) =>
    ANIMATION_PRESETS.find((p) => p.id === id),
  ).filter((p) => p !== undefined);

  const select = (id: string | null) => {
    animationActions.clear();
    if (id) animationActions.applyPreset(id);
  };

  return (
    <PanelSection title="Motion">
      <div className="grid grid-cols-2 gap-2">
        <Option label="None" active={active === null} onClick={() => select(null)} />
        {options.map((preset) => (
          <Option
            key={preset.id}
            label={preset.label}
            title={preset.description}
            active={active === preset.id}
            onClick={() => select(preset.id)}
          />
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Adds gentle movement so a still screenshot is worth exporting as video.
        Leave it on None for a plain image.
      </p>
    </PanelSection>
  );
}

function Option({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
        active
          ? "border-white/20 bg-white/10 text-foreground"
          : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
      )}
    >
      <span className="font-medium">{label}</span>
      {active ? <Check className="size-3.5 shrink-0" /> : null}
    </button>
  );
}

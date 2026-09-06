"use client";

import {
  AppWindow,
  ImageIcon,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import { MotionPicker } from "@/components/editor/MotionPicker";
import { MOTION_UI } from "@/lib/config";
import { Switch } from "@/components/ui/switch";
import { DEVICE_LIST, DEVICE_SPECS, sourceAspect } from "@/lib/canvas/devices";
import { deviceActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import type { DeviceType } from "@/types";
import { cn } from "@/lib/utils";

/** Names the common shapes, and falls back to a plain ratio for the rest. */
function ratioLabel(aspect: number): string {
  const known: [number, string][] = [
    [16 / 9, "16:9"],
    [16 / 10, "16:10"],
    [4 / 3, "4:3"],
    [3 / 2, "3:2"],
    [21 / 9, "21:9"],
    [9 / 16, "9:16"],
    [1, "1:1"],
  ];
  const hit = known.find(([r]) => Math.abs(r - aspect) < 0.02);
  return hit ? hit[1] : `${aspect.toFixed(2)}:1`;
}

const ICONS: Record<DeviceType, typeof Smartphone> = {
  none: ImageIcon,
  iphone: Smartphone,
  android: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  macbook: Laptop,
  monitor: Monitor,
  browser: AppWindow,
};

export function DevicePanel() {
  const device = useProjectStore((s) => s.scene.device);
  const screen = useProjectStore((s) => s.scene.screen);
  const aspect = sourceAspect(screen);
  // Bitmap frames are one shape, so the toggle has nothing to act on.
  const fixedShape = !!DEVICE_SPECS[device.type]?.art;
  const frameless = device.type === "none";

  return (
    <>
      <PanelSection title="Device">
        <div className="grid grid-cols-2 gap-2">
          {DEVICE_LIST.map((spec) => {
            const Icon = ICONS[spec.type];
            const active = device.type === spec.type;
            return (
              <button
                key={spec.type}
                onClick={() => deviceActions.setType(spec.type)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs transition-colors",
                  active
                    ? "border-white/20 bg-white/10 text-foreground"
                    : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {spec.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">Fit frame to media</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {frameless
                ? "No frame to reshape — a bare screenshot already takes the shape of whatever you put in it."
                : fixedShape
                  ? "This frame is artwork, so its shape is fixed. Pick Laptop for a frame that reshapes."
                  : aspect
                  ? `Reshapes the frame to ${ratioLabel(aspect)} instead of cropping the edges off.`
                  : "Reshapes the frame around whatever you put in it, instead of cropping to fit."}
            </p>
          </div>
          <Switch
            checked={(device.fitToSource || frameless) && !fixedShape}
            disabled={fixedShape || frameless}
            onCheckedChange={(v) => deviceActions.setFitToSource(v)}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Transform"
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => deviceActions.reset()}
          >
            <RotateCcw className="size-3" /> Reset
          </Button>
        }
      >
        <NumberField
          label="Position X"
          value={device.position.x}
          min={-1200}
          max={1200}
          step={1}
          onChange={(v) => deviceActions.setPosition(v, device.position.y)}
        />
        <NumberField
          label="Position Y"
          value={device.position.y}
          min={-1200}
          max={1200}
          step={1}
          onChange={(v) => deviceActions.setPosition(device.position.x, v)}
        />
        <NumberField
          label="Scale"
          value={device.scale}
          min={0.1}
          max={3}
          step={0.01}
          displayScale={100}
          suffix="%"
          onChange={deviceActions.setScale}
        />
      </PanelSection>

      <PanelSection title="Rotation">
        {(["x", "y", "z"] as const).map((axis) => (
          <NumberField
            key={axis}
            label={`Rotate ${axis.toUpperCase()}`}
            value={device.rotation[axis]}
            min={-180}
            max={180}
            step={1}
            suffix="°"
            onChange={(v) => deviceActions.setRotation(axis, v)}
          />
        ))}
      </PanelSection>

      {/* With the timeline hidden, this is the only way to add movement. */}
      {MOTION_UI ? null : <MotionPicker />}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        On the canvas: drag to move, <kbd>Alt</kbd>-drag to scale,{" "}
        <kbd>Shift</kbd>-drag to spin.
      </p>
    </>
  );
}

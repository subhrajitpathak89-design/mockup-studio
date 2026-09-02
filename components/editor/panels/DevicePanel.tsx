"use client";

import { Laptop, Monitor, Smartphone, Tablet, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NumberField } from "@/components/editor/NumberField";
import { DEVICE_LIST } from "@/lib/canvas/devices";
import { deviceActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import type { DeviceType } from "@/types";
import { cn } from "@/lib/utils";

const ICONS: Record<DeviceType, typeof Smartphone> = {
  iphone: Smartphone,
  android: Tablet,
  laptop: Laptop,
  browser: Monitor,
};

export function DevicePanel() {
  const device = useProjectStore((s) => s.scene.device);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {DEVICE_LIST.map((spec) => {
          const Icon = ICONS[spec.type];
          const active = device.type === spec.type;
          return (
            <button
              key={spec.type}
              onClick={() => deviceActions.setType(spec.type)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-xs transition-colors",
                active
                  ? "border-primary bg-accent"
                  : "border-border hover:border-foreground/30",
              )}
            >
              <Icon className="size-4" />
              {spec.label}
            </button>
          );
        })}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transform
        </p>
        <Button size="sm" variant="ghost" onClick={() => deviceActions.reset()}>
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </div>

      <div className="space-y-3">
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
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rotation
        </p>
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
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        On the canvas: drag to move, <kbd>Alt</kbd>-drag to scale,{" "}
        <kbd>Shift</kbd>-drag to spin.
      </p>
    </div>
  );
}

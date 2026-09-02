"use client";

import { Laptop, Monitor, Smartphone, Tablet, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
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

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        On the canvas: drag to move, <kbd>Alt</kbd>-drag to scale,{" "}
        <kbd>Shift</kbd>-drag to spin.
      </p>
    </>
  );
}

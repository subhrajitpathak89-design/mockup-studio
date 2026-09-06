"use client";

import { ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import { MotionPicker } from "@/components/editor/MotionPicker";
import { MOTION_UI } from "@/lib/config";
import { DEVICE_GROUPS, DEVICE_SPECS } from "@/lib/canvas/devices";
import { deviceActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export function DevicePanel() {
  const device = useProjectStore((s) => s.scene.device);
  const spec = DEVICE_SPECS[device.type];
  // A photograph is one shot at one angle: nothing in it can be moved, turned
  // or relit, so the controls that would pretend otherwise are not shown.
  const isPhoto = !!spec?.photo;

  return (
    <>
      {DEVICE_GROUPS.filter((g) => g.specs.length > 0).map(({ group, specs }) => (
        <PanelSection key={group} title={group}>
          <div className="grid grid-cols-2 gap-2">
            {specs.map((option) => {
              const active = device.type === option.type;
              return (
                <button
                  key={option.type}
                  onClick={() => deviceActions.setType(option.type)}
                  className={cn(
                    "group overflow-hidden rounded-xl border text-left transition-colors",
                    active
                      ? "border-white/25 bg-white/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-black/30">
                    {option.photo || option.art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={option.photo?.src ?? option.art!.src}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "px-2 py-1.5 text-[11px]",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </div>
                </button>
              );
            })}
          </div>
        </PanelSection>
      ))}

      {isPhoto ? (
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          This frame is a photograph, so it brings its own background and
          lighting. Your screen is fitted into the glass — adjust how it sits
          under Upload.
        </p>
      ) : (
        <>
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
        </>
      )}

      {/* With the timeline hidden, this is the only way to add movement. */}
      {MOTION_UI ? null : <MotionPicker />}

      {isPhoto ? null : (
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          On the canvas: drag to move, <kbd>Alt</kbd>-drag to scale,{" "}
          <kbd>Shift</kbd>-drag to spin.
        </p>
      )}
    </>
  );
}

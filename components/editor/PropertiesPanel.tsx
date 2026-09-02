"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "@/store/editorStore";
import { UploadPanel } from "./panels/UploadPanel";
import { DevicePanel } from "./panels/DevicePanel";
import { BackgroundPanel } from "./panels/BackgroundPanel";
import { AnimationPanel } from "./panels/AnimationPanel";

const TITLES: Record<string, string> = {
  upload: "Upload",
  device: "Device",
  background: "Scene",
  animation: "Animation",
};

export function PropertiesPanel() {
  const tool = useEditorStore((s) => s.tool);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-card">
      <div className="flex h-11 shrink-0 items-center border-b px-4">
        <h2 className="text-sm font-semibold">{TITLES[tool]}</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {tool === "upload" ? <UploadPanel /> : null}
          {tool === "device" ? <DevicePanel /> : null}
          {tool === "background" ? <BackgroundPanel /> : null}
          {tool === "animation" ? <AnimationPanel /> : null}
        </div>
      </ScrollArea>
    </aside>
  );
}

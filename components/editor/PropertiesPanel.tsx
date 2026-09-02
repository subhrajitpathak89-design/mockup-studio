"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const open = useEditorStore((s) => s.panelOpen);

  if (!open) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-l bg-card py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Show properties"
              onClick={() => useEditorStore.getState().togglePanel()}
            >
              <PanelRightOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show properties</TooltipContent>
        </Tooltip>
        <span className="mt-3 text-[11px] font-medium tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          {TITLES[tool]}
        </span>
      </aside>
    );
  }

  return (
    // min-h-0 is what keeps the scroll area inside the column: without it a
    // flex child grows to its content and spills past the viewport.
    <aside className="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{TITLES[tool]}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Hide properties"
              onClick={() => useEditorStore.getState().togglePanel()}
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hide properties</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 pb-8">
          {tool === "upload" ? <UploadPanel /> : null}
          {tool === "device" ? <DevicePanel /> : null}
          {tool === "background" ? <BackgroundPanel /> : null}
          {tool === "animation" ? <AnimationPanel /> : null}
        </div>
      </ScrollArea>
    </aside>
  );
}

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
import { Surface } from "./Surface";
import { UploadPanel } from "./panels/UploadPanel";
import { DevicePanel } from "./panels/DevicePanel";
import { BackgroundPanel } from "./panels/BackgroundPanel";
import { AnimationPanel } from "./panels/AnimationPanel";
import { TextPanel } from "./panels/TextPanel";

const TITLES: Record<string, string> = {
  upload: "Upload",
  device: "Device",
  background: "Scene",
  text: "Text",
  animation: "Animation",
};

export function PropertiesPanel() {
  const tool = useEditorStore((s) => s.tool);
  const open = useEditorStore((s) => s.panelOpen);

  if (!open) {
    return (
      <Surface className="flex w-11 shrink-0 flex-col items-center p-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-xl"
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
      </Surface>
    );
  }

  return (
    // min-h-0 is what keeps the scroll area inside the column: without it a
    // flex child grows to its content and spills past the viewport.
    <Surface className="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <h2 className="text-sm font-semibold">{TITLES[tool]}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-lg"
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
        <div className="space-y-4 p-3 pb-8">
          {tool === "upload" ? <UploadPanel /> : null}
          {tool === "device" ? <DevicePanel /> : null}
          {tool === "background" ? <BackgroundPanel /> : null}
          {tool === "text" ? <TextPanel /> : null}
          {tool === "animation" ? <AnimationPanel /> : null}
        </div>
      </ScrollArea>
    </Surface>
  );
}

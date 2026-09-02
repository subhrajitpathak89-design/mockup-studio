"use client";

import { Image as ImageIcon, Palette, Smartphone, Type, Wand2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore, type ToolId } from "@/store/editorStore";
import { cn } from "@/lib/utils";
import { Surface } from "./Surface";

const TOOLS: { id: ToolId; label: string; icon: typeof ImageIcon }[] = [
  { id: "upload", label: "Upload", icon: ImageIcon },
  { id: "device", label: "Device", icon: Smartphone },
  { id: "background", label: "Background", icon: Palette },
  { id: "text", label: "Text", icon: Type },
  { id: "animation", label: "Animation", icon: Wand2 },
];

export function ToolRail() {
  const tool = useEditorStore((s) => s.tool);

  return (
    <Surface className="flex w-[68px] shrink-0 flex-col items-center gap-1 p-2">
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                useEditorStore.getState().setTool(id);
                if (id === "device") useEditorStore.getState().select("device");
              }}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] transition-colors",
                tool === id
                  ? "bg-white/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </Surface>
  );
}

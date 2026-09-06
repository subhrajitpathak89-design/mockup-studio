"use client";

import {
  Image as ImageIcon,
  Sticker,
  Palette,
  Smartphone,
  Type,
  Wand2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore, type ToolId } from "@/store/editorStore";
import { cn } from "@/lib/utils";
import { Surface } from "./Surface";
import { MOTION_UI } from "@/lib/config";

const ALL_TOOLS: { id: ToolId; label: string; icon: typeof ImageIcon }[] = [
  { id: "upload", label: "Upload", icon: ImageIcon },
  { id: "device", label: "Device", icon: Smartphone },
  { id: "overlay", label: "Overlay", icon: Sticker },
  { id: "background", label: "Scene", icon: Palette },
  { id: "text", label: "Text", icon: Type },
  { id: "animation", label: "Animation", icon: Wand2 },
];

const TOOLS = ALL_TOOLS.filter((t) => MOTION_UI || t.id !== "animation");

export function ToolRail() {
  const tool = useEditorStore((s) => s.tool);

  return (
    <Surface className="flex w-[72px] min-h-0 shrink-0 flex-col items-center gap-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                useEditorStore.getState().setTool(id);
                if (id === "device") useEditorStore.getState().select("device");
              }}
              className={cn(
                "flex w-full shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] leading-none whitespace-nowrap transition-colors",
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

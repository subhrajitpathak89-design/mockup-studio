"use client";

import { Image as ImageIcon, Palette, Smartphone, Wand2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore, type ToolId } from "@/store/editorStore";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolId; label: string; icon: typeof ImageIcon }[] = [
  { id: "upload", label: "Upload", icon: ImageIcon },
  { id: "device", label: "Device", icon: Smartphone },
  { id: "background", label: "Background", icon: Palette },
  { id: "animation", label: "Animation", icon: Wand2 },
];

export function ToolRail() {
  const tool = useEditorStore((s) => s.tool);

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-card py-3">
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                useEditorStore.getState().setTool(id);
                if (id === "device") useEditorStore.getState().select("device");
              }}
              className={cn(
                "flex w-14 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors",
                tool === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
}

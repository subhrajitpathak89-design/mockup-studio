"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Clapperboard,
  Download,
  Grid3x3,
  Maximize,
  Minus,
  Play,
  Plus,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

export function Toolbar() {
  const name = useProjectStore((s) => s.project.name);
  const dirty = useProjectStore((s) => s.dirty);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const zoom = useEditorStore((s) => s.zoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await useProjectStore.getState().save();
    setSaving(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3">
      <Link href="/" className="flex items-center gap-2 text-sm font-medium">
        <Clapperboard className="size-5" />
        <span className="hidden sm:inline">Mockup Motion Studio</span>
      </Link>

      <Separator orientation="vertical" className="h-6" />

      <Input
        value={name}
        onChange={(e) => useProjectStore.getState().setProject({ name: e.target.value })}
        className="h-8 w-52 border-transparent bg-transparent text-sm font-medium hover:border-border focus-visible:border-border"
        aria-label="Project name"
      />

      <div className="flex items-center gap-1">
        <IconButton
          label="Undo"
          disabled={!canUndo}
          onClick={() => useProjectStore.getState().undo()}
        >
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton
          label="Redo"
          disabled={!canRedo}
          onClick={() => useProjectStore.getState().redo()}
        >
          <Redo2 className="size-4" />
        </IconButton>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <IconButton label="Zoom out" onClick={() => useEditorStore.getState().zoomBy(1 / 1.2)}>
          <Minus className="size-4" />
        </IconButton>
        <span className="w-11 text-center font-mono text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton label="Zoom in" onClick={() => useEditorStore.getState().zoomBy(1.2)}>
          <Plus className="size-4" />
        </IconButton>
        <IconButton label="Fit to screen" onClick={() => useEditorStore.getState().resetView()}>
          <Maximize className="size-4" />
        </IconButton>
        <IconButton
          label="Toggle grid"
          active={showGrid}
          onClick={() => useEditorStore.getState().toggleGrid()}
        >
          <Grid3x3 className="size-4" />
        </IconButton>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={save} disabled={saving}>
          <Save className="size-4" />
          {dirty ? "Save" : "Saved"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => useEditorStore.getState().setPreviewOpen(true)}
        >
          <Play className="size-4" /> Preview
        </Button>
        <Button size="sm" onClick={() => useEditorStore.getState().setExportOpen(true)}>
          <Download className="size-4" /> Export
        </Button>
      </div>
    </header>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={active ? "secondary" : "ghost"}
          className="size-8"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

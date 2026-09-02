"use client";

import { useEditorRuntime, useRestoreProject } from "@/hooks/useEditorRuntime";
import { Toolbar } from "./Toolbar";
import { ToolRail } from "./ToolRail";
import { SceneCanvas } from "./SceneCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { Timeline } from "./Timeline";
import { PreviewOverlay } from "./PreviewOverlay";
import { ExportDialog } from "./ExportDialog";

export function EditorShell() {
  useRestoreProject();
  useEditorRuntime();

  return (
    <div className="relative h-dvh overflow-hidden bg-zinc-950">
      {/* A soft wash behind the panels so the elevation has something to sit on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(56,189,248,0.10),transparent_60%),radial-gradient(60%_50%_at_100%_100%,rgba(168,85,247,0.08),transparent_60%)]"
      />

      <div className="relative flex h-full flex-col gap-2.5 p-2.5">
        <Toolbar />
        <div className="flex min-h-0 flex-1 gap-2.5">
          <ToolRail />
          <SceneCanvas />
          <PropertiesPanel />
        </div>
        <Timeline />
      </div>

      <PreviewOverlay />
      <ExportDialog />
    </div>
  );
}

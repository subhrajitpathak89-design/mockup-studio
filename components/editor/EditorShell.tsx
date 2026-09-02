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
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <SceneCanvas />
        <PropertiesPanel />
      </div>
      <Timeline />
      <PreviewOverlay />
      <ExportDialog />
    </div>
  );
}

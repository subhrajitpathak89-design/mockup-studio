"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { downloadBlob, safeFilename, type Resolution } from "@/lib/export/renderer";
import { exportPng } from "@/lib/export/image";
import { exportVideo, supportsFormat, type VideoFormat } from "@/lib/export/video";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

type Format = "png" | VideoFormat;

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "png", label: "PNG", hint: "Still frame" },
  { id: "webm", label: "WebM", hint: "Best quality" },
  { id: "mp4", label: "MP4", hint: "Where supported" },
  { id: "gif", label: "GIF", hint: "Small, 256 colours" },
];

export function ExportDialog() {
  const open = useEditorStore((s) => s.exportOpen);

  /**
   * Video is only worth offering when something actually moves. A still image
   * with no motion would export as a frozen frame stretched over the whole
   * duration — a file nobody wants and the tool should not hand out.
   */
  const isRecording = useProjectStore((s) => s.scene.screen.kind === "video");
  const hasMotion = useProjectStore((s) => s.scene.animations.length > 0);
  const moves = isRecording || hasMotion;

  const [format, setFormat] = useState<Format>("webm");
  // Derived rather than synced: a still scene can only mean PNG, and deriving
  // it keeps the highlighted chip and the export honest with each other.
  const activeFormat: Format = moves ? format : "png";
  const [resolution, setResolution] = useState<Resolution>(1080);
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = progress !== null;

  const run = async () => {
    const { scene, project } = useProjectStore.getState();
    setError(null);
    setNote(null);
    setProgress(0);

    try {
      const base = safeFilename(project.name);
      if (activeFormat === "png") {
        const time = useAnimationStore.getState().time;
        const blob = await exportPng(scene, project, time, resolution);
        downloadBlob(blob, `${base}.png`);
      } else {
        useAnimationStore.getState().pause();
        const result = await exportVideo(scene, project, {
          format: activeFormat as VideoFormat,
          resolution,
          fps,
          onProgress: setProgress,
        });
        downloadBlob(result.blob, `${base}.${result.extension}`);

        const notes: string[] = [];
        if (result.fellBackToWebm) {
          notes.push(
            "MP4 recording is not available in this browser — exported WebM instead.",
          );
        }
        if (result.slow) {
          notes.push(
            "Rendering could not keep up with real time, so the video may be mistimed. Keep this tab in the foreground, or try 720p or a lower frame rate.",
          );
        }
        setNote(notes.join(" ") || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !busy && useEditorStore.getState().setExportOpen(v)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Video is recorded in real time, so a 6 second animation takes about
            6 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-4 gap-2">
              {FORMATS.map((f) => {
                const isVideo = f.id !== "png";
                const unsupported = isVideo && !supportsFormat(f.id as VideoFormat);
                const unavailable = isVideo && !moves;
                return (
                  <button
                    key={f.id}
                    disabled={busy || unavailable}
                    title={
                      unavailable
                        ? "Add a recording or a motion preset to export video"
                        : undefined
                    }
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-center transition-colors disabled:opacity-50",
                      activeFormat === f.id
                        ? "border-primary bg-accent"
                        : "border-border hover:border-foreground/30",
                    )}
                  >
                    <div className="text-xs font-medium">{f.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {unavailable
                        ? "needs motion"
                        : unsupported
                          ? "falls back"
                          : f.hint}
                    </div>
                  </button>
                );
              })}
            </div>
            {!moves ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Nothing in this scene moves, so video would come out as a frozen
                frame. Add a motion preset in the Device panel, or use a screen
                recording, to export video.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Resolution</Label>
            <div className="grid grid-cols-2 gap-2">
              {([720, 1080] as Resolution[]).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  disabled={busy}
                  variant={resolution === r ? "default" : "outline"}
                  onClick={() => setResolution(r)}
                >
                  {r}p
                </Button>
              ))}
            </div>
          </div>

          {activeFormat !== "png" ? (
            <div className="space-y-2">
              <Label>Frame rate</Label>
              <div className="grid grid-cols-3 gap-2">
                {([24, 30, 60] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    disabled={busy || activeFormat === "gif"}
                    variant={fps === f ? "default" : "outline"}
                    onClick={() => setFps(f)}
                  >
                    {f} fps
                  </Button>
                ))}
              </div>
              {activeFormat === "gif" ? (
                <p className="text-[11px] text-muted-foreground">
                  GIF exports at 15 fps and up to 640px wide to keep the file
                  usable.
                </p>
              ) : null}
            </div>
          ) : null}

          {busy ? (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Rendering… {Math.round((progress ?? 0) * 100)}%
              </p>
            </div>
          ) : null}

          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

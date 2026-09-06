"use client";

import { useEffect, useRef, useState } from "react";
import { Film, ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/editor/ColorPicker";
import { NumberField } from "@/components/editor/NumberField";
import { PanelSection } from "@/components/editor/Surface";
import {
  fileFromDataTransfer,
  imageFromDataTransfer,
  readImageFile,
} from "@/lib/canvas/imageCache";
import { isAcceptedVideo, readVideoFile } from "@/lib/canvas/videoCache";
import { commitRecording } from "@/lib/record/handoff";
import { Switch } from "@/components/ui/switch";
import { screenActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";
import type { ScreenState } from "@/types";

/** `trimOut` of 0 means "to the end", so it needs resolving before display. */
function trimEnd(screen: ScreenState) {
  return screen.trimOut > 0 ? screen.trimOut : screen.mediaDuration;
}


export function UploadPanel() {
  const screen = useProjectStore((s) => s.scene.screen);
  const isVideo = screen.kind === "video";
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const accept = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    try {
      if (isAcceptedVideo(file)) {
        // An uploaded clip is a recording that happened somewhere else, so it
        // takes the same path: blob to storage, frame and duration sized to it.
        const video = await readVideoFile(file);
        await commitRecording(
          {
            blob: file,
            url: video.url,
            width: video.width,
            height: video.height,
            duration: video.duration,
            mimeType: file.type,
            hasAudio: true,
          },
          { trimIn: 0, trimOut: video.duration },
        );
        return;
      }
      const { dataUrl, width, height } = await readImageFile(file);
      screenActions.setImage(dataUrl, width, height);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file");
    }
  };

  // Paste support — designers copy screenshots far more often than they save
  // them, so this is the fastest path into the editor.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromDataTransfer(e.clipboardData);
      if (file) {
        e.preventDefault();
        void accept(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void accept(fileFromDataTransfer(e.dataTransfer));
        }}
        className={cn(
          "rounded-xl border border-dashed p-6 text-center transition-colors",
          dragging
            ? "border-sky-400/60 bg-sky-400/10"
            : "border-white/15 bg-white/[0.02]",
        )}
      >
        <ImageUp className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a screenshot or recording</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PNG, JPG, WebP, MP4, WebM or MOV — or paste from the clipboard
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 rounded-lg"
          onClick={() => input.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => void accept(e.target.files?.[0])}
        />
      </div>

      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}

      {screen.source ? (
        <>
          {isVideo ? (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                  <Film className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">Recording</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {screen.naturalWidth} × {screen.naturalHeight} ·{" "}
                    {Math.max(0, trimEnd(screen) - screen.trimIn).toFixed(1)}s
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-lg"
                  aria-label="Remove recording"
                  onClick={() => screenActions.clear()}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <PanelSection title="Trim">
                {/* Stored, never applied — the source is untouched, so
                    widening this back costs nothing. */}
                <NumberField
                  label="In"
                  value={screen.trimIn}
                  min={0}
                  max={Math.max(0, trimEnd(screen) - 0.3)}
                  step={0.1}
                  suffix="s"
                  onChange={(v) => screenActions.setTrim(v, screen.trimOut)}
                />
                <NumberField
                  label="Out"
                  value={trimEnd(screen)}
                  min={Math.min(screen.mediaDuration, screen.trimIn + 0.3)}
                  max={screen.mediaDuration}
                  step={0.1}
                  suffix="s"
                  onChange={(v) => screenActions.setTrim(screen.trimIn, v)}
                />
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="text-xs text-muted-foreground">Mute</span>
                  <Switch
                    checked={screen.muted}
                    onCheckedChange={(v) => screenActions.setMuted(v)}
                  />
                </div>
                <p className="px-1 text-[11px] text-muted-foreground">
                  Audio reaches MP4 and WebM exports only.
                </p>
              </PanelSection>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.source}
                alt="Uploaded screenshot"
                className="h-12 w-12 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">Screenshot</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {screen.naturalWidth} × {screen.naturalHeight}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-lg"
                aria-label="Remove screenshot"
                onClick={() => screenActions.clear()}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}


          <PanelSection title="Screen">
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="rounded-lg"
                variant={screen.fit === "contain" ? "default" : "outline"}
                onClick={() => screenActions.setFit("contain")}
              >
                Fit
              </Button>
              <Button
                size="sm"
                className="rounded-lg"
                variant={screen.fit === "cover" ? "default" : "outline"}
                onClick={() => screenActions.setFit("cover")}
              >
                Fill
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => screenActions.reset()}
              >
                Reset
              </Button>
            </div>

            <NumberField
              label="Scale"
              value={screen.scale}
              min={0.2}
              max={3}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={screenActions.setScale}
            />
            <NumberField
              label="Position X"
              value={screen.position.x}
              min={-1}
              max={1}
              step={0.01}
              displayScale={100}
              onChange={(v) => screenActions.setPosition(v, screen.position.y)}
            />
            <NumberField
              label="Position Y"
              value={screen.position.y}
              min={-1}
              max={1}
              step={0.01}
              displayScale={100}
              onChange={(v) => screenActions.setPosition(screen.position.x, v)}
            />
            <NumberField
              label="Corner radius"
              value={screen.cornerRadius}
              min={0}
              max={80}
              step={1}
              onChange={screenActions.setCornerRadius}
            />
            <NumberField
              label="Border"
              value={screen.borderWidth}
              min={0}
              max={24}
              step={1}
              onChange={(v) => screenActions.setBorder(v)}
            />
            {screen.borderWidth > 0 ? (
              <ColorPicker
                label="Border colour"
                value={screen.borderColor}
                onChange={(c) => screenActions.setBorder(screen.borderWidth, c)}
                swatches={[
                  "rgba(255,255,255,0.16)",
                  "rgba(255,255,255,0.4)",
                  "#ffffff",
                  "rgba(0,0,0,0.35)",
                  "#0b0b0d",
                ]}
              />
            ) : null}
            <NumberField
              label="Opacity"
              value={screen.opacity}
              min={0}
              max={1}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={screenActions.setOpacity}
            />
          </PanelSection>
        </>
      ) : null}
    </>
  );
}

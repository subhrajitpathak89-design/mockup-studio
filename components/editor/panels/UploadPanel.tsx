"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NumberField } from "@/components/editor/NumberField";
import {
  imageFromDataTransfer,
  readImageFile,
} from "@/lib/canvas/imageCache";
import { screenActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export function UploadPanel() {
  const screen = useProjectStore((s) => s.scene.screen);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const accept = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, width, height } = await readImageFile(file);
      screenActions.setImage(dataUrl, width, height);
      setError(null);
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
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void accept(imageFromDataTransfer(e.dataTransfer));
        }}
        className={cn(
          "rounded-lg border border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border",
        )}
      >
        <ImageUp className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a screenshot</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PNG, JPG or WebP — or paste from the clipboard
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => input.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void accept(e.target.files?.[0])}
        />
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {screen.source ? (
        <>
          <div className="flex items-center gap-3 rounded-md border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screen.source}
              alt="Uploaded screenshot"
              className="h-12 w-12 rounded object-cover"
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
              aria-label="Remove screenshot"
              onClick={() => screenActions.clear()}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Screen
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant={screen.fit === "contain" ? "default" : "outline"}
                onClick={() => screenActions.setFit("contain")}
              >
                Fit
              </Button>
              <Button
                size="sm"
                variant={screen.fit === "cover" ? "default" : "outline"}
                onClick={() => screenActions.setFit("cover")}
              >
                Fill
              </Button>
              <Button size="sm" variant="outline" onClick={() => screenActions.reset()}>
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
              label="Opacity"
              value={screen.opacity}
              min={0}
              max={1}
              step={0.01}
              displayScale={100}
              suffix="%"
              onChange={screenActions.setOpacity}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

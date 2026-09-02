"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveScene } from "@/lib/animation/engine";
import { renderScene, TextureBuffer } from "@/lib/canvas/renderer";
import { getCachedImage } from "@/lib/canvas/imageCache";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

/**
 * Preview draws from exactly the same scene state as the editor — it is the
 * editor with the chrome removed, not a second rendering path.
 */
export function PreviewOverlay() {
  const open = useEditorStore((s) => s.previewOpen);
  const project = useProjectStore((s) => s.project);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!open) return;
    useAnimationStore.getState().restart();
    return () => useAnimationStore.getState().pause();
  }, [open]);

  useEffect(
    () => useAnimationStore.subscribe((s) => setPlaying(s.playing)),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const buffer = new TextureBuffer();
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const { scene, project: meta } = useProjectStore.getState();
      const scale = canvas.width / meta.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderScene(
        ctx,
        {
          scene,
          resolved: resolveScene(scene, useAnimationStore.getState().time),
          width: meta.width,
          height: meta.height,
          image: getCachedImage(scene.screen.source),
          quality: "draft",
        },
        buffer,
      );
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const w = Math.min(1600, project.width);
    canvas.width = w;
    canvas.height = Math.round((w / project.width) * project.height);
  }, [open, project.width, project.height]);

  if (!open) return null;

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/95 p-8"
    >
      <canvas
        ref={canvasRef}
        className="max-h-[80vh] max-w-full rounded-md shadow-2xl"
        style={{ aspectRatio: `${project.width} / ${project.height}` }}
      />

      <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 backdrop-blur">
        <Button
          size="icon"
          variant="ghost"
          className="size-9 rounded-full text-white hover:bg-white/20"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => useAnimationStore.getState().toggle()}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 rounded-full text-white hover:bg-white/20"
          aria-label="Restart"
          onClick={() => useAnimationStore.getState().restart()}
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 rounded-full text-white hover:bg-white/20"
          aria-label="Fullscreen"
          onClick={() => {
            const el = shellRef.current;
            if (!el) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen();
          }}
        >
          <Maximize2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 rounded-full text-white hover:bg-white/20"
          aria-label="Close preview"
          onClick={() => useEditorStore.getState().setPreviewOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <p className="text-xs text-white/50">
        Space to play or pause · Esc to close
      </p>
    </div>
  );
}

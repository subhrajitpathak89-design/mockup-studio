"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { resolveScene } from "@/lib/animation/engine";
import { loadImage } from "@/lib/canvas/imageCache";
import { DEVICE_SPECS, frameImageSrc } from "@/lib/canvas/devices";
import { renderScene, TextureBuffer } from "@/lib/canvas/renderer";
import { TEMPLATES, type Template } from "@/lib/project/templates";
import type { Scene } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Template previews are the real scene, rendered by the real renderer — not
 * recorded clips. They cost nothing to keep honest: change a preset or a
 * shader and every card here changes with it, because there is no second copy
 * of the artwork to update.
 */
export function TemplateGallery({
  onPick,
}: {
  onPick: (template: Template) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Start from a template
        </h2>
        <span className="text-sm text-muted-foreground">
          Add your screen — the motion is already set
        </span>
      </div>

      <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onPick={() => onPick(template)}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
  template,
  onPick,
}: {
  template: Template;
  onPick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState(false);

  // Built once: instantiating a preset stamps ids off the clock, so rebuilding
  // on every render would restart the motion mid-play.
  const scene = useMemo<Scene>(() => template.build(), [template]);
  const buffer = useMemo(() => new TextureBuffer(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const paint = (time: number) => {
      const { width: w, height: h } = canvas;
      // Landscape templates fill the card, since their backgrounds are
      // full-bleed and the crop costs nothing. A 9:16 or 1:1 template cropped
      // to 16:9 would lose the device itself, so those are fitted instead.
      const cover = Math.max(w / template.width, h / template.height);
      const contain = Math.min(w / template.width, h / template.height);
      const mismatch =
        Math.max(w / h, template.width / template.height) /
        Math.min(w / h, template.width / template.height);
      const scale = mismatch > 1.35 ? contain : cover;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(
        scale,
        0,
        0,
        scale,
        (w - template.width * scale) / 2,
        (h - template.height * scale) / 2,
      );
      renderScene(
        ctx,
        {
          scene,
          resolved: resolveScene(scene, time),
          time,
          width: template.width,
          height: template.height,
          quality: "draft",
          image: null,
        },
        buffer,
      );
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    // Photo backdrops and bitmap device frames are both files, and nothing
    // else on this page is loading them.
    const files = [
      scene.background.type === "image" ? scene.background.imageUrl : "",
      frameImageSrc(DEVICE_SPECS[scene.device.type]),
    ].filter(Boolean);
    for (const src of files) {
      void loadImage(src)
        .then(() => paint(template.duration * 0.62))
        .catch(() => undefined);
    }

    if (!hovered) {
      // At rest, sit on a moment where the motion has settled — frame zero is
      // usually mid-fade and reads as a mistake.
      paint(template.duration * 0.62);
      return;
    }

    let raf = 0;
    const started = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      paint(((now - started) / 1000) % template.duration);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hovered, scene, buffer, template]);

  return (
    <button
      onClick={onPick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`Start from ${template.label}`}
      className="group overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] text-left transition-colors hover:border-white/25 focus-visible:border-white/25 focus-visible:outline-none"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        <canvas
          ref={canvasRef}
          width={520}
          height={293}
          className="size-full"
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-zinc-950/40 opacity-0 backdrop-blur-[2px] transition-opacity",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950">
            <Play className="size-3 fill-current" /> Use template
          </span>
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-zinc-950/70 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur">
          {ratioLabel(template.width, template.height)}
        </span>
      </div>

      <div className="px-3.5 py-3">
        <p className="truncate text-sm font-medium">{template.label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {template.hint}
        </p>
      </div>
    </button>
  );
}

function ratioLabel(width: number, height: number) {
  const r = width / height;
  if (Math.abs(r - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(r - 9 / 16) < 0.02) return "9:16";
  if (Math.abs(r - 1) < 0.02) return "1:1";
  if (Math.abs(r - 4 / 5) < 0.02) return "4:5";
  return `${r.toFixed(2)}:1`;
}

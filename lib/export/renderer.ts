"use client";

import { resolveScene } from "@/lib/animation/engine";
import { renderScene, TextureBuffer } from "@/lib/canvas/renderer";
import { loadImage } from "@/lib/canvas/imageCache";
import type { ProjectMeta, Scene } from "@/types";

export type Resolution = 720 | 1080;

export interface ExportTarget {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Canvas-space units per project-space unit. */
  scale: number;
}

/**
 * Builds an offscreen canvas sized to the requested resolution, keeping the
 * project's aspect ratio. Resolution is defined by the shorter edge so a 9:16
 * story exports 1080 wide rather than 1080 tall.
 */
export function createExportTarget(
  project: ProjectMeta,
  resolution: Resolution,
): ExportTarget {
  const ratio = project.width / project.height;
  const scale =
    ratio >= 1 ? resolution / project.height : resolution / project.width;

  const width = Math.round(project.width * scale / 2) * 2;
  const height = Math.round(project.height * scale / 2) * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  return { canvas, ctx, width, height, scale };
}

export interface FrameRenderer {
  (time: number): void;
}

/**
 * Returns a function that paints the scene at any time onto the target. The
 * screenshot is decoded once up front, and the device texture buffer is reused
 * across every frame.
 */
export async function createFrameRenderer(
  scene: Scene,
  project: ProjectMeta,
  target: ExportTarget,
): Promise<FrameRenderer> {
  const image = scene.screen.source ? await loadImage(scene.screen.source) : null;
  const buffer = new TextureBuffer();

  return (time: number) => {
    const { ctx } = target;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(target.scale, target.scale);
    renderScene(
      ctx,
      {
        scene,
        resolved: resolveScene(scene, time),
        time,
        width: project.width,
        height: project.height,
        image,
        quality: "final",
      },
      buffer,
    );
    ctx.restore();
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFilename(name: string) {
  return name.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "mockup";
}

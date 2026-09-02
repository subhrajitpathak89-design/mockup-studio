"use client";

import type { ProjectMeta, Scene } from "@/types";
import {
  createExportTarget,
  createFrameRenderer,
  type Resolution,
} from "./renderer";

export async function exportPng(
  scene: Scene,
  project: ProjectMeta,
  time: number,
  resolution: Resolution,
): Promise<Blob> {
  const target = createExportTarget(project, resolution);
  const renderFrame = await createFrameRenderer(scene, project, target);
  renderFrame(time);

  return new Promise((resolve, reject) => {
    target.canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
}

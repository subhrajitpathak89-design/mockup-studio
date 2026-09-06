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
  const { renderFrame, texture } = await createFrameRenderer(scene, project, target);
  // A still of a recording has to land on the exact frame the playhead is on.
  await texture.seek(time);
  renderFrame(time);
  texture.dispose();

  return new Promise((resolve, reject) => {
    target.canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
}

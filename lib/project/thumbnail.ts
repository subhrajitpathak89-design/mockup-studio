"use client";

import { resolveScene } from "@/lib/animation/engine";
import { renderScene } from "@/lib/canvas/renderer";
import { getScreenTexture } from "@/lib/canvas/videoCache";
import type { ProjectMeta, Scene } from "@/types";

/** Wide enough to read at card size, small enough to sit inside a saved row. */
const THUMB_WIDTH = 384;

/**
 * Paints a small still of the scene for the projects list.
 *
 * Deliberately synchronous: it draws from textures already decoded for the
 * editor rather than loading anything, so an autosave never waits on a
 * download. A project whose media has not finished loading simply gets a
 * thumbnail of its background, and the next save catches the rest.
 *
 * This is not the editor canvas copied — that one carries selection outlines
 * and handles, which have no business in a project card.
 */
export function renderThumbnail(scene: Scene, project: ProjectMeta): string | null {
  if (typeof document === "undefined") return null;

  try {
    const scale = THUMB_WIDTH / project.width;
    const width = THUMB_WIDTH;
    const height = Math.max(2, Math.round(project.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    ctx.scale(scale, scale);
    renderScene(ctx, {
      scene,
      resolved: resolveScene(scene, 0),
      time: 0,
      width: project.width,
      height: project.height,
      image: getScreenTexture(scene.screen),
      quality: "draft",
    });

    // JPEG rather than PNG: a gradient background in PNG is a megabyte, and
    // every one of these lives inside an IndexedDB row.
    return canvas.toDataURL("image/jpeg", 0.62);
  } catch {
    // A tainted canvas or a mid-load texture should never break saving.
    return null;
  }
}

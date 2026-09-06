"use client";

import { resolveScene } from "@/lib/animation/engine";
import { renderScene, TextureBuffer } from "@/lib/canvas/renderer";
import { loadImage } from "@/lib/canvas/imageCache";
import { DEVICE_SPECS, frameImageSrc } from "@/lib/canvas/devices";
import {
  createVideoElement,
  seekVideo,
  sourceTimeFor,
  trimmedDuration,
} from "@/lib/canvas/videoCache";
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
 * The screen content, decoded and positionable.
 *
 * An image is simply itself at every moment. A recording has to be moved to
 * the right moment first — either by seeking (exact, for GIF and PNG) or by
 * playing in real time (for MediaRecorder capture, which runs at 1x anyway).
 */
export interface ScreenTexture {
  source: CanvasImageSource | null;
  /** Positions the recording at a scene time. A no-op for images. */
  seek(time: number): Promise<void>;
  /** Starts real-time playback from the top of the trim. */
  play(): Promise<void>;
  /** The recording's audio, for muxing into a captured stream. */
  audioTrack(): MediaStreamTrack | null;
  dispose(): void;
}

/**
 * Export gets its own video element rather than borrowing the editor's: the
 * editor's is being driven by the playhead, and two clocks fighting over one
 * element produces a mistimed export.
 */
export async function createScreenTexture(scene: Scene): Promise<ScreenTexture> {
  const screen = scene.screen;

  if (!screen.source) {
    return {
      source: null,
      seek: async () => undefined,
      play: async () => undefined,
      audioTrack: () => null,
      dispose: () => undefined,
    };
  }

  if (screen.kind !== "video") {
    const image = await loadImage(screen.source);
    return {
      source: image,
      seek: async () => undefined,
      play: async () => undefined,
      audioTrack: () => null,
      dispose: () => undefined,
    };
  }

  const video = createVideoElement(screen.source);
  video.muted = screen.muted;
  let stream: MediaStream | null = null;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not decode the recording"));
  });
  await seekVideo(video, screen.trimIn);

  return {
    source: video,
    async seek(time: number) {
      await seekVideo(video, sourceTimeFor(screen, time));
    },
    async play() {
      await seekVideo(video, screen.trimIn);
      await video.play().catch(() => undefined);
    },
    audioTrack() {
      if (screen.muted) return null;
      try {
        // Canvas capture carries no sound, so the recording's own audio has
        // to be muxed in or the export comes out silent.
        const capture = (
          video as HTMLVideoElement & { captureStream?: () => MediaStream }
        ).captureStream?.();
        if (!capture) return null;
        stream = capture;
        return capture.getAudioTracks()[0] ?? null;
      } catch {
        return null;
      }
    },
    dispose() {
      video.pause();
      stream?.getTracks().forEach((t) => t.stop());
      video.removeAttribute("src");
      video.load();
    },
  };
}

/** The scene's own length when a recording defines it, else the project's. */
export function sceneDuration(scene: Scene, project: ProjectMeta): number {
  const media = trimmedDuration(scene.screen);
  return media > 0 ? Math.min(project.duration, media) : project.duration;
}

/**
 * Returns a function that paints the scene at any time onto the target,
 * together with the texture it draws from. The device texture buffer is reused
 * across every frame.
 */
export async function createFrameRenderer(
  scene: Scene,
  project: ProjectMeta,
  target: ExportTarget,
): Promise<{ renderFrame: FrameRenderer; texture: ScreenTexture }> {
  const texture = await createScreenTexture(scene);
  // A backdrop that is still downloading would export as the fallback
  // gradient, so it has to be in the cache before the first frame is painted.
  if (scene.background.type === "image" && scene.background.imageUrl) {
    await loadImage(scene.background.imageUrl).catch(() => undefined);
  }
  // Overlays are part of the picture; a missing one exports as a gap.
  await Promise.all(
    (scene.overlays ?? []).map((o) =>
      o.src ? loadImage(o.src).catch(() => undefined) : undefined,
    ),
  );
  // A bitmap device frame missing from an export is a device with no bezel.
  const art = frameImageSrc(DEVICE_SPECS[scene.device.type]);
  if (art) await loadImage(art).catch(() => undefined);
  const buffer = new TextureBuffer();

  const renderFrame: FrameRenderer = (time: number) => {
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
        image: texture.source,
        quality: "final",
      },
      buffer,
    );
    ctx.restore();
  };

  return { renderFrame, texture };
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

"use client";

import type { ProjectMeta, Scene } from "@/types";
import { GifEncoder } from "./gif";
import {
  createExportTarget,
  createFrameRenderer,
  type Resolution,
} from "./renderer";

export type VideoFormat = "webm" | "mp4" | "gif";

export interface VideoExportOptions {
  format: VideoFormat;
  resolution: Resolution;
  fps: 24 | 30 | 60;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const MP4_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E"',
  "video/mp4",
];

const WEBM_CANDIDATES = [
  'video/webm;codecs="vp9"',
  'video/webm;codecs="vp8"',
  "video/webm",
];

export function supportsFormat(format: VideoFormat): boolean {
  if (typeof MediaRecorder === "undefined") return format === "gif";
  if (format === "gif") return true;
  const candidates = format === "mp4" ? MP4_CANDIDATES : WEBM_CANDIDATES;
  return candidates.some((t) => MediaRecorder.isTypeSupported(t));
}

function pickMimeType(format: "webm" | "mp4"): string | null {
  const candidates = format === "mp4" ? MP4_CANDIDATES : WEBM_CANDIDATES;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export interface VideoExportResult {
  blob: Blob;
  extension: string;
  /** Set when the requested format was unavailable and WebM was used. */
  fellBackToWebm: boolean;
  /**
   * Recording is real time, so a machine that cannot render fast enough — or a
   * tab the browser has throttled in the background — produces a mistimed
   * video. We measure it rather than letting it pass unnoticed.
   */
  slow: boolean;
}

export async function exportVideo(
  scene: Scene,
  project: ProjectMeta,
  options: VideoExportOptions,
): Promise<VideoExportResult> {
  if (options.format === "gif") {
    // GIF is rendered offline frame by frame, so its timing is exact.
    return {
      blob: await exportGif(scene, project, options),
      extension: "gif",
      fellBackToWebm: false,
      slow: false,
    };
  }

  let mime = pickMimeType(options.format);
  let fellBackToWebm = false;
  if (!mime && options.format === "mp4") {
    // MP4 recording is not available in every browser; WebM always is.
    mime = pickMimeType("webm");
    fellBackToWebm = true;
  }
  if (!mime) throw new Error("This browser cannot record video.");

  const startedAt = performance.now();
  const blob = await recordCanvas(scene, project, options, mime);
  const wallSeconds = (performance.now() - startedAt) / 1000;

  return {
    blob,
    extension: mime.startsWith("video/mp4") ? "mp4" : "webm",
    fellBackToWebm,
    slow: wallSeconds > project.duration * 1.25 + 1,
  };
}

/**
 * Records in real time via MediaRecorder. Pushing frames faster than wall
 * clock makes the recorder timestamp them wrongly and produce a video shorter
 * than the timeline, so the export intentionally runs at 1x.
 */
async function recordCanvas(
  scene: Scene,
  project: ProjectMeta,
  options: VideoExportOptions,
  mimeType: string,
): Promise<Blob> {
  const target = createExportTarget(project, options.resolution);
  const renderFrame = await createFrameRenderer(scene, project, target);

  // Paint frame zero before capture starts so the video never opens on blank.
  renderFrame(0);

  const stream = target.canvas.captureStream(options.fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: options.resolution === 1080 ? 12_000_000 : 6_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start(100);

  // Paced with a timer rather than requestAnimationFrame: browsers throttle
  // rAF in a backgrounded tab, which would stall the export indefinitely.
  await new Promise<void>((resolve) => {
    const start = performance.now();
    const interval = 1000 / options.fps;

    const step = () => {
      if (options.signal?.aborted) {
        resolve();
        return;
      }
      const elapsed = (performance.now() - start) / 1000;
      const t = Math.min(elapsed, project.duration);
      renderFrame(t);
      options.onProgress?.(t / project.duration);

      if (elapsed >= project.duration) {
        resolve();
        return;
      }
      setTimeout(step, interval);
    };
    step();
  });

  // Hold the last frame for a beat. A static canvas emits no frames at all and
  // the encoder trims the tail, so nudge it — but with a no-op paint rather
  // than a full re-render, which at 1080p would cost seconds.
  renderFrame(project.duration);
  const tailFrames = Math.max(4, Math.round(options.fps * 0.3));
  for (let i = 0; i < tailFrames; i++) {
    target.ctx.clearRect(0, 0, 0, 0);
    await new Promise((r) => setTimeout(r, 1000 / options.fps));
  }

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  return done;
}

/** GIF is capped in size and rate — 256 colours is unkind to large gradients. */
const GIF_MAX_WIDTH = 640;
const GIF_FPS = 15;

async function exportGif(
  scene: Scene,
  project: ProjectMeta,
  options: VideoExportOptions,
): Promise<Blob> {
  const target = createExportTarget(project, options.resolution);
  const renderFrame = await createFrameRenderer(scene, project, target);

  const gifScale = Math.min(1, GIF_MAX_WIDTH / target.width);
  const gw = Math.max(2, Math.round(target.width * gifScale));
  const gh = Math.max(2, Math.round(target.height * gifScale));

  const scaler = document.createElement("canvas");
  scaler.width = gw;
  scaler.height = gh;
  const sctx = scaler.getContext("2d", { alpha: false })!;
  sctx.imageSmoothingQuality = "high";

  const frameCount = Math.max(1, Math.round(project.duration * GIF_FPS));
  const encoder = new GifEncoder(gw, gh, Math.round(100 / GIF_FPS));

  for (let i = 0; i < frameCount; i++) {
    if (options.signal?.aborted) break;
    renderFrame((i / GIF_FPS) % project.duration);
    sctx.drawImage(target.canvas, 0, 0, gw, gh);
    encoder.addFrame(sctx.getImageData(0, 0, gw, gh));
    options.onProgress?.((i + 1) / frameCount);
    // Yield so the encoder does not lock the main thread for whole seconds.
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  return encoder.finish();
}

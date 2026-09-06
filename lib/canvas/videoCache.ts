"use client";

import type { ScreenState } from "@/types";
import { getCachedImage } from "./imageCache";

/**
 * A recording is a texture like any other — Canvas2D takes an
 * `HTMLVideoElement` through `drawImage` exactly as it takes an image — so the
 * renderer never learns that video exists. What lives here is everything the
 * renderer should *not* know: decoding, seeking, and keeping the element in
 * step with scene time.
 */
const videos = new Map<string, HTMLVideoElement>();
const pending = new Map<string, Promise<HTMLVideoElement>>();

/** Seeks land within a frame or two; past this we treat playback as adrift. */
const DRIFT_TOLERANCE = 0.12;

export function createVideoElement(source: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = source;
  video.preload = "auto";
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  // Never in the DOM: it exists only to decode frames for the canvas.
  return video;
}

export function getCachedVideo(source: string): HTMLVideoElement | null {
  if (!source) return null;
  return videos.get(source) ?? null;
}

/** Resolves once the element has enough data to be drawn at time zero. */
export function loadVideo(source: string): Promise<HTMLVideoElement> {
  if (!source) return Promise.reject(new Error("No video source"));

  const hit = videos.get(source);
  if (hit) return Promise.resolve(hit);

  const inflight = pending.get(source);
  if (inflight) return inflight;

  const promise = new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = createVideoElement(source);
    const settle = () => {
      videos.set(source, video);
      pending.delete(source);
      resolve(video);
    };
    video.onloadeddata = settle;
    video.onerror = () => {
      pending.delete(source);
      reject(new Error("Could not decode that recording"));
    };
  });

  pending.set(source, promise);
  return promise;
}

export function releaseVideo(source: string) {
  const video = videos.get(source);
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
  videos.delete(source);
}

/**
 * Returns whatever should be drawn inside the device right now — a decoded
 * image, or the recording's current frame.
 */
export function getScreenTexture(screen: ScreenState): CanvasImageSource | null {
  if (!screen.source) return null;
  return screen.kind === "video"
    ? getCachedVideo(screen.source)
    : getCachedImage(screen.source);
}

/** How long the recording runs after trimming — the spine of the timeline. */
export function trimmedDuration(screen: ScreenState): number {
  if (screen.kind !== "video" || !screen.mediaDuration) return 0;
  const end = screen.trimOut > 0 ? screen.trimOut : screen.mediaDuration;
  return Math.max(0.1, end - screen.trimIn);
}

/**
 * Maps scene time onto source time. Scene time stays the master clock; the
 * video only ever follows it, which is what keeps `resolveScene` pure and the
 * editor, preview and export rendering the same frame.
 */
export function sourceTimeFor(screen: ScreenState, sceneTime: number): number {
  const span = trimmedDuration(screen);
  if (span <= 0) return 0;
  // Recordings shorter than the timeline hold on their last frame rather than
  // looping, which would read as a glitch in the middle of a demo.
  return screen.trimIn + Math.min(Math.max(sceneTime, 0), span);
}

/** Resolves once the element is actually showing the requested moment. */
export function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Number.isFinite(time) ? Math.max(0, time) : 0;
  if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = target;
    // A seek to a position the element is already at can fire nothing at all.
    setTimeout(done, 400);
  });
}

export function isAdrift(video: HTMLVideoElement, target: number): boolean {
  return Math.abs(video.currentTime - target) > DRIFT_TOLERANCE;
}

export interface VideoProbe {
  width: number;
  height: number;
  duration: number;
}

/**
 * Reads a recording's real dimensions back off the blob.
 *
 * `MediaRecorder` output frequently carries no duration in its header, so
 * `video.duration` comes back as Infinity. The caller's own measured elapsed
 * time is authoritative; this only reports what the file admits to.
 */
export function probeVideo(source: string): Promise<VideoProbe> {
  return new Promise((resolve, reject) => {
    const video = createVideoElement(source);
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      });
    };
    video.onerror = () => reject(new Error("Could not read that recording"));
  });
}

"use client";

import { useAnimationStore } from "@/store/animationStore";
import { useProjectStore } from "@/store/projectStore";
import {
  getCachedVideo,
  isAdrift,
  loadVideo,
  sourceTimeFor,
} from "./videoCache";

/**
 * Keeps the recording in step with scene time.
 *
 * Scene time is the master clock and the video is a follower — press play and
 * the element is told to play, drag the playhead and it is told to seek. That
 * direction matters: it is what lets `resolveScene` stay a pure function of
 * time, so the device animation and the recording play off one clock with no
 * second animation path to keep in sync.
 */
let rafId: number | null = null;
let requesting = "";
let lastPainted = -1;

const listeners = new Set<() => void>();

/** Fires when the visible frame changes, so the canvas knows to repaint. */
export function subscribeVideoFrames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

export function startVideoClock() {
  if (rafId !== null || typeof window === "undefined") return;

  const tick = () => {
    rafId = requestAnimationFrame(tick);

    const { screen } = useProjectStore.getState().scene;
    if (screen.kind !== "video" || !screen.source) {
      lastPainted = -1;
      return;
    }

    const video = getCachedVideo(screen.source);
    if (!video) {
      // Decode on first sight, once — the loop runs every frame.
      if (requesting !== screen.source) {
        requesting = screen.source;
        loadVideo(screen.source)
          .then(notify)
          .catch(() => undefined);
      }
      return;
    }

    const { time, playing } = useAnimationStore.getState();
    const target = sourceTimeFor(screen, time);

    if (video.muted !== screen.muted) video.muted = screen.muted;

    if (playing) {
      if (video.paused) {
        // Autoplay policy can refuse an unmuted play(); muting and retrying
        // beats dropping the picture along with the sound.
        void video.play().catch(() => {
          video.muted = true;
          void video.play().catch(() => undefined);
        });
      }
      // Left alone, decode hiccups let the video slide behind the timeline.
      if (isAdrift(video, target)) video.currentTime = target;
    } else {
      if (!video.paused) video.pause();
      if (isAdrift(video, target)) video.currentTime = target;
    }

    if (video.currentTime !== lastPainted) {
      lastPainted = video.currentTime;
      notify();
    }
  };

  rafId = requestAnimationFrame(tick);
}

export function stopVideoClock() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  requesting = "";
  lastPainted = -1;
}

"use client";

import { newRecordingId, saveRecording } from "@/lib/project/persistence";
import { deviceActions, screenActions } from "@/lib/project/actions";
import { useAnimationStore } from "@/store/animationStore";
import { useProjectStore } from "@/store/projectStore";
import type { DeviceType } from "@/types";
import type { RecordingResult } from "./capture";

/** Timelines outside this range stop being useful to edit frame by frame. */
const MIN_DURATION = 1;
const MAX_DURATION = 120;

/**
 * Picks the frame that flatters the capture.
 *
 * A guess, and one click to change — but it means the first thing you see
 * after recording already reads as a product shot rather than a raw rectangle.
 */
export function deviceForAspect(width: number, height: number): DeviceType {
  const ratio = width / Math.max(1, height);
  // Portrait captures are phone-shaped; everything wider goes on a screen. The
  // frames are photographs, so this only picks which photograph — the capture
  // is fitted into whatever glass that shot happens to have.
  if (ratio <= 0.8) return "phone-in-hand";
  if (ratio <= 1.2) return "tablet-held";
  return "monitor-desk";
}

/** Canvas that matches the capture's orientation. */
function canvasForAspect(width: number, height: number) {
  return width >= height
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
}

export interface Trim {
  trimIn: number;
  trimOut: number;
}

/**
 * Moves a finished recording into the editor: blob to storage, reference into
 * the scene, device and timeline sized to what was actually captured.
 */
export async function commitRecording(
  recording: RecordingResult,
  trim: Trim,
): Promise<void> {
  const recordingId = newRecordingId();
  await saveRecording(recordingId, recording.blob);

  const store = useProjectStore.getState();
  if (!store.hydrated) {
    // Recording is a front door of its own, so it has to be able to create the
    // project it lands in.
    const canvas = canvasForAspect(recording.width, recording.height);
    store.newProject("Screen recording", canvas.width, canvas.height);
  }

  screenActions.setRecording({
    source: recording.url,
    recordingId,
    naturalWidth: recording.width,
    naturalHeight: recording.height,
    mediaDuration: recording.duration,
    trimIn: trim.trimIn,
    trimOut: trim.trimOut,
  });

  deviceActions.setType(deviceForAspect(recording.width, recording.height));
  // A capture's shape comes from whatever screen it was taken on, so the frame
  // has to follow it rather than crop the edges off the demo.
  deviceActions.setFitToSource(true);

  // The recording is the spine of the timeline; animations layer on top of it.
  const span = Math.min(
    MAX_DURATION,
    Math.max(MIN_DURATION, trim.trimOut - trim.trimIn),
  );
  useProjectStore.getState().setProject({ duration: Number(span.toFixed(2)) });
  useAnimationStore.getState().setDuration(span);
  useAnimationStore.getState().setTime(0);

  await useProjectStore.getState().save();
}

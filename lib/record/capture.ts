"use client";

/**
 * Screen capture, in the browser.
 *
 * Everything here is `getDisplayMedia` plus `MediaRecorder`. The browser owns
 * the source picker — we cannot skin it, preselect a window, or bypass it,
 * because it is a security surface. What we do own is audio mixing, pause,
 * measuring the real elapsed length, and noticing when the user stops the
 * capture from the browser's own banner instead of from our UI.
 */

const WEBM_CANDIDATES = [
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  "video/webm",
];

export function isCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined" &&
    WEBM_CANDIDATES.some((t) => MediaRecorder.isTypeSupported(t))
  );
}

/**
 * System audio is a Chromium capability. Firefox and Safari expose no way to
 * capture it, and macOS refuses it even in Chrome for full-screen shares — so
 * the toggle has to say so rather than silently record nothing.
 */
export function isSystemAudioSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const chromium = /Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua);
  return chromium && !!navigator.mediaDevices?.getDisplayMedia;
}

export function isMicSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pickMimeType(): string {
  return (
    WEBM_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm"
  );
}

export interface CaptureOptions {
  mic: boolean;
  systemAudio: boolean;
  /** Fires when the user ends the share from the browser's own banner. */
  onExternalStop?: () => void;
}

export interface RecordingResult {
  blob: Blob;
  /** Object URL for the blob. The caller owns revoking it. */
  url: string;
  /** Measured from the wall clock, excluding paused stretches. */
  duration: number;
  width: number;
  height: number;
  mimeType: string;
  hasAudio: boolean;
}

export interface CaptureSession {
  /** Seconds recorded so far, paused time excluded. */
  elapsed(): number;
  paused(): boolean;
  pause(): void;
  resume(): void;
  /** Ends the capture and resolves with the finished recording. */
  stop(): Promise<RecordingResult>;
  /** Aborts without producing a result — used when the user retakes. */
  cancel(): void;
}

export async function startCapture(
  options: CaptureOptions,
): Promise<CaptureSession> {
  if (!isCaptureSupported()) {
    throw new Error("This browser cannot record the screen.");
  }

  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 } },
    // Asking for system audio on a browser that cannot deliver it makes the
    // whole call reject, so only ask where it exists.
    audio: options.systemAudio && isSystemAudioSupported(),
  });

  let mic: MediaStream | null = null;
  if (options.mic) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      // A refused microphone should not throw away a screen share the user
      // has already granted — carry on without it.
      mic = null;
    }
  }

  const { track: audioTrack, context } = mixAudio(display, mic);

  const stream = new MediaStream();
  display.getVideoTracks().forEach((t) => stream.addTrack(t));
  if (audioTrack) stream.addTrack(audioTrack);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const settings = display.getVideoTracks()[0]?.getSettings() ?? {};

  let startedAt = performance.now();
  let accumulated = 0;
  let cancelled = false;

  const elapsed = () =>
    (accumulated +
      (recorder.state === "recording" ? performance.now() - startedAt : 0)) /
    1000;

  const teardown = () => {
    stream.getTracks().forEach((t) => t.stop());
    display.getTracks().forEach((t) => t.stop());
    mic?.getTracks().forEach((t) => t.stop());
    void context?.close().catch(() => undefined);
  };

  // "Stop sharing" in the browser's banner ends the track without telling the
  // recorder, so listen for it and treat it exactly like our own stop button.
  display.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", () => {
      if (recorder.state !== "inactive") options.onExternalStop?.();
    });
  });

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start(250);

  return {
    elapsed,
    paused: () => recorder.state === "paused",
    pause() {
      if (recorder.state !== "recording") return;
      accumulated += performance.now() - startedAt;
      recorder.pause();
    },
    resume() {
      if (recorder.state !== "paused") return;
      startedAt = performance.now();
      recorder.resume();
    },
    async stop() {
      if (recorder.state === "recording") {
        accumulated += performance.now() - startedAt;
      }
      if (recorder.state !== "inactive") recorder.stop();
      const blob = await stopped;
      teardown();

      if (cancelled) throw new Error("Recording cancelled");

      const url = URL.createObjectURL(blob);
      return {
        blob,
        url,
        // The recorder's own header usually omits duration, so our measured
        // elapsed time is the authority on how long this recording runs.
        duration: Math.max(0.2, accumulated / 1000),
        width: settings.width ?? 1920,
        height: settings.height ?? 1080,
        mimeType,
        hasAudio: !!audioTrack,
      };
    },
    cancel() {
      cancelled = true;
      if (recorder.state !== "inactive") recorder.stop();
      teardown();
    },
  };
}

/**
 * Merges system audio and the microphone into one track before they reach the
 * recorder. Two separate tracks would produce a file most players only play
 * half of.
 */
function mixAudio(
  display: MediaStream,
  mic: MediaStream | null,
): { track: MediaStreamTrack | null; context: AudioContext | null } {
  const sources = [
    ...display.getAudioTracks().map((t) => new MediaStream([t])),
    ...(mic ? [mic] : []),
  ];

  if (sources.length === 0) return { track: null, context: null };
  if (sources.length === 1) {
    return { track: sources[0].getAudioTracks()[0], context: null };
  }

  try {
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    for (const source of sources) {
      context.createMediaStreamSource(source).connect(destination);
    }
    return { track: destination.stream.getAudioTracks()[0], context };
  } catch {
    // If WebAudio is unavailable, one track beats none.
    return { track: sources[0].getAudioTracks()[0], context: null };
  }
}

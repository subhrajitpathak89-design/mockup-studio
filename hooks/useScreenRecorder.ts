"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  isCaptureSupported,
  isMicSupported,
  isSystemAudioSupported,
  startCapture,
  type CaptureSession,
  type RecordingResult,
} from "@/lib/record/capture";

export type RecorderPhase = "setup" | "countdown" | "recording";

/**
 * Capture support is a property of the browser, not of React state. Reading it
 * through an external store keeps the server render honest — the toggles never
 * render enabled and then flip to disabled a moment after hydration.
 */
const CAPABILITIES = {
  client: null as null | {
    supported: boolean;
    systemAudioOk: boolean;
    micOk: boolean;
  },
  server: { supported: false, systemAudioOk: false, micOk: false },
};

export function useCapabilities() {
  return useSyncExternalStore(
    // The server snapshot has to claim nothing is supported, and React will
    // not leave it behind on its own — so the subscription announces itself
    // once, which is what moves the component onto the real capabilities.
    (onChange) => {
      queueMicrotask(onChange);
      return () => undefined;
    },
    () => {
      CAPABILITIES.client ??= {
        supported: isCaptureSupported(),
        systemAudioOk: isSystemAudioSupported(),
        micOk: isMicSupported(),
      };
      return CAPABILITIES.client;
    },
    () => CAPABILITIES.server,
  );
}

/**
 * The capture state machine, shared by the `/record` front door and the
 * editor's Record panel. The two differ only in what they do with the finished
 * recording, so that is the one thing the caller supplies.
 */
export function useScreenRecorder(onComplete: (result: RecordingResult) => void) {
  const [phase, setPhase] = useState<RecorderPhase>("setup");
  const [mic, setMic] = useState(false);
  const [systemAudio, setSystemAudio] = useState(true);
  const [countdownEnabled, setCountdownEnabled] = useState(true);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<CaptureSession | null>(null);
  const { supported, systemAudioOk, micOk } = useCapabilities();

  // What we will actually ask for, once the browser has had its say. Asking
  // for system audio where it does not exist rejects the whole capture.
  const wantSystemAudio = systemAudio && systemAudioOk;
  const wantMic = mic && micOk;

  // Held in a ref so restarting a capture never tears down the live session
  // just because the caller passed a new closure.
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    try {
      const result = await session.stop();
      setPhase("setup");
      completeRef.current(result);
    } catch {
      setPhase("setup");
    }
  }, []);

  const begin = useCallback(async () => {
    setError(null);
    try {
      const session = await startCapture({
        mic: wantMic,
        systemAudio: wantSystemAudio,
        // Ending the share from the browser's own banner is a stop, not a
        // crash — treat it identically to pressing our stop button.
        onExternalStop: () => void stop(),
      });
      sessionRef.current = session;
      setElapsed(0);
      setPaused(false);
      setPhase("recording");
    } catch (e) {
      // A cancelled picker is not an error worth shouting about.
      const message = e instanceof Error ? e.message : "Could not start recording";
      setError(/Permission|denied|NotAllowed/i.test(message) ? null : message);
      setPhase("setup");
    }
  }, [wantMic, wantSystemAudio, stop]);

  // Countdown, then start. The tick both counts and fires, so nothing is set
  // synchronously while rendering.
  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = setTimeout(() => {
      if (count <= 1) void begin();
      else setCount((c) => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, count, begin]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      setElapsed(sessionRef.current?.elapsed() ?? 0);
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  // Navigating away mid-capture must release the screen share, or the browser
  // goes on telling the user they are still sharing.
  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (countdownEnabled) {
      setCount(3);
      setPhase("countdown");
    } else {
      void begin();
    }
  }, [countdownEnabled, begin]);

  const togglePause = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.paused()) {
      session.resume();
      setPaused(false);
    } else {
      session.pause();
      setPaused(true);
    }
  }, []);

  return {
    phase,
    count,
    elapsed,
    paused,
    error,
    setError,
    supported,
    micOk,
    systemAudioOk,
    mic: wantMic,
    setMic,
    systemAudio: wantSystemAudio,
    setSystemAudio,
    countdownEnabled,
    setCountdownEnabled,
    start,
    stop,
    togglePause,
  };
}

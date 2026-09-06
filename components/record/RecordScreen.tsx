"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Circle,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import type { RecordingResult } from "@/lib/record/capture";
import { commitRecording } from "@/lib/record/handoff";
import { cn } from "@/lib/utils";

export function RecordScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordingResult | null>(null);

  // The front door keeps its review step: arriving here, you have not yet
  // seen the editor, so there is nowhere else to judge the trim.
  const recorder = useScreenRecorder(setRecording);

  const retake = () => {
    if (recording) URL.revokeObjectURL(recording.url);
    setRecording(null);
    setSaveError(null);
  };

  const use = async (trimIn: number, trimOut: number) => {
    if (!recording) return;
    setBusy(true);
    try {
      await commitRecording(recording, { trimIn, trimOut });
      router.push("/editor");
    } catch (e) {
      setBusy(false);
      setSaveError(e instanceof Error ? e.message : "Could not save that recording");
    }
  };

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-8">
        <header className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-2 text-muted-foreground"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        </header>

        <div className="flex flex-1 flex-col justify-center py-10">
          {recording ? (
            <ReviewStep
              recording={recording}
              busy={busy}
              error={saveError}
              onRetake={retake}
              onUse={use}
            />
          ) : recorder.phase === "countdown" ? (
            <CountdownStep count={recorder.count} />
          ) : recorder.phase === "recording" ? (
            <RecordingStep
              elapsed={recorder.elapsed}
              paused={recorder.paused}
              onPause={recorder.togglePause}
              onStop={() => void recorder.stop()}
            />
          ) : (
            <SetupStep
              supported={recorder.supported}
              mic={recorder.mic}
              micOk={recorder.micOk}
              onMic={recorder.setMic}
              systemAudio={recorder.systemAudio}
              systemAudioOk={recorder.systemAudioOk}
              onSystemAudio={recorder.setSystemAudio}
              countdown={recorder.countdownEnabled}
              onCountdown={recorder.setCountdownEnabled}
              error={recorder.error}
              onStart={recorder.start}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function SetupStep({
  supported,
  mic,
  micOk,
  onMic,
  systemAudio,
  systemAudioOk,
  onSystemAudio,
  countdown,
  onCountdown,
  error,
  onStart,
}: {
  supported: boolean;
  mic: boolean;
  micOk: boolean;
  onMic: (v: boolean) => void;
  systemAudio: boolean;
  systemAudioOk: boolean;
  onSystemAudio: (v: boolean) => void;
  countdown: boolean;
  onCountdown: (v: boolean) => void;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Record your screen.
      </h1>
      <p className="mt-4 max-w-lg text-muted-foreground text-pretty">
        Choose what to capture in the next step. When you stop, the recording
        drops straight into a device frame.
      </p>

      <div className="mt-8 space-y-1 rounded-xl border border-border">
        <ToggleRow
          icon={mic ? Mic : MicOff}
          label="Microphone"
          hint={micOk ? "Narrate as you go" : "Not available in this browser"}
          checked={mic && micOk}
          disabled={!micOk}
          onChange={onMic}
        />
        <ToggleRow
          icon={Volume2}
          label="System audio"
          hint={
            systemAudioOk
              ? "Sound from the thing you're demoing"
              : "Needs Chrome or Edge"
          }
          checked={systemAudio && systemAudioOk}
          disabled={!systemAudioOk}
          onChange={onSystemAudio}
        />
        <ToggleRow
          icon={Circle}
          label="3 second countdown"
          hint="Time to get to the right window"
          checked={countdown}
          disabled={false}
          onChange={onCountdown}
        />
      </div>

      {!supported ? (
        <p className="mt-5 text-sm text-destructive">
          This browser can&apos;t record the screen. Chrome, Edge or Firefox on
          desktop will work.
        </p>
      ) : null}
      {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}

      <div className="mt-8">
        <Button size="lg" disabled={!supported} onClick={onStart}>
          <Circle className="fill-current" /> Start recording
        </Button>
      </div>
    </>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Mic;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 not-last:border-b not-last:border-border",
        disabled && "opacity-55",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function CountdownStep({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="text-8xl font-semibold tabular-nums">{count}</div>
      <p className="mt-6 text-sm text-muted-foreground">
        Your browser will ask which window to share.
      </p>
    </div>
  );
}

function RecordingStep({
  elapsed,
  paused,
  onPause,
  onStop,
}: {
  elapsed: number;
  paused: boolean;
  onPause: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-3 rounded-full bg-red-500",
            !paused && "animate-pulse",
          )}
        />
        <span className="text-5xl font-semibold tabular-nums">
          {formatTime(elapsed)}
        </span>
      </div>

      <p className="mt-5 max-w-sm text-center text-sm text-muted-foreground text-pretty">
        {paused
          ? "Paused. Resume when you're ready."
          : "Recording. Switch to the window you're demoing — come back here to stop."}
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" size="lg" onClick={onPause}>
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="lg" onClick={onStop}>
          <Square className="fill-current" /> Stop
        </Button>
      </div>
    </div>
  );
}

/**
 * The review step exists because every raw capture has junk on both ends —
 * finding the window at the start, reaching for stop at the end. Trimming it
 * here, while you still remember what you recorded, is faster than hunting for
 * trim controls in an editor busy showing you device frames.
 */
function ReviewStep({
  recording,
  busy,
  error,
  onRetake,
  onUse,
}: {
  recording: RecordingResult;
  busy: boolean;
  error: string | null;
  onRetake: () => void;
  onUse: (trimIn: number, trimOut: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const duration = recording.duration;
  const [trim, setTrim] = useState({ start: 0, end: duration });

  // Loop between the handles so the trim is judged by watching it, not by
  // reading two numbers.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.currentTime >= trim.end || video.currentTime < trim.start - 0.2) {
        video.currentTime = trim.start;
        void video.play().catch(() => undefined);
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [trim]);

  const trimmed = Math.max(0, trim.end - trim.start);

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Trim the ends</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing is re-encoded — you can widen this again in the editor.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          src={recording.url}
          autoPlay
          playsInline
          muted={!recording.hasAudio}
          controls={false}
          className="aspect-video w-full object-contain"
        />
      </div>

      <TrimBar
        duration={duration}
        start={trim.start}
        end={trim.end}
        onChange={(start, end) => setTrim({ start, end })}
      />

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span>
          {formatTime(trim.start)} → {formatTime(trim.end)}
        </span>
        <span>{formatTime(trimmed)} of {formatTime(duration)}</span>
      </div>

      {!recording.hasAudio ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No audio was captured. Sound only reaches MP4 and WebM exports — PNG
          and GIF are silent by nature.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" size="lg" disabled={busy} onClick={onRetake}>
          <RotateCcw /> Retake
        </Button>
        <Button
          size="lg"
          disabled={busy || trimmed < 0.3}
          onClick={() => onUse(trim.start, trim.end)}
        >
          {busy ? "Opening editor…" : "Use this recording"}
        </Button>
      </div>
    </>
  );
}

/** Two handles over one track. The kept region is lit; the rest is dimmed. */
function TrimBar({
  duration,
  start,
  end,
  onChange,
}: {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"start" | "end" | null>(null);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const fraction = (clientX - rect.left) / Math.max(1, rect.width);
    return Math.min(duration, Math.max(0, fraction * duration));
  };

  const onMove = (e: React.PointerEvent) => {
    const handle = dragging.current;
    if (!handle) return;
    const t = timeAt(e.clientX);
    // Handles cannot cross, and 0.3s is the shortest clip worth keeping.
    if (handle === "start") onChange(Math.min(t, end - 0.3), end);
    else onChange(start, Math.max(t, start + 0.3));
  };

  const pct = (t: number) => `${(t / Math.max(0.001, duration)) * 100}%`;

  return (
    <div
      ref={trackRef}
      onPointerMove={onMove}
      onPointerUp={(e) => {
        dragging.current = null;
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      }}
      onPointerCancel={() => (dragging.current = null)}
      className="relative mt-5 h-12 w-full cursor-pointer touch-none rounded-lg bg-muted"
    >
      <div
        className="absolute inset-y-0 rounded-lg bg-primary/25 ring-1 ring-primary/50"
        style={{ left: pct(start), right: `${100 - (end / duration) * 100}%` }}
      />
      {(["start", "end"] as const).map((handle) => (
        <button
          key={handle}
          type="button"
          aria-label={handle === "start" ? "Trim start" : "Trim end"}
          onPointerDown={(e) => {
            dragging.current = handle;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          style={{ left: pct(handle === "start" ? start : end) }}
          className="absolute inset-y-0 -ml-1.5 w-3 cursor-ew-resize rounded-full bg-primary shadow-lg ring-2 ring-background"
        />
      ))}
    </div>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
}

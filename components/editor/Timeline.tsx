"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { TrackId } from "@/types";
import { cn } from "@/lib/utils";

const TRACKS: { id: TrackId; label: string }[] = [
  { id: "device", label: "Device" },
  { id: "screen", label: "Screen" },
  { id: "camera", label: "Camera" },
];

export function Timeline() {
  const duration = useProjectStore((s) => s.project.duration);
  const animations = useProjectStore((s) => s.scene.animations);
  const scroll = useProjectStore((s) => s.scene.screen.scroll);
  const playing = useAnimationStore((s) => s.playing);
  const open = useEditorStore((s) => s.timelineOpen);
  const laneRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  // Keep the playback clock in step with the project's duration.
  useEffect(() => {
    useAnimationStore.getState().setDuration(duration);
  }, [duration]);

  const seek = (clientX: number) => {
    const lane = laneRef.current;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    useAnimationStore.getState().setTime(fraction * duration);
  };

  const clipsFor = (track: TrackId) => {
    if (track === "screen") {
      return scroll.enabled
        ? [
            {
              id: "scroll",
              label: "UI Scroll",
              delay: scroll.delay,
              duration: scroll.duration,
            },
          ]
        : [];
    }
    return animations
      .filter((a) => a.track === track)
      .map((a) => ({
        id: a.id,
        label: a.label,
        delay: a.delay,
        duration: a.duration,
      }));
  };

  // Playback stays reachable when the tracks are hidden — collapsing the
  // timeline should free up canvas space, not take away the play button.
  const controls = (
    <div className="flex items-center gap-2 px-3 py-2">
      <Button
        size="icon"
        variant="secondary"
        className="size-8"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => useAnimationStore.getState().toggle()}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        aria-label="Restart"
        onClick={() => useAnimationStore.getState().restart()}
      >
        <RotateCcw className="size-4" />
      </Button>
      <TimeReadout duration={duration} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-8"
            aria-label={open ? "Hide timeline" : "Show timeline"}
            onClick={() => useEditorStore.getState().toggleTimeline()}
          >
            {open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {open ? "Hide timeline" : "Show timeline"}
        </TooltipContent>
      </Tooltip>
    </div>
  );

  if (!open) {
    return <div className="shrink-0 border-t bg-card">{controls}</div>;
  }

  return (
    <div className="flex h-52 shrink-0 flex-col border-t bg-card">
      <div className="border-b">{controls}</div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-28 shrink-0 border-r">
          <div className="h-6 border-b" />
          {TRACKS.map((t) => (
            <div
              key={t.id}
              className="flex h-10 items-center px-3 text-xs text-muted-foreground"
            >
              {t.label}
            </div>
          ))}
        </div>

        <div
          ref={laneRef}
          className="relative flex-1 select-none"
          onPointerDown={(e) => {
            setScrubbing(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            useAnimationStore.getState().pause();
            seek(e.clientX);
          }}
          onPointerMove={(e) => scrubbing && seek(e.clientX)}
          onPointerUp={(e) => {
            setScrubbing(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        >
          <Ruler duration={duration} />

          {TRACKS.map((t) => (
            <div key={t.id} className="relative h-10 border-b border-border/40">
              {clipsFor(t.id).map((clip) => (
                <div
                  key={clip.id}
                  className="absolute top-1.5 flex h-7 items-center rounded-sm bg-sky-500/25 px-2 text-[11px] text-sky-100 ring-1 ring-sky-400/50"
                  style={{
                    left: `${(clip.delay / duration) * 100}%`,
                    width: `${Math.max(2, (clip.duration / duration) * 100)}%`,
                  }}
                >
                  <span className="truncate">{clip.label}</span>
                  <span className="absolute -left-px top-1/2 size-2 -translate-y-1/2 rotate-45 bg-sky-300" />
                  <span className="absolute -right-px top-1/2 size-2 -translate-y-1/2 rotate-45 bg-sky-300" />
                </div>
              ))}
            </div>
          ))}

          <Playhead duration={duration} />
        </div>
      </div>
    </div>
  );
}

function Ruler({ duration }: { duration: number }) {
  const ticks = Math.min(24, Math.max(2, Math.round(duration)));
  return (
    <div className="relative h-6 border-b">
      {Array.from({ length: ticks + 1 }, (_, i) => (
        <span
          key={i}
          className="absolute top-1 text-[10px] tabular-nums text-muted-foreground"
          style={{ left: `${(i / ticks) * 100}%` }}
        >
          <span className="relative -left-2">{formatTime((i / ticks) * duration)}</span>
        </span>
      ))}
    </div>
  );
}

/** Isolated so 60 frames per second of playback repaint only this element. */
function Playhead({ duration }: { duration: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = (time: number) => {
      if (ref.current) {
        ref.current.style.left = `${(time / duration) * 100}%`;
      }
    };
    apply(useAnimationStore.getState().time);
    return useAnimationStore.subscribe((s) => apply(s.time));
  }, [duration]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-sky-400"
    >
      <span className="absolute -left-1.5 top-0 size-3 rounded-full bg-sky-400" />
    </div>
  );
}

function TimeReadout({ duration }: { duration: number }) {
  const [time, setTime] = useState(0);
  useEffect(
    () => useAnimationStore.subscribe((s) => setTime(Math.round(s.time * 10) / 10)),
    [],
  );
  return (
    <span className={cn("ml-1 font-mono text-xs tabular-nums text-muted-foreground")}>
      {formatTime(time)} / {formatTime(duration)}
    </span>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

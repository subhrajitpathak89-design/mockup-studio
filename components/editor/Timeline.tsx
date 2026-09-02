"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { animationActions, screenActions, textActions } from "@/lib/project/actions";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { TrackId } from "@/types";
import { cn } from "@/lib/utils";
import { Surface } from "./Surface";

const TRACKS: { id: TrackId; label: string }[] = [
  { id: "device", label: "Device" },
  { id: "screen", label: "Screen" },
  { id: "text", label: "Text" },
  { id: "camera", label: "Camera" },
];

interface Clip {
  id: string;
  label: string;
  delay: number;
  duration: number;
  /** Which sub-row of the track this clip sits on. */
  row: number;
  /** Base clips represent the layer itself and cannot be removed. */
  base?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onToggleLayer?: () => void;
  remove?: () => void;
}

export function Timeline() {
  const duration = useProjectStore((s) => s.project.duration);
  const animations = useProjectStore((s) => s.scene.animations);
  const scroll = useProjectStore((s) => s.scene.screen.scroll);
  const screenSource = useProjectStore((s) => s.scene.screen.source);
  const texts = useProjectStore((s) => s.scene.texts);
  const playing = useAnimationStore((s) => s.playing);
  const open = useEditorStore((s) => s.timelineOpen);
  const selectedTextId = useEditorStore((s) => s.selectedTextId);
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

  const clipsFor = (track: TrackId): Clip[] => {
    if (track === "screen") {
      // The mockup itself runs the whole timeline, like a base video clip in
      // an NLE — it is always there, so the track is never empty.
      const base: Clip = {
        id: "screen-base",
        label: screenSource ? "Mockup" : "Mockup (no screenshot)",
        delay: 0,
        duration,
        row: 0,
        base: true,
      };
      return scroll.enabled
        ? [
            base,
            {
              id: "scroll",
              label: "UI Scroll",
              delay: scroll.delay,
              duration: scroll.duration,
              row: 0,
              remove: () => screenActions.setScroll({ enabled: false }),
            },
          ]
        : [base];
    }

    if (track === "text") {
      // One base clip per caption, plus its animation clips on top.
      return texts.flatMap((item, row): Clip[] => [
        {
          id: `text-${item.id}`,
          label: item.content.split("\n")[0] || "Text",
          delay: 0,
          duration,
          row,
          base: true,
          selected: selectedTextId === item.id,
          onSelect: () => {
            useEditorStore.getState().selectText(item.id);
            useEditorStore.getState().setTool("text");
          },
          onToggleLayer: () =>
            textActions.setLayer(
              item.id,
              item.layer === "front" ? "behind" : "front",
            ),
          remove: () => {
            textActions.remove(item.id);
            if (selectedTextId === item.id)
              useEditorStore.getState().selectText(null);
          },
        },
        ...animations
          .filter((a) => a.targetId === item.id)
          .map((a) => ({
            id: a.id,
            label: a.label,
            delay: a.delay,
            duration: a.duration,
            row,
            remove: () => animationActions.removeClip(a.id),
          })),
      ]);
    }

    return animations
      .filter((a) => a.track === track && !a.targetId)
      .map((a) => ({
        id: a.id,
        label: a.label,
        delay: a.delay,
        duration: a.duration,
        row: 0,
        remove: () => animationActions.removeClip(a.id),
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
    return <Surface className="shrink-0">{controls}</Surface>;
  }

  // The text track grows with the number of captions, so rows are measured
  // rather than fixed.
  const rowHeights = TRACKS.map((t) =>
    t.id === "text" ? Math.max(1, texts.length) * 40 : 40,
  );

  return (
    <Surface className="flex h-56 shrink-0 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06]">{controls}</div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="sticky left-0 w-28 shrink-0 border-r border-white/[0.06] bg-card/80">
          <div className="h-6 border-b border-white/[0.06]" />
          {TRACKS.map((t, i) => (
            <div
              key={t.id}
              style={{ height: rowHeights[i] }}
              className="flex items-center px-3 text-xs text-muted-foreground"
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

          {TRACKS.map((t, ti) => {
            const clips = clipsFor(t.id);
            return (
              <div
                key={t.id}
                style={{ height: rowHeights[ti] }}
                className="relative border-b border-border/40"
              >
                {clips.map((clip) => (
                  <ClipBar key={clip.id} clip={clip} duration={duration} />
                ))}
              </div>
            );
          })}

          <Playhead duration={duration} />
        </div>
      </div>
    </Surface>
  );
}

function ClipBar({ clip, duration }: { clip: Clip; duration: number }) {
  return (
    <div
      role={clip.onSelect ? "button" : undefined}
      tabIndex={clip.onSelect ? 0 : undefined}
      onPointerDown={(e) => {
        if (!clip.onSelect) return;
        e.stopPropagation();
        clip.onSelect();
      }}
      className={cn(
        "group absolute flex items-center gap-1 rounded-md px-2 text-[11px] ring-1",
        // Animation clips are inset inside their layer's row so they read as
        // riding on top of it rather than as a separate layer.
        clip.base ? "h-7" : "h-5",
        clip.base
          ? "bg-white/[0.06] text-foreground/80 ring-white/15"
          : "bg-sky-500/25 text-sky-100 ring-sky-400/50",
        clip.selected && "ring-2 ring-sky-400",
        clip.onSelect && "cursor-pointer",
      )}
      style={{
        top: clip.row * 40 + (clip.base ? 6 : 9),
        left: `${(clip.delay / duration) * 100}%`,
        width: `${Math.max(2, (clip.duration / duration) * 100)}%`,
      }}
    >
      <span className="truncate">{clip.label}</span>

      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {clip.onToggleLayer ? (
          <button
            aria-label={`Toggle layer for ${clip.label}`}
            title="Move in front of / behind the mockup"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              clip.onToggleLayer?.();
            }}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"
          >
            <Layers className="size-3" />
          </button>
        ) : null}
        {clip.remove ? (
          <button
            aria-label={`Delete ${clip.label}`}
            // The lane below is a scrub target, so stop the pointer here or
            // deleting would also move the playhead.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              clip.remove?.();
            }}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>

      {!clip.base ? (
        <>
          <span className="absolute -left-px top-1/2 size-2 -translate-y-1/2 rotate-45 bg-sky-300" />
          <span className="absolute -right-px top-1/2 size-2 -translate-y-1/2 rotate-45 bg-sky-300" />
        </>
      ) : null}
    </div>
  );
}

function Ruler({ duration }: { duration: number }) {
  const ticks = Math.min(24, Math.max(2, Math.round(duration)));
  return (
    <div className="relative h-6 border-b border-white/[0.06]">
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

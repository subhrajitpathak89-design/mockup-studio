"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Smartphone,
  Sticker,
  Type,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trimmedDuration } from "@/lib/canvas/videoCache";
import {
  animationActions,
  overlayActions,
  screenActions,
  textActions,
} from "@/lib/project/actions";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import type { Animation, TrackId } from "@/types";
import { cn } from "@/lib/utils";
import { Surface } from "./Surface";

const TRACKS: { id: TrackId; label: string; icon: typeof Layers }[] = [
  { id: "screen", label: "Screen", icon: ImageIcon },
  { id: "device", label: "Device", icon: Smartphone },
  { id: "overlay", label: "Overlay", icon: Sticker },
  { id: "text", label: "Text", icon: Type },
  { id: "camera", label: "Camera", icon: Video },
];

/** Each track gets its own colour so a glance tells you what a clip drives. */
const TONES: Record<TrackId, string> = {
  screen: "bg-violet-500/30 ring-violet-400/60 text-violet-50",
  device: "bg-sky-500/30 ring-sky-400/60 text-sky-50",
  overlay: "bg-rose-500/30 ring-rose-400/60 text-rose-50",
  text: "bg-amber-500/30 ring-amber-400/60 text-amber-50",
  camera: "bg-emerald-500/30 ring-emerald-400/60 text-emerald-50",
};

const LANE_H = 26;
const ROW_PAD = 8;
/** Nothing useful is left of a clip shorter than this. */
const MIN_CLIP = 0.15;

interface Clip {
  id: string;
  label: string;
  delay: number;
  duration: number;
  track: TrackId;
  /** Base clips are the layer itself: always full length, never dragged. */
  base?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onToggleLayer?: () => void;
  remove?: () => void;
  /** Present when the clip can be moved. */
  onChange?: (delay: number, duration: number) => void;
  /** Trimming is only offered when a single clip backs the bar. */
  trimmable?: boolean;
}

/** One layer: the clip that *is* the layer, and the clips animating it. */
interface Row {
  key: string;
  base?: Clip;
  lanes: Clip[][];
}

/**
 * Stacks clips that overlap in time onto separate lanes.
 *
 * Two animations starting at zero used to be drawn on top of each other — you
 * could see one bar, grab it, and move the other. Packing them means every
 * clip is visible and hittable, which is most of what made this timeline feel
 * unusable.
 */
function packLanes(clips: Clip[]): Clip[][] {
  const lanes: Clip[][] = [];
  for (const clip of [...clips].sort((a, b) => a.delay - b.delay)) {
    const lane = lanes.find((l) => {
      const last = l[l.length - 1];
      return last.delay + last.duration <= clip.delay + 1e-6;
    });
    if (lane) lane.push(clip);
    else lanes.push([clip]);
  }
  return lanes;
}

/**
 * A preset becomes several clips — "Rise" is an opacity clip and a position
 * clip — and drawing one bar each stacks identical-looking rectangles. The
 * timeline shows the preset instead, which is also the unit the Animation
 * panel talks in.
 *
 * Dragging a group shifts every clip by the same delta so any stagger the
 * preset authored survives. Trimming would have to redistribute durations
 * across the group, so it is offered only when the group is a single clip.
 */
function groupByPreset(list: Animation[]): Clip[] {
  const groups = new Map<string, Animation[]>();
  for (const a of list) {
    const key = a.presetId || a.id;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return [...groups.values()].map((clips) => {
    const start = Math.min(...clips.map((c) => c.delay));
    const end = Math.max(...clips.map((c) => c.delay + c.duration));
    const single = clips.length === 1;
    return {
      id: clips[0].id,
      label: clips[0].label,
      delay: start,
      duration: Number((end - start).toFixed(3)),
      track: clips[0].track,
      trimmable: single,
      remove: () => clips.forEach((c) => animationActions.removeClip(c.id)),
      onChange: (delay: number, dur: number) => {
        if (single) {
          animationActions.patchClip(clips[0].id, { delay, duration: dur });
          return;
        }
        const shift = delay - start;
        clips.forEach((c) =>
          animationActions.patchClip(c.id, {
            delay: Number((c.delay + shift).toFixed(3)),
          }),
        );
      },
    } satisfies Clip;
  });
}

function rowHeight(row: Row) {
  // Only count lanes that exist: reserving an empty one for every layer added
  // up to more height than the panel has.
  const lanes = Math.max(1, (row.base ? 1 : 0) + row.lanes.length);
  return lanes * LANE_H + ROW_PAD;
}

export function Timeline() {
  const duration = useProjectStore((s) => s.project.duration);
  const animations = useProjectStore((s) => s.scene.animations);
  const screen = useProjectStore((s) => s.scene.screen);
  const scroll = screen.scroll;
  const screenSource = screen.source;
  const screenKind = screen.kind;
  const texts = useProjectStore((s) => s.scene.texts);
  const overlays = useProjectStore((s) => s.scene.overlays);
  const playing = useAnimationStore((s) => s.playing);
  const open = useEditorStore((s) => s.timelineOpen);
  const selectedTextId = useEditorStore((s) => s.selectedTextId);
  const selectedOverlayId = useEditorStore((s) => s.selectedOverlayId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  // null means "follow the viewport" — the timeline fits until you zoom.
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    useAnimationStore.getState().setDuration(duration);
  }, [duration]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const fitPps = viewport > 0 ? viewport / Math.max(0.1, duration) : 0;
  const pps = zoom ?? fitPps;
  const laneWidth = Math.max(viewport, duration * pps);

  const timeAt = useCallback(
    (clientX: number) => {
      const lane = laneRef.current;
      if (!lane || pps <= 0) return 0;
      const rect = lane.getBoundingClientRect();
      return Math.min(duration, Math.max(0, (clientX - rect.left) / pps));
    },
    [duration, pps],
  );

  const rowsFor = (track: TrackId): Row[] => {
    if (track === "screen") {
      // A recording is a video clip, so its edges trim it — the gesture every
      // editor uses, and the thing you reach for first on a fresh capture.
      // A still image has no head or tail to cut, so it stays fixed.
      const recording = screenKind === "video" && screen.mediaDuration > 0;
      const base: Clip = {
        id: "screen-base",
        track,
        label: !screenSource
          ? "No screen yet"
          : recording
            ? "Recording"
            : "Mockup",
        delay: 0,
        duration: recording
          ? Math.min(duration, trimmedDuration(screen))
          : duration,
        base: true,
        trimmable: recording,
        onChange: recording
          ? (delay, dur) => {
              // The clip is pinned to zero, so a moved left edge *is* the
              // amount trimmed off the head.
              const head = Math.min(
                Math.max(0, screen.trimIn + delay),
                screen.mediaDuration - MIN_CLIP,
              );
              const tail = Math.min(screen.mediaDuration, head + dur);
              screenActions.setTrim(
                Number(head.toFixed(3)),
                Number(tail.toFixed(3)),
              );
            }
          : undefined,
      };
      const overlays: Clip[] = scroll.enabled
        ? [
            {
              id: "scroll",
              track,
              label: "UI Scroll",
              delay: scroll.delay,
              duration: scroll.duration,
              trimmable: true,
              remove: () => screenActions.setScroll({ enabled: false }),
              onChange: (delay, dur) =>
                screenActions.setScroll({ delay, duration: dur }),
            },
          ]
        : [];
      return [{ key: "screen", base, lanes: packLanes(overlays) }];
    }

    if (track === "overlay") {
      if (overlays.length === 0) return [{ key: "overlay-empty", lanes: [] }];
      return overlays.map((item) => ({
        key: item.id,
        base: {
          id: `overlay-${item.id}`,
          track,
          label: item.name || "Overlay",
          delay: 0,
          duration,
          base: true,
          selected: selectedOverlayId === item.id,
          onSelect: () => {
            useEditorStore.getState().selectOverlay(item.id);
            useEditorStore.getState().setTool("overlay");
          },
          onToggleLayer: () =>
            overlayActions.patch(item.id, {
              layer: item.layer === "front" ? "behind" : "front",
            }),
          remove: () => {
            overlayActions.remove(item.id);
            if (selectedOverlayId === item.id)
              useEditorStore.getState().selectOverlay(null);
          },
        },
        lanes: packLanes(
          groupByPreset(animations.filter((a) => a.targetId === item.id)),
        ),
      }));
    }

    if (track === "text") {
      if (texts.length === 0) return [{ key: "text-empty", lanes: [] }];
      return texts.map((item) => ({
        key: item.id,
        base: {
          id: `text-${item.id}`,
          track,
          label: item.content.split("\n")[0] || "Text",
          delay: 0,
          duration,
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
        lanes: packLanes(
          groupByPreset(animations.filter((a) => a.targetId === item.id)),
        ),
      }));
    }

    return [
      {
        key: track,
        lanes: packLanes(
          groupByPreset(
            animations.filter((a) => a.track === track && !a.targetId),
          ),
        ),
      },
    ];
  };

  const controls = (
    <div className="flex items-center gap-1.5 px-2.5 py-2">
      <Button
        size="icon"
        className="size-8 rounded-lg"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => useAnimationStore.getState().toggle()}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 rounded-lg"
        aria-label="Restart"
        onClick={() => useAnimationStore.getState().restart()}
      >
        <RotateCcw className="size-4" />
      </Button>

      <TimeReadout duration={duration} />

      {open ? (
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn
            label="Zoom out"
            onClick={() => setZoom(Math.max(fitPps * 0.5, pps / 1.5))}
          >
            <Minus className="size-3.5" />
          </IconBtn>
          <IconBtn label="Fit timeline" onClick={() => setZoom(null)}>
            <Maximize2 className="size-3.5" />
          </IconBtn>
          <IconBtn label="Zoom in" onClick={() => setZoom(Math.min(600, pps * 1.5))}>
            <Plus className="size-3.5" />
          </IconBtn>
        </div>
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn("size-8 rounded-lg", !open && "ml-auto")}
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

  const tracks = TRACKS.map((t) => ({ ...t, rows: rowsFor(t.id) }));

  return (
    <Surface className="flex h-[17rem] shrink-0 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06]">{controls}</div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {/* Track headers stay put while the lanes scroll sideways. */}
        <div className="w-[116px] shrink-0 border-r border-white/[0.06] bg-card/60">
          <div className="h-[26px] border-b border-white/[0.06]" />
          {tracks.map((t) => (
            <div
              key={t.id}
              style={{ height: t.rows.reduce((h, r) => h + rowHeight(r), 0) }}
              className="flex items-center gap-2 border-b border-white/[0.04] px-3 text-xs text-muted-foreground"
            >
              <t.icon className="size-3.5 shrink-0" />
              <span className="truncate">{t.label}</span>
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            ref={laneRef}
            style={{ width: laneWidth }}
            className="relative select-none"
            onPointerDown={(e) => {
              // Scrubbing anywhere in the lane, the way every editor works.
              useAnimationStore.getState().pause();
              useAnimationStore.getState().setTime(timeAt(e.clientX));
              const move = (ev: PointerEvent) =>
                useAnimationStore.getState().setTime(timeAt(ev.clientX));
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <Ruler duration={duration} pps={pps} />

            {tracks.map((t) => (
              <div key={t.id} className="border-b border-white/[0.04]">
                {t.rows.map((row) => (
                  <div
                    key={row.key}
                    style={{ height: rowHeight(row) }}
                    className="relative"
                  >
                    {row.base ? (
                      <ClipBar
                        clip={row.base}
                        top={4}
                        pps={pps}
                        duration={duration}
                      />
                    ) : null}
                    {row.lanes.flatMap((lane, li) =>
                      lane.map((clip) => (
                        <ClipBar
                          key={clip.id}
                          clip={clip}
                          top={4 + ((row.base ? 1 : 0) + li) * LANE_H}
                          pps={pps}
                          duration={duration}
                        />
                      )),
                    )}
                  </div>
                ))}
              </div>
            ))}

            <Playhead pps={pps} />
          </div>
        </div>
      </div>
    </Surface>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 rounded-lg"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

type DragMode = "move" | "trim-start" | "trim-end";

/**
 * A clip you can actually grab.
 *
 * Dragging the body moves it, dragging either edge trims it — the same
 * gestures every video editor uses. Before this the only way to change a
 * clip's timing was to type numbers into the Animation panel, which is what
 * made the timeline feel like a read-only diagram.
 */
function ClipBar({
  clip,
  top,
  pps,
  duration,
}: {
  clip: Clip;
  top: number;
  pps: number;
  duration: number;
}) {
  const [dragging, setDragging] = useState<DragMode | null>(null);
  const draggable = !!clip.onChange;
  const trimmable = draggable && clip.trimmable !== false;

  const width = Math.max(8, clip.duration * pps);
  const showLabel = width > 54;

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    if (!clip.onChange || pps <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    setDragging(mode);

    const startX = e.clientX;
    const from = { delay: clip.delay, duration: clip.duration };
    // Snap to a tenth of a second, and to the ends of the timeline.
    const snap = (t: number) => {
      const rounded = Math.round(t * 10) / 10;
      if (Math.abs(rounded) < 0.08) return 0;
      if (Math.abs(rounded - duration) < 0.08) return duration;
      return rounded;
    };

    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - startX) / pps;
      if (mode === "move") {
        const delay = snap(
          Math.min(duration - from.duration, Math.max(0, from.delay + dt)),
        );
        clip.onChange?.(delay, from.duration);
        return;
      }
      if (mode === "trim-start") {
        const end = from.delay + from.duration;
        const delay = snap(
          Math.min(end - MIN_CLIP, Math.max(0, from.delay + dt)),
        );
        clip.onChange?.(delay, Number((end - delay).toFixed(3)));
        return;
      }
      const dur = snap(
        Math.min(duration - from.delay, Math.max(MIN_CLIP, from.duration + dt)),
      );
      clip.onChange?.(from.delay, Math.max(MIN_CLIP, dur));
    };

    const up = () => {
      setDragging(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role={clip.onSelect ? "button" : undefined}
      tabIndex={clip.onSelect ? 0 : undefined}
      // Also the label for a clip too narrow to show its own text, and the
      // place to explain a bar that deliberately does not move.
      title={
        clip.base && !draggable
          ? `${clip.label} — this layer runs the whole timeline`
          : clip.label
      }
      onPointerDown={(e) => {
        if (clip.onSelect) {
          e.stopPropagation();
          clip.onSelect();
          return;
        }
        // A base clip is pinned to the start; only its edges do anything.
        if (draggable && !clip.base) startDrag("move", e);
      }}
      style={{ top, left: clip.delay * pps, width, height: LANE_H - 6 }}
      className={cn(
        "group absolute flex items-center rounded-lg ring-1 transition-shadow",
        clip.base
          ? "bg-white/[0.05] text-foreground/75 ring-white/10"
          : TONES[clip.track],
        clip.selected && "ring-2 ring-sky-400",
        draggable && !clip.base && "cursor-grab",
        dragging === "move" && "cursor-grabbing shadow-lg",
        clip.onSelect && "cursor-pointer",
      )}
    >
      {trimmable ? (
        <span
          onPointerDown={(e) => startDrag("trim-start", e)}
          className="absolute -left-0.5 top-0 h-full w-2 cursor-ew-resize rounded-l-lg before:absolute before:inset-y-1.5 before:left-1 before:w-0.5 before:rounded-full before:bg-white/70 before:opacity-0 before:transition-opacity group-hover:before:opacity-100"
        />
      ) : null}

      {showLabel ? (
        <span className="pointer-events-none truncate px-2.5 text-[11px] font-medium">
          {clip.label}
        </span>
      ) : null}

      <span className="ml-auto flex shrink-0 items-center gap-0.5 pr-1">
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
            // The lane below scrubs, so swallow the pointer or deleting would
            // also move the playhead.
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

      {trimmable ? (
        <span
          onPointerDown={(e) => startDrag("trim-end", e)}
          className="absolute -right-0.5 top-0 h-full w-2 cursor-ew-resize rounded-r-lg before:absolute before:inset-y-1.5 before:right-1 before:w-0.5 before:rounded-full before:bg-white/70 before:opacity-0 before:transition-opacity group-hover:before:opacity-100"
        />
      ) : null}

      {dragging ? (
        <span className="pointer-events-none absolute -top-6 left-0 z-30 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-white shadow ring-1 ring-white/15">
          {clip.delay.toFixed(1)}s · {clip.duration.toFixed(1)}s
        </span>
      ) : null}
    </div>
  );
}

/**
 * Tick spacing follows the zoom rather than the duration, so labels never
 * collide and never thin out to two on a long timeline.
 */
function Ruler({ duration, pps }: { duration: number; pps: number }) {
  if (pps <= 0) return <div className="h-[26px] border-b border-white/[0.06]" />;

  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const step = steps.find((s) => s * pps >= 64) ?? 60;
  const count = Math.floor(duration / step);

  return (
    <div className="relative h-[26px] border-b border-white/[0.06]">
      {Array.from({ length: count + 1 }, (_, i) => {
        const t = i * step;
        return (
          <span
            key={i}
            style={{ left: t * pps }}
            className="absolute top-0 flex h-full flex-col justify-between"
          >
            <span className="pl-1 text-[10px] leading-4 tabular-nums text-muted-foreground">
              {formatTick(t, step)}
            </span>
            <span className="h-1.5 w-px bg-white/15" />
          </span>
        );
      })}
    </div>
  );
}

/** Isolated so 60 frames per second of playback repaint only this element. */
function Playhead({ pps }: { pps: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = (time: number) => {
      if (ref.current) ref.current.style.transform = `translateX(${time * pps}px)`;
    };
    apply(useAnimationStore.getState().time);
    return useAnimationStore.subscribe((s) => apply(s.time));
  }, [pps]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-y-0 left-0 z-20 w-0.5 bg-sky-400">
      <span className="absolute -left-[7px] top-0 size-4 rounded-b-sm rounded-t-md bg-sky-400 shadow" />
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
    <span className="ml-1.5 font-mono text-xs tabular-nums">
      <span className="text-foreground">{formatClock(time)}</span>
      <span className="text-muted-foreground"> / {formatClock(duration)}</span>
    </span>
  );
}

function formatTick(seconds: number, step: number) {
  if (step < 1) return `${seconds.toFixed(1)}s`;
  const mm = Math.floor(seconds / 60);
  const ss = Math.round(seconds % 60);
  return mm > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : `${ss}s`;
}

function formatClock(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const tenths = Math.floor((s % 1) * 10);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${tenths}`;
}

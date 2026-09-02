"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { resolveScene } from "@/lib/animation/engine";
import { deviceQuad, renderScene } from "@/lib/canvas/renderer";
import { pointInQuad } from "@/lib/canvas/transforms";
import { getCachedImage, loadImage } from "@/lib/canvas/imageCache";
import {
  getTextBounds,
  hitTestText,
  hitTestTextHandle,
  type HandleId,
} from "@/lib/canvas/text";
import { ensureFontsReady } from "@/lib/fonts";
import { deviceActions, textActions } from "@/lib/project/actions";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

/** Backing-store cap. Editing at full 4K would cost far more than it shows. */
const MAX_RENDER_WIDTH = 1600;

type DragMode =
  | "none"
  | "move"
  | "scale"
  | "rotate"
  | "pan"
  | "text"
  | "textResize"
  | "deviceResize";

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);
  const displayScaleRef = useRef(1);

  const project = useProjectStore((s) => s.project);
  const screenSource = useProjectStore((s) => s.scene.screen.source);
  const selectedTextId = useEditorStore((s) => s.selectedTextId);

  /** Screen-space box of the selected caption, for the floating delete chip. */
  const [textChip, setTextChip] = useState<{ x: number; y: number } | null>(null);

  // Decode the screenshot once; the render loop reads it from the cache.
  useEffect(() => {
    if (!screenSource) {
      dirtyRef.current = true;
      return;
    }
    let cancelled = false;
    loadImage(screenSource)
      .then(() => {
        if (!cancelled) dirtyRef.current = true;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [screenSource]);

  // Web fonts must be resolved before the first paint, or captions render in
  // a fallback face and only snap to the right one on the next edit.
  useEffect(() => {
    void ensureFontsReady().then(() => {
      dirtyRef.current = true;
    });
  }, []);

  // Anything that changes the picture flips the dirty flag. Rendering is kept
  // out of React entirely so scrubbing never re-renders the tree.
  useEffect(() => {
    const mark = () => {
      dirtyRef.current = true;
    };
    const unsubs = [
      useProjectStore.subscribe(mark),
      useAnimationStore.subscribe(mark),
      useEditorStore.subscribe(mark),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Fit the canvas element to the available space, then apply user zoom.
  const layout = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { width: cw, height: ch } = container.getBoundingClientRect();
    const fit = Math.min((cw - 64) / project.width, (ch - 64) / project.height);
    const { zoom, pan } = useEditorStore.getState();
    const display = Math.max(0.02, fit) * zoom;
    displayScaleRef.current = display;

    canvas.style.width = `${project.width * display}px`;
    canvas.style.height = `${project.height * display}px`;
    canvas.style.transform = `translate(${pan.x}px, ${pan.y}px)`;

    const renderScale = Math.min(1, MAX_RENDER_WIDTH / project.width);
    const bw = Math.round(project.width * renderScale);
    const bh = Math.round(project.height * renderScale);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    dirtyRef.current = true;
  }, [project.width, project.height]);

  useEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (containerRef.current) ro.observe(containerRef.current);
    const unsub = useEditorStore.subscribe(layout);
    return () => {
      ro.disconnect();
      unsub();
    };
  }, [layout]);

  // The render loop.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const { scene, project: meta } = useProjectStore.getState();
      const { time } = useAnimationStore.getState();
      const { showGrid, selection, previewOpen, selectedTextId: sel } =
        useEditorStore.getState();

      const renderScale = canvas.width / meta.width;
      const resolved = resolveScene(scene, time);

      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      renderScene(ctx, {
        scene,
        resolved,
        time,
        width: meta.width,
        height: meta.height,
        image: getCachedImage(scene.screen.source),
        showGrid,
        selectedTextId: previewOpen ? null : sel,
        quality: "draft",
      });

      if (selection === "device" && !previewOpen && !sel) {
        drawSelection(
          ctx,
          deviceQuad(scene, resolved, meta.width, meta.height),
          meta.width,
        );
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Position the floating delete chip over the caption's top-right corner.
      const bounds = sel ? getTextBounds(sel) : undefined;
      if (bounds && !previewOpen) {
        const display = displayScaleRef.current;
        const z = resolved.camera.zoom;
        const sx =
          (meta.width / 2 + (bounds.x + bounds.w + resolved.camera.x) * z) * display;
        const sy = (meta.height / 2 + (bounds.y + resolved.camera.y) * z) * display;
        setTextChip((prev) =>
          prev && Math.abs(prev.x - sx) < 0.5 && Math.abs(prev.y - sy) < 0.5
            ? prev
            : { x: sx, y: sy },
        );
      } else {
        setTextChip((prev) => (prev === null ? prev : null));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pointer interaction: drag to move, alt-drag to scale, shift-drag to spin.
  const dragRef = useRef({
    mode: "none" as DragMode,
    startX: 0,
    startY: 0,
    textId: null as string | null,
    handle: null as HandleId | null,
    startDistance: 1,
    origin: { x: 0, y: 0, scale: 1, rotZ: 0, panX: 0, panY: 0, size: 96 },
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = displayScaleRef.current;
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;

    const { scene, project: meta } = useProjectStore.getState();
    const resolved = resolveScene(scene, useAnimationStore.getState().time);
    const quad = deviceQuad(scene, resolved, meta.width, meta.height);
    const onDevice = pointInQuad(quad, px, py);

    const localX = (px - meta.width / 2) / resolved.camera.zoom - resolved.camera.x;
    const localY = (py - meta.height / 2) / resolved.camera.zoom - resolved.camera.y;

    const editor = useEditorStore.getState();
    const pan = editor.pan;
    // A generous grab radius. Dividing by both the display scale and the
    // camera zoom keeps it a constant ~18px on screen however far the camera
    // has pushed in.
    const tolerance = 18 / (scale * (resolved.camera.zoom || 1));

    // Anchors on the selected caption take priority over everything.
    const textHandle = editor.selectedTextId
      ? hitTestTextHandle(editor.selectedTextId, localX, localY, tolerance)
      : null;

    const deviceHandle =
      !textHandle && !editor.selectedTextId
        ? hitTestDeviceHandle(quad, px, py, tolerance)
        : null;

    // Captions sit above the device, so they get first refusal on the click.
    const textId = textHandle
      ? editor.selectedTextId
      : hitTestText(scene.texts ?? [], localX, localY);

    const mode: DragMode = textHandle
      ? "textResize"
      : deviceHandle
        ? "deviceResize"
        : textId
          ? "text"
          : e.button === 1 || !onDevice
            ? "pan"
            : e.altKey
              ? "scale"
              : e.shiftKey
                ? "rotate"
                : "move";

    if (textId && !textHandle) {
      editor.selectText(textId);
      editor.setTool("text");
    } else if (!textId && !textHandle && onDevice) {
      editor.selectText(null);
      editor.select("device");
    } else if (!textId && !textHandle && !onDevice && !deviceHandle) {
      editor.selectText(null);
    }

    const text = scene.texts?.find((t) => t.id === textId);
    const centre = quadCentre(quad);

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      textId: textId ?? null,
      handle: textHandle ?? deviceHandle,
      startDistance:
        mode === "deviceResize"
          ? Math.max(1, Math.hypot(px - centre.x, py - centre.y))
          : mode === "textResize" && text
            ? Math.max(
                1,
                Math.hypot(localX - text.position.x, localY - text.position.y),
              )
            : 1,
      origin: text
        ? {
            x: text.position.x,
            y: text.position.y,
            scale: 1,
            rotZ: 0,
            panX: pan.x,
            panY: pan.y,
            size: text.size,
          }
        : {
            x: scene.device.position.x,
            y: scene.device.position.y,
            scale: scene.device.scale,
            rotZ: scene.device.rotation.z,
            panX: pan.x,
            panY: pan.y,
            size: 96,
          },
    };

    editor.setInteracting(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = displayScaleRef.current;

    if (drag.mode === "none") {
      updateCursor(e, canvas, scale);
      return;
    }

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    switch (drag.mode) {
      case "pan":
        useEditorStore.getState().setPan({
          x: drag.origin.panX + dx,
          y: drag.origin.panY + dy,
        });
        break;
      case "text": {
        const id = drag.textId;
        if (!id) break;
        const zoom = useProjectStore.getState().scene.camera.zoom || 1;
        textActions.patch(id, {
          position: {
            x: Math.round(drag.origin.x + dx / scale / zoom),
            y: Math.round(drag.origin.y + dy / scale / zoom),
          },
        });
        break;
      }
      case "textResize": {
        // Dragging an anchor scales the caption by how much further the
        // pointer is from its centre than when the drag started.
        const id = drag.textId;
        if (!id) break;
        const rect = canvas.getBoundingClientRect();
        const { scene, project: meta } = useProjectStore.getState();
        const resolved = resolveScene(scene, useAnimationStore.getState().time);
        const px = (e.clientX - rect.left) / scale;
        const py = (e.clientY - rect.top) / scale;
        const localX =
          (px - meta.width / 2) / resolved.camera.zoom - resolved.camera.x;
        const localY =
          (py - meta.height / 2) / resolved.camera.zoom - resolved.camera.y;
        const distance = Math.hypot(localX - drag.origin.x, localY - drag.origin.y);
        const factor = distance / drag.startDistance;
        textActions.patch(id, {
          size: clamp(Math.round(drag.origin.size * factor), 12, 400),
        });
        break;
      }
      case "deviceResize": {
        const rect = canvas.getBoundingClientRect();
        const { scene, project: meta } = useProjectStore.getState();
        const resolved = resolveScene(scene, useAnimationStore.getState().time);
        const quad = deviceQuad(scene, resolved, meta.width, meta.height);
        const centre = quadCentre(quad);
        const px = (e.clientX - rect.left) / scale;
        const py = (e.clientY - rect.top) / scale;
        const distance = Math.max(1, Math.hypot(px - centre.x, py - centre.y));
        const factor = distance / drag.startDistance;
        deviceActions.setScale(clamp(drag.origin.scale * factor, 0.1, 3));
        break;
      }
      case "move":
        deviceActions.setPosition(
          Math.round(drag.origin.x + dx / scale),
          Math.round(drag.origin.y + dy / scale),
        );
        break;
      case "scale":
        deviceActions.setScale(clamp(drag.origin.scale - dy / 300, 0.1, 3));
        break;
      case "rotate":
        deviceActions.setRotation(
          "z",
          clamp(Math.round(drag.origin.rotZ + dx / 6), -180, 180),
        );
        break;
    }
  };

  /** Anchors only read as resize handles if the cursor says so. */
  const updateCursor = (
    e: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
    scale: number,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;
    const { scene, project: meta } = useProjectStore.getState();
    const resolved = resolveScene(scene, useAnimationStore.getState().time);
    const localX = (px - meta.width / 2) / resolved.camera.zoom - resolved.camera.x;
    const localY = (py - meta.height / 2) / resolved.camera.zoom - resolved.camera.y;
    const tolerance = 18 / (scale * (resolved.camera.zoom || 1));

    const sel = useEditorStore.getState().selectedTextId;
    const onHandle = sel
      ? hitTestTextHandle(sel, localX, localY, tolerance)
      : hitTestDeviceHandle(
          deviceQuad(scene, resolved, meta.width, meta.height),
          px,
          py,
          tolerance,
        );

    canvas.style.cursor = onHandle
      ? onHandle === "nw" || onHandle === "se"
        ? "nwse-resize"
        : "nesw-resize"
      : hitTestText(scene.texts ?? [], localX, localY)
        ? "move"
        : "default";
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.mode = "none";
    useEditorStore.getState().setInteracting(false);
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    useEditorStore.getState().zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
  };

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-[radial-gradient(circle_at_50%_25%,#26262b,#111114)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-24px_rgba(0,0,0,0.9)]"
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="touch-none rounded-sm shadow-2xl shadow-black/60 ring-1 ring-white/10"
        />

        {textChip && selectedTextId ? (
          <button
            type="button"
            aria-label="Delete text"
            title="Delete text"
            onClick={() => {
              textActions.remove(selectedTextId);
              useEditorStore.getState().selectText(null);
            }}
            style={{ left: textChip.x, top: textChip.y }}
            className="absolute z-10 -translate-y-1/2 translate-x-2 rounded-full border border-white/15 bg-zinc-900/90 p-1.5 text-white shadow-lg backdrop-blur transition-colors hover:border-red-400/60 hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function quadCentre(quad: { x: number; y: number }[]) {
  return {
    x: quad.reduce((a, p) => a + p.x, 0) / quad.length,
    y: quad.reduce((a, p) => a + p.y, 0) / quad.length,
  };
}

const DEVICE_HANDLE_IDS: HandleId[] = ["nw", "ne", "se", "sw"];

function hitTestDeviceHandle(
  quad: { x: number; y: number }[],
  x: number,
  y: number,
  tolerance: number,
): HandleId | null {
  for (let i = 0; i < quad.length; i++) {
    if (Math.hypot(quad[i].x - x, quad[i].y - y) <= tolerance) {
      return DEVICE_HANDLE_IDS[i];
    }
  }
  return null;
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  quad: { x: number; y: number }[],
  canvasWidth: number,
) {
  const unit = canvasWidth / 900;
  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2 * unit;
  ctx.setLineDash([8 * unit, 6 * unit]);
  ctx.beginPath();
  quad.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.stroke();

  ctx.setLineDash([]);
  for (const p of quad) {
    // Filled white with a blue ring reads as a grabbable handle rather than
    // a decorative dot.
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 * unit, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2.5 * unit;
    ctx.strokeStyle = "#38bdf8";
    ctx.stroke();
  }
  ctx.restore();
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

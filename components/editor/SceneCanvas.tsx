"use client";

import { useCallback, useEffect, useRef } from "react";
import { resolveScene } from "@/lib/animation/engine";
import { deviceQuad, renderScene } from "@/lib/canvas/renderer";
import { pointInQuad } from "@/lib/canvas/transforms";
import { getCachedImage, loadImage } from "@/lib/canvas/imageCache";
import { hitTestText } from "@/lib/canvas/text";
import { deviceActions, textActions } from "@/lib/project/actions";
import { useAnimationStore } from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

/** Backing-store cap. Editing at full 4K would cost far more than it shows. */
const MAX_RENDER_WIDTH = 1600;

type DragMode = "none" | "move" | "scale" | "rotate" | "pan" | "text";

export function SceneCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);
  const displayScaleRef = useRef(1);

  const project = useProjectStore((s) => s.project);
  const screenSource = useProjectStore((s) => s.scene.screen.source);

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
      const { showGrid, selection, previewOpen, selectedTextId } =
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
        selectedTextId: previewOpen ? null : selectedTextId,
        quality: "draft",
      });

      if (selection === "device" && !previewOpen) {
        drawSelection(
          ctx,
          deviceQuad(scene, resolved, meta.width, meta.height),
          meta.width,
        );
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    origin: { x: 0, y: 0, scale: 1, rotZ: 0, panX: 0, panY: 0 },
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

    // Captions sit above the device, so they get first refusal on the click.
    const localX = (px - meta.width / 2) / resolved.camera.zoom - resolved.camera.x;
    const localY = (py - meta.height / 2) / resolved.camera.zoom - resolved.camera.y;
    const textId = hitTestText(scene.texts ?? [], localX, localY);

    const pan = useEditorStore.getState().pan;
    const mode: DragMode = textId
      ? "text"
      : e.button === 1 || !onDevice
        ? "pan"
        : e.altKey
          ? "scale"
          : e.shiftKey
            ? "rotate"
            : "move";

    if (textId) {
      useEditorStore.getState().selectText(textId);
      useEditorStore.getState().setTool("text");
    } else if (onDevice) {
      useEditorStore.getState().selectText(null);
      useEditorStore.getState().select("device");
    }

    const text = scene.texts?.find((t) => t.id === textId);

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      textId,
      origin: text
        ? {
            x: text.position.x,
            y: text.position.y,
            scale: 1,
            rotZ: 0,
            panX: pan.x,
            panY: pan.y,
          }
        : {
            x: scene.device.position.x,
            y: scene.device.position.y,
            scale: scene.device.scale,
            rotZ: scene.device.rotation.z,
            panX: pan.x,
            panY: pan.y,
          },
    };

    useEditorStore.getState().setInteracting(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === "none") return;

    const scale = displayScaleRef.current;
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
      case "move":
        deviceActions.setPosition(
          Math.round(drag.origin.x + dx / scale),
          Math.round(drag.origin.y + dy / scale),
        );
        break;
      case "scale":
        deviceActions.setScale(
          clamp(drag.origin.scale - dy / 300, 0.1, 3),
        );
        break;
      case "rotate":
        deviceActions.setRotation(
          "z",
          clamp(Math.round(drag.origin.rotZ + dx / 6), -180, 180),
        );
        break;
    }
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
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="touch-none rounded-sm shadow-2xl shadow-black/60 ring-1 ring-white/10"
      />
    </div>
  );
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
  ctx.fillStyle = "#38bdf8";
  for (const p of quad) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 * unit, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

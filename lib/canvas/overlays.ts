"use client";

import { getCachedImage } from "./imageCache";
import type { OverlayItem } from "@/types";
import type { ResolvedText } from "@/lib/animation/engine";

/**
 * Image overlays: logos, badges, stickers, cut-outs — anything that sits on
 * the scene rather than inside the device.
 *
 * They animate through the same resolved map as captions. An overlay has the
 * same four animatable properties a caption does (x, y, scale, opacity), so
 * reusing that map means every text preset works on an overlay without the
 * engine learning a second entity.
 */
const REST: ResolvedText = { x: 0, y: 0, scale: 1, opacity: 1 };

export interface OverlayBounds {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Centre and rotation, so hit-testing can undo the spin. */
  cx: number;
  cy: number;
  rotation: number;
}

/** Bounds of what was last painted, for hit-testing on canvas. */
const measured = new Map<string, OverlayBounds>();

/** Natural size an overlay is drawn at before its own scale is applied. */
function baseSize(item: OverlayItem) {
  const w = item.naturalWidth || 1;
  const h = item.naturalHeight || 1;
  // `width` is authored in canvas units; height follows the aspect so an
  // overlay can never be squashed by accident.
  const drawW = item.width;
  return { w: drawW, h: (drawW * h) / w };
}

export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: OverlayItem[],
  selectedId: string | null,
  resolved: Record<string, ResolvedText> = {},
) {
  for (const item of overlays) {
    const image = getCachedImage(item.src);
    const t = resolved[item.id] ?? REST;
    const { w, h } = baseSize(item);
    const scale = item.scale * t.scale;
    const drawW = w * scale;
    const drawH = h * scale;
    const cx = item.position.x + t.x;
    const cy = item.position.y + t.y;

    measured.set(item.id, {
      id: item.id,
      x: cx - drawW / 2,
      y: cy - drawH / 2,
      w: drawW,
      h: drawH,
      cx,
      cy,
      rotation: item.rotation,
    });

    if (!image) continue;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, Math.min(1, item.opacity * t.opacity));
    if (item.blendMode && item.blendMode !== "normal") {
      ctx.globalCompositeOperation = item.blendMode;
    }
    if (item.shadowBlur > 0) {
      ctx.shadowColor = item.shadowColor;
      ctx.shadowBlur = item.shadowBlur;
      ctx.shadowOffsetY = item.shadowOffsetY;
    }
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    if (selectedId === item.id)
      drawOverlaySelection(ctx, measured.get(item.id)!);
  }
}

/**
 * Drops bounds for overlays that no longer exist. Takes the whole list on
 * purpose: drawOverlays runs twice per frame, once per layer, and pruning
 * against a filtered list would forget everything on the other layer.
 */
export function pruneOverlayBounds(overlays: OverlayItem[]) {
  const live = new Set(overlays.map((o) => o.id));
  for (const id of measured.keys()) if (!live.has(id)) measured.delete(id);
}

export function getOverlayBounds(id: string) {
  return measured.get(id);
}

export type HandleId = "nw" | "ne" | "se" | "sw";

const OVERLAY_CORNERS = [
  { id: "nw" as const, sx: -1, sy: -1 },
  { id: "ne" as const, sx: 1, sy: -1 },
  { id: "se" as const, sx: 1, sy: 1 },
  { id: "sw" as const, sx: -1, sy: 1 },
];

/**
 * A point expressed in the overlay's own unrotated frame, relative to its
 * centre. Everything below hit-tests there, so a spun overlay is grabbed by
 * the pixels you can actually see rather than by its bounding envelope.
 */
function toLocal(b: OverlayBounds, x: number, y: number) {
  const a = (-b.rotation * Math.PI) / 180;
  const dx = x - b.cx;
  const dy = y - b.cy;
  return {
    x: dx * Math.cos(a) - dy * Math.sin(a),
    y: dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/** Topmost overlay under a point, in canvas units. */
export function hitTestOverlay(
  overlays: OverlayItem[],
  x: number,
  y: number,
): string | null {
  for (let i = overlays.length - 1; i >= 0; i--) {
    const b = measured.get(overlays[i].id);
    if (!b) continue;
    const p = toLocal(b, x, y);
    if (Math.abs(p.x) <= b.w / 2 && Math.abs(p.y) <= b.h / 2) {
      return overlays[i].id;
    }
  }
  return null;
}

/** Which corner of the selected overlay, if any, is under a point. */
export function hitTestOverlayHandle(
  id: string,
  x: number,
  y: number,
  tolerance: number,
): HandleId | null {
  const b = measured.get(id);
  if (!b) return null;
  const p = toLocal(b, x, y);
  for (const h of OVERLAY_CORNERS) {
    if (
      Math.hypot(p.x - (h.sx * b.w) / 2, p.y - (h.sy * b.h) / 2) <= tolerance
    ) {
      return h.id;
    }
  }
  return null;
}

function drawOverlaySelection(ctx: CanvasRenderingContext2D, b: OverlayBounds) {
  ctx.save();
  // Drawn in the overlay's own rotated frame so the box hugs the image
  // instead of ballooning into its axis-aligned envelope.
  ctx.translate(b.cx, b.cy);
  ctx.rotate((b.rotation * Math.PI) / 180);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);

  ctx.setLineDash([]);
  ctx.fillStyle = "#38bdf8";
  for (const h of OVERLAY_CORNERS) {
    ctx.beginPath();
    ctx.arc((h.sx * b.w) / 2, (h.sy * b.h) / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

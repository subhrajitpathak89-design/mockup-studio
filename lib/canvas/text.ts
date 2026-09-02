import type { ResolvedText } from "@/lib/animation/engine";
import { fontById } from "@/lib/fonts";
import type { TextItem } from "@/types";

export interface TextBounds {
  id: string;
  /** Axis-aligned box in scene-local coordinates (origin = canvas centre). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Bounds measured during the last paint. Measuring text needs a canvas
 * context, so the renderer records them here and hit-testing reads them back
 * instead of doing a second measuring pass on every pointer move.
 */
const measured = new Map<string, TextBounds>();

export function getTextBounds(id: string): TextBounds | undefined {
  return measured.get(id);
}

const REST: ResolvedText = { x: 0, y: 0, scale: 1, opacity: 1 };

export function fontFor(item: TextItem, scale = 1): string {
  return `${item.weight} ${item.size * scale}px ${fontById(item.fontId).family}`;
}

export function drawTexts(
  ctx: CanvasRenderingContext2D,
  texts: TextItem[],
  selectedId: string | null,
  resolved: Record<string, ResolvedText> = {},
) {
  for (const item of texts) {
    const t = resolved[item.id] ?? REST;
    const lines = item.content.split("\n");
    const lineHeight = item.size * item.lineHeight;

    ctx.save();
    ctx.translate(item.position.x + t.x, item.position.y + t.y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.scale(t.scale, t.scale);

    ctx.font = fontFor(item);
    ctx.textBaseline = "middle";
    ctx.textAlign = item.align;
    ctx.globalAlpha = Math.max(0, Math.min(1, item.opacity * t.opacity));
    // letterSpacing is not in every engine; setting it is harmless where it
    // is unsupported, and measurement below stays consistent either way.
    ctx.letterSpacing = `${item.letterSpacing}px`;

    let widest = 0;
    lines.forEach((line, i) => {
      const y = (i - (lines.length - 1) / 2) * lineHeight;
      widest = Math.max(widest, ctx.measureText(line).width);
      ctx.fillStyle = item.color;
      ctx.fillText(line, 0, y);
    });

    const height = lines.length * lineHeight;
    const left =
      item.align === "center" ? -widest / 2 : item.align === "right" ? -widest : 0;

    // Bounds are stored post-scale so handles and hit-testing line up with
    // what is actually on screen mid-animation.
    measured.set(item.id, {
      id: item.id,
      x: item.position.x + t.x + left * t.scale,
      y: item.position.y + t.y - (height / 2) * t.scale,
      w: widest * t.scale,
      h: height * t.scale,
    });

    ctx.letterSpacing = "0px";
    ctx.restore();

    if (selectedId === item.id) drawTextSelection(ctx, measured.get(item.id)!);
  }
}

/**
 * Drops bounds for captions that no longer exist, so stale boxes stop catching
 * clicks. This takes the *whole* list on purpose: drawTexts runs twice per
 * frame (once per layer), and pruning against a filtered list would throw away
 * the bounds of every caption sitting on the other layer.
 */
export function pruneTextBounds(texts: TextItem[]) {
  const live = new Set(texts.map((t) => t.id));
  for (const id of measured.keys()) if (!live.has(id)) measured.delete(id);
}

const PAD_X = 12;
const PAD_Y = 8;

/** Corner anchors double as resize handles, so they are drawn large enough to grab. */
export function textHandles(b: TextBounds) {
  const x0 = b.x - PAD_X;
  const y0 = b.y - PAD_Y;
  const x1 = b.x + b.w + PAD_X;
  const y1 = b.y + b.h + PAD_Y;
  return [
    { id: "nw" as const, x: x0, y: y0 },
    { id: "ne" as const, x: x1, y: y0 },
    { id: "se" as const, x: x1, y: y1 },
    { id: "sw" as const, x: x0, y: y1 },
  ];
}

function drawTextSelection(ctx: CanvasRenderingContext2D, b: TextBounds) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(b.x - PAD_X, b.y - PAD_Y, b.w + PAD_X * 2, b.h + PAD_Y * 2);

  ctx.setLineDash([]);
  ctx.fillStyle = "#38bdf8";
  for (const h of textHandles(b)) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Topmost text under a point given in scene-local coordinates. */
export function hitTestText(texts: TextItem[], x: number, y: number): string | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const b = measured.get(texts[i].id);
    if (!b) continue;
    if (
      x >= b.x - PAD_X &&
      x <= b.x + b.w + PAD_X &&
      y >= b.y - PAD_Y &&
      y <= b.y + b.h + PAD_Y
    ) {
      return texts[i].id;
    }
  }
  return null;
}

export type HandleId = "nw" | "ne" | "se" | "sw";

/** Which corner anchor, if any, is under a point. Radius is generous on purpose. */
export function hitTestTextHandle(
  id: string,
  x: number,
  y: number,
  tolerance: number,
): HandleId | null {
  const b = measured.get(id);
  if (!b) return null;
  for (const h of textHandles(b)) {
    if (Math.hypot(h.x - x, h.y - y) <= tolerance) return h.id;
  }
  return null;
}

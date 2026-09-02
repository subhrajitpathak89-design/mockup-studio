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

export function fontFor(item: TextItem, scale = 1): string {
  return `${item.weight} ${item.size * scale}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
}

export function drawTexts(
  ctx: CanvasRenderingContext2D,
  texts: TextItem[],
  selectedId: string | null,
) {
  for (const item of texts) {
    const lines = item.content.split("\n");
    const lineHeight = item.size * item.lineHeight;

    ctx.save();
    ctx.translate(item.position.x, item.position.y);
    ctx.rotate((item.rotation * Math.PI) / 180);

    ctx.font = fontFor(item);
    ctx.textBaseline = "middle";
    ctx.textAlign = item.align;
    ctx.globalAlpha = item.opacity;
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

    measured.set(item.id, {
      id: item.id,
      x: item.position.x + left,
      y: item.position.y - height / 2,
      w: widest,
      h: height,
    });

    if (selectedId === item.id) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(left - 10, -height / 2 - 6, widest + 20, height + 12);
    }

    ctx.letterSpacing = "0px";
    ctx.restore();
  }

  // Drop anything that was deleted so stale boxes stop catching clicks.
  const live = new Set(texts.map((t) => t.id));
  for (const id of measured.keys()) if (!live.has(id)) measured.delete(id);
}

/** Topmost text under a point given in scene-local coordinates. */
export function hitTestText(texts: TextItem[], x: number, y: number): string | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const b = measured.get(texts[i].id);
    if (!b) continue;
    if (x >= b.x - 10 && x <= b.x + b.w + 10 && y >= b.y - 6 && y <= b.y + b.h + 6) {
      return texts[i].id;
    }
  }
  return null;
}

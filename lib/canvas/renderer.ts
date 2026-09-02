import type { ResolvedScene } from "@/lib/animation/engine";
import type { Scene } from "@/types";
import {
  DEVICE_SPECS,
  drawDeviceFrame,
  drawDeviceOverlay,
  roundedRectPath,
  type DeviceSpec,
} from "./devices";
import { drawWarpedTexture, projectQuad, type Point } from "./transforms";

export interface RenderOptions {
  scene: Scene;
  resolved: ResolvedScene;
  width: number;
  height: number;
  /** Decoded screenshot. Decoding is done once and reused across frames. */
  image: CanvasImageSource | null;
  showGrid?: boolean;
  /** Higher mesh density for exports, lower for interactive editing. */
  quality?: "draft" | "final";
}

/**
 * Reusable offscreen canvas for the flat device texture. Allocating one per
 * frame is a common source of jank in a canvas editor, so we keep one around
 * and only resize it when the device changes.
 */
export class TextureBuffer {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  get(width: number, height: number) {
    if (!this.canvas) {
      this.canvas =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(width, height)
          : document.createElement("canvas");
    }
    const c = this.canvas as HTMLCanvasElement;
    if (c.width !== width || c.height !== height) {
      c.width = width;
      c.height = height;
      this.ctx = null;
    }
    if (!this.ctx) {
      this.ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    }
    this.ctx!.clearRect(0, 0, width, height);
    return { canvas: c as unknown as CanvasImageSource, ctx: this.ctx! };
  }
}

const sharedBuffer = new TextureBuffer();

export function renderScene(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
  buffer: TextureBuffer = sharedBuffer,
) {
  const { scene, resolved, width, height } = opts;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, scene, resolved, width, height);
  if (opts.showGrid) drawEditorGrid(ctx, width, height);

  const spec = DEVICE_SPECS[scene.device.type];

  // Camera: zoom and pan around the canvas centre.
  ctx.translate(width / 2, height / 2);
  ctx.scale(resolved.camera.zoom, resolved.camera.zoom);
  ctx.translate(resolved.camera.x, resolved.camera.y);
  ctx.translate(resolved.device.x, resolved.device.y);

  const fitScale = deviceFitScale(spec, width, height);
  const quad = projectQuad(
    spec.width,
    spec.height,
    resolved.device.rotX,
    resolved.device.rotY,
    resolved.device.rotZ,
    resolved.device.scale * fitScale,
  );

  ctx.globalAlpha = Math.max(0, Math.min(1, resolved.device.opacity));

  drawShadow(ctx, scene, quad);

  const { canvas: texture, ctx: tctx } = buffer.get(spec.width, spec.height);
  drawDeviceTexture(tctx, spec, scene, resolved, opts.image);

  const flat =
    Math.abs(resolved.device.rotX) < 0.01 &&
    Math.abs(resolved.device.rotY) < 0.01;

  if (flat) {
    // Fast path: a pure 2D rotate/scale needs no mesh warp.
    ctx.save();
    ctx.rotate((resolved.device.rotZ * Math.PI) / 180);
    const s = resolved.device.scale * fitScale;
    ctx.scale(s, s);
    ctx.drawImage(texture, -spec.width / 2, -spec.height / 2);
    ctx.restore();
  } else {
    drawWarpedTexture(
      ctx,
      texture,
      spec.width,
      spec.height,
      quad,
      opts.quality === "final" ? 24 : 12,
    );
  }

  drawLighting(ctx, scene, quad);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Scales the device so it sits comfortably inside the canvas by default. */
export function deviceFitScale(
  spec: DeviceSpec,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const margin = 0.72;
  return Math.min(
    (canvasWidth * margin) / spec.width,
    (canvasHeight * margin) / spec.height,
  );
}

/** The device outline in canvas pixel space, for hit-testing and handles. */
export function deviceQuad(
  scene: Scene,
  resolved: ResolvedScene,
  width: number,
  height: number,
): Point[] {
  const spec = DEVICE_SPECS[scene.device.type];
  const fitScale = deviceFitScale(spec, width, height);
  const quad = projectQuad(
    spec.width,
    spec.height,
    resolved.device.rotX,
    resolved.device.rotY,
    resolved.device.rotZ,
    resolved.device.scale * fitScale,
  );
  const z = resolved.camera.zoom;
  return quad.map((p) => ({
    x: width / 2 + (p.x + resolved.camera.x + resolved.device.x) * z,
    y: height / 2 + (p.y + resolved.camera.y + resolved.device.y) * z,
  }));
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  resolved: ResolvedScene,
  width: number,
  height: number,
) {
  const bg = scene.background;
  const off = resolved.backgroundOffset;

  if (bg.type === "solid") {
    ctx.fillStyle = bg.color1;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bg.type === "gradient") {
    const grad =
      bg.gradientKind === "radial"
        ? radialGradient(ctx, width, height, off)
        : linearGradient(ctx, width, height, bg.angle, off);
    grad.addColorStop(0, bg.color1);
    grad.addColorStop(1, bg.color2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.fillStyle = bg.color1;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = bg.gridOpacity;
  ctx.strokeStyle = bg.color2;
  ctx.lineWidth = Math.max(1, width / 1920);
  const size = Math.max(8, bg.gridSize);
  ctx.beginPath();
  for (let x = ((off % size) + size) % size; x < width; x += size) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += size) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function linearGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  angleDeg: number,
  offset: number,
) {
  const rad = (angleDeg * Math.PI) / 180;
  const cx = width / 2 + offset;
  const cy = height / 2;
  const len =
    (Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) / 2;
  return ctx.createLinearGradient(
    cx - Math.cos(rad) * len,
    cy - Math.sin(rad) * len,
    cx + Math.cos(rad) * len,
    cy + Math.sin(rad) * len,
  );
}

function radialGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number,
) {
  const cx = width / 2 + offset;
  const cy = height / 2;
  return ctx.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    Math.max(width, height) * 0.7,
  );
}

function drawEditorGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1, width / 1920);
  const step = width / 12;
  ctx.beginPath();
  for (let x = step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = step; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  quad: Point[],
) {
  const s = scene.shadow;
  if (s.opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha *= s.opacity;
  ctx.filter = `blur(${Math.max(0, s.blur)}px)`;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  quad.forEach((p, i) => {
    const x = p.x + s.offsetX;
    const y = p.y + s.offsetY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLighting(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  quad: Point[],
) {
  const l = scene.lighting;
  if (l.intensity <= 0) return;

  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const r = Math.max(maxX - minX, maxY - minY) / 2;
  const rad = (l.angle * Math.PI) / 180;

  ctx.save();
  ctx.beginPath();
  quad.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createLinearGradient(
    cx - Math.cos(rad) * r,
    cy - Math.sin(rad) * r,
    cx + Math.cos(rad) * r,
    cy + Math.sin(rad) * r,
  );
  // Softness widens the falloff so the highlight reads as a large source.
  const mid = 0.2 + l.softness * 0.5;
  grad.addColorStop(0, `rgba(255,255,255,${0.55 * l.intensity})`);
  grad.addColorStop(mid, "rgba(255,255,255,0)");
  grad.addColorStop(1, `rgba(0,0,0,${0.35 * l.intensity})`);

  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = grad;
  ctx.fillRect(minX - r, minY - r, maxX - minX + r * 2, maxY - minY + r * 2);
  ctx.restore();
}

function drawDeviceTexture(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
  scene: Scene,
  resolved: ResolvedScene,
  image: CanvasImageSource | null,
) {
  drawDeviceFrame(ctx, spec);

  const screen = scene.screen;
  const rect = spec.screen;
  const radius =
    screen.cornerRadius >= 0 ? screen.cornerRadius : spec.screenRadius;

  ctx.save();
  roundedRectPath(ctx, rect, radius);
  ctx.clip();

  // Placeholder so an empty device still reads as a device.
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (image) {
    const iw = screen.naturalWidth || 1;
    const ih = screen.naturalHeight || 1;
    const contain = Math.min(rect.w / iw, rect.h / ih);
    const cover = Math.max(rect.w / iw, rect.h / ih);
    const base = screen.fit === "cover" ? cover : contain;
    const s = base * screen.scale;

    const drawW = iw * s;
    const drawH = ih * s;

    const dx = rect.x + (rect.w - drawW) / 2 + screen.position.x * rect.h;
    let dy = rect.y + (rect.h - drawH) / 2 + screen.position.y * rect.h;

    const overflow = Math.max(0, drawH - rect.h);
    if (screen.scroll.enabled && overflow > 0) {
      // Scrolling pins the image to the top and travels down the overflow.
      dy = rect.y - resolved.screenScroll * overflow;
    }

    ctx.globalAlpha = screen.opacity;
    ctx.drawImage(image, dx, dy, drawW, drawH);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `600 ${Math.round(rect.w * 0.045)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Upload a screenshot",
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
    );
  }

  // Glass sheen across the screen.
  const sheen = ctx.createLinearGradient(
    rect.x,
    rect.y,
    rect.x + rect.w,
    rect.y + rect.h,
  );
  sheen.addColorStop(0, "rgba(255,255,255,0.08)");
  sheen.addColorStop(0.4, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.restore();

  drawDeviceOverlay(ctx, spec);
}

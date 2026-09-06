import type { ResolvedScene } from "@/lib/animation/engine";
import type { Scene } from "@/types";
import {
  resolveDeviceSpec,
  drawFrameArt,
  drawPhotoFrame,
  quadSize,
  roundedRectPath,
  type DeviceSpec,
} from "./devices";
import { drawOverlays, pruneOverlayBounds } from "./overlays";
import { drawWarpedTexture, projectQuad, type Point } from "./transforms";
import { getCachedImage } from "./imageCache";
import { midColor, renderShaderFrame } from "./shaders";
import { drawTexts, pruneTextBounds } from "./text";

export interface RenderOptions {
  scene: Scene;
  resolved: ResolvedScene;
  width: number;
  height: number;
  /** Decoded screenshot. Decoding is done once and reused across frames. */
  image: CanvasImageSource | null;
  showGrid?: boolean;
  /** Timeline position, for backgrounds that animate on their own. */
  time?: number;
  /** Id of the selected text item, drawn with a selection outline. */
  selectedTextId?: string | null;
  selectedOverlayId?: string | null;
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
    // The whole backing store rather than the requested rect. They are the
    // same today because the canvas is resized to match, but clearing what we
    // are about to hand to drawImage is the version that cannot rot.
    this.ctx!.clearRect(0, 0, c.width, c.height);
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

  drawBackground(ctx, scene, resolved, width, height, opts.time ?? 0);
  if (opts.showGrid) drawEditorGrid(ctx, width, height);

  const spec = resolveDeviceSpec(scene.device, scene.screen);

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

  const texts = scene.texts ?? [];
  const overlays = scene.overlays ?? [];
  pruneTextBounds(texts);
  pruneOverlayBounds(overlays);
  // Captions marked "behind" are painted before the device so the mockup
  // occludes them, exactly like a layer sitting underneath.
  if (
    texts.some((t) => t.layer === "behind") ||
    overlays.some((o) => o.layer === "behind")
  ) {
    ctx.save();
    ctx.translate(-resolved.device.x, -resolved.device.y);
    drawOverlays(
      ctx,
      overlays.filter((o) => o.layer === "behind"),
      opts.selectedOverlayId ?? null,
      resolved.texts,
    );
    drawTexts(
      ctx,
      texts.filter((t) => t.layer === "behind"),
      opts.selectedTextId ?? null,
      resolved.texts,
    );
    ctx.restore();
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, resolved.device.opacity));

  drawShadow(ctx, scene, quad, spec);

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
      meshSegments(resolved.device.rotX, resolved.device.rotY, opts.quality),
    );
  }

  drawLighting(ctx, scene, quad, spec);

  // Captions sit above the device and follow the camera, but not the device's
  // own offset or its animated opacity — so undo that translate first.
  ctx.globalAlpha = 1;
  ctx.translate(-resolved.device.x, -resolved.device.y);
  drawOverlays(
    ctx,
    overlays.filter((o) => o.layer !== "behind"),
    opts.selectedOverlayId ?? null,
    resolved.texts,
  );
  drawTexts(
    ctx,
    texts.filter((t) => t.layer !== "behind"),
    opts.selectedTextId ?? null,
    resolved.texts,
  );

  ctx.restore();
}

/** Scales the device so it sits comfortably inside the canvas by default. */
export function deviceFitScale(
  spec: DeviceSpec,
  canvasWidth: number,
  canvasHeight: number,
): number {
  // A photograph is the whole scene, not an object standing in one, so it
  // covers the canvas rather than floating inside it with a margin.
  if (spec.photo) {
    return Math.max(canvasWidth / spec.width, canvasHeight / spec.height);
  }
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
  const spec = resolveDeviceSpec(scene.device, scene.screen);
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
  time: number,
) {
  const bg = scene.background;
  const off = resolved.backgroundOffset;

  if (bg.type === "shader") {
    const frame = renderShaderFrame(
      bg.shaderId,
      width,
      height,
      time * bg.shaderSpeed,
      {
        colors: [bg.color1, midColor(bg.color1, bg.color2), bg.color2],
        amplitude: bg.shaderAmplitude,
        scale: bg.shaderScale,
      },
    );
    if (frame) {
      ctx.drawImage(frame, 0, 0, width, height);
      return;
    }
    // WebGL2 missing or the shader would not compile — a flat gradient beats
    // a black rectangle where the background should be.
  }

  if (bg.type === "image") {
    const photo = bg.imageUrl ? getCachedImage(bg.imageUrl) : null;
    if (photo) {
      drawCover(ctx, photo, width, height, off);
      if (bg.imageDim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${bg.imageDim})`;
        ctx.fillRect(0, 0, width, height);
      }
      return;
    }
    // Still downloading, or offline. The gradient below stands in, so the
    // scene never flashes empty while a photo is in flight.
  }

  if (bg.type === "solid") {
    ctx.fillStyle = bg.color1;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bg.type !== "grid") {
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

/** Fills the frame with an image, cropping the overflow rather than squashing. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  offset: number,
) {
  const iw = Number((image as HTMLImageElement).naturalWidth) || width;
  const ih = Number((image as HTMLImageElement).naturalHeight) || height;
  const scale = Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (width - dw) / 2 + offset, (height - dh) / 2, dw, dh);
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

/**
 * How finely to subdivide the perspective mesh.
 *
 * The mesh exists only to approximate perspective, and the error it corrects
 * grows with the tilt — so a gentle angle needs far fewer cells than a steep
 * one. That matters beyond speed: every cell boundary is a chance to show a
 * seam, so the cheapest mesh that still looks right is also the cleanest.
 */
function meshSegments(
  rotX: number,
  rotY: number,
  quality: RenderOptions["quality"],
): number {
  const tilt = Math.max(Math.abs(rotX), Math.abs(rotY));
  const needed = Math.ceil(tilt / 4);
  const cap = quality === "final" ? 24 : 14;
  return Math.min(cap, Math.max(2, needed));
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  quad: Point[],
  spec: DeviceSpec,
) {
  const s = scene.shadow;
  if (s.opacity <= 0) return;

  // A bitmap frame's silhouette is nothing like its bounding box — a laptop
  // lid is far narrower than the deck it sits on — so a box-shaped shadow
  // draws a visible rectangle out past the lid. Shadow the contact band under
  // the device instead, which is where a real one falls anyway.
  if (spec.photo) return;
  const cast = spec.art ? contactBand(quad) : quad;

  ctx.save();
  ctx.globalAlpha *= s.opacity;
  ctx.filter = `blur(${Math.max(0, s.blur)}px)`;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  cast.forEach((p, i) => {
    const x = p.x + s.offsetX;
    const y = p.y + s.offsetY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The lower slice of a device quad, pulled in at the sides — an approximation
 * of where a laptop actually touches the surface it stands on.
 */
function contactBand(quad: Point[]): Point[] {
  const [tl, tr, br, bl] = quad;
  const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const top = 0.74;
  const left = lerp(tl, bl, top);
  const right = lerp(tr, br, top);
  const pinch = 0.03;
  return [
    lerp(left, right, pinch),
    lerp(right, left, pinch),
    lerp(br, bl, pinch),
    lerp(bl, br, pinch),
  ];
}

function drawLighting(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  quad: Point[],
  spec: DeviceSpec,
) {
  const l = scene.lighting;
  if (l.intensity <= 0) return;
  // Artwork frames arrive with their own highlights already rendered, and our
  // pass is clipped to the bounding box — which on a laptop would light the
  // empty air either side of the lid.
  if (spec.photo || spec.art || spec.type === "none") return;

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

/** Screen content for a photographic frame, warped into its glass. */
const screenBuffer = new TextureBuffer();

function drawPhotoTexture(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
  scene: Scene,
  resolved: ResolvedScene,
  image: CanvasImageSource | null,
) {
  const photo = spec.photo!;
  // Without the photograph there is nothing to align to, so wait rather than
  // warping content onto an empty rectangle.
  if (!drawPhotoFrame(ctx, spec)) return;

  const size = quadSize(photo.quad);
  if (size.width < 2 || size.height < 2) return;

  const { canvas: content, ctx: cctx } = screenBuffer.get(size.width, size.height);
  const rect = { x: 0, y: 0, w: size.width, h: size.height };
  const radius =
    scene.screen.cornerRadius >= 0 ? scene.screen.cornerRadius : photo.radius;

  // Rounded here, in the flat buffer, so the corners carry through the warp
  // and follow the real glass instead of squaring off over the bezel.
  cctx.save();
  roundedRectPath(cctx, rect, radius);
  cctx.clip();
  paintScreenContent(cctx, rect, scene, resolved, image, spec);
  cctx.restore();

  drawWarpedTexture(
    ctx,
    content,
    size.width,
    size.height,
    photo.quad.map(([x, y]) => ({ x, y })) as [Point, Point, Point, Point],
    18,
  );
}

/**
 * The screenshot or recording, fitted into a screen rectangle. Shared because
 * a photographic frame paints it into a flat buffer before warping, while the
 * frameless and bitmap-art paths paint it straight into the device texture.
 */
function paintScreenContent(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  scene: Scene,
  resolved: ResolvedScene,
  image: CanvasImageSource | null,
  spec: DeviceSpec,
) {
  const screen = scene.screen;

  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (!image) {
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `600 ${Math.round(rect.w * 0.045)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Upload or record a screen",
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
    );
    return;
  }

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
    dy = rect.y - resolved.screenScroll * overflow;
  }

  ctx.globalAlpha = screen.opacity;
  ctx.drawImage(image, dx, dy, drawW, drawH);
  ctx.globalAlpha = 1;

  // A photograph already carries the room's reflections; adding our own would
  // double them up.
  if (spec.photo || spec.type === "none") return;

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
}

function drawDeviceTexture(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
  scene: Scene,
  resolved: ResolvedScene,
  image: CanvasImageSource | null,
) {
  if (spec.photo) {
    drawPhotoTexture(ctx, spec, scene, resolved, image);
    return;
  }

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
      "Upload or record a screen",
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
    );
  }

  // Glass sheen across the screen. A frameless screenshot has no glass over
  // it, so the highlight would just be a smear on the content.
  if (spec.type === "none") {
    ctx.restore();
    drawScreenBorder(ctx, spec, scene.screen);
    return;
  }

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

  drawScreenBorder(ctx, spec, scene.screen);
  drawFrameArt(ctx, spec);
}

/**
 * Stroked inside the screen's own rounded rect, and inside the device texture
 * so it warps and scales with everything else. Half the width is inset so the
 * whole stroke lands on the content rather than straddling the edge, where the
 * outer half would be clipped away.
 */
function drawScreenBorder(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
  screen: Scene["screen"],
) {
  const width = screen.borderWidth ?? 0;
  if (width <= 0) return;
  const rect = spec.screen;
  const radius =
    screen.cornerRadius >= 0 ? screen.cornerRadius : spec.screenRadius;
  const half = width / 2;
  ctx.save();
  ctx.strokeStyle = screen.borderColor || "rgba(255,255,255,0.16)";
  ctx.lineWidth = width;
  roundedRectPath(
    ctx,
    {
      x: rect.x + half,
      y: rect.y + half,
      w: Math.max(0, rect.w - width),
      h: Math.max(0, rect.h - width),
    },
    Math.max(0, radius - half),
  );
  ctx.stroke();
  ctx.restore();
}

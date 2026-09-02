import type { DeviceType } from "@/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Device geometry in "device units" — the natural pixel size of the frame at
 * scale 1. Frames are drawn procedurally, never from bitmap assets, so they
 * stay crisp at any export resolution.
 */
export interface DeviceSpec {
  type: DeviceType;
  label: string;
  /** Overall bounding box of the frame. */
  width: number;
  height: number;
  /** Outer body, may be inset inside the bounding box (laptop base sits below). */
  body: Rect;
  bodyRadius: number;
  /** Where the uploaded screenshot lives. */
  screen: Rect;
  screenRadius: number;
}

export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  iphone: {
    type: "iphone",
    label: "Phone",
    width: 430,
    height: 880,
    body: { x: 0, y: 0, w: 430, h: 880 },
    bodyRadius: 58,
    screen: { x: 14, y: 14, w: 402, h: 852 },
    screenRadius: 46,
  },
  android: {
    type: "android",
    label: "Android",
    width: 430,
    height: 900,
    body: { x: 0, y: 0, w: 430, h: 900 },
    bodyRadius: 44,
    screen: { x: 12, y: 12, w: 406, h: 876 },
    screenRadius: 34,
  },
  laptop: {
    type: "laptop",
    label: "Laptop",
    width: 1400,
    height: 872,
    body: { x: 60, y: 0, w: 1280, h: 812 },
    bodyRadius: 26,
    screen: { x: 82, y: 22, w: 1236, h: 768 },
    screenRadius: 6,
  },
  browser: {
    type: "browser",
    label: "Browser",
    width: 1440,
    height: 900,
    body: { x: 0, y: 0, w: 1440, h: 900 },
    bodyRadius: 18,
    screen: { x: 0, y: 48, w: 1440, h: 852 },
    screenRadius: 0,
  },
};

export const DEVICE_LIST = Object.values(DEVICE_SPECS);

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  { x, y, w, h }: Rect,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** Draws the frame chrome that sits *around* the screen. */
export function drawDeviceFrame(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
) {
  switch (spec.type) {
    case "iphone":
      drawPhoneBody(ctx, spec, "#1c1c1e", "#3a3a3c");
      break;
    case "android":
      drawPhoneBody(ctx, spec, "#141416", "#2f3033");
      break;
    case "laptop":
      drawLaptopBody(ctx, spec);
      break;
    case "browser":
      drawBrowserBody(ctx, spec);
      break;
  }
}

/** Chrome drawn *on top* of the screen (notches, camera cut-outs). */
export function drawDeviceOverlay(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
) {
  if (spec.type === "iphone") {
    ctx.fillStyle = "#000000";
    roundedRectPath(
      ctx,
      { x: spec.width / 2 - 62, y: 24, w: 124, h: 34 },
      17,
    );
    ctx.fill();
  }
  if (spec.type === "android") {
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(spec.width / 2, 42, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spec.type === "laptop") {
    // Base wedge below the lid.
    const baseY = spec.body.y + spec.body.h;
    const g = ctx.createLinearGradient(0, baseY, 0, spec.height);
    g.addColorStop(0, "#c9ccd2");
    g.addColorStop(1, "#8f949c");
    ctx.fillStyle = g;
    roundedRectPath(
      ctx,
      { x: 0, y: baseY, w: spec.width, h: spec.height - baseY },
      10,
    );
    ctx.fill();
    // Trackpad notch.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    roundedRectPath(
      ctx,
      { x: spec.width / 2 - 70, y: baseY, w: 140, h: 12 },
      6,
    );
    ctx.fill();
  }
}

function drawPhoneBody(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
  inner: string,
  edge: string,
) {
  const g = ctx.createLinearGradient(0, 0, spec.width, spec.height);
  g.addColorStop(0, edge);
  g.addColorStop(0.5, inner);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLaptopBody(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  const g = ctx.createLinearGradient(
    spec.body.x,
    0,
    spec.body.x + spec.body.w,
    spec.body.h,
  );
  g.addColorStop(0, "#2b2d31");
  g.addColorStop(0.5, "#161719");
  g.addColorStop(1, "#2b2d31");
  ctx.fillStyle = g;
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBrowserBody(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  ctx.fillStyle = "#22242a";
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  // Traffic lights.
  const colors = ["#ff5f57", "#febc2e", "#28c840"];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(28 + i * 26, 24, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // URL pill.
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundedRectPath(ctx, { x: 130, y: 12, w: spec.width - 260, h: 24 }, 12);
  ctx.fill();
}

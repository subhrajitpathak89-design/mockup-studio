import { getCachedImage } from "./imageCache";
import type { DeviceState, DeviceType, ScreenState } from "@/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Device geometry in "device units" — the natural pixel size of the frame at
 * scale 1.
 *
 * Frames are drawn procedurally rather than composited from bitmap mockups.
 * That is not a shortcut: a PNG frame is locked to one aspect, so it could not
 * reshape around a recording (see `resolveDeviceSpec`), and it would soften at
 * a 4K export. Drawing them means the bezels stay sharp at any size and any
 * shape — at the cost of every highlight having to be built by hand below.
 */
export interface DeviceSpec {
  type: DeviceType;
  label: string;
  /** Overall bounding box of the frame. */
  width: number;
  height: number;
  /** Outer body. Insets leave room for side buttons, stands and laptop bases. */
  body: Rect;
  bodyRadius: number;
  /** Where the screen content lives. */
  screen: Rect;
  screenRadius: number;
  /**
   * A bitmap frame, drawn *over* the screen. Only for artwork whose screen is
   * a transparent hole — the content is painted first and the art covers
   * everything around it, which is why no separate mask is needed.
   *
   * A frame with art cannot reshape (see `resolveDeviceSpec`): the pixels are
   * one aspect and no amount of maths changes that.
   */
  art?: {
    src: string;
    /** Source crop, so transparent margins in the file cost nothing. */
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  };
}

export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  /**
   * The frameless case: body and screen are the same rectangle, so every
   * chrome switch below falls through and draws nothing. It still travels the
   * whole device pipeline — transform, 3D warp, shadow — because a bare
   * screenshot wants exactly those and nothing else.
   */
  none: {
    type: "none",
    label: "Screenshot",
    width: 1280,
    height: 800,
    body: { x: 0, y: 0, w: 1280, h: 800 },
    bodyRadius: 24,
    screen: { x: 0, y: 0, w: 1280, h: 800 },
    screenRadius: 24,
  },
  iphone: {
    type: "iphone",
    label: "Phone",
    width: 450,
    height: 880,
    // Inset 10 each side so the side buttons have somewhere to sit.
    body: { x: 10, y: 0, w: 430, h: 880 },
    bodyRadius: 62,
    screen: { x: 24, y: 14, w: 402, h: 852 },
    screenRadius: 50,
  },
  android: {
    type: "android",
    label: "Android",
    width: 450,
    height: 900,
    body: { x: 10, y: 0, w: 430, h: 900 },
    bodyRadius: 46,
    screen: { x: 24, y: 14, w: 402, h: 872 },
    screenRadius: 36,
  },
  tablet: {
    type: "tablet",
    label: "Tablet",
    width: 900,
    height: 1220,
    body: { x: 0, y: 0, w: 900, h: 1220 },
    bodyRadius: 44,
    screen: { x: 28, y: 28, w: 844, h: 1164 },
    screenRadius: 22,
  },
  laptop: {
    type: "laptop",
    label: "Laptop",
    width: 1452,
    height: 856,
    // The lid sits inset: the base below it is about a quarter wider, which is
    // most of what makes a laptop read as a laptop rather than a monitor.
    body: { x: 138, y: 0, w: 1176, h: 780 },
    bodyRadius: 18,
    screen: { x: 163, y: 23, w: 1126, h: 732 },
    screenRadius: 6,
  },
  macbook: {
    type: "macbook",
    label: "MacBook",
    // Measured off the artwork: the opaque bounds of the device, and the
    // transparent rectangle that is its screen.
    width: 1431,
    height: 835,
    body: { x: 0, y: 0, w: 1431, h: 835 },
    bodyRadius: 18,
    screen: { x: 152, y: 49, w: 1127, h: 691 },
    screenRadius: 4,
    art: { src: "/frames/macbook.png", sx: 53, sy: 95, sw: 1431, sh: 835 },
  },
  monitor: {
    type: "monitor",
    label: "Monitor",
    width: 1560,
    height: 1180,
    body: { x: 60, y: 0, w: 1440, h: 920 },
    bodyRadius: 20,
    // The deep bottom bezel is the chin an all-in-one display sits on.
    screen: { x: 78, y: 18, w: 1404, h: 826 },
    screenRadius: 6,
  },
  browser: {
    type: "browser",
    label: "Browser",
    width: 1460,
    height: 920,
    body: { x: 0, y: 0, w: 1460, h: 920 },
    bodyRadius: 16,
    screen: { x: 0, y: 56, w: 1460, h: 864 },
    screenRadius: 0,
  },
};

export const DEVICE_LIST = Object.values(DEVICE_SPECS);

/** Aspect of whatever is playing inside the device, or null when it is empty. */
export function sourceAspect(screen: ScreenState): number | null {
  if (!screen.naturalWidth || !screen.naturalHeight) return null;
  return screen.naturalWidth / screen.naturalHeight;
}

/**
 * The frame the scene should actually draw.
 *
 * Frames ship with a fixed screen aspect, which is fine for a screenshot you
 * cropped yourself and wrong for a recording: capture a 16:10 laptop, a 16:9
 * monitor or a 21:9 ultrawide and each arrives a different shape. Cropping to
 * fit throws away the edges of a demo — usually the toolbars and controls the
 * demo is about.
 *
 * So the frame bends instead. Bezels, the laptop base and the browser chrome
 * keep their thickness; only the screen changes shape, and the body is rebuilt
 * around it. Screen *area* is preserved rather than width, so a tall capture
 * and a wide one carry the same visual weight on the canvas instead of one
 * of them suddenly dominating.
 */
export function resolveDeviceSpec(
  device: DeviceState,
  screen: ScreenState,
): DeviceSpec {
  const base = DEVICE_SPECS[device.type] ?? DEVICE_SPECS.browser;
  // Bitmap artwork is one shape and cannot be rebuilt around the media.
  // A frameless screenshot always takes the media's shape: there is no frame
  // to preserve, so cropping to a stock rectangle would only lose pixels.
  if (base.art) return base;
  if (!device.fitToSource && base.type !== "none") return base;

  const aspect = sourceAspect(screen);
  if (!aspect || !Number.isFinite(aspect)) return base;

  // Already the right shape — leave the hand-tuned geometry alone.
  const baseAspect = base.screen.w / base.screen.h;
  if (Math.abs(aspect - baseAspect) < 0.01) return base;

  const area = base.screen.w * base.screen.h;
  const screenW = Math.round(Math.sqrt(area * aspect));
  const screenH = Math.round(screenW / aspect);

  const left = base.screen.x - base.body.x;
  const right = base.body.x + base.body.w - (base.screen.x + base.screen.w);
  const top = base.screen.y - base.body.y;
  const bottom = base.body.y + base.body.h - (base.screen.y + base.screen.h);
  const outerX = base.body.x;
  const outerRight = base.width - (base.body.x + base.body.w);
  const outerY = base.body.y;
  const outerBottom = base.height - (base.body.y + base.body.h);

  const bodyW = screenW + left + right;
  const bodyH = screenH + top + bottom;

  return {
    ...base,
    width: bodyW + outerX + outerRight,
    height: bodyH + outerY + outerBottom,
    body: { x: outerX, y: outerY, w: bodyW, h: bodyH },
    screen: { x: outerX + left, y: outerY + top, w: screenW, h: screenH },
  };
}

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

function inset({ x, y, w, h }: Rect, by: number): Rect {
  return { x: x + by, y: y + by, w: w - by * 2, h: h - by * 2 };
}

/**
 * A brushed-metal edge.
 *
 * What sells a machined case is not the base colour but the specular bands
 * running down it, so the gradient deliberately alternates light and dark
 * rather than sweeping evenly.
 */
function metalGradient(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  stops: string[],
) {
  const g = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

const TITANIUM = [
  "#5b5f66",
  "#c9ced6",
  "#7d828a",
  "#4a4e55",
  "#8f949c",
  "#d3d8e0",
  "#5b5f66",
];

const GRAPHITE = [
  "#2a2c30",
  "#6b7079",
  "#33363b",
  "#1d1f22",
  "#3b3e44",
  "#767b84",
  "#2a2c30",
];

const ALUMINIUM = [
  "#8e949d",
  "#d8dde4",
  "#a9aeb6",
  "#878d95",
  "#b6bbc3",
  "#e2e6ec",
  "#9aa0a8",
];

/** Draws the frame chrome that sits *around* the screen. */
export function drawDeviceFrame(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
) {
  switch (spec.type) {
    case "iphone":
      drawPhoneBody(ctx, spec, TITANIUM);
      break;
    case "android":
      drawPhoneBody(ctx, spec, GRAPHITE);
      break;
    case "tablet":
      drawTabletBody(ctx, spec);
      break;
    case "laptop":
      drawLaptopLid(ctx, spec);
      break;
    case "macbook":
      // Nothing behind: the art covers everything but the screen hole.
      break;
    case "monitor":
      drawMonitorBody(ctx, spec);
      break;
    case "browser":
      drawBrowserBody(ctx, spec);
      break;
  }
}

/** Chrome drawn *on top* of the screen — islands, cameras, stands, bases. */
export function drawDeviceOverlay(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
) {
  switch (spec.type) {
    case "iphone":
      drawDynamicIsland(ctx, spec);
      break;
    case "android":
      drawPunchHole(ctx, spec);
      break;
    case "tablet":
      drawTabletCamera(ctx, spec);
      break;
    case "laptop":
      drawLaptopNotch(ctx, spec);
      drawLaptopBase(ctx, spec);
      break;
    case "macbook":
      drawDeviceArt(ctx, spec);
      break;
    case "monitor":
      drawMonitorStand(ctx, spec);
      break;
    case "browser":
      break;
  }
}

/* ------------------------------------------------------------------ phones */

function drawSideButtons(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  const { body } = spec;
  const depth = 7;
  const r = 3;
  // Drawn before the body so the case edge overlaps them, which is what makes
  // them read as machined into the side rather than stuck on.
  const buttons: Rect[] = [
    { x: body.x - depth, y: body.y + body.h * 0.17, w: depth + 4, h: body.h * 0.045 },
    { x: body.x - depth, y: body.y + body.h * 0.25, w: depth + 4, h: body.h * 0.075 },
    { x: body.x - depth, y: body.y + body.h * 0.35, w: depth + 4, h: body.h * 0.075 },
    {
      x: body.x + body.w - 4,
      y: body.y + body.h * 0.28,
      w: depth + 4,
      h: body.h * 0.11,
    },
  ];
  for (const b of buttons) {
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, "#9aa0a8");
    g.addColorStop(0.5, "#5c6068");
    g.addColorStop(1, "#8b9098");
    ctx.fillStyle = g;
    roundedRectPath(ctx, b, r);
    ctx.fill();
  }
}

function drawPhoneBody(
  ctx: CanvasRenderingContext2D,
  spec: DeviceSpec,
  palette: string[],
) {
  drawSideButtons(ctx, spec);

  // Machined outer band.
  ctx.fillStyle = metalGradient(ctx, spec.body, palette);
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  // Black glass sitting inside the band, slightly proud of the screen.
  const glass = inset(spec.body, 5);
  ctx.fillStyle = "#08080a";
  roundedRectPath(ctx, glass, spec.bodyRadius - 5);
  ctx.fill();

  // A hairline catches the light along the very top of the band.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, inset(spec.body, 0.75), spec.bodyRadius);
  ctx.stroke();
}

function drawDynamicIsland(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  const w = Math.min(126, spec.screen.w * 0.31);
  const h = 35;
  ctx.fillStyle = "#000000";
  roundedRectPath(
    ctx,
    { x: spec.screen.x + (spec.screen.w - w) / 2, y: spec.screen.y + 13, w, h },
    h / 2,
  );
  ctx.fill();

  // The lens is a barely-there ring, not a dot.
  ctx.fillStyle = "rgba(40,52,70,0.85)";
  ctx.beginPath();
  ctx.arc(
    spec.screen.x + (spec.screen.w + w) / 2 - 18,
    spec.screen.y + 13 + h / 2,
    7,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawPunchHole(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(spec.screen.x + spec.screen.w / 2, spec.screen.y + 30, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(40,52,70,0.9)";
  ctx.beginPath();
  ctx.arc(spec.screen.x + spec.screen.w / 2, spec.screen.y + 30, 7, 0, Math.PI * 2);
  ctx.fill();
}

/* ----------------------------------------------------------------- tablet */

function drawTabletBody(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  ctx.fillStyle = metalGradient(ctx, spec.body, ALUMINIUM);
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  const glass = inset(spec.body, 6);
  ctx.fillStyle = "#08080a";
  roundedRectPath(ctx, glass, spec.bodyRadius - 6);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, inset(spec.body, 0.75), spec.bodyRadius);
  ctx.stroke();
}

function drawTabletCamera(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  // Sits in the bezel above the screen, which is where a tablet's camera is —
  // landscape or portrait, it follows the short bezel.
  ctx.fillStyle = "rgba(30,36,48,0.95)";
  ctx.beginPath();
  ctx.arc(spec.screen.x + spec.screen.w / 2, spec.body.y + 15, 6, 0, Math.PI * 2);
  ctx.fill();
}

/* ----------------------------------------------------------------- laptop */

function drawLaptopLid(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  // Aluminium rim, a hair proud of the lid on every side.
  ctx.fillStyle = metalGradient(ctx, spec.body, [
    "#8b9199",
    "#c8ced6",
    "#9aa0a8",
    "#7d838b",
    "#a9aeb6",
    "#cfd4db",
    "#8b9199",
  ]);
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  // The lid face itself is near-black and takes up nearly the whole panel —
  // the bezel you see is this, not a separate part.
  ctx.fillStyle = "#0d0e10";
  roundedRectPath(ctx, inset(spec.body, 3.5), spec.bodyRadius - 3);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 1.25;
  roundedRectPath(ctx, inset(spec.body, 0.6), spec.bodyRadius);
  ctx.stroke();
}

/**
 * The camera notch, drawn over the screen.
 *
 * Square at the top where it meets the bezel and rounded only at the bottom,
 * which is the detail that stops it reading as a floating black pill.
 */
function drawLaptopNotch(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  const w = Math.min(150, spec.screen.w * 0.125);
  const h = Math.min(30, spec.screen.h * 0.042);
  const x = spec.screen.x + (spec.screen.w - w) / 2;
  const y = spec.screen.y;
  const r = Math.min(9, h / 2);

  ctx.fillStyle = "#0d0e10";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(52,64,84,0.9)";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, Math.max(2, h * 0.11), 0, Math.PI * 2);
  ctx.fill();
}

function drawLaptopBase(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  const top = spec.body.y + spec.body.h;
  const baseH = spec.height - top;
  if (baseH <= 0) return;

  // A dark seam where the lid disappears into the deck.
  ctx.fillStyle = "#0b0c0e";
  ctx.fillRect(spec.body.x + 16, top - 3, spec.body.w - 32, 5);

  // A shallow slab, tapering very slightly toward the front. The old version
  // was a deep wedge, which read as a stand rather than a keyboard deck.
  const taper = spec.width * 0.012;
  const r = Math.min(12, baseH * 0.42);
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(spec.width, top);
  ctx.lineTo(spec.width - taper, spec.height - r);
  ctx.arcTo(
    spec.width - taper,
    spec.height,
    spec.width - taper - r,
    spec.height,
    r,
  );
  ctx.lineTo(taper + r, spec.height);
  ctx.arcTo(taper, spec.height, taper, spec.height - r, r);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, top, 0, spec.height);
  g.addColorStop(0, "#e2e6eb");
  g.addColorStop(0.28, "#c6ccd3");
  g.addColorStop(0.72, "#a4aab2");
  g.addColorStop(1, "#7f858d");
  ctx.fillStyle = g;
  ctx.fill();

  // The thumb recess sits at the *back* of the deck, against the lid — not on
  // the front lip, which is where this used to draw it.
  const notchW = spec.width * 0.17;
  const notchH = baseH * 0.3;
  const nx = spec.width / 2 - notchW / 2;
  const nr = notchH / 2;
  ctx.beginPath();
  ctx.moveTo(nx, top);
  ctx.lineTo(nx + notchW, top);
  ctx.lineTo(nx + notchW, top + notchH - nr);
  ctx.arcTo(nx + notchW, top + notchH, nx + notchW - nr, top + notchH, nr);
  ctx.lineTo(nx + nr, top + notchH);
  ctx.arcTo(nx, top + notchH, nx, top + notchH - nr, nr);
  ctx.closePath();
  const ng = ctx.createLinearGradient(0, top, 0, top + notchH);
  ng.addColorStop(0, "#9aa0a8");
  ng.addColorStop(1, "#d3d8de");
  ctx.fillStyle = ng;
  ctx.fill();

  // Catch-light along the top edge of the deck.
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(2, top + 1);
  ctx.lineTo(spec.width - 2, top + 1);
  ctx.stroke();
}

/* ------------------------------------------------------------ bitmap art */

/**
 * Paints a bitmap frame over the screen.
 *
 * Silent when the artwork has not loaded yet — the screen content is already
 * on the canvas, so a missing frame shows an unframed screenshot for a moment
 * rather than a hole in the scene.
 */
function drawDeviceArt(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  if (!spec.art) return;
  const art = getCachedImage(spec.art.src);
  if (!art) return;
  ctx.drawImage(
    art,
    spec.art.sx,
    spec.art.sy,
    spec.art.sw,
    spec.art.sh,
    0,
    0,
    spec.width,
    spec.height,
  );
}

/* ---------------------------------------------------------------- monitor */

function drawMonitorBody(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  ctx.fillStyle = metalGradient(ctx, spec.body, ALUMINIUM);
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  // Glass panel covering screen and chin in one sheet.
  ctx.fillStyle = "#0b0b0d";
  roundedRectPath(ctx, inset(spec.body, 8), spec.bodyRadius - 5);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, inset(spec.body, 0.75), spec.bodyRadius);
  ctx.stroke();
}

function drawMonitorStand(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  const bodyBottom = spec.body.y + spec.body.h;
  const standH = spec.height - bodyBottom;
  if (standH <= 0) return;

  const cx = spec.width / 2;
  const neckW = spec.width * 0.14;
  const neckH = standH * 0.62;

  const neck = ctx.createLinearGradient(cx - neckW / 2, 0, cx + neckW / 2, 0);
  neck.addColorStop(0, "#7e848c");
  neck.addColorStop(0.35, "#cfd4db");
  neck.addColorStop(0.7, "#9aa0a8");
  neck.addColorStop(1, "#6e747c");
  ctx.fillStyle = neck;
  ctx.fillRect(cx - neckW / 2, bodyBottom, neckW, neckH);

  // Foot, seen close to edge-on.
  const footW = spec.width * 0.38;
  const footH = standH * 0.22;
  const foot = ctx.createLinearGradient(0, bodyBottom + neckH, 0, spec.height);
  foot.addColorStop(0, "#c3c9d1");
  foot.addColorStop(1, "#7b818a");
  ctx.fillStyle = foot;
  roundedRectPath(
    ctx,
    { x: cx - footW / 2, y: bodyBottom + neckH, w: footW, h: footH },
    footH / 2,
  );
  ctx.fill();
}

/* ---------------------------------------------------------------- browser */

function drawBrowserBody(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  ctx.fillStyle = "#0f1115";
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.fill();

  const barH = spec.screen.y - spec.body.y;
  if (barH <= 0) return;

  ctx.save();
  roundedRectPath(ctx, spec.body, spec.bodyRadius);
  ctx.clip();

  const bar = ctx.createLinearGradient(0, spec.body.y, 0, spec.body.y + barH);
  bar.addColorStop(0, "#2c3038");
  bar.addColorStop(1, "#22252b");
  ctx.fillStyle = bar;
  ctx.fillRect(spec.body.x, spec.body.y, spec.body.w, barH);

  const midY = spec.body.y + barH / 2;

  // Traffic lights.
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(spec.body.x + 30 + i * 24, midY, 7.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // An active tab, so the bar reads as a browser and not just a title bar.
  const tabW = Math.min(230, spec.body.w * 0.2);
  const tabX = spec.body.x + 112;
  ctx.fillStyle = "#3a3f48";
  roundedRectPath(ctx, { x: tabX, y: spec.body.y + 10, w: tabW, h: barH - 10 }, 9);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundedRectPath(
    ctx,
    { x: tabX + 16, y: midY - 3.5, w: tabW * 0.55, h: 7 },
    3.5,
  );
  ctx.fill();

  // Address pill.
  const pillX = tabX + tabW + 26;
  const pillW = Math.max(80, spec.body.w - pillX - 70);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  roundedRectPath(ctx, { x: pillX, y: midY - 12, w: pillW, h: 24 }, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundedRectPath(ctx, { x: pillX + 14, y: midY - 3, w: pillW * 0.3, h: 6 }, 3);
  ctx.fill();

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, inset(spec.body, 0.75), spec.bodyRadius);
  ctx.stroke();
}

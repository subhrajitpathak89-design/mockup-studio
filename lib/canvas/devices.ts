import { getCachedImage } from "./imageCache";
import { FRAME_QUADS } from "./frameQuads.generated";
import type { DeviceState, DeviceType, ScreenState } from "@/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Point = [number, number];

/**
 * A frame the screen content goes into.
 *
 * Frames are photographs now, not drawn geometry. A photograph brings its own
 * lighting, surface and hands, which is a quality of finish that procedural
 * bezels never reached — at the cost of being one fixed shape and one fixed
 * camera angle, which is why `fitToSource` and 3D rotation do not apply to it.
 */
export interface DeviceSpec {
  type: DeviceType;
  label: string;
  /** The picker groups frames by the kind of device they show. */
  group: string;
  /** Natural pixel size of the artwork. */
  width: number;
  height: number;
  /** Axis-aligned bounds of the screen — used for aspect and fallbacks. */
  screen: Rect;
  screenRadius: number;
  /**
   * A photographic frame: the picture, and the screen's four corners inside
   * it. The corners are a quadrilateral rather than a rectangle because most
   * of these shots are taken at an angle, so the screen carries perspective.
   *
   * Painted first, with the content warped into the quad on top — the reverse
   * of the transparent-hole approach, and the only order that works when the
   * screen in the photograph is opaque white.
   */
  photo?: {
    src: string;
    quad: [Point, Point, Point, Point];
    /** Corner rounding of the glass, in artwork pixels. */
    radius: number;
  };
  /**
   * Bitmap artwork whose screen is a transparent hole. The content is painted
   * first and the art covers everything around it, so no mask is needed.
   */
  art?: {
    src: string;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  };
}

/** Builds a photographic spec from the detected quad. */
function photoFrame(
  type: DeviceType,
  label: string,
  group: string,
  file: string,
  radius: number,
): DeviceSpec {
  const found = FRAME_QUADS[file];
  if (!found) throw new Error(`No detected screen for ${file} — run npm run frames`);
  const quad = found.quad as [Point, Point, Point, Point];
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    type,
    label,
    group,
    width: found.width,
    height: found.height,
    screen: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
    screenRadius: radius,
    photo: { src: `/frames/${file}`, quad, radius },
  };
}

export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  /**
   * No frame at all — the screenshot itself is the object. It still travels
   * the whole pipeline, because a bare screenshot wants exactly the transform,
   * shadow and background that a framed one does.
   */
  none: {
    type: "none",
    label: "Screenshot",
    group: "Plain",
    width: 1280,
    height: 800,
    screen: { x: 0, y: 0, w: 1280, h: 800 },
    screenRadius: 24,
  },

  "phone-in-hand": photoFrame(
    "phone-in-hand",
    "In hand",
    "Phone",
    "phone-in-hand.png",
    38,
  ),
  "phone-held-out": photoFrame(
    "phone-held-out",
    "Held out",
    "Phone",
    "phone-held-out.png",
    40,
  ),
  "tablet-held": photoFrame(
    "tablet-held",
    "Held",
    "Tablet",
    "tablet-held.png",
    22,
  ),
  "monitor-desk": photoFrame(
    "monitor-desk",
    "At a desk",
    "Monitor",
    "monitor-desk.png",
    4,
  ),
  "monitor-shelf": photoFrame(
    "monitor-shelf",
    "On a shelf",
    "Monitor",
    "monitor-shelf.png",
    4,
  ),
  "monitor-angled": photoFrame(
    "monitor-angled",
    "Angled",
    "Monitor",
    "monitor-angled.png",
    4,
  ),

  macbook: {
    type: "macbook",
    label: "MacBook",
    group: "Laptop",
    // Measured off the artwork: the opaque bounds of the device, and the
    // transparent rectangle that is its screen.
    width: 1431,
    height: 835,
    screen: { x: 152, y: 49, w: 1127, h: 691 },
    screenRadius: 4,
    art: { src: "/frames/macbook.png", sx: 53, sy: 95, sw: 1431, sh: 835 },
  },
};

export const DEVICE_LIST = Object.values(DEVICE_SPECS);

/** Frames grouped for the picker, in the order they should appear. */
export const DEVICE_GROUPS: { group: string; specs: DeviceSpec[] }[] = [
  "Phone",
  "Tablet",
  "Laptop",
  "Monitor",
  "Plain",
].map((group) => ({
  group,
  specs: DEVICE_LIST.filter((s) => s.group === group),
}));

/** Aspect of whatever is going on the screen, if anything is. */
export function sourceAspect(screen: ScreenState): number | null {
  if (!screen.source || !screen.naturalWidth || !screen.naturalHeight) return null;
  return screen.naturalWidth / screen.naturalHeight;
}

/**
 * A photograph is one shape and one camera angle, so unlike the drawn frames
 * it once replaced, nothing here reshapes around the media. Only the frameless
 * case still takes the media's own shape.
 */
export function resolveDeviceSpec(
  device: DeviceState,
  screen: ScreenState,
): DeviceSpec {
  const base = DEVICE_SPECS[device.type] ?? DEVICE_SPECS["monitor-desk"];
  if (base.type !== "none") return base;

  const aspect = sourceAspect(screen);
  if (!aspect || !Number.isFinite(aspect)) return base;

  const area = base.screen.w * base.screen.h;
  const w = Math.round(Math.sqrt(area * aspect));
  const h = Math.round(w / aspect);
  return {
    ...base,
    width: w,
    height: h,
    screen: { x: 0, y: 0, w, h },
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

/** The photograph itself, under the screen content. */
export function drawPhotoFrame(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
  if (!spec.photo) return false;
  const img = getCachedImage(spec.photo.src);
  if (!img) return false;
  ctx.drawImage(img, 0, 0, spec.width, spec.height);
  return true;
}

/** Bitmap artwork with a transparent screen, drawn over the content. */
export function drawFrameArt(ctx: CanvasRenderingContext2D, spec: DeviceSpec) {
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

/** Average edge lengths of the screen quad, for sizing the content buffer. */
export function quadSize(quad: [Point, Point, Point, Point]) {
  const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return {
    width: Math.round((dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2),
    height: Math.round((dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2),
  };
}

/**
 * The bitmap a frame needs before it can be painted, whichever kind it is.
 * Callers preload this; forgetting it leaves a photographic frame invisible,
 * because there is nothing else to draw in its place.
 */
export function frameImageSrc(spec: DeviceSpec | undefined): string {
  return spec?.photo?.src ?? spec?.art?.src ?? "";
}

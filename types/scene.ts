export type DeviceType =
  /** No frame at all — the screenshot itself is the object. */
  | "none"
  | "iphone"
  | "android"
  | "tablet"
  | "laptop"
  | "macbook"
  | "monitor"
  | "browser";
export type ScreenFit = "contain" | "cover";
export type BackgroundType =
  | "solid"
  | "gradient"
  | "grid"
  | "shader"
  | "image";
export type GradientKind = "linear" | "radial";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DeviceState {
  type: DeviceType;
  /**
   * Reshape the frame around whatever is inside it, rather than cropping the
   * media to the frame's built-in aspect. On by default for recordings, whose
   * shape depends on the screen they were captured from.
   */
  fitToSource: boolean;
  /** Offset from canvas centre, in canvas pixels. */
  position: Vec2;
  scale: number;
  /** Degrees. */
  rotation: Vec3;
}

export type ScreenKind = "image" | "video";

export interface ScreenState {
  /**
   * What is playing inside the device. An image is a data URL and travels
   * inside the saved project; a recording is an object URL rebuilt on load
   * from the blob named by `recordingId`, because object URLs do not survive
   * a reload and a video is far too large to inline as a data URL.
   */
  kind: ScreenKind;
  /** Object URL or data URL of the screen content. Empty when none. */
  source: string;
  /** Key into the recordings store. Only set when `kind` is "video". */
  recordingId?: string;
  /** Natural pixel size of the image or video. */
  naturalWidth: number;
  naturalHeight: number;
  /** Full length of the recording, in seconds. Zero for images. */
  mediaDuration: number;
  /** Non-destructive trim, in source seconds. `trimOut` 0 means "to the end". */
  trimIn: number;
  trimOut: number;
  /** Silences the recording in preview and export. */
  muted: boolean;
  fit: ScreenFit;
  scale: number;
  /** Offset within the screen viewport, normalised to viewport height. */
  position: Vec2;
  cornerRadius: number;
  /**
   * A stroke around the screen content. Reads as a hairline highlight on a
   * frameless screenshot, which is what separates it from the background
   * when both are dark. Zero hides it.
   */
  borderWidth: number;
  borderColor: string;
  opacity: number;
  /** Vertical auto-scroll of tall screenshots inside the device viewport. */
  scroll: ScrollState;
}

export interface ScrollState {
  enabled: boolean;
  /** 0..1 — fraction of the overflowing height to travel. */
  amount: number;
  duration: number;
  delay: number;
  easing: EasingName;
}

export interface BackgroundState {
  type: BackgroundType;
  color1: string;
  color2: string;
  angle: number;
  gradientKind: GradientKind;
  gridSize: number;
  gridOpacity: number;
  /** Which GPU shader to run when `type` is "shader". */
  shaderId: string;
  /** Multiplies scene time before it reaches the shader. */
  shaderSpeed: number;
  shaderAmplitude: number;
  shaderScale: number;
  /** Backdrop photo URL when `type` is "image". */
  imageUrl: string;
  /** 0..1 — darkens the photo so a device still reads against it. */
  imageDim: number;
}

export interface ShadowState {
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface LightingState {
  intensity: number;
  /** Degrees — direction the key light comes from. */
  angle: number;
  softness: number;
}

export interface CameraState {
  position: Vec2;
  zoom: number;
}

export interface Scene {
  device: DeviceState;
  overlays: OverlayItem[];
  screen: ScreenState;
  background: BackgroundState;
  shadow: ShadowState;
  lighting: LightingState;
  camera: CameraState;
  texts: TextItem[];
  animations: Animation[];
}

export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "smooth"
  | "spring";

export type AnimatableProperty =
  | "device.position.x"
  | "device.position.y"
  | "device.scale"
  | "device.rotation.x"
  | "device.rotation.y"
  | "device.rotation.z"
  | "device.opacity"
  | "camera.position.x"
  | "camera.position.y"
  | "camera.zoom"
  | "background.offset"
  | "text.opacity"
  | "text.position.x"
  | "text.position.y"
  | "text.scale";

export type TrackId = "device" | "screen" | "overlay" | "text" | "camera";

export interface Animation {
  id: string;
  /** Text item this clip drives. Unset for device/camera clips. */
  targetId?: string;
  /** Preset this clip came from, for labelling. */
  presetId: string;
  label: string;
  track: TrackId;
  property: AnimatableProperty;
  from: number;
  to: number;
  delay: number;
  duration: number;
  easing: EasingName;
  /** Ping-pong forever within the timeline (used by Float). */
  loop: boolean;
}

/**
 * An image sitting on the scene rather than inside the device — a logo, a
 * badge, a cut-out. Animatable through the same properties as a caption, so
 * every text preset applies to one unchanged.
 */
export interface OverlayItem {
  id: string;
  name: string;
  /** Data URL, so an overlay travels inside the saved project. */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Drawn width in canvas units; height follows the aspect. */
  width: number;
  /** Offset from canvas centre, in canvas pixels. */
  position: Vec2;
  scale: number;
  /** Degrees. */
  rotation: number;
  opacity: number;
  blendMode: BlendMode;
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetY: number;
  /** Whether the overlay sits in front of the device or behind it. */
  layer: "front" | "behind";
}

export type TextAlign = "left" | "center" | "right";

/**
 * Canvas2D composite operations, which are the same set CSS calls blend modes.
 * "normal" maps to source-over rather than being passed through.
 */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";
export type TextWeight = 400 | 500 | 600 | 700 | 800;

/**
 * A caption placed in the scene. Text lives in canvas space next to the
 * device, moves with the camera, and is rendered by the same pass as
 * everything else so it appears in preview and export unchanged.
 */
export interface TextItem {
  id: string;
  content: string;
  fontId: string;
  /** Whether the caption sits in front of the device or behind it. */
  layer: "front" | "behind";
  /** Offset from canvas centre, in canvas pixels. */
  position: Vec2;
  size: number;
  color: string;
  weight: TextWeight;
  align: TextAlign;
  opacity: number;
  letterSpacing: number;
  lineHeight: number;
  /** Degrees. */
  rotation: number;
  /** How the caption composites against the scene beneath it. */
  blendMode: BlendMode;
  /** Outline drawn behind the fill. Zero means none. */
  strokeWidth: number;
  strokeColor: string;
  /** Drop shadow. Zero blur with zero offset means none. */
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetY: number;
}

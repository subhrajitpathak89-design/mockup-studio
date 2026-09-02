export type DeviceType = "iphone" | "android" | "laptop" | "browser";
export type ScreenFit = "contain" | "cover";
export type BackgroundType = "solid" | "gradient" | "grid" | "rails";
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
  /** Offset from canvas centre, in canvas pixels. */
  position: Vec2;
  scale: number;
  /** Degrees. */
  rotation: Vec3;
}

export interface ScreenState {
  /** Object URL or data URL of the uploaded screenshot. Empty when none. */
  source: string;
  /** Natural pixel size of the uploaded image. */
  naturalWidth: number;
  naturalHeight: number;
  fit: ScreenFit;
  scale: number;
  /** Offset within the screen viewport, normalised to viewport height. */
  position: Vec2;
  cornerRadius: number;
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
  /** Light rails: glowing beams that flare out from a centre line. */
  railCount: number;
  railSpread: number;
  railGlow: number;
  railSpeed: number;
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
  | "background.offset";

export type TrackId = "device" | "screen" | "camera";

export interface Animation {
  id: string;
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

export type TextAlign = "left" | "center" | "right";
export type TextWeight = 400 | 500 | 600 | 700 | 800;

/**
 * A caption placed in the scene. Text lives in canvas space next to the
 * device, moves with the camera, and is rendered by the same pass as
 * everything else so it appears in preview and export unchanged.
 */
export interface TextItem {
  id: string;
  content: string;
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
}

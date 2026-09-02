import { DEVICE_SPECS } from "@/lib/canvas/devices";
import {
  DEFAULT_DURATION,
  DEFAULT_FPS,
  type BackgroundState,
  type DeviceType,
  type LightingState,
  type ProjectMeta,
  type Scene,
  type ShadowState,
} from "@/types";

export const SCHEMA_VERSION = 1;

/** A whole saved project: metadata plus the single source-of-truth scene. */
export interface ProjectFile {
  version: number;
  project: ProjectMeta;
  scene: Scene;
}

export function createProjectMeta(
  name: string,
  width: number,
  height: number,
): ProjectMeta {
  const now = Date.now();
  return {
    id: `p_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    width,
    height,
    duration: DEFAULT_DURATION,
    fps: DEFAULT_FPS,
    createdAt: now,
    updatedAt: now,
  };
}

export function createScene(device: DeviceType = "iphone"): Scene {
  return {
    device: {
      type: device,
      position: { x: 0, y: 0 },
      scale: 1,
      rotation: { x: 0, y: 0, z: 0 },
    },
    screen: {
      source: "",
      naturalWidth: 0,
      naturalHeight: 0,
      fit: "cover",
      scale: 1,
      position: { x: 0, y: 0 },
      cornerRadius: DEVICE_SPECS[device].screenRadius,
      opacity: 1,
      scroll: {
        enabled: false,
        amount: 1,
        duration: 4,
        delay: 0.5,
        easing: "easeInOut",
      },
    },
    background: BACKGROUND_PRESETS[0].value,
    shadow: SHADOW_PRESETS[1].value,
    lighting: LIGHTING_PRESETS[0].value,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    animations: [],
  };
}

export interface Preset<T> {
  id: string;
  label: string;
  value: T;
}

/**
 * Backgrounds are tuned for product presentation — restrained, high contrast
 * against a device, and safe behind both light and dark screenshots.
 */
export const BACKGROUND_PRESETS: Preset<BackgroundState>[] = [
  {
    id: "graphite",
    label: "Graphite",
    value: {
      type: "gradient",
      color1: "#20232b",
      color2: "#0b0c0f",
      angle: 120,
      gradientKind: "linear",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "paper",
    label: "Paper",
    value: {
      type: "gradient",
      color1: "#f6f5f3",
      color2: "#dedbd5",
      angle: 120,
      gradientKind: "linear",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "indigo",
    label: "Indigo",
    value: {
      type: "gradient",
      color1: "#4338ca",
      color2: "#1e1b4b",
      angle: 135,
      gradientKind: "linear",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    value: {
      type: "gradient",
      color1: "#fb7185",
      color2: "#7c2d12",
      angle: 150,
      gradientKind: "linear",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "spotlight",
    label: "Spotlight",
    value: {
      type: "gradient",
      color1: "#3f3f46",
      color2: "#09090b",
      angle: 90,
      gradientKind: "radial",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "mint",
    label: "Mint",
    value: {
      type: "gradient",
      color1: "#a7f3d0",
      color2: "#0f766e",
      angle: 120,
      gradientKind: "linear",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "slate-solid",
    label: "Slate",
    value: {
      type: "solid",
      color1: "#111827",
      color2: "#111827",
      angle: 120,
      gradientKind: "linear",
      gridSize: 64,
      gridOpacity: 0.12,
    },
  },
  {
    id: "blueprint",
    label: "Blueprint",
    value: {
      type: "grid",
      color1: "#0f172a",
      color2: "#38bdf8",
      angle: 120,
      gradientKind: "linear",
      gridSize: 72,
      gridOpacity: 0.18,
    },
  },
];

export const SHADOW_PRESETS: Preset<ShadowState>[] = [
  {
    id: "soft",
    label: "Soft",
    value: { opacity: 0.28, blur: 60, offsetX: 0, offsetY: 24 },
  },
  {
    id: "medium",
    label: "Medium",
    value: { opacity: 0.45, blur: 44, offsetX: 0, offsetY: 32 },
  },
  {
    id: "floating",
    label: "Floating",
    value: { opacity: 0.5, blur: 110, offsetX: 0, offsetY: 90 },
  },
];

export const LIGHTING_PRESETS: Preset<LightingState>[] = [
  { id: "soft", label: "Soft", value: { intensity: 0.4, angle: 45, softness: 0.85 } },
  { id: "studio", label: "Studio", value: { intensity: 0.65, angle: 70, softness: 0.6 } },
  {
    id: "dramatic",
    label: "Dramatic",
    value: { intensity: 0.95, angle: 160, softness: 0.25 },
  },
];

/**
 * Fills in anything a project saved by an older build is missing, so opening
 * an old project never throws on a undefined nested field.
 */
export function migrateScene(scene: Partial<Scene> | undefined): Scene {
  const base = createScene();
  if (!scene) return base;
  return {
    device: { ...base.device, ...scene.device },
    screen: {
      ...base.screen,
      ...scene.screen,
      scroll: { ...base.screen.scroll, ...scene.screen?.scroll },
      position: { ...base.screen.position, ...scene.screen?.position },
    },
    background: { ...base.background, ...scene.background },
    shadow: { ...base.shadow, ...scene.shadow },
    lighting: { ...base.lighting, ...scene.lighting },
    camera: {
      ...base.camera,
      ...scene.camera,
      position: { ...base.camera.position, ...scene.camera?.position },
    },
    animations: scene.animations ?? [],
  };
}

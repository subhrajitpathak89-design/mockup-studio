import type { AnimatableProperty, Animation, Scene } from "@/types";
import { clamp01, ease, lerp } from "./easing";

/**
 * The scene as it looks at one instant in time. Everything downstream — the
 * editor canvas, preview and export — renders from this and nothing else.
 */
export interface ResolvedScene {
  device: {
    x: number;
    y: number;
    scale: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    opacity: number;
  };
  camera: { x: number; y: number; zoom: number };
  /** 0..1 — how far the screenshot has scrolled through its overflow. */
  screenScroll: number;
  /** Parallax offset applied to the background, in canvas pixels. */
  backgroundOffset: number;
}

/**
 * How an animated value combines with the value the user authored in the
 * property panel. Keeping presets relative means moving the device on canvas
 * never invalidates an animation that is already applied.
 */
const COMBINE: Record<AnimatableProperty, "add" | "multiply" | "set"> = {
  "device.position.x": "add",
  "device.position.y": "add",
  "device.scale": "multiply",
  "device.rotation.x": "add",
  "device.rotation.y": "add",
  "device.rotation.z": "add",
  "device.opacity": "set",
  "camera.position.x": "add",
  "camera.position.y": "add",
  "camera.zoom": "multiply",
  "background.offset": "add",
};

/** Progress of a single clip at `time`, already eased. */
export function clipProgress(anim: Animation, time: number): number {
  const local = time - anim.delay;
  if (anim.duration <= 0) return local >= 0 ? 1 : 0;

  if (anim.loop) {
    if (local < 0) return 0;
    // Ping-pong: 0 → 1 → 0 → 1 …
    const cycle = (local / anim.duration) % 2;
    const t = cycle <= 1 ? cycle : 2 - cycle;
    return ease(anim.easing, t);
  }

  return ease(anim.easing, clamp01(local / anim.duration));
}

export function clipValue(anim: Animation, time: number): number {
  return lerp(anim.from, anim.to, clipProgress(anim, time));
}

export function resolveScene(scene: Scene, time: number): ResolvedScene {
  const { device, camera } = scene;

  const resolved: ResolvedScene = {
    device: {
      x: device.position.x,
      y: device.position.y,
      scale: device.scale,
      rotX: device.rotation.x,
      rotY: device.rotation.y,
      rotZ: device.rotation.z,
      opacity: 1,
    },
    camera: { x: camera.position.x, y: camera.position.y, zoom: camera.zoom },
    screenScroll: 0,
    backgroundOffset: 0,
  };

  for (const anim of scene.animations) {
    const value = clipValue(anim, time);
    const mode = COMBINE[anim.property];
    applyValue(resolved, anim.property, value, mode);
  }

  const scroll = scene.screen.scroll;
  if (scroll.enabled) {
    const local = time - scroll.delay;
    const t =
      scroll.duration <= 0 ? 1 : ease(scroll.easing, clamp01(local / scroll.duration));
    resolved.screenScroll = local < 0 ? 0 : t * scroll.amount;
  }

  return resolved;
}

function applyValue(
  target: ResolvedScene,
  property: AnimatableProperty,
  value: number,
  mode: "add" | "multiply" | "set",
) {
  const combine = (current: number) =>
    mode === "add" ? current + value : mode === "multiply" ? current * value : value;

  switch (property) {
    case "device.position.x":
      target.device.x = combine(target.device.x);
      break;
    case "device.position.y":
      target.device.y = combine(target.device.y);
      break;
    case "device.scale":
      target.device.scale = combine(target.device.scale);
      break;
    case "device.rotation.x":
      target.device.rotX = combine(target.device.rotX);
      break;
    case "device.rotation.y":
      target.device.rotY = combine(target.device.rotY);
      break;
    case "device.rotation.z":
      target.device.rotZ = combine(target.device.rotZ);
      break;
    case "device.opacity":
      target.device.opacity = combine(target.device.opacity);
      break;
    case "camera.position.x":
      target.camera.x = combine(target.camera.x);
      break;
    case "camera.position.y":
      target.camera.y = combine(target.camera.y);
      break;
    case "camera.zoom":
      target.camera.zoom = combine(target.camera.zoom);
      break;
    case "background.offset":
      target.backgroundOffset = combine(target.backgroundOffset);
      break;
  }
}

/** End time of a clip, used to size the timeline markers. */
export function clipEnd(anim: Animation): number {
  return anim.delay + anim.duration;
}

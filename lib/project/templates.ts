"use client";

import { instantiatePreset, ANIMATION_PRESETS } from "@/lib/animation/presets";
import {
  instantiateTextPreset,
  TEXT_ANIMATION_PRESETS,
} from "@/lib/animation/textPresets";
import { backdropUrl } from "@/lib/canvas/unsplash";
import { DEFAULT_FONT_ID } from "@/lib/fonts";
import { createScene } from "@/lib/project/schema";
import type { Animation, DeviceType, Scene, TextItem } from "@/types";

/**
 * Starting points that are already moving.
 *
 * A scene is plain JSON, so a template is just a scene with everything except
 * the screen filled in — background, device, framing, motion, sometimes a
 * caption. You add your recording and it is done. Nothing here is a special
 * case for the renderer: a template is exactly what you would have built by
 * hand in the editor, so every control still applies afterwards.
 */
export interface Template {
  id: string;
  label: string;
  hint: string;
  width: number;
  height: number;
  duration: number;
  build(): Scene;
}

/** Pulls preset clips by id, so templates compose the same motion the panel offers. */
function clips(...ids: string[]): Animation[] {
  return ids.flatMap((id) => {
    const preset = ANIMATION_PRESETS.find((p) => p.id === id);
    return preset ? instantiatePreset(preset) : [];
  });
}

function caption(content: string, overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: `t_${Math.random().toString(36).slice(2, 8)}`,
    content,
    fontId: DEFAULT_FONT_ID,
    layer: "front",
    position: { x: 0, y: -430 },
    size: 92,
    color: "#ffffff",
    weight: 700,
    align: "center",
    opacity: 1,
    letterSpacing: -1.5,
    lineHeight: 1.1,
    rotation: 0,
    blendMode: "normal",
    strokeWidth: 0,
    strokeColor: "#000000",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0.55)",
    shadowOffsetY: 0,
    ...overrides,
  };
}

function textClips(id: string, presetId: string): Animation[] {
  const preset = TEXT_ANIMATION_PRESETS.find((p) => p.id === presetId);
  return preset ? instantiateTextPreset(preset, id) : [];
}

/** Common starting point: a device, a background, and nothing in the screen. */
function base(device: DeviceType): Scene {
  const scene = createScene(device);
  return { ...scene, device: { ...scene.device, fitToSource: true } };
}

export const TEMPLATES: Template[] = [
  {
    id: "aurora-float",
    label: "Aurora Float",
    hint: "Drifting shader, gentle hover",
    width: 1920,
    height: 1080,
    duration: 6,
    build() {
      const scene = base("monitor-desk");
      return {
        ...scene,
        device: { ...scene.device, rotation: { x: 0, y: 0, z: 0 }, scale: 0.92 },
        background: {
          ...scene.background,
          type: "shader",
          shaderId: "aurora",
          color1: "#38bdf8",
          color2: "#a855f7",
          shaderSpeed: 0.5,
        },
        animations: clips("float", "fade-in"),
      };
    },
  },
  {
    id: "tilt-reveal",
    label: "Tilt Reveal",
    hint: "Angled laptop, rotates into place",
    width: 1920,
    height: 1080,
    duration: 6,
    build() {
      const scene = base("macbook");
      return {
        ...scene,
        device: {
          ...scene.device,
          rotation: { x: 8, y: -18, z: 0 },
          scale: 0.95,
        },
        background: {
          ...scene.background,
          type: "gradient",
          color1: "#1e1b4b",
          color2: "#0b0c0f",
          gradientKind: "radial",
        },
        lighting: { intensity: 0.75, angle: 60, softness: 0.55 },
        animations: clips("rotate-in", "scale-in"),
      };
    },
  },
  {
    id: "story-scroll",
    label: "Story Scroll",
    hint: "9:16 phone, scrolls your screen",
    width: 1080,
    height: 1920,
    duration: 8,
    build() {
      const scene = base("phone-in-hand");
      return {
        ...scene,
        device: { ...scene.device, scale: 1 },
        screen: {
          ...scene.screen,
          fit: "cover",
          // A tall capture travelling down the viewport is the whole point of
          // a story-shaped template.
          scroll: { ...scene.screen.scroll, enabled: true, duration: 6, delay: 0.6 },
        },
        background: {
          ...scene.background,
          type: "shader",
          shaderId: "silk",
          color1: "#f472b6",
          color2: "#4338ca",
          shaderSpeed: 0.4,
        },
        animations: clips("slide-up"),
      };
    },
  },
  {
    id: "headline-launch",
    label: "Headline Launch",
    hint: "Caption rises, product pushes in",
    width: 1920,
    height: 1080,
    duration: 7,
    build() {
      const scene = base("monitor-desk");
      const headline = caption("Introducing", { position: { x: 0, y: -400 }, size: 104 });
      return {
        ...scene,
        device: { ...scene.device, position: { x: 0, y: 90 }, scale: 0.86 },
        background: {
          ...scene.background,
          type: "gradient",
          color1: "#0b0c0f",
          color2: "#20232b",
          gradientKind: "linear",
          angle: 120,
        },
        texts: [headline],
        animations: [
          ...clips("push-in", "fade-in"),
          ...textClips(headline.id, "text-rise"),
        ],
      };
    },
  },
  {
    id: "studio-shot",
    label: "Studio Shot",
    hint: "Photo backdrop, slow parallax",
    width: 1920,
    height: 1080,
    duration: 6,
    build() {
      const scene = base("macbook");
      return {
        ...scene,
        device: { ...scene.device, rotation: { x: 4, y: 10, z: 0 }, scale: 0.9 },
        background: {
          ...scene.background,
          type: "image",
          imageUrl: backdropUrl("photo-1557683316-973673baf926"),
          imageDim: 0.3,
        },
        shadow: { opacity: 0.5, blur: 110, offsetX: 0, offsetY: 90 },
        animations: clips("parallax", "fade-in"),
      };
    },
  },
  {
    id: "neon-pop",
    label: "Neon Pop",
    hint: "Iridescent wash, snappy scale",
    width: 1080,
    height: 1080,
    duration: 5,
    build() {
      const scene = base("phone-in-hand");
      return {
        ...scene,
        device: { ...scene.device, rotation: { x: 0, y: 0, z: -6 }, scale: 0.95 },
        background: {
          ...scene.background,
          type: "shader",
          shaderId: "iridescence",
          color1: "#67e8f9",
          color2: "#a78bfa",
          shaderSpeed: 0.8,
        },
        lighting: { intensity: 0.9, angle: 140, softness: 0.35 },
        animations: clips("scale-in", "float"),
      };
    },
  },
];

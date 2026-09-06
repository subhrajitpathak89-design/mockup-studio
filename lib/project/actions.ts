"use client";

import { DEVICE_SPECS } from "@/lib/canvas/devices";
import { DEFAULT_FONT_ID } from "@/lib/fonts";
import { FLAT_SEED, IMAGE_SEED, SHADER_SEED } from "@/lib/project/schema";
import {
  ANIMATION_PRESETS,
  instantiatePreset,
} from "@/lib/animation/presets";
import {
  TEXT_ANIMATION_PRESETS,
  instantiateTextPreset,
} from "@/lib/animation/textPresets";
import { patchScene, useProjectStore } from "@/store/projectStore";
import type {
  Animation,
  OverlayItem,
  BackgroundState,
  DeviceType,
  LightingState,
  ScreenFit,
  ShadowState,
  TextItem,
} from "@/types";

type Num = number;

export const deviceActions = {
  setType(type: DeviceType) {
    patchScene(
      (s) => ({
        ...s,
        device: { ...s.device, type },
        screen: { ...s.screen, cornerRadius: DEVICE_SPECS[type].screenRadius },
      }),
      "device.type",
    );
  },
  setPosition(x: Num, y: Num) {
    patchScene(
      (s) => ({ ...s, device: { ...s.device, position: { x, y } } }),
      "device.position",
    );
  },
  setScale(scale: Num) {
    patchScene((s) => ({ ...s, device: { ...s.device, scale } }), "device.scale");
  },
  setFitToSource(fitToSource: boolean) {
    patchScene(
      (s) => ({ ...s, device: { ...s.device, fitToSource } }),
      "device.fitToSource",
    );
  },
  setRotation(axis: "x" | "y" | "z", value: Num) {
    patchScene(
      (s) => ({
        ...s,
        device: { ...s.device, rotation: { ...s.device.rotation, [axis]: value } },
      }),
      `device.rotation.${axis}`,
    );
  },
  reset() {
    patchScene(
      (s) => ({
        ...s,
        device: {
          ...s.device,
          position: { x: 0, y: 0 },
          scale: 1,
          rotation: { x: 0, y: 0, z: 0 },
        },
      }),
      "device.reset",
    );
  },
};

/** `trimOut` of 0 means "run to the end of the clip". */
function syncDurationToClip(
  trimIn: number,
  trimOut: number,
  mediaDuration: number,
) {
  const end = trimOut > 0 ? trimOut : mediaDuration;
  const length = end - trimIn;
  if (!Number.isFinite(length) || length <= 0) return;
  useProjectStore
    .getState()
    .setProject({ duration: Math.min(120, Math.max(0.5, Number(length.toFixed(2)))) });
}

export const screenActions = {
  setImage(source: string, naturalWidth: number, naturalHeight: number) {
    patchScene(
      (s) => ({
        ...s,
        screen: {
          ...s.screen,
          kind: "image",
          source,
          recordingId: undefined,
          naturalWidth,
          naturalHeight,
          mediaDuration: 0,
          trimIn: 0,
          trimOut: 0,
          scale: 1,
          position: { x: 0, y: 0 },
        },
      }),
      "screen.image",
    );
  },
  /**
   * Drops a recording into the device. Trim is stored rather than applied —
   * nothing is re-encoded, so the trim can be widened again later.
   */
  setRecording(recording: {
    source: string;
    recordingId: string;
    naturalWidth: number;
    naturalHeight: number;
    mediaDuration: number;
    trimIn: number;
    trimOut: number;
  }) {
    patchScene(
      (s) => ({
        ...s,
        screen: {
          ...s.screen,
          kind: "video",
          ...recording,
          // A recording fills the device; letterboxing a demo looks broken.
          fit: "cover",
          scale: 1,
          position: { x: 0, y: 0 },
          // Scroll drives a still image down a viewport; a video moves itself.
          scroll: { ...s.screen.scroll, enabled: false },
        },
      }),
      "screen.recording",
    );
    // The project has to be as long as the clip, or the tail is silently cut
    // off — and with the timeline hidden there is no way to notice or fix it.
    syncDurationToClip(recording.trimIn, recording.trimOut, recording.mediaDuration);
  },
  setTrim(trimIn: number, trimOut: number) {
    patchScene(
      (s) => ({ ...s, screen: { ...s.screen, trimIn, trimOut } }),
      "screen.trim",
    );
    const { mediaDuration } = useProjectStore.getState().scene.screen;
    syncDurationToClip(trimIn, trimOut, mediaDuration);
  },
  setMuted(muted: boolean) {
    patchScene((s) => ({ ...s, screen: { ...s.screen, muted } }), "screen.muted");
  },
  setFit(fit: ScreenFit) {
    patchScene(
      (s) => ({ ...s, screen: { ...s.screen, fit, scale: 1, position: { x: 0, y: 0 } } }),
      "screen.fit",
    );
  },
  setScale(scale: Num) {
    patchScene((s) => ({ ...s, screen: { ...s.screen, scale } }), "screen.scale");
  },
  setPosition(x: Num, y: Num) {
    patchScene(
      (s) => ({ ...s, screen: { ...s.screen, position: { x, y } } }),
      "screen.position",
    );
  },
  setCornerRadius(cornerRadius: Num) {
    patchScene(
      (s) => ({ ...s, screen: { ...s.screen, cornerRadius } }),
      "screen.cornerRadius",
    );
  },
  setBorder(borderWidth: Num, borderColor?: string) {
    patchScene(
      (s) => ({
        ...s,
        screen: {
          ...s.screen,
          borderWidth,
          borderColor: borderColor ?? s.screen.borderColor,
        },
      }),
      "screen.border",
    );
  },
  setOpacity(opacity: Num) {
    patchScene((s) => ({ ...s, screen: { ...s.screen, opacity } }), "screen.opacity");
  },
  reset() {
    patchScene(
      (s) => ({
        ...s,
        screen: {
          ...s.screen,
          fit: "cover",
          scale: 1,
          position: { x: 0, y: 0 },
          opacity: 1,
          cornerRadius: DEVICE_SPECS[s.device.type].screenRadius,
          borderWidth: 0,
        },
      }),
      "screen.reset",
    );
  },
  setScroll(patch: Partial<import("@/types").ScrollState>) {
    patchScene(
      (s) => ({
        ...s,
        // Scrolling only has room to move when the image overflows the
        // viewport, which "cover" guarantees for tall screenshots.
        screen: {
          ...s.screen,
          fit: patch.enabled ? "cover" : s.screen.fit,
          scroll: { ...s.screen.scroll, ...patch },
        },
      }),
      "screen.scroll",
    );
  },
  clear() {
    patchScene(
      (s) => ({
        ...s,
        screen: {
          ...s.screen,
          kind: "image",
          source: "",
          recordingId: undefined,
          naturalWidth: 0,
          naturalHeight: 0,
          mediaDuration: 0,
          trimIn: 0,
          trimOut: 0,
        },
      }),
      "screen.clear",
    );
  },
};

export const backgroundActions = {
  /**
   * A flat dark gradient carried into a shader renders as mud, and a photo
   * backdrop with no photo renders as nothing — so entering either type for
   * the first time seeds something that actually reads. Leaving and coming
   * back keeps whatever you set.
   */
  setType(type: BackgroundState["type"]) {
    patchScene((s) => {
      if (type === "shader" && s.background.type !== "shader") {
        return {
          ...s,
          background: {
            ...s.background,
            type,
            color1: SHADER_SEED.color1,
            color2: SHADER_SEED.color2,
            shaderId: s.background.shaderId || SHADER_SEED.shaderId,
          },
        };
      }
      // Shader tints are chosen to glow, and a glowing tint as a flat fill
      // is a colour nobody picked. Coming back to a flat type resets to a
      // ground rather than inheriting one.
      if (
        (type === "solid" || type === "gradient" || type === "grid") &&
        (s.background.type === "shader" || s.background.type === "image")
      ) {
        return {
          ...s,
          background: {
            ...s.background,
            type,
            color1: FLAT_SEED.color1,
            color2: FLAT_SEED.color2,
          },
        };
      }
      if (type === "image" && !s.background.imageUrl) {
        return {
          ...s,
          background: {
            ...s.background,
            type,
            imageUrl: IMAGE_SEED.imageUrl,
            imageDim: IMAGE_SEED.imageDim,
          },
        };
      }
      return { ...s, background: { ...s.background, type } };
    }, "background.type");
  },
  patch(patch: Partial<BackgroundState>) {
    patchScene(
      (s) => ({ ...s, background: { ...s.background, ...patch } }),
      "background",
    );
  },
  apply(value: BackgroundState) {
    patchScene((s) => ({ ...s, background: value }), "background.preset");
  },
};

export const shadowActions = {
  patch(patch: Partial<ShadowState>) {
    patchScene((s) => ({ ...s, shadow: { ...s.shadow, ...patch } }), "shadow");
  },
  apply(value: ShadowState) {
    patchScene((s) => ({ ...s, shadow: value }), "shadow.preset");
  },
};

export const lightingActions = {
  patch(patch: Partial<LightingState>) {
    patchScene((s) => ({ ...s, lighting: { ...s.lighting, ...patch } }), "lighting");
  },
  apply(value: LightingState) {
    patchScene((s) => ({ ...s, lighting: value }), "lighting.preset");
  },
};

export const animationActions = {
  applyPreset(presetId: string) {
    const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const clips = instantiatePreset(preset);
    patchScene(
      (s) => ({
        ...s,
        // Re-applying a preset replaces its previous clips rather than
        // stacking duplicates on top of each other.
        animations: [
          ...s.animations.filter((a) => a.presetId !== presetId),
          ...clips,
        ],
      }),
      "animation.apply",
    );
  },
  removePreset(presetId: string) {
    patchScene(
      (s) => ({
        ...s,
        animations: s.animations.filter((a) => a.presetId !== presetId),
      }),
      "animation.remove",
    );
  },
  /** Removes a single clip. A preset with no clips left disappears with it. */
  removeClip(id: string) {
    patchScene(
      (s) => ({ ...s, animations: s.animations.filter((a) => a.id !== id) }),
      "animation.removeClip",
    );
  },
  patchClip(id: string, patch: Partial<Animation>) {
    patchScene(
      (s) => ({
        ...s,
        animations: s.animations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }),
      `animation.clip.${id}`,
    );
  },
  /** Applies duration/delay/easing to every clip of one preset at once. */
  patchPreset(presetId: string, patch: Partial<Animation>) {
    patchScene(
      (s) => ({
        ...s,
        animations: s.animations.map((a) =>
          a.presetId === presetId ? { ...a, ...patch } : a,
        ),
      }),
      `animation.preset.${presetId}`,
    );
  },
  clear() {
    patchScene((s) => ({ ...s, animations: [] }), "animation.clear");
  },
};

export const overlayActions = {
  /**
   * Adds an image on top of the scene. Sized to a third of the canvas width so
   * it lands visible but not dominant, whatever the source resolution.
   */
  add(
    src: string,
    naturalWidth: number,
    naturalHeight: number,
    name: string,
    canvasWidth: number,
  ): string {
    const id = `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    patchScene(
      (s) => ({
        ...s,
        overlays: [
          ...s.overlays,
          {
            id,
            name,
            src,
            naturalWidth,
            naturalHeight,
            width: Math.round(canvasWidth / 3),
            position: { x: 0, y: 0 },
            scale: 1,
            rotation: 0,
            opacity: 1,
            blendMode: "normal",
            shadowBlur: 0,
            shadowColor: "rgba(0,0,0,0.45)",
            shadowOffsetY: 0,
            layer: "front",
          },
        ],
      }),
      "overlay.add",
    );
    return id;
  },
  patch(id: string, patch: Partial<OverlayItem>) {
    patchScene(
      (s) => ({
        ...s,
        overlays: s.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      }),
      `overlay.patch.${id}`,
    );
  },
  remove(id: string) {
    patchScene(
      (s) => ({
        ...s,
        overlays: s.overlays.filter((o) => o.id !== id),
        // Clips driving a deleted overlay would linger on the timeline as
        // orphans, exactly as they would for a caption.
        animations: s.animations.filter((a) => a.targetId !== id),
      }),
      "overlay.remove",
    );
  },
  /** Moves an overlay within its layer's paint order. */
  reorder(id: string, direction: -1 | 1) {
    patchScene((s) => {
      const index = s.overlays.findIndex((o) => o.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= s.overlays.length) return s;
      const overlays = [...s.overlays];
      [overlays[index], overlays[next]] = [overlays[next], overlays[index]];
      return { ...s, overlays };
    }, "overlay.reorder");
  },
  applyAnimation(id: string, presetId: string) {
    const preset = TEXT_ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const clips = instantiateTextPreset(preset, id).map((c) => ({
      ...c,
      track: "overlay" as const,
    }));
    const scoped = `${presetId}:${id}`;
    patchScene(
      (s) => ({
        ...s,
        animations: [...s.animations.filter((a) => a.presetId !== scoped), ...clips],
      }),
      "overlay.animation.apply",
    );
  },
  removeAnimation(id: string, presetId: string) {
    const scoped = `${presetId}:${id}`;
    patchScene(
      (s) => ({
        ...s,
        animations: s.animations.filter((a) => a.presetId !== scoped),
      }),
      "overlay.animation.remove",
    );
  },
};

export const textActions = {
  add(content = "Your headline"): string {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    patchScene(
      (s) => ({
        ...s,
        texts: [
          ...s.texts,
          {
            id,
            content,
            fontId: DEFAULT_FONT_ID,
            layer: "front",
            // Offset from centre so a new caption never lands hidden behind
            // the device.
            position: { x: 0, y: -420 },
            size: 96,
            color: "#ffffff",
            weight: 700,
            align: "center",
            opacity: 1,
            letterSpacing: -1,
            lineHeight: 1.15,
            rotation: 0,
            blendMode: "normal",
            strokeWidth: 0,
            strokeColor: "#000000",
            shadowBlur: 0,
            shadowColor: "rgba(0,0,0,0.55)",
            shadowOffsetY: 0,
          },
        ],
      }),
      "text.add",
    );
    return id;
  },
  patch(id: string, patch: Partial<TextItem>) {
    patchScene(
      (s) => ({
        ...s,
        texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }),
      `text.patch.${id}`,
    );
  },
  remove(id: string) {
    patchScene(
      (s) => ({
        ...s,
        texts: s.texts.filter((t) => t.id !== id),
        // Clips that drove this caption would otherwise linger as orphans on
        // the timeline for a layer that no longer exists.
        animations: s.animations.filter((a) => a.targetId !== id),
      }),
      "text.remove",
    );
  },
  setLayer(id: string, layer: "front" | "behind") {
    patchScene(
      (s) => ({
        ...s,
        texts: s.texts.map((t) => (t.id === id ? { ...t, layer } : t)),
      }),
      "text.layer",
    );
  },
  /** Moves a caption within its own layer's paint order. */
  reorder(id: string, direction: -1 | 1) {
    patchScene((s) => {
      const index = s.texts.findIndex((t) => t.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= s.texts.length) return s;
      const texts = [...s.texts];
      [texts[index], texts[next]] = [texts[next], texts[index]];
      return { ...s, texts };
    }, "text.reorder");
  },
  applyStyle(id: string, style: Partial<TextItem>) {
    patchScene(
      (s) => ({
        ...s,
        texts: s.texts.map((t) => (t.id === id ? { ...t, ...style } : t)),
      }),
      "text.style",
    );
  },
  applyAnimation(id: string, presetId: string) {
    const preset = TEXT_ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const clips = instantiateTextPreset(preset, id);
    const scoped = `${presetId}:${id}`;
    patchScene(
      (s) => ({
        ...s,
        animations: [
          ...s.animations.filter((a) => a.presetId !== scoped),
          ...clips,
        ],
      }),
      "text.animation.apply",
    );
  },
  removeAnimation(id: string, presetId: string) {
    const scoped = `${presetId}:${id}`;
    patchScene(
      (s) => ({
        ...s,
        animations: s.animations.filter((a) => a.presetId !== scoped),
      }),
      "text.animation.remove",
    );
  },
  duplicate(id: string) {
    patchScene((s) => {
      const source = s.texts.find((t) => t.id === id);
      if (!source) return s;
      return {
        ...s,
        texts: [
          ...s.texts,
          {
            ...source,
            id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            position: {
              x: source.position.x + 40,
              y: source.position.y + 40,
            },
          },
        ],
      };
    }, "text.duplicate");
  },
};

export function appliedPresetIds(): string[] {
  const { animations } = useProjectStore.getState().scene;
  return Array.from(new Set(animations.map((a) => a.presetId)));
}

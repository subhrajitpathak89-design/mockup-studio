"use client";

import { DEVICE_SPECS } from "@/lib/canvas/devices";
import {
  ANIMATION_PRESETS,
  instantiatePreset,
} from "@/lib/animation/presets";
import { patchScene, useProjectStore } from "@/store/projectStore";
import type {
  Animation,
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

export const screenActions = {
  setImage(source: string, naturalWidth: number, naturalHeight: number) {
    patchScene(
      (s) => ({
        ...s,
        screen: {
          ...s.screen,
          source,
          naturalWidth,
          naturalHeight,
          scale: 1,
          position: { x: 0, y: 0 },
        },
      }),
      "screen.image",
    );
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
        screen: { ...s.screen, source: "", naturalWidth: 0, naturalHeight: 0 },
      }),
      "screen.clear",
    );
  },
};

export const backgroundActions = {
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
      (s) => ({ ...s, texts: s.texts.filter((t) => t.id !== id) }),
      "text.remove",
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

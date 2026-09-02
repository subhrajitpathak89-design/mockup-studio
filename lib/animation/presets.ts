import type { Animation, TrackId } from "@/types";

export interface AnimationPreset {
  id: string;
  label: string;
  description: string;
  track: TrackId;
  /** Clips are cloned when applied, then freely editable. */
  clips: Omit<Animation, "id" | "presetId" | "label" | "track">[];
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: "fade-in",
    label: "Fade In",
    description: "Device fades up from transparent.",
    track: "device",
    clips: [
      {
        property: "device.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 1,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "scale-in",
    label: "Scale In",
    description: "Grows from 80% to full size.",
    track: "device",
    clips: [
      {
        property: "device.scale",
        from: 0.8,
        to: 1,
        delay: 0,
        duration: 1,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "device.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.6,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "slide-up",
    label: "Slide Up",
    description: "Enters from below the frame.",
    track: "device",
    clips: [
      {
        property: "device.position.y",
        from: 420,
        to: 0,
        delay: 0,
        duration: 1,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "device.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.6,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "slide-down",
    label: "Slide Down",
    description: "Enters from above the frame.",
    track: "device",
    clips: [
      {
        property: "device.position.y",
        from: -420,
        to: 0,
        delay: 0,
        duration: 1,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "device.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.6,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "rotate-in",
    label: "Rotate In",
    description: "Tilts in and settles flat.",
    track: "device",
    clips: [
      {
        property: "device.rotation.y",
        from: -24,
        to: 0,
        delay: 0,
        duration: 1.2,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "device.rotation.z",
        from: -6,
        to: 0,
        delay: 0,
        duration: 1.2,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "device.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.6,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "float",
    label: "Float",
    description: "Subtle continuous drift.",
    track: "device",
    clips: [
      {
        property: "device.position.y",
        from: -14,
        to: 14,
        delay: 0,
        duration: 2,
        easing: "easeInOut",
        loop: true,
      },
    ],
  },
  {
    id: "push-in",
    label: "Push In",
    description: "Camera moves slowly toward the device.",
    track: "camera",
    clips: [
      {
        property: "camera.zoom",
        from: 0.88,
        to: 1.08,
        delay: 0,
        duration: 6,
        easing: "smooth",
        loop: false,
      },
    ],
  },
  {
    id: "pull-out",
    label: "Pull Out",
    description: "Camera drifts away from the device.",
    track: "camera",
    clips: [
      {
        property: "camera.zoom",
        from: 1.12,
        to: 0.92,
        delay: 0,
        duration: 6,
        easing: "smooth",
        loop: false,
      },
    ],
  },
  {
    id: "parallax",
    label: "Parallax",
    description: "Background drifts against the device.",
    track: "camera",
    clips: [
      {
        property: "background.offset",
        from: -80,
        to: 80,
        delay: 0,
        duration: 6,
        easing: "smooth",
        loop: false,
      },
      {
        property: "device.position.x",
        from: 40,
        to: -40,
        delay: 0,
        duration: 6,
        easing: "smooth",
        loop: false,
      },
    ],
  },
];

export function instantiatePreset(preset: AnimationPreset): Animation[] {
  return preset.clips.map((clip, i) => ({
    ...clip,
    id: `${preset.id}-${Date.now().toString(36)}-${i}`,
    presetId: preset.id,
    label: preset.label,
    track: preset.track,
  }));
}

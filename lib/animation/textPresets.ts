import type { Animation, TextItem } from "@/types";

export interface TextAnimationPreset {
  id: string;
  label: string;
  clips: Omit<Animation, "id" | "presetId" | "label" | "track" | "targetId">[];
}

export const TEXT_ANIMATION_PRESETS: TextAnimationPreset[] = [
  {
    id: "text-fade-in",
    label: "Fade In",
    clips: [
      {
        property: "text.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.8,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "text-rise",
    label: "Rise",
    clips: [
      {
        property: "text.position.y",
        from: 60,
        to: 0,
        delay: 0,
        duration: 0.9,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "text.opacity",
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
    id: "text-pop",
    label: "Pop",
    clips: [
      {
        property: "text.scale",
        from: 0.7,
        to: 1,
        delay: 0,
        duration: 0.7,
        easing: "spring",
        loop: false,
      },
      {
        property: "text.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.4,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "text-slide",
    label: "Slide In",
    clips: [
      {
        property: "text.position.x",
        from: -240,
        to: 0,
        delay: 0,
        duration: 0.9,
        easing: "easeOut",
        loop: false,
      },
      {
        property: "text.opacity",
        from: 0,
        to: 1,
        delay: 0,
        duration: 0.5,
        easing: "easeOut",
        loop: false,
      },
    ],
  },
  {
    id: "text-float",
    label: "Float",
    clips: [
      {
        property: "text.position.y",
        from: -10,
        to: 10,
        delay: 0,
        duration: 2.4,
        easing: "easeInOut",
        loop: true,
      },
    ],
  },
];

export function instantiateTextPreset(
  preset: TextAnimationPreset,
  targetId: string,
): Animation[] {
  return preset.clips.map((clip, i) => ({
    ...clip,
    id: `${preset.id}-${targetId}-${Date.now().toString(36)}-${i}`,
    presetId: `${preset.id}:${targetId}`,
    label: preset.label,
    track: "text" as const,
    targetId,
  }));
}

export interface TextStylePreset {
  id: string;
  label: string;
  value: Partial<TextItem>;
}

/** Quick looks — one click to a caption that already reads well. */
export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "headline",
    label: "Headline",
    value: {
      fontId: "inter",
      size: 112,
      weight: 800,
      letterSpacing: -3,
      lineHeight: 1.05,
      color: "#ffffff",
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    value: {
      fontId: "playfair",
      size: 104,
      weight: 700,
      letterSpacing: -1,
      lineHeight: 1.1,
      color: "#ffffff",
    },
  },
  {
    id: "caption",
    label: "Caption",
    value: {
      fontId: "inter",
      size: 44,
      weight: 500,
      letterSpacing: 0,
      lineHeight: 1.4,
      color: "#cbd5e1",
    },
  },
  {
    id: "eyebrow",
    label: "Eyebrow",
    value: {
      fontId: "grotesk",
      size: 34,
      weight: 600,
      letterSpacing: 6,
      lineHeight: 1.3,
      color: "#38bdf8",
    },
  },
  {
    id: "code",
    label: "Code",
    value: {
      fontId: "mono",
      size: 40,
      weight: 500,
      letterSpacing: 0,
      lineHeight: 1.5,
      color: "#a7f3d0",
    },
  },
];

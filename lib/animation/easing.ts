import type { EasingName } from "@/types";

export type EasingFn = (t: number) => number;

const c4 = (2 * Math.PI) / 3;

export const EASINGS: Record<EasingName, EasingFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // A gentler in-out, good for camera moves.
  smooth: (t) => t * t * (3 - 2 * t),
  // Overshoots once and settles — no physics sim, just a damped sine.
  spring: (t) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
};

export const EASING_OPTIONS: { value: EasingName; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "easeIn", label: "Ease In" },
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In Out" },
  { value: "smooth", label: "Smooth" },
  { value: "spring", label: "Spring" },
];

export function ease(name: EasingName, t: number): number {
  return (EASINGS[name] ?? EASINGS.easeOut)(clamp01(t));
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

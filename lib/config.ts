/**
 * MVP scope switches.
 *
 * The animation engine, timeline and per-keyframe editing are all built and
 * working. For the first release the product is narrower — put a screenshot or
 * a recording into a mockup and export it — so the editing surface is hidden
 * rather than removed. Flipping this back on restores the full timeline; there
 * is no migration to do, because an empty `animations` array has always been a
 * valid scene.
 */
export const MOTION_UI = false;

/**
 * The handful of presets offered when the full timeline is hidden. These are
 * all whole-frame moves — no 3D rotation — which is deliberate: they are the
 * ones that still read correctly on a fixed-angle bitmap mockup.
 */
export const SIMPLE_MOTION_PRESETS = ["float", "push-in", "slide-up"] as const;

/** The screen's four corners inside a photographic mockup, in its own pixels. */
export interface FrameQuad {
  width: number;
  height: number;
  /** Top-left, top-right, bottom-right, bottom-left. */
  quad: [number, number][];
}

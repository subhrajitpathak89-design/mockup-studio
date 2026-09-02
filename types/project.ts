export interface ProjectMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasPreset {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: "16:9", label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { id: "9:16", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
  { id: "4:5", label: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
  { id: "1:1", label: "Square", ratio: "1:1", width: 1080, height: 1080 },
];

export const DEFAULT_DURATION = 6;
export const DEFAULT_FPS = 30;

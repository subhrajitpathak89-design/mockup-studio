"use client";

import { create } from "zustand";

export type Selection = "device" | "screen" | "background" | null;
export type ToolId =
  | "upload"
  | "overlay"
  | "device"
  | "background"
  | "text"
  | "animation";

interface EditorState {
  tool: ToolId;
  selection: Selection;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  previewOpen: boolean;
  exportOpen: boolean;
  /** Collapsible chrome — the canvas should be able to take the whole window. */
  panelOpen: boolean;
  timelineOpen: boolean;
  /** Set while the user drags on canvas, to suppress expensive work. */
  interacting: boolean;
  /** Text layer being edited, if any. */
  selectedTextId: string | null;
  /** Image overlay being edited, if any. */
  selectedOverlayId: string | null;

  selectText: (id: string | null) => void;
  selectOverlay: (id: string | null) => void;
  setTool: (tool: ToolId) => void;
  togglePanel: () => void;
  toggleTimeline: () => void;
  setPanelOpen: (open: boolean) => void;
  select: (selection: Selection) => void;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  toggleGrid: () => void;
  setPreviewOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setInteracting: (interacting: boolean) => void;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export const useEditorStore = create<EditorState>((set) => ({
  tool: "upload",
  selection: "device",
  zoom: 1,
  pan: { x: 0, y: 0 },
  showGrid: false,
  previewOpen: false,
  exportOpen: false,
  panelOpen: true,
  timelineOpen: true,
  interacting: false,
  selectedTextId: null,
  selectedOverlayId: null,

  // Picking a tool always reveals its properties — a collapsed panel should
  // never make a click look like it did nothing.
  setTool: (tool) => set({ tool, panelOpen: true }),
  // Selecting a caption takes the selection away from the device, so the
  // canvas draws one selection outline rather than two.
  selectText: (selectedTextId) =>
    set({
      selectedTextId,
      selectedOverlayId: null,
      selection: selectedTextId ? null : "device",
    }),
  // One selection at a time: two dashed outlines on the canvas is one too many.
  selectOverlay: (selectedOverlayId) =>
    set({
      selectedOverlayId,
      selectedTextId: null,
      selection: selectedOverlayId ? null : "device",
    }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  select: (selection) => set({ selection }),
  setZoom: (zoom) =>
    set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  zoomBy: (factor) =>
    set((s) => ({
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom * factor)),
    })),
  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setInteracting: (interacting) => set({ interacting }),
}));

"use client";

import { create } from "zustand";
import type { ProjectMeta, Scene } from "@/types";
import {
  createProjectMeta,
  createScene,
  type ProjectFile,
} from "@/lib/project/schema";
import { loadProject, saveProject } from "@/lib/project/persistence";

const HISTORY_LIMIT = 60;
/** Two edits with the same label inside this window collapse into one undo. */
const MERGE_WINDOW_MS = 700;

interface HistoryEntry {
  scene: Scene;
  label: string;
}

interface ProjectState {
  project: ProjectMeta;
  scene: Scene;
  past: HistoryEntry[];
  future: HistoryEntry[];
  lastLabel: string | null;
  lastEditAt: number;
  dirty: boolean;
  hydrated: boolean;

  /** Every scene mutation goes through here so history stays consistent. */
  patchScene: (updater: (scene: Scene) => Scene, label: string) => void;
  setProject: (patch: Partial<ProjectMeta>) => void;
  newProject: (name: string, width: number, height: number) => void;
  open: (file: ProjectFile) => void;
  openById: (id: string) => Promise<boolean>;
  save: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createProjectMeta("Untitled Project", 1920, 1080),
  scene: createScene(),
  past: [],
  future: [],
  lastLabel: null,
  lastEditAt: 0,
  dirty: false,
  hydrated: false,

  patchScene: (updater, label) => {
    const state = get();
    const next = updater(state.scene);
    if (next === state.scene) return;

    const now = Date.now();
    const merge =
      state.lastLabel === label && now - state.lastEditAt < MERGE_WINDOW_MS;

    const past = merge
      ? state.past
      : [...state.past, { scene: state.scene, label }].slice(-HISTORY_LIMIT);

    set({
      scene: next,
      past,
      future: [],
      lastLabel: label,
      lastEditAt: now,
      dirty: true,
    });
  },

  setProject: (patch) =>
    set((s) => ({ project: { ...s.project, ...patch }, dirty: true })),

  newProject: (name, width, height) =>
    set({
      project: createProjectMeta(name, width, height),
      scene: createScene(),
      past: [],
      future: [],
      lastLabel: null,
      dirty: true,
      hydrated: true,
    }),

  open: (file) =>
    set({
      project: file.project,
      scene: file.scene,
      past: [],
      future: [],
      lastLabel: null,
      dirty: false,
      hydrated: true,
    }),

  openById: async (id) => {
    const file = await loadProject(id);
    if (!file) return false;
    get().open(file);
    return true;
  },

  save: async () => {
    const { project, scene } = get();
    await saveProject({ version: 1, project, scene });
    set({ dirty: false });
  },

  undo: () => {
    const { past, scene, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      scene: previous.scene,
      past: past.slice(0, -1),
      future: [{ scene, label: previous.label }, ...future].slice(0, HISTORY_LIMIT),
      lastLabel: null,
      dirty: true,
    });
  },

  redo: () => {
    const { future, scene, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      scene: next.scene,
      past: [...past, { scene, label: next.label }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      lastLabel: null,
      dirty: true,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

/** Convenience selector — scene mutations read better as small helpers. */
export function patchScene(
  updater: (scene: Scene) => Scene,
  label: string,
) {
  useProjectStore.getState().patchScene(updater, label);
}

"use client";

import { useEffect } from "react";
import {
  startPlaybackTicker,
  stopPlaybackTicker,
  useAnimationStore,
} from "@/store/animationStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { getLastOpened } from "@/lib/project/persistence";

const AUTOSAVE_DELAY = 1200;

/** Global keyboard shortcuts, autosave and the playback clock. */
export function useEditorRuntime() {
  useEffect(() => {
    startPlaybackTicker();
    return () => stopPlaybackTicker();
  }, []);

  // Autosave: debounced so a slider drag writes once, not sixty times.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return useProjectStore.subscribe((state) => {
      if (!state.dirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void useProjectStore.getState().save();
      }, AUTOSAVE_DELAY);
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void useProjectStore.getState().save();
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useProjectStore.getState().redo();
        else useProjectStore.getState().undo();
        return;
      }

      if (typing) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          useAnimationStore.getState().toggle();
          break;
        case "Escape":
          useEditorStore.getState().setPreviewOpen(false);
          break;
        case "Delete":
        case "Backspace": {
          const { selection } = useEditorStore.getState();
          if (selection === "device") {
            // There is one device per scene in V1, so "delete" clears the
            // screenshot inside it rather than removing the device.
            useProjectStore.getState().patchScene(
              (s) => ({
                ...s,
                screen: { ...s.screen, source: "", naturalWidth: 0, naturalHeight: 0 },
              }),
              "screen.clear",
            );
          }
          break;
        }
        case "f":
        case "F":
          useEditorStore.getState().resetView();
          break;
        case "+":
        case "=":
          useEditorStore.getState().zoomBy(1.2);
          break;
        case "-":
        case "_":
          useEditorStore.getState().zoomBy(1 / 1.2);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Restores the last project when the editor is opened cold (e.g. a refresh). */
export function useRestoreProject() {
  useEffect(() => {
    const state = useProjectStore.getState();
    if (state.hydrated) return;
    const id = getLastOpened();
    if (!id) return;
    void state.openById(id);
  }, []);
}

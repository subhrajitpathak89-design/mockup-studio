"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  startPlaybackTicker,
  stopPlaybackTicker,
  useAnimationStore,
} from "@/store/animationStore";
import { startVideoClock, stopVideoClock } from "@/lib/canvas/videoClock";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { getLastOpened } from "@/lib/project/persistence";
import { textActions } from "@/lib/project/actions";

const AUTOSAVE_DELAY = 1200;

/** Global keyboard shortcuts, autosave and the playback clock. */
export function useEditorRuntime() {
  useEffect(() => {
    startPlaybackTicker();
    startVideoClock();
    return () => {
      stopPlaybackTicker();
      stopVideoClock();
    };
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
          const { selection, selectedTextId } = useEditorStore.getState();
          if (selectedTextId) {
            textActions.remove(selectedTextId);
            useEditorStore.getState().selectText(null);
          } else if (selection === "device") {
            // There is one device per scene in V1, so "delete" clears the
            // screenshot inside it rather than removing the device.
            useProjectStore.getState().patchScene(
              (s) => ({
                ...s,
                screen: {
                  ...s.screen,
                  kind: "image",
                  source: "",
                  recordingId: undefined,
                  naturalWidth: 0,
                  naturalHeight: 0,
                  mediaDuration: 0,
                  trimIn: 0,
                  trimOut: 0,
                },
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

/**
 * Restores the last project when the editor is opened cold — a refresh, or a
 * bookmark straight to /editor.
 */
export function useRestoreProject() {
  const router = useRouter();

  useEffect(() => {
    if (useProjectStore.getState().hydrated) return;

    const id = getLastOpened();
    // Nothing to restore means there is no scene to edit, so the editor hands
    // back to the chooser rather than showing empty chrome.
    if (!id) {
      router.replace("/projects");
      return;
    }

    let cancelled = false;
    void useProjectStore
      .getState()
      .openById(id)
      .then((ok) => {
        if (!ok && !cancelled) router.replace("/projects");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
}

"use client";

import { create } from "zustand";

interface AnimationState {
  time: number;
  playing: boolean;
  duration: number;
  loop: boolean;

  setDuration: (duration: number) => void;
  setTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  time: 0,
  playing: false,
  duration: 6,
  loop: true,

  setDuration: (duration) =>
    set((s) => ({ duration, time: Math.min(s.time, duration) })),
  setTime: (time) =>
    set((s) => ({ time: Math.max(0, Math.min(time, s.duration)) })),
  play: () => {
    // Replaying from the end should start over rather than sit still.
    if (get().time >= get().duration - 0.001) set({ time: 0 });
    set({ playing: true });
  },
  pause: () => set({ playing: false }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  restart: () => set({ time: 0, playing: true }),
}));

let rafId: number | null = null;
let lastFrame = 0;
let started = false;

/**
 * A single global ticker drives playback. Running it outside React means
 * scrubbing and playback never trigger a component tree re-render.
 */
export function startPlaybackTicker() {
  if (started || typeof window === "undefined") return;
  started = true;

  const tick = (now: number) => {
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;

    const state = useAnimationStore.getState();
    if (state.playing) {
      let next = state.time + dt;
      if (next >= state.duration) {
        next = state.loop ? next % state.duration : state.duration;
        if (!state.loop) useAnimationStore.setState({ playing: false });
      }
      useAnimationStore.setState({ time: next });
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}

export function stopPlaybackTicker() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  lastFrame = 0;
  started = false;
}

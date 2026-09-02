# Mockup Motion Studio

Turn static UI screenshots into polished animated device mockups — without
opening After Effects.

**Upload → Mockup → Animate → Preview → Export**

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · shadcn/ui ·
Lucide · Zustand · IndexedDB (`idb`).

## How it works

A project is one JSON **scene** (`types/scene.ts`) and everything reads from it:

```
scene ──▶ resolveScene(scene, t) ──▶ renderScene(ctx, …)
             (lib/animation)            (lib/canvas)
                    │
      ┌─────────────┼──────────────┬────────────┐
   editor        preview        export       IndexedDB
```

`resolveScene` is a pure function of time, so the editor canvas, preview and
export all render identical frames — there is no second animation path to keep
in sync, and export can seek to any moment exactly.

### Rendering

The whole scene is drawn to a single **Canvas2D**: background, shadow, device
frame, screenshot, then lighting. Device frames are drawn procedurally (no
bitmap assets), so they stay sharp at any export resolution.

Rotation X/Y uses a perspective projection of the device quad plus a
homography-based mesh warp (`lib/canvas/transforms.ts`). A pure Z-rotation
takes a fast path that skips the mesh entirely.

Rendering lives outside React: the canvas subscribes to the stores directly and
repaints on a dirty flag, so scrubbing and playback never re-render the tree.

### Animation

Presets instantiate small clips with `from`/`to`, `delay`, `duration` and an
easing. Values combine with whatever you authored in the property panel —
positions and rotations are added, scale and zoom multiply, opacity is absolute
— so moving the device on canvas never invalidates an applied animation.

### Export

| Format | Path | Timing |
| --- | --- | --- |
| PNG | `canvas.toBlob` | exact |
| GIF | in-repo encoder (median cut + LZW, no deps) | exact, offline |
| WebM | `MediaRecorder` on `captureStream` | real time |
| MP4 | `MediaRecorder`, falls back to WebM | real time |

Video records in real time, so a 6 second animation takes about 6 seconds. If
the machine cannot keep up — or the browser throttles a backgrounded tab — the
export says so instead of silently handing back a mistimed file. GIF is capped
at 640px wide and 15 fps, since 256 colours is unkind to large gradients.

### Persistence

Projects autosave to IndexedDB, screenshot included (as a data URL, so a
project is one self-contained record that survives a reload). Reopening the
editor restores the last project.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + S` | Save |
| `F` | Fit canvas |
| `+` / `-` | Zoom |
| `Delete` | Clear the screenshot |
| `Esc` | Close preview |

On canvas: drag to move, `Alt`-drag to scale, `Shift`-drag to spin, drag the
background to pan, `Ctrl`-scroll to zoom.

## Layout

```
app/            routes — landing and /editor
components/     editor shell, canvas, timeline, panels, shadcn/ui
lib/animation/  easing, engine, presets
lib/canvas/     renderer, device geometry, 3D transforms, image cache
lib/export/     PNG, video, GIF encoder
lib/project/    schema, defaults, IndexedDB persistence, actions
store/          Zustand — project, editor, animation
types/          project and scene contracts
```

## Scope

V1 covers project creation, upload, four device frames, canvas manipulation,
backgrounds, shadows, lighting, animation presets, UI scroll, timeline,
preview, export, local saving and undo/redo. No accounts, backend, AI,
collaboration or multi-scene editing.

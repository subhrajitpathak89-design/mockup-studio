# Framecast

Screenshots and screen recordings, framed. Capture a flow or drop in a
screenshot, put it inside an animated device mockup, and export — without
opening After Effects.

**Record or upload → Mockup → Animate → Preview → Export**

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · shadcn/ui ·
Lucide · Zustand · IndexedDB (`idb`).

## The landing page

`/` is a product page, not just a launcher: hero, capability strip, features,
two screenshot showcases, how-it-works and a closing CTA. It sells the tool;
your work lives in the editor.

Animated pieces come from [React Bits](https://reactbits.dev) — `Aurora` (a WebGL
shader behind the hero), `BlurText`, `ShinyText` and `SpotlightCard`. React Bits
copies source into the repo rather than adding a dependency, so those files
live in `components/` and are ours to edit; `Aurora` carries small local fixes
for a ref write during render and its effect dependencies.

The headline animates via `BlurText`, which renders a paragraph — so the real
`<h1>` is screen-reader-only and the animated copy is `aria-hidden`.

### Screenshots

`npm run shots` drives a real Chrome over the running dev server and captures
`public/shots/` — the sample UI that goes inside the device, the editor, the
Record panel and the export dialog. They are photographs of the product, not
mockups, so re-run it after a UI change and the landing page cannot drift from
what actually ships.

Needs the dev server up, and Chrome at the usual Windows path (override with
`CHROME_PATH` and `SHOTS_BASE`).

## Recording

`/record` is where capture lives: record, review, trim, then the editor. It is
its own route rather than a tool in the editor's rail — a capture starts a
piece of work rather than adjusting the scene you already have. A recording and
an uploaded screenshot land in the same scene, so everything below applies
equally to both.

A recording already in a project is trimmed and muted from the **Upload**
panel, beside the screenshot controls.

### Recording

Capture is `getDisplayMedia` plus `MediaRecorder` (`lib/record/`). The browser
owns the source picker — it cannot be skinned or bypassed. Microphone and
system audio are merged through a WebAudio graph into one track before they
reach the recorder, because two audio tracks produce a file most players only
play half of.

Stopping lands on a review step rather than dropping straight into the editor:
every raw capture has junk on both ends, and trimming it while you still
remember what you recorded beats hunting for trim controls later. Trim is
stored as `trimIn`/`trimOut` and never re-encoded, so it can be widened again.

`MediaRecorder` output often carries no duration in its header, so the session
measures elapsed wall-clock time itself and treats that as authoritative.

| Capability | Status |
| --- | --- |
| Screen / window capture | Yes |
| Microphone | Yes |
| System audio | Chrome and Edge only — the toggle says so elsewhere |
| Auto-zoom on clicks | No. Browsers expose no cursor or click data for other windows; zoom is keyframed by hand |

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
frame, screen content, then lighting. A recording is a texture like any other —
Canvas2D takes a video element through `drawImage` exactly as it takes an
image — so the renderer never learns that video exists. Most device frames are
drawn procedurally, so they stay sharp at any export resolution and can reshape
around the media; MacBook is the exception and ships as artwork.

Rotation X/Y uses a perspective projection of the device quad plus a
homography-based mesh warp (`lib/canvas/transforms.ts`). A pure Z-rotation
takes a fast path that skips the mesh entirely.

The mesh is subdivided to match the tilt rather than to a fixed count. The
error it corrects grows with the angle, so a gentle tilt needs far fewer cells
— and since every cell boundary is a chance to show a seam, the cheapest mesh
that still looks right is also the cleanest. Cells overlap by half a pixel for
the same reason: clip edges are antialiased, so cells that abut exactly let the
background show through as hairlines.

Rendering lives outside React: the canvas subscribes to the stores directly and
repaints on a dirty flag, so scrubbing and playback never re-render the tree.

### Bitmap frames

**MacBook** is artwork rather than geometry (`public/frames/macbook.png`). Its
screen is a transparent hole, so the pipeline needs no mask: the screen content
is painted first and the art is drawn over it in the overlay pass, covering
everything but the hole.

Its numbers were measured off the file rather than guessed — the opaque bounds
of the device and the transparent rectangle inside it — and the spec crops to
those bounds so the file's empty margins cost nothing.

Two passes step aside for artwork frames. The drop shadow falls back to a
contact band under the device, because a laptop's silhouette is nothing like
its bounding box and a box-shaped shadow draws a visible rectangle out past the
lid. The lighting pass is skipped outright: the art already carries its own
highlights, and ours is clipped to the same box.

A bitmap cannot reshape, so **Fit frame to media** is off and disabled for it,
and the panel points at **Laptop** for a frame that does. That is why both
exist: Laptop is procedural and adaptive, MacBook is photoreal and fixed. A
recording still auto-picks Laptop, so captures are never cropped by default.

### Frames and media shape

Device frames ship with a fixed screen aspect, which is fine for a screenshot
you cropped yourself and wrong for a recording. A 16:10 laptop, a 16:9 monitor
and a 21:9 ultrawide all arrive different shapes, and cropping one to fit the
frame throws away the edges — usually the toolbars and controls the demo is
about.

So the frame bends instead (`resolveDeviceSpec`). Bezels, the laptop base and
the browser chrome keep their thickness; only the screen changes shape, and the
body is rebuilt around it. Screen *area* is preserved rather than width, so a
tall capture and a wide one carry the same visual weight instead of one of them
suddenly dominating the canvas. A source already the frame's own aspect returns
the hand-tuned geometry untouched.

It is `device.fitToSource`, on by default and on always for recordings, with a
toggle in the Device panel. Projects saved before it existed load with it off,
so finished work does not silently re-lay-out.

### Backgrounds

Solid, gradient and grid are drawn straight to the 2D context. Two more are not:

**Shaders** — Aurora, Silk, Iridescence and Liquid Chrome, adapted from
[React Bits](https://reactbits.dev). React Bits ships them as React components
that mount their own canvas into the DOM, which is no use here: the scene is one
Canvas2D and export runs offscreen, so a DOM component would show in the editor
and be missing from every exported frame. The GLSL instead runs on our own
offscreen WebGL2 canvas (`lib/canvas/shaders.ts`) and comes back as a texture
for `drawImage`. The important change is the clock — React Bits animates on
`requestAnimationFrame`, this takes scene time as a uniform, which is what makes
a background frame-exact in export and identical across editor, preview and
file. No WebGL2, or a shader that will not compile, falls back to a gradient.

**Photo backdrops** — a curated set of abstract images hotlinked from Unsplash
(`lib/canvas/unsplash.ts`). Their CDN sends `Access-Control-Allow-Origin: *`, so
a backdrop does not taint the canvas and export still works; every id in the
list was checked against the CDN and looked at before it was added. A backdrop
needs a connection the first time it is used, and the gradient stands in while
one is in flight.

The old procedural "light rails" background was replaced by these. Projects
saved with it migrate to the Aurora shader on load.

### Animation

Presets instantiate small clips with `from`/`to`, `delay`, `duration` and an
easing. Values combine with whatever you authored in the property panel —
positions and rotations are added, scale and zoom multiply, opacity is absolute
— so moving the device on canvas never invalidates an applied animation.

### Video

Scene time stays the master clock and the recording follows it (`videoClock`):
press play and the element is told to play, drag the playhead and it is told to
seek. That direction is what keeps `resolveScene` a pure function of time, so
the device animation and the recording run off one clock with no second
animation path to keep in sync.

A recording shorter than the timeline holds its last frame rather than looping,
which would read as a glitch mid-demo.

### Export

| Format | Path | Timing |
| --- | --- | --- |
| PNG | `canvas.toBlob` | exact |
| GIF | in-repo encoder (median cut + LZW, no deps) | exact, offline |
| WebM | `MediaRecorder` on `captureStream` | real time |
| MP4 | `MediaRecorder`, falls back to WebM | real time |

Export gets its own video element rather than borrowing the editor's: two
clocks fighting over one element produce a mistimed export. Real-time capture
plays it; GIF and PNG seek it, so their timing stays exact. Canvas capture
carries no sound, so a recording's audio is muxed in as its own track — which
means audio reaches WebM and MP4 only. PNG and GIF are silent by nature.

Video records in real time, so a 6 second animation takes about 6 seconds. If
the machine cannot keep up — or the browser throttles a backgrounded tab — the
export says so instead of silently handing back a mistimed file. GIF is capped
at 640px wide and 15 fps, since 256 colours is unkind to large gradients.

### Projects

The app has two levels, the way a video editor usually does:

```
/            marketing
/projects    the chooser — pick or create a project
/editor      one project, with the full editing chrome
```

At the chooser there is no scene, so there is no toolbar, tool rail or
timeline: undo, zoom, preview and export would all be acting on a project you
are not looking at. Its own header carries only Record, Upload and New project,
over the same Aurora shader the landing page uses.

### Templates

`/projects` opens on **Start from a template** — scenes with everything except
the screen already set: background, device, framing, motion, sometimes a
caption. You add your recording and it is done.

A template is not a special case for the renderer. A scene is plain JSON, so a
template is literally a scene built from the same presets the Animation panel
offers (`lib/project/templates.ts`), and every control still applies after you
pick one.

The preview on each card is the **real scene through the real renderer**, not a
recorded clip — it animates on hover off its own `requestAnimationFrame` loop
and sits on a settled frame at rest. That keeps them honest for free: change a
preset or a shader and every card changes with it, because there is no second
copy of the artwork to update. Landscape templates fill their card; a 9:16 or
1:1 one is fitted instead, since cropping those to 16:9 would lose the device.

Separate routes rather than a mode inside the editor, so the browser's back
button works and the URL says which level you are on. `/editor` opened cold
restores the last project, and redirects to `/projects` when there is nothing
to restore rather than showing empty chrome. The editor's top-left control
goes back up a level.

Each card's thumbnail is rendered on save (`lib/project/thumbnail.ts`): a 384px
still of the scene at t=0, drawn through the same `renderScene` as everything
else and stored as a JPEG data URL on the project row, around 5KB. It is
deliberately synchronous and draws only from textures already decoded for the
editor, so an autosave never waits on a download; a project whose media is
still loading gets its background now and the rest on the next save. It is not
a copy of the editor canvas, which carries selection outlines and handles.

Switching saves the open project first if it is dirty, so nothing is lost on
the way out.

### Persistence

Projects autosave to IndexedDB, screenshot included (as a data URL, so a
project is one self-contained record that survives a reload). Reopening the
editor restores the last project.

Recordings are the exception: far too large to inline as a data URL, they live
as blobs in a `recordings` store and are referenced by id. A recording's
`source` is an object URL, which dies on reload, so it is stripped on save and
rebuilt from the blob on load. Deleting a project deletes its recording too.

### Timeline

Clips are draggable: the body moves a clip, either edge trims it, and values
snap to a tenth of a second and to the ends of the timeline. Before that the
only way to change timing was to type numbers into the Animation panel, which
is what made the timeline read as a diagram rather than a tool.

Three things keep it legible:

- **One bar per preset.** A preset expands into several clips — "Rise" is an
  opacity clip and a position clip — and one bar each stacked identical
  rectangles. Dragging a group shifts every clip by the same delta so the
  stagger it authored survives. Trimming would have to redistribute durations,
  so it is offered only when a single clip backs the bar.
- **Lane packing.** Clips that overlap in time stack onto separate lanes, and
  the row grows to fit. Two animations starting at zero used to be drawn on top
  of each other: you could see one bar, grab it, and move the other.
- **Zoom.** Pixels-per-second is a real scale with fit / in / out, and the
  ruler picks its tick interval from the zoom, so labels never collide and
  never thin out to two on a long recording.

Each track's base clip — the device, the screen, an overlay — spans the whole
composition and cannot be dragged, because there is nothing behind it to slide
against. The one exception is a screen holding a recording: its edges trim
`trimIn`/`trimOut`, which is the same operation an editor expects from a media
clip, so it is the one base clip with handles.

### Frameless screenshots

`DeviceType` includes `"none"`, whose spec has body and screen as the same
rectangle. Every chrome switch in `devices.ts` falls through it and draws
nothing, so the screenshot itself becomes the object — rounded corners, a
hairline border, a soft shadow, and an optional 3D tilt on a background. It is
the shape most product shots actually want, and the frame devices could not
make.

It costs almost no new code because it still travels the whole device
pipeline: position, scale, the homography mesh warp for tilt, and the existing
device shadow all apply unchanged. Only two things are suppressed — the glass
sheen and the lighting pass, both of which model a frame catching a key light
and read as a smear over bare content — and only one bit of state is new, the
screen's `borderWidth`/`borderColor`.

A frameless screenshot always takes its media's aspect, ignoring
`fitToSource`: there is no frame to preserve, so cropping to a stock rectangle
would only throw pixels away.

Because it rides the device track, every part of it animates. Corner radius,
tilt and shadow are ordinary scene state resolved at a time, so a shot can
start flat and rotate into 3D as its shadow blooms — which is the thing a
static mockup tool cannot export.

### Overlays

An overlay is an image that lives on the scene rather than inside the device:
a logo, a badge, a screenshot pinned beside the mockup. Each one gets its own
timeline row and can sit `front` (over the device) or `behind` it, so the
mockup occludes it.

Overlays reuse the caption animation presets outright. A caption and an image
animate the same four properties — x, y, scale, opacity — so
`lib/animation/engine.ts` resolves overlays into the same map captions use and
`overlayActions.applyAnimation` instantiates the text presets under
`track: "overlay"`. There is no second preset library to keep in sync.

The export renderer runs on its own offscreen canvas and shares no image cache
with the editor, so it decodes every overlay source before the first frame —
otherwise an overlay visible on screen would export as a gap.

On canvas an overlay is dragged by its body and resized from its corners, the
same gesture a caption uses; the corner drives `width` and the height follows
the aspect, so a corner drag cannot squash it. Click priority runs captions,
then overlays, then the device — the order the renderer paints them in — and a
`behind` overlay only answers a click the device did not, so it cannot be
grabbed through the mockup.

A selected overlay carries the same floating bin a caption does, hung off its
top-right corner — the rotated one, so it tracks a spun overlay rather than
drifting onto the bounding box.

Hit-testing happens in the overlay's own unrotated frame rather than against
its bounding box. A rotated overlay's box is much larger than the image inside
it, so the naive test would hand you empty corners and refuse the edges you can
actually see.

### Blending

Captions and overlays both carry a `blendMode`, applied as a Canvas2D
`globalCompositeOperation` around the draw. Captions add stroke and drop shadow
on top of it: the shadow is painted with the stroke pass and cleared before the
fill, so a stroked caption does not get a second shadow from its own outline.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + S` | Save |
| `F` | Fit canvas |
| `+` / `-` | Zoom |
| `Delete` | Clear the screen content |
| `Esc` | Close preview |

On canvas: drag to move, `Alt`-drag to scale, `Shift`-drag to spin, drag the
background to pan, `Ctrl`-scroll to zoom.

## Layout

```
app/            routes — landing, /record and /editor
scripts/        screenshot capture for the landing page
components/     editor shell, canvas, timeline, panels, shadcn/ui
components/record/  the /record front door
lib/animation/  easing, engine, presets
lib/canvas/     renderer, device geometry, transforms, media cache, shaders
lib/export/     PNG, video, GIF encoder
lib/record/     screen capture, editor handoff
lib/project/    schema, defaults, IndexedDB persistence, actions
store/          Zustand — project, editor, animation
types/          project and scene contracts
```

## Scope

Covers project creation, screen recording, upload, four device frames, canvas
manipulation, backgrounds, shadows, lighting, animation presets, UI scroll,
timeline, preview, export, local saving and undo/redo. No accounts, backend,
AI, collaboration or multi-scene editing.

Next: a keyframed zoom track, so a recording can direct the viewer's attention
the way a produced demo does.

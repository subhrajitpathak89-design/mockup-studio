/**
 * Finds the screen inside each photographic mockup.
 *
 * The mockups are photographs with a blown-out white screen, not artwork with
 * a transparent hole, so the screen has to be located rather than declared.
 * That is what makes them tractable: the screen is the only large pure-white
 * region in the frame, and its corners are all we need to warp a screenshot
 * into it.
 *
 *   node scripts/frames.mjs           writes the spec + debug overlays
 *
 * Decoding happens inside headless Chrome because puppeteer is already a
 * dependency and a canvas gives us pixels without hand-rolling a PNG decoder.
 */
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const FRAMES = "public/frames";
const DEBUG = "public/frames/_debug";
const OUT = "lib/canvas/frameQuads.generated.ts";
const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** Files the detector should skip — artwork with a real transparent hole. */
const SKIP = new Set(["macbook.png"]);

/**
 * Runs in the page. Kept as one function so it can be handed to evaluate()
 * whole, which is why it declares its own helpers.
 */
function detect(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("decode failed"));
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);

      // A lit screen is near-white and near-neutral. Backgrounds in these
      // shots get close in brightness (the beige tablet wall especially), so
      // the threshold leans on saturation as much as luminance.
      const isScreen = (i) => {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (data[i + 3] < 128) return false;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return min >= 244 && max - min <= 10;
      };

      const mask = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) mask[p] = isScreen(p * 4) ? 1 : 0;

      // Largest connected run of screen pixels, found with a flood fill that
      // uses an explicit stack — the regions are far too big for recursion.
      const label = new Int32Array(w * h).fill(-1);
      let best = { id: -1, size: 0 };
      let next = 0;
      const stack = new Int32Array(w * h);

      for (let start = 0; start < w * h; start++) {
        if (!mask[start] || label[start] !== -1) continue;
        const id = next++;
        let top = 0;
        let size = 0;
        stack[top++] = start;
        label[start] = id;
        while (top > 0) {
          const p = stack[--top];
          size++;
          const x = p % w;
          const y = (p - x) / w;
          const push = (q) => {
            label[q] = id;
            stack[top++] = q;
          };
          if (x > 0 && mask[p - 1] && label[p - 1] === -1) push(p - 1);
          if (x < w - 1 && mask[p + 1] && label[p + 1] === -1) push(p + 1);
          if (y > 0 && mask[p - w] && label[p - w] === -1) push(p - w);
          if (y < h - 1 && mask[p + w] && label[p + w] === -1) push(p + w);
        }
        if (size > best.size) best = { id, size };
      }

      if (best.id === -1) return reject(new Error("no screen region found"));

      const pts = [];
      for (let p = 0; p < w * h; p++) {
        if (label[p] !== best.id) continue;
        const x = p % w;
        pts.push([x, (p - x) / w]);
      }

      // Convex hull (monotone chain), counter-clockwise in image coords.
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = [];
      for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
          lower.pop();
        lower.push(p);
      }
      const upper = [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
          upper.pop();
        upper.push(p);
      }
      let hull = lower.slice(0, -1).concat(upper.slice(0, -1));

      // Reduce the hull to four corners by repeatedly deleting the edge whose
      // removal adds the least area, extending its neighbours to meet. Screen
      // corners are rounded, so the hull arrives with a chamfer at each one —
      // this walks those back to where the straight edges would actually meet.
      const lineIntersect = (p1, p2, p3, p4) => {
        const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
        if (Math.abs(d) < 1e-9) return null;
        const t =
          ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
        return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
      };

      while (hull.length > 4) {
        let cheapest = { area: Infinity, index: -1, point: null };
        for (let i = 0; i < hull.length; i++) {
          const n = hull.length;
          const prev2 = hull[(i - 1 + n) % n];
          const a = hull[i];
          const b = hull[(i + 1) % n];
          const next2 = hull[(i + 2) % n];
          const q = lineIntersect(prev2, a, b, next2);
          if (!q) continue;
          // Area of the triangle the deletion adds.
          const area = Math.abs(cross(a, b, q)) / 2;
          if (area < cheapest.area) cheapest = { area, index: i, point: q };
        }
        if (cheapest.index === -1) break;
        const n = hull.length;
        const out = [];
        for (let i = 0; i < n; i++) {
          if (i === cheapest.index) {
            out.push(cheapest.point);
          } else if (i === (cheapest.index + 1) % n) {
            // The second endpoint of the deleted edge is replaced by the
            // intersection already pushed above.
          } else {
            out.push(hull[i]);
          }
        }
        hull = out;
      }

      // Order the corners as top-left, top-right, bottom-right, bottom-left so
      // downstream code can rely on the winding.
      const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
      const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
      const corner = (fx, fy) =>
        hull.reduce((bestPt, p) =>
          fx * (p[0] - cx) + fy * (p[1] - cy) >
          fx * (bestPt[0] - cx) + fy * (bestPt[1] - cy)
            ? p
            : bestPt,
        );
      const quad = [
        corner(-1, -1),
        corner(1, -1),
        corner(1, 1),
        corner(-1, 1),
      ].map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);

      // Opaque bounds, so a frame with transparent margins costs nothing.
      resolve({ width: w, height: h, area: best.size, quad });
    };
    img.src = dataUrl;
  });
}

/** Paints the detected quad over the source so a human can check it. */
function overlay(dataUrl, quad) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      ctx.lineWidth = Math.max(3, img.naturalWidth / 400);
      ctx.strokeStyle = "#ff2d78";
      ctx.beginPath();
      quad.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#00e5ff";
      quad.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], ctx.lineWidth * 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      resolve(c.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
});

try {
  await mkdir(DEBUG, { recursive: true });
  const page = await browser.newPage();
  await page.goto("about:blank");

  const files = (await readdir(FRAMES))
    .filter((f) => f.toLowerCase().endsWith(".png") && !SKIP.has(f))
    .sort();

  const results = [];
  for (const file of files) {
    const buf = await readFile(path.join(FRAMES, file));
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;

    const found = await page.evaluate(detect, dataUrl);
    results.push({ file, ...found });

    const png = await page.evaluate(overlay, dataUrl, found.quad);
    await writeFile(
      path.join(DEBUG, file),
      Buffer.from(png.split(",")[1], "base64"),
    );

    const coverage = ((found.area / (found.width * found.height)) * 100).toFixed(1);
    console.log(
      `✓ ${file.padEnd(22)} ${found.width}×${found.height}  screen ${coverage}%  ` +
        found.quad.map(([x, y]) => `(${x},${y})`).join(" "),
    );
  }

  const body = results
    .map(
      (r) => `  "${r.file}": {
    width: ${r.width},
    height: ${r.height},
    quad: [${r.quad.map(([x, y]) => `[${x}, ${y}]`).join(", ")}],
  },`,
    )
    .join("\n");

  await writeFile(
    OUT,
    `// Generated by \`node scripts/frames.mjs\`. Do not edit by hand.
//
// Each quad is the screen's four corners in the artwork's own pixels, ordered
// top-left, top-right, bottom-right, bottom-left.
import type { FrameQuad } from "./frameTypes";

export const FRAME_QUADS: Record<string, FrameQuad> = {
${body}
};
`,
  );
  console.log(`\nWrote ${OUT} and ${results.length} overlays to ${DEBUG}`);
} finally {
  await browser.close();
}

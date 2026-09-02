import type { BackgroundState } from "@/types";

/**
 * Light rails: glowing beams that converge on a horizontal centre line and
 * flare away from it, each with a hot near-white core inside a coloured outer
 * glow. Drawn procedurally and driven by the timeline clock, so it animates in
 * preview and comes out of export at full resolution.
 */
export function drawRails(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundState,
  width: number,
  height: number,
  time: number,
  offset: number,
) {
  ctx.save();
  ctx.fillStyle = "#050507";
  ctx.fillRect(0, 0, width, height);

  const count = Math.max(1, Math.round(bg.railCount));
  const midY = height / 2;
  const phase = time * bg.railSpeed;

  // Beams add light on top of one another rather than occluding.
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const centred = t - 0.5;

    // Two motions, deliberately out of step so the fan never looks like it is
    // marching: the whole bundle sweeps, and each beam breathes on its own.
    const sweep = Math.sin(phase * 0.7) * 0.06;
    const breathe = Math.sin(phase * 1.6 + i * 1.1) * 0.05;
    const x = width / 2 + (centred * 0.2 + sweep + breathe) * width + offset;

    // The flare opens and closes over the cycle, which is what reads as
    // "alive" far more than translation does.
    const openness = 0.75 + 0.35 * Math.sin(phase * 1.1 + i * 0.6);
    const lean = centred * bg.railSpread * width * 0.95 * openness;

    // Each beam's brightness pulses on its own offset.
    const pulse = 0.65 + 0.45 * Math.sin(phase * 2.1 + i * 1.7);

    drawBeam(ctx, x, midY, -1, lean, height, bg, bg.color1, i, phase, pulse);
    drawBeam(ctx, x, midY, 1, lean, height, bg, bg.color2, i, phase, pulse);
  }

  // A soft bloom over the whole field ties the beams together, breathing with
  // the bundle so the centre line never sits perfectly still.
  const bloomPulse = 0.8 + 0.3 * Math.sin(phase * 1.3);
  const band = height * 0.24;
  const bloom = ctx.createLinearGradient(0, midY - band, 0, midY + band);
  bloom.addColorStop(0, "rgba(255,255,255,0)");
  bloom.addColorStop(0.5, `rgba(255,255,255,${0.24 * bg.railGlow * bloomPulse})`);
  bloom.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, midY - band, width, band * 2);

  ctx.restore();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  midY: number,
  dir: -1 | 1,
  lean: number,
  height: number,
  bg: BackgroundState,
  color: string,
  index: number,
  phase: number,
  pulse: number,
) {
  const reach = height * 0.62;
  const steps = 26;
  // Narrow where the beams meet, wide at the far end — the flare.
  const baseHalf = height * 0.014;
  const tipHalf = height * (0.05 + bg.railSpread * 0.06);
  const curve = 1.6;
  const glow = bg.railGlow * pulse;

  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const eased = Math.pow(u, curve);
    const y = midY + dir * u * reach;
    // A travelling S-warp: the wave itself moves along the beam over time.
    const warp =
      Math.sin(u * Math.PI * 1.4 - phase * 1.8 + index) * height * 0.018 * u;
    const cx = x + lean * eased + warp;
    const half = baseHalf + (tipHalf - baseHalf) * eased;
    left.push([cx - half, y]);
    right.push([cx + half, y]);
  }

  const grad = ctx.createLinearGradient(x, midY, x + lean, midY + dir * reach);
  grad.addColorStop(0, withAlpha(color, 0.95 * glow));
  grad.addColorStop(0.45, withAlpha(color, 0.5 * glow));
  grad.addColorStop(1, withAlpha(color, 0));

  fillRibbon(ctx, left, right, 1, grad);

  // Hot core: a much narrower white streak that gives the beam its heat.
  const core = ctx.createLinearGradient(x, midY, x + lean, midY + dir * reach);
  core.addColorStop(0, `rgba(255,255,255,${Math.min(1, 1.0 * glow)})`);
  core.addColorStop(0.35, `rgba(255,255,255,${0.45 * glow})`);
  core.addColorStop(0.7, `rgba(255,255,255,${0.12 * glow})`);
  core.addColorStop(1, "rgba(255,255,255,0)");

  fillRibbon(ctx, left, right, 0.34, core);
}

/** Fills the band between two edges, optionally narrowed toward its centre. */
function fillRibbon(
  ctx: CanvasRenderingContext2D,
  left: [number, number][],
  right: [number, number][],
  width: number,
  fill: CanvasGradient,
) {
  ctx.beginPath();
  for (let i = 0; i < left.length; i++) {
    const mid = (left[i][0] + right[i][0]) / 2;
    const half = ((right[i][0] - left[i][0]) / 2) * width;
    const x = mid - half;
    if (i === 0) ctx.moveTo(x, left[i][1]);
    else ctx.lineTo(x, left[i][1]);
  }
  for (let i = left.length - 1; i >= 0; i--) {
    const mid = (left[i][0] + right[i][0]) / 2;
    const half = ((right[i][0] - left[i][0]) / 2) * width;
    ctx.lineTo(mid + half, left[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Accepts #rgb / #rrggbb and returns an rgba() string at `alpha`. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full.slice(0, 6) || "ffffff", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

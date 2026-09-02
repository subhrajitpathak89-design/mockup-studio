import type { BackgroundState } from "@/types";

/**
 * Light rails: glowing beams that converge on a horizontal centre line and
 * flare away from it, each with a hot near-white core inside a coloured
 * outer glow. Drawn procedurally so it animates with the timeline and comes
 * out of export at full resolution.
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
    // Spread the bundle evenly, then drift each beam on its own slow cycle so
    // the fan breathes instead of sitting still.
    const t = count === 1 ? 0.5 : i / (count - 1);
    const centred = t - 0.5;
    const drift = Math.sin(phase + i * 0.9) * 0.045;
    const x = width / 2 + (centred * 0.22 + drift) * width + offset;

    const lean = centred * bg.railSpread * width * 0.9;
    const colorUp = bg.color1;
    const colorDown = bg.color2;

    drawBeam(ctx, x, midY, -1, lean, height, bg, colorUp, i, phase);
    drawBeam(ctx, x, midY, 1, lean, height, bg, colorDown, i, phase);
  }

  // A soft bloom over the whole field ties the beams together.
  const bloom = ctx.createLinearGradient(0, midY - height * 0.2, 0, midY + height * 0.2);
  bloom.addColorStop(0, "rgba(255,255,255,0)");
  bloom.addColorStop(0.5, `rgba(255,255,255,${0.22 * bg.railGlow})`);
  bloom.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, midY - height * 0.2, width, height * 0.4);

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
) {
  const reach = height * 0.62;
  const steps = 26;
  // Narrow where the beams meet, wide at the far end — the flare.
  const baseHalf = height * 0.014;
  const tipHalf = height * (0.05 + bg.railSpread * 0.06);
  const curve = 1.6;

  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const eased = Math.pow(u, curve);
    const y = midY + dir * u * reach;
    // A gentle S-warp keeps the beams from reading as straight triangles.
    const warp = Math.sin(u * Math.PI * 0.8 + phase * 0.5 + index) * height * 0.012;
    const cx = x + lean * eased + warp;
    const half = baseHalf + (tipHalf - baseHalf) * eased;
    left.push([cx - half, y]);
    right.push([cx + half, y]);
  }

  const grad = ctx.createLinearGradient(x, midY, x + lean, midY + dir * reach);
  grad.addColorStop(0, withAlpha(color, 0.95 * bg.railGlow));
  grad.addColorStop(0.45, withAlpha(color, 0.5 * bg.railGlow));
  grad.addColorStop(1, withAlpha(color, 0));

  ctx.beginPath();
  left.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Hot core: a much narrower white streak that gives the beam its heat.
  const core = ctx.createLinearGradient(x, midY, x + lean, midY + dir * reach);
  core.addColorStop(0, `rgba(255,255,255,${1.0 * bg.railGlow})`);
  core.addColorStop(0.35, `rgba(255,255,255,${0.45 * bg.railGlow})`);
  core.addColorStop(0.7, `rgba(255,255,255,${0.12 * bg.railGlow})`);
  core.addColorStop(1, "rgba(255,255,255,0)");

  ctx.beginPath();
  left.forEach(([px, py], i) => {
    const rx = right[i][0];
    const mid = (px + rx) / 2;
    const w = (rx - px) * 0.34;
    if (i === 0) ctx.moveTo(mid - w, py);
    else ctx.lineTo(mid - w, py);
  });
  for (let i = left.length - 1; i >= 0; i--) {
    const mid = (left[i][0] + right[i][0]) / 2;
    const w = (right[i][0] - left[i][0]) * 0.34;
    ctx.lineTo(mid + w, left[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = core;
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

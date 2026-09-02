export interface Point {
  x: number;
  y: number;
}

const DEG = Math.PI / 180;

/** Distance of the virtual camera from the scene plane, in device units. */
export const PERSPECTIVE = 2600;

/**
 * Projects the four corners of a `width` x `height` plane after rotating it
 * around X, Y and Z, then applying a perspective divide. Returns points in a
 * space centred on the origin, ready to be translated onto the canvas.
 */
export function projectQuad(
  width: number,
  height: number,
  rotXDeg: number,
  rotYDeg: number,
  rotZDeg: number,
  scale: number,
): [Point, Point, Point, Point] {
  const rx = rotXDeg * DEG;
  const ry = rotYDeg * DEG;
  const rz = rotZDeg * DEG;

  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);

  const hw = width / 2;
  const hh = height / 2;
  const corners: Point[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];

  return corners.map((p) => {
    // Z rotation.
    let x = p.x * cz - p.y * sz;
    let y = p.x * sz + p.y * cz;
    let z = 0;

    // Y rotation.
    const x1 = x * cy + z * sy;
    z = -x * sy + z * cy;
    x = x1;

    // X rotation.
    const y1 = y * cx - z * sx;
    z = y * sx + z * cx;
    y = y1;

    const k = (PERSPECTIVE / (PERSPECTIVE - z)) * scale;
    return { x: x * k, y: y * k };
  }) as [Point, Point, Point, Point];
}

export interface Homography {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

/**
 * Homography mapping the unit square (0,0)(1,0)(1,1)(0,1) onto `quad`.
 * Used to warp the flat device texture onto the projected quad.
 */
export function squareToQuad(quad: [Point, Point, Point, Point]): Homography {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sumX = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sumY = p0.y - p1.y + p2.y - p3.y;

  const det = dx1 * dy2 - dx2 * dy1;
  let g = 0;
  let h = 0;
  if (Math.abs(det) > 1e-9) {
    g = (sumX * dy2 - dx2 * sumY) / det;
    h = (dx1 * sumY - sumX * dy1) / det;
  }

  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

export function applyHomography(m: Homography, u: number, v: number): Point {
  const denom = m.g * u + m.h * v + 1;
  return {
    x: (m.a * u + m.b * v + m.c) / denom,
    y: (m.d * u + m.e * v + m.f) / denom,
  };
}

/**
 * Draws `texture` warped onto the projected quad by splitting it into a mesh
 * of triangles, each drawn with an affine approximation. `segments` trades
 * accuracy for speed; the error shrinks quadratically with the cell size.
 */
export function drawWarpedTexture(
  ctx: CanvasRenderingContext2D,
  texture: CanvasImageSource,
  texWidth: number,
  texHeight: number,
  quad: [Point, Point, Point, Point],
  segments = 12,
) {
  const m = squareToQuad(quad);
  const grid: Point[][] = [];
  for (let iy = 0; iy <= segments; iy++) {
    const row: Point[] = [];
    for (let ix = 0; ix <= segments; ix++) {
      row.push(applyHomography(m, ix / segments, iy / segments));
    }
    grid.push(row);
  }

  const cw = texWidth / segments;
  const ch = texHeight / segments;

  for (let iy = 0; iy < segments; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const p00 = grid[iy][ix];
      const p10 = grid[iy][ix + 1];
      const p01 = grid[iy + 1][ix];
      const p11 = grid[iy + 1][ix + 1];

      const sx = ix * cw;
      const sy = iy * ch;

      drawTriangle(ctx, texture, sx, sy, sx + cw, sy, sx, sy + ch, p00, p10, p01);
      drawTriangle(
        ctx,
        texture,
        sx + cw,
        sy,
        sx + cw,
        sy + ch,
        sx,
        sy + ch,
        p10,
        p11,
        p01,
      );
    }
  }
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  texture: CanvasImageSource,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  q0: Point,
  q1: Point,
  q2: Point,
) {
  const denom = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(denom) < 1e-9) return;

  const a = ((q1.x - q0.x) * (v2 - v0) - (q2.x - q0.x) * (v1 - v0)) / denom;
  const b = ((q2.x - q0.x) * (u1 - u0) - (q1.x - q0.x) * (u2 - u0)) / denom;
  const c = ((q1.y - q0.y) * (v2 - v0) - (q2.y - q0.y) * (v1 - v0)) / denom;
  const d = ((q2.y - q0.y) * (u1 - u0) - (q1.y - q0.y) * (u2 - u0)) / denom;
  const e = q0.x - a * u0 - b * v0;
  const f = q0.y - c * u0 - d * v0;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(q0.x, q0.y);
  ctx.lineTo(q1.x, q1.y);
  ctx.lineTo(q2.x, q2.y);
  ctx.closePath();
  // Expand the clip by a hair so neighbouring cells do not show seams.
  ctx.clip();
  ctx.transform(a, c, b, d, e, f);
  ctx.drawImage(texture, 0, 0);
  ctx.restore();
}

/** Axis-aligned bounds of a projected quad, for hit-testing on canvas. */
export function quadBounds(quad: Point[]) {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function pointInQuad(quad: Point[], px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const xi = quad[i].x,
      yi = quad[i].y;
    const xj = quad[j].x,
      yj = quad[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

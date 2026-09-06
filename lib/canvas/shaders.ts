"use client";

/**
 * Shader backgrounds.
 *
 * The fragment shaders are adapted from React Bits (reactbits.dev) — Aurora,
 * Silk, Iridescence and Liquid Chrome. React Bits ships them as React
 * components that mount their own canvas into the DOM, which is no use here:
 * the scene is drawn to a single Canvas2D and exported from an offscreen one,
 * so a DOM component would be visible in the editor and absent from every
 * exported frame.
 *
 * Instead the GLSL is run here on our own offscreen WebGL2 canvas and handed
 * back as a texture to `drawImage`. The crucial difference from the React
 * version is the clock: those animate on `requestAnimationFrame`, this takes
 * scene time as a uniform. That is what keeps a background frame-exact in
 * export and identical between the editor, the preview and the file.
 */

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorStops[3];
uniform float uAmplitude;
uniform float uScale;
out vec4 fragColor;
`;

/** Simplex noise, as used by React Bits' Aurora. */
const SNOISE = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

export interface ShaderDef {
  id: string;
  label: string;
  frag: string;
}

export const BACKGROUND_SHADERS: ShaderDef[] = [
  {
    id: "aurora",
    label: "Aurora",
    frag: `${COMMON}${SNOISE}
vec3 ramp(float f) {
  return f < 0.5
    ? mix(uColorStops[0], uColorStops[1], f * 2.0)
    : mix(uColorStops[1], uColorStops[2], (f - 0.5) * 2.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 rampColor = ramp(uv.x);
  float h = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  h = exp(h);
  h = (uv.y * 2.0 - h + 0.2);
  float intensity = 0.6 * h;
  float alpha = smoothstep(-0.05, 0.45, intensity);
  // Composited over near-black here rather than left transparent: this is a
  // background, and the scene behind it is nothing.
  fragColor = vec4(intensity * rampColor * alpha, 1.0);
}
`,
  },
  {
    id: "silk",
    label: "Silk",
    frag: `${COMMON}
const float e = 2.71828182845904523536;
float noise(vec2 p) {
  vec2 r = (e * sin(e * p));
  return fract(r.x * r.y * (1.0 + p.x));
}
vec2 rot(vec2 uv, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * uv;
}
void main() {
  float rnd = noise(gl_FragCoord.xy);
  vec2 uv = rot(vUv * uScale, 0.6);
  vec2 tex = uv * uScale;
  tex.y += 0.03 * sin(8.0 * tex.x - uTime);
  float pattern = 0.6 + 0.4 * sin(
      5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * uTime)
    + sin(20.0 * (tex.x + tex.y - 0.1 * uTime)));
  float grain = rnd / 18.0;
  vec3 col = mix(uColorStops[0], uColorStops[2], pattern) * (0.5 + 0.7 * pattern);
  fragColor = vec4(clamp(col - grain, 0.0, 1.0), 1.0);
}
`,
  },
  {
    id: "iridescence",
    label: "Iridescence",
    frag: `${COMMON}
void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv * 2.0 - 1.0) * uResolution / mr;
  float d = -uTime * 0.5;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5)
      * mix(uColorStops[0], uColorStops[2], 0.5) * 2.0;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  },
  {
    id: "chrome",
    label: "Liquid Chrome",
    frag: `${COMMON}
vec3 sample(vec2 coord) {
  vec2 uv = (2.0 * coord - uResolution) / min(uResolution.x, uResolution.y);
  for (float i = 1.0; i < 10.0; i++) {
    uv.x += uAmplitude / i * cos(i * 3.0 * uv.y + uTime);
    uv.y += uAmplitude / i * cos(i * 3.0 * uv.x + uTime);
  }
  vec3 base = mix(uColorStops[0], uColorStops[2], 0.5);
  return base / abs(sin(uTime - uv.y - uv.x));
}
void main() {
  // This pattern turns to sparkle without supersampling. React Bits takes 3x3
  // samples; 2x2 is a quarter cheaper at 1080p and the difference does not
  // survive an export.
  vec2 coord = vUv * uResolution;
  vec3 col = (sample(coord + vec2(-0.25, -0.25))
            + sample(coord + vec2(0.25, -0.25))
            + sample(coord + vec2(-0.25, 0.25))
            + sample(coord + vec2(0.25, 0.25))) * 0.25;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
  },
];

export function shaderById(id: string): ShaderDef {
  return BACKGROUND_SHADERS.find((s) => s.id === id) ?? BACKGROUND_SHADERS[0];
}

/** Largest backing store we will render a background at. */
const MAX_DIM = 2560;

interface Compiled {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

let canvas: HTMLCanvasElement | null = null;
let gl: WebGL2RenderingContext | null = null;
let failed = false;
const programs = new Map<string, Compiled | null>();

function ensureContext(): WebGL2RenderingContext | null {
  if (failed) return null;
  if (gl) return gl;
  if (typeof document === "undefined") return null;

  canvas = document.createElement("canvas");
  const created = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    // Read back by drawImage on the very next line, so the buffer has to
    // survive the frame it was drawn in.
    preserveDrawingBuffer: true,
  });
  if (!created) {
    failed = true;
    return null;
  }
  gl = created;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One oversized triangle covers the viewport with no seam down the middle.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  return gl;
}

function compile(id: string): Compiled | null {
  const ctx = gl;
  if (!ctx) return null;

  const cached = programs.get(id);
  if (cached !== undefined) return cached;

  const def = shaderById(id);
  const build = (type: number, source: string) => {
    const shader = ctx.createShader(type)!;
    ctx.shaderSource(shader, source);
    ctx.compileShader(shader);
    if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
      console.warn(`Background shader "${id}" failed:`, ctx.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };

  const vs = build(ctx.VERTEX_SHADER, VERT);
  const fs = build(ctx.FRAGMENT_SHADER, def.frag);
  if (!vs || !fs) {
    programs.set(id, null);
    return null;
  }

  const program = ctx.createProgram()!;
  ctx.attachShader(program, vs);
  ctx.attachShader(program, fs);
  ctx.bindAttribLocation(program, 0, "position");
  ctx.linkProgram(program);
  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    programs.set(id, null);
    return null;
  }

  const compiled: Compiled = {
    program,
    uniforms: {
      uTime: ctx.getUniformLocation(program, "uTime"),
      uResolution: ctx.getUniformLocation(program, "uResolution"),
      uColorStops: ctx.getUniformLocation(program, "uColorStops"),
      uAmplitude: ctx.getUniformLocation(program, "uAmplitude"),
      uScale: ctx.getUniformLocation(program, "uScale"),
    },
  };
  programs.set(id, compiled);
  return compiled;
}

export interface ShaderOptions {
  colors: [string, string, string];
  amplitude: number;
  scale: number;
}

/**
 * Renders one frame and hands back the canvas holding it. Null means WebGL2 is
 * unavailable or the shader would not compile — the caller paints a gradient
 * instead rather than leaving a hole in the scene.
 */
export function renderShaderFrame(
  id: string,
  width: number,
  height: number,
  time: number,
  options: ShaderOptions,
): HTMLCanvasElement | null {
  const ctx = ensureContext();
  if (!ctx || !canvas) return null;

  const compiled = compile(id);
  if (!compiled) return null;

  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.viewport(0, 0, w, h);
  ctx.useProgram(compiled.program);
  ctx.enableVertexAttribArray(0);
  ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0);

  const { uniforms } = compiled;
  if (uniforms.uTime) ctx.uniform1f(uniforms.uTime, time);
  if (uniforms.uResolution) ctx.uniform2f(uniforms.uResolution, w, h);
  if (uniforms.uAmplitude) ctx.uniform1f(uniforms.uAmplitude, options.amplitude);
  if (uniforms.uScale) ctx.uniform1f(uniforms.uScale, options.scale);
  if (uniforms.uColorStops) {
    const stops = new Float32Array(9);
    options.colors.forEach((hex, i) => {
      const [r, g, b] = toRgb(hex);
      stops[i * 3] = r;
      stops[i * 3 + 1] = g;
      stops[i * 3 + 2] = b;
    });
    ctx.uniform3fv(uniforms.uColorStops, stops);
  }

  ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  return canvas;
}

/** Hex to linear-ish 0..1 RGB. The shaders work in plain sRGB values. */
function toRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

/** Midpoint colour, so a two-swatch UI can drive a three-stop ramp. */
export function midColor(a: string, b: string): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex((r1 + r2) / 2)}${hex((g1 + g2) / 2)}${hex((b1 + b2) / 2)}`;
}

/**
 * Minimal GIF89a encoder — median-cut quantisation plus LZW, no dependencies.
 * GIF is a 256-colour format, so exports are capped to a modest width and
 * frame rate; anything larger belongs in the WebM path.
 */

class ByteStream {
  private bytes: number[] = [];

  writeByte(b: number) {
    this.bytes.push(b & 0xff);
  }
  writeBytes(arr: number[] | Uint8Array) {
    for (const b of arr) this.writeByte(b);
  }
  writeShort(v: number) {
    this.writeByte(v & 0xff);
    this.writeByte((v >> 8) & 0xff);
  }
  writeString(s: string) {
    for (let i = 0; i < s.length; i++) this.writeByte(s.charCodeAt(i));
  }
  toUint8Array() {
    return new Uint8Array(this.bytes);
  }
}

interface Box {
  pixels: number[][];
}

/** Median-cut colour quantisation down to at most `max` colours. */
function medianCut(pixels: number[][], max: number): number[][] {
  if (pixels.length === 0) return [[0, 0, 0]];
  let boxes: Box[] = [{ pixels }];

  while (boxes.length < max) {
    // Split the box with the widest channel range.
    let target = -1;
    let bestRange = 0;
    let bestChannel = 0;

    boxes.forEach((box, i) => {
      if (box.pixels.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let min = 255;
        let maxV = 0;
        for (const p of box.pixels) {
          if (p[c] < min) min = p[c];
          if (p[c] > maxV) maxV = p[c];
        }
        const range = maxV - min;
        if (range > bestRange) {
          bestRange = range;
          target = i;
          bestChannel = c;
        }
      }
    });

    if (target === -1 || bestRange === 0) break;

    const box = boxes[target];
    box.pixels.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = box.pixels.length >> 1;
    boxes = [
      ...boxes.slice(0, target),
      { pixels: box.pixels.slice(0, mid) },
      { pixels: box.pixels.slice(mid) },
      ...boxes.slice(target + 1),
    ];
  }

  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const p of box.pixels) {
      r += p[0];
      g += p[1];
      b += p[2];
    }
    const n = box.pixels.length || 1;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function buildPalette(data: Uint8ClampedArray, sampleStride: number) {
  const samples: number[][] = [];
  for (let i = 0; i < data.length; i += 4 * sampleStride) {
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  const palette = medianCut(samples, 256);
  while (palette.length < 2) palette.push([0, 0, 0]);
  return palette;
}

function nearestIndex(
  palette: number[][],
  r: number,
  g: number,
  b: number,
  cache: Map<number, number>,
) {
  const key = (r >> 2) * 4096 + (g >> 2) * 64 + (b >> 2);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = palette[i][0] - r;
    const dg = palette[i][1] - g;
    const db = palette[i][2] - b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  cache.set(key, best);
  return best;
}

function lzwEncode(indices: Uint8Array, colorDepth: number): number[] {
  const minCodeSize = Math.max(2, colorDepth);
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<string, number>();

  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  const resetDict = () => {
    dict = new Map();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  emit(clearCode);
  resetDict();

  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = String(indices[i]);
    const combined = `${prefix},${k}`;
    if (dict.has(combined)) {
      prefix = combined;
      continue;
    }

    emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix));
    dict.set(combined, nextCode++);
    if (nextCode > 1 << codeSize) {
      if (codeSize < 12) {
        codeSize++;
      } else {
        emit(clearCode);
        resetDict();
      }
    }
    prefix = k;
  }

  emit(prefix.includes(",") ? dict.get(prefix)! : Number(prefix));
  emit(eoiCode);

  if (bitCount > 0) out.push(bitBuffer & 0xff);
  return out;
}

export class GifEncoder {
  private stream = new ByteStream();
  private started = false;

  constructor(
    private width: number,
    private height: number,
    private delayCentis: number,
  ) {}

  private writeHeader() {
    this.stream.writeString("GIF89a");
    this.stream.writeShort(this.width);
    this.stream.writeShort(this.height);
    // No global colour table; every frame carries a local one.
    this.stream.writeByte(0x70);
    this.stream.writeByte(0);
    this.stream.writeByte(0);

    // Netscape looping extension.
    this.stream.writeByte(0x21);
    this.stream.writeByte(0xff);
    this.stream.writeByte(11);
    this.stream.writeString("NETSCAPE2.0");
    this.stream.writeByte(3);
    this.stream.writeByte(1);
    this.stream.writeShort(0);
    this.stream.writeByte(0);
  }

  addFrame(imageData: ImageData) {
    if (!this.started) {
      this.started = true;
      this.writeHeader();
    }

    const { data } = imageData;
    const stride = Math.max(1, Math.floor(data.length / 4 / 20000));
    const palette = buildPalette(data, stride);

    const depth = Math.max(1, Math.ceil(Math.log2(palette.length)));
    const tableSize = 1 << depth;

    const cache = new Map<number, number>();
    const indices = new Uint8Array(this.width * this.height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      indices[p] = nearestIndex(palette, data[i], data[i + 1], data[i + 2], cache);
    }

    // Graphic control extension (frame delay).
    this.stream.writeByte(0x21);
    this.stream.writeByte(0xf9);
    this.stream.writeByte(4);
    this.stream.writeByte(0x04);
    this.stream.writeShort(this.delayCentis);
    this.stream.writeByte(0);
    this.stream.writeByte(0);

    // Image descriptor with a local colour table.
    this.stream.writeByte(0x2c);
    this.stream.writeShort(0);
    this.stream.writeShort(0);
    this.stream.writeShort(this.width);
    this.stream.writeShort(this.height);
    this.stream.writeByte(0x80 | (depth - 1));

    for (let i = 0; i < tableSize; i++) {
      const c = palette[i] ?? [0, 0, 0];
      this.stream.writeByte(c[0]);
      this.stream.writeByte(c[1]);
      this.stream.writeByte(c[2]);
    }

    const minCodeSize = Math.max(2, depth);
    this.stream.writeByte(minCodeSize);

    const encoded = lzwEncode(indices, depth);
    for (let i = 0; i < encoded.length; i += 255) {
      const chunk = encoded.slice(i, i + 255);
      this.stream.writeByte(chunk.length);
      this.stream.writeBytes(chunk);
    }
    this.stream.writeByte(0);
  }

  finish(): Blob {
    this.stream.writeByte(0x3b);
    return new Blob([this.stream.toUint8Array()], { type: "image/gif" });
  }
}

"use client";

/**
 * Decoding a screenshot is expensive and the renderer needs it on every frame,
 * so each source string is decoded exactly once and held here.
 */
const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function getCachedImage(source: string): HTMLImageElement | null {
  if (!source) return null;
  return cache.get(source) ?? null;
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  if (!source) return Promise.reject(new Error("No image source"));

  const hit = cache.get(source);
  if (hit) return Promise.resolve(hit);

  const inflight = pending.get(source);
  if (inflight) return inflight;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cache.set(source, img);
      pending.delete(source);
      resolve(img);
    };
    img.onerror = () => {
      pending.delete(source);
      reject(new Error("Failed to decode image"));
    };
    img.src = source;
  });

  pending.set(source, promise);
  return promise;
}

export interface ReadImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function isAcceptedImage(file: File | null): file is File {
  return !!file && ACCEPTED.includes(file.type);
}

/**
 * Reads an upload into a data URL. Data URLs (rather than object URLs) mean a
 * saved project survives a reload without a second storage mechanism.
 */
export async function readImageFile(file: File): Promise<ReadImageResult> {
  if (!isAcceptedImage(file)) {
    throw new Error("Supported formats: PNG, JPG, WebP");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  const img = await loadImage(dataUrl);
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
}

/** Pulls the first image out of a paste or drop event, if there is one. */
export function imageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (isAcceptedImage(file)) return file;
    }
  }
  for (const file of Array.from(dt.files ?? [])) {
    if (isAcceptedImage(file)) return file;
  }
  return null;
}

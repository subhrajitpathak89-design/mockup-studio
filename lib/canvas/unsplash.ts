/**
 * A curated set of abstract backdrops from Unsplash.
 *
 * Hotlinked rather than bundled, which is what Unsplash asks for — and their
 * CDN sends `Access-Control-Allow-Origin: *`, so a background drawn from one
 * does not taint the canvas and export still works.
 *
 * Every id here was checked against the CDN and eyeballed before it landed in
 * the list. Adding one blind is how you ship a background that 404s.
 */
export interface BackdropDef {
  id: string;
  label: string;
  /** Unsplash photo id — the `photo-…` segment of the CDN path. */
  photo: string;
  /** Roughly how dark the image is, so text and device shadows can adapt. */
  tone: "dark" | "light";
}

export const BACKDROPS: BackdropDef[] = [
  { id: "indigo-haze", label: "Indigo Haze", photo: "photo-1557683316-973673baf926", tone: "dark" },
  { id: "prism", label: "Prism", photo: "photo-1550859492-d5da9d8e45f3", tone: "light" },
  { id: "spectrum", label: "Spectrum", photo: "photo-1579546929518-9e396f3cc809", tone: "light" },
  { id: "porcelain", label: "Porcelain", photo: "photo-1558591710-4b4a1ae0f04d", tone: "light" },
  { id: "blush", label: "Blush", photo: "photo-1554189097-ffe88e998a2b", tone: "light" },
  { id: "ink", label: "Ink", photo: "photo-1541701494587-cb58502866ab", tone: "dark" },
  { id: "ribbon", label: "Ribbon", photo: "photo-1618005182384-a83a8bd57fbe", tone: "dark" },
  { id: "dusk-neon", label: "Dusk Neon", photo: "photo-1614850523459-c2f4c699c52e", tone: "dark" },
  { id: "plaster", label: "Plaster", photo: "photo-1531685250784-7569952593d2", tone: "light" },
  { id: "nebula", label: "Nebula", photo: "photo-1462331940025-496dfbfc7564", tone: "dark" },
  { id: "starfield", label: "Starfield", photo: "photo-1534796636912-3b95b3ab5986", tone: "dark" },
  { id: "deep-space", label: "Deep Space", photo: "photo-1506318137071-a8e063b4bec0", tone: "dark" },
];

const CDN = "https://images.unsplash.com";

/**
 * Full-size URL for rendering. Capped at 2400px: a 1080p export never needs
 * more, and the original files run to 6000px and several megabytes.
 */
export function backdropUrl(photo: string, width = 2400): string {
  return `${CDN}/${photo}?auto=format&fit=crop&q=80&w=${width}`;
}

/** Small URL for the picker grid. */
export function backdropThumb(photo: string): string {
  return `${CDN}/${photo}?auto=format&fit=crop&q=70&w=160&h=100`;
}

export function backdropForUrl(url: string): BackdropDef | undefined {
  return BACKDROPS.find((b) => url.includes(b.photo));
}

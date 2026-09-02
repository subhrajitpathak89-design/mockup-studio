import {
  DM_Serif_Display,
  Inter,
  JetBrains_Mono,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";

/**
 * Fonts have to be real loaded families, not CSS variables, because the canvas
 * renderer sets ctx.font directly. next/font gives us the resolved family name
 * for each, and the same string works in both the DOM preview and the canvas.
 */
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: ["400"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"] });

export interface FontOption {
  id: string;
  label: string;
  /** Family stack handed to both CSS and ctx.font. */
  family: string;
  /** Weights the family actually ships; the UI hides the rest. */
  weights: number[];
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "system",
    label: "System",
    family: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "inter",
    label: "Inter",
    family: inter.style.fontFamily,
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "grotesk",
    label: "Grotesk",
    family: grotesk.style.fontFamily,
    weights: [400, 500, 600, 700],
  },
  {
    id: "playfair",
    label: "Playfair",
    family: playfair.style.fontFamily,
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "dm-serif",
    label: "DM Serif",
    family: dmSerif.style.fontFamily,
    weights: [400],
  },
  {
    id: "mono",
    label: "Mono",
    family: mono.style.fontFamily,
    weights: [400, 500, 700],
  },
];

export const DEFAULT_FONT_ID = "inter";

export function fontById(id: string): FontOption {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}

/** Preloads every family so the first canvas paint is not a fallback face. */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    FONT_OPTIONS.flatMap((f) =>
      f.weights.map((w) =>
        document.fonts.load(`${w} 64px ${f.family}`).catch(() => undefined),
      ),
    ),
  );
  await document.fonts.ready;
}

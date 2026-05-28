export interface CardSpec {
  index: number;
  hue: number;
  label: string;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABELS = [
  "1997 — FIRST <html>",
  "Flash & ActionScript",
  "Dreamweaver days",
  "PHP from scratch",
  "Awwwards SOTD",
  "Three.js scenes",
  "GSAP timelines",
  "Custom shaders",
  "WebGL r54",
  "Canvas2D loops",
  "Lenis smooth",
  "Pixi sparks",
  "CSS 3D wins",
  "Service workers",
  "Headless CMS",
  "WebGPU peek",
  "Static & fast",
  "Type-safe APIs",
  "Edge runtime",
  "Astro islands",
  "Vue composition",
  "Nuxt SPA",
  "Pinia stores",
  "Vitest green",
  "Playwright pass",
  "Ship it.",
];

export function generateCards(count = 26, seed = 19870219): CardSpec[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    hue: Math.floor(rand() * 360),
    label: LABELS[i % LABELS.length] ?? `Card ${i}`,
  }));
}

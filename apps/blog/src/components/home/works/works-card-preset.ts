import type { WorkProjectData } from "@/types/content";

export const WORKS_CARD_PRESET = {
  cornerRadius: 8,
  dayBorderWidth: 1,
  height: 236,
  padding: "24px 32px",
  rimWidth: 1.5,
  saturation: 1.4,
  width: 352,
} as const;

export const WORKS_WEBGL_GLASS_PROFILE = {
  aberration: 0.03,
  bevelDepth: 0.075,
  bevelWidth: 0.12,
  frost: 2.2,
  magnify: 1.006,
  mobileResolution: 1,
  refraction: 0.007,
  resolution: 1.5,
  shadow: false,
  specular: true,
  tilt: false,
} as const;

export function createWorksCardPresentation(work: WorkProjectData, index: number) {
  return {
    actionLabels: {
      github: "GitHub",
      live: "进入项目",
      source: "Source:",
      website: "Website:",
    },
    description: work.description,
    kind: work.kind.toUpperCase(),
    orderLabel: String(index + 1).padStart(2, "0"),
    title: work.name,
    work,
  };
}

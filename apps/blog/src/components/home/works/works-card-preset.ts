import type { WorkProjectData } from "@/types/content";

export const WORKS_CARD_PRESET = {
  aberrationBlur: 0.3,
  aberrationIntensity: 2,
  blurPx: 20,
  cornerRadius: 32,
  dayBorderWidth: 1,
  displacementScale: 100,
  height: 236,
  padding: "24px 32px",
  rimWidth: 1.5,
  saturation: 1.4,
  width: 352,
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

import * as THREE from "three";
import { HOME_STAR_SETTINGS, ORIGINAL_STAR_SETTINGS, type ClusterSettings } from "@/composables/star-clusters";
export { createStarClusters, bunchRadius, HOME_STAR_SETTINGS, HOME_STAR_SEED, type ClusterSettings } from "@/composables/star-clusters";

export const CLUSTER_PRESETS: { name: string; description: string; settings: ClusterSettings }[] = [
  { name: "原版星线", description: "原来的十二条星线。从这里开始，沿线调整。", settings: { ...ORIGINAL_STAR_SETTINGS } },
  { name: "沿线成簇", description: "保留十二条线的走向，星星沿线疏密成簇。", settings: { bunches: 4, spread: 0.3, clumping: 0.8, curvature: 0.1, flow: 1, parallax: 1 } },
  { name: "柔和星束", description: "星线稍稍散开、弯曲，仍然从中心延伸到四周。", settings: { bunches: 3, spread: 0.65, clumping: 0.65, curvature: 0.28, flow: 0.8, parallax: 1 } },
  { name: "首页选定", description: "你选定的宽星束、轻聚簇与慢速流动。", settings: { ...HOME_STAR_SETTINGS } },
];
export const CLUSTER_SLIDERS = [
  { key: "bunches", label: "每条线的星簇", min: 1, max: 8, step: 1 },
  { key: "spread", label: "星束宽度", min: 0, max: 1, step: 0.01 },
  { key: "clumping", label: "聚簇程度", min: 0, max: 1, step: 0.01 },
  { key: "curvature", label: "轻微弯曲", min: 0, max: 1, step: 0.01 },
  { key: "flow", label: "向外流速", min: 0, max: 2, step: 0.05 },
  { key: "parallax", label: "鼠标视差", min: 0, max: 1, step: 0.01 },
] as const;

export function normalizeClusterSettings(value: Partial<ClusterSettings>): ClusterSettings {
  const settings = { ...CLUSTER_PRESETS[0].settings };
  for (const slider of CLUSTER_SLIDERS) {
    const number = value[slider.key];
    if (typeof number === "number" && Number.isFinite(number)) {
      settings[slider.key] = THREE.MathUtils.clamp(slider.key === "bunches" ? Math.round(number) : number, slider.min, slider.max);
    }
  }
  return settings;
}

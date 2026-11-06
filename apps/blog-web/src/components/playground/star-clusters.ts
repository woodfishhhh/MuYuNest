import * as THREE from "three";
import { LEGACY_STAR_SETTINGS, ORIGINAL_STAR_SETTINGS, type ClusterSettings } from "@/composables/star-clusters";
import type { StarMotionSettings, StarMode } from "@/composables/star-motion";
import selectedPlayground from "@/content/star-playground.json";
export { createStarClusters, bunchRadius, type ClusterSettings } from "@/composables/star-clusters";
export type { StarMode } from "@/composables/star-motion";

export const CLUSTER_PRESETS: { name: string; description: string; settings: ClusterSettings }[] = [
  { name: "原版星线", description: "原来的十二条星线。从这里开始，沿线调整。", settings: { ...ORIGINAL_STAR_SETTINGS } },
  { name: "沿线成簇", description: "保留十二条线的走向，星星沿线疏密成簇。", settings: { bunches: 4, spread: 0.3, clumping: 0.8, curvature: 0.1, flow: 1, parallax: 1 } },
  { name: "柔和星束", description: "星线稍稍散开、弯曲，仍然从中心延伸到四周。", settings: { bunches: 3, spread: 0.65, clumping: 0.65, curvature: 0.28, flow: 0.8, parallax: 1 } },
  { name: "旧版首页", description: "早期的十二条宽星束与轻聚簇。", settings: { ...LEGACY_STAR_SETTINGS } },
];
export const CLUSTER_SLIDERS = [
  { key: "bunches", label: "每条线的星簇", min: 1, max: 24, step: 1 },
  { key: "spread", label: "星束宽度", min: 0, max: 4, step: 0.05 },
  { key: "clumping", label: "聚簇程度", min: 0, max: 1, step: 0.01 },
  { key: "curvature", label: "弯曲程度", min: -4, max: 4, step: 0.05 },
  { key: "flow", label: "流动速度", min: 0, max: 8, step: 0.05 },
  { key: "parallax", label: "鼠标视差", min: 0, max: 4, step: 0.05 },
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

export type PlaygroundSettings = StarMotionSettings;

export const SELECTED_PLAYGROUND = {
  ...selectedPlayground,
  mode: selectedPlayground.mode as StarMode,
  theme: selectedPlayground.theme as "day" | "night",
  geometry: selectedPlayground.geometry as "cube" | "mobius" | "none",
};

export interface StarControl {
  key: keyof PlaygroundSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  scale?: number;
}

const base: PlaygroundSettings = {
  ...LEGACY_STAR_SETTINGS,
  count: 12, density: 0.48, starSize: 1.2, reach: 1,
  trail: 1, angle: 0, gravity: 1, turbulence: 0.4,
};

export const STAR_MODES: { id: StarMode; name: string; english: string; description: string; defaults: PlaygroundSettings }[] = [
  { id: "rays", name: "射线模式", english: "RADIAL", description: "从中心出发，让星线铺满整个视野。", defaults: { ...base } },
  { id: "comet", name: "彗星模式", english: "COMET", description: "彗核从远处迎面飞来，长尾留在纵深里。", defaults: { ...base, count: 5, flow: 0.8, spread: 1.1, curvature: 0.4, trail: 1.15, angle: 28, density: 0.65 } },
  { id: "fall", name: "星团掉落", english: "STARFALL", description: "星团从远处冲向镜头，越靠近，越铺满视野。", defaults: { ...base, count: 9, flow: 0.65, spread: 0.9, clumping: 0.7, trail: 0.22, gravity: 1.4, angle: 8, density: 0.65 } },
];

export const COMMON_CONTROLS: StarControl[] = [
  { key: "flow", label: "流动速度", min: 0, max: 8, step: 0.05, unit: "×" },
  { key: "density", label: "参与星点", min: 0.1, max: 1, step: 0.01, unit: "%", scale: 100 },
  { key: "starSize", label: "星点大小", min: 0.25, max: 5, step: 0.05, unit: "×" },
  { key: "parallax", label: "指针视差", min: 0, max: 4, step: 0.05, unit: "×" },
];

const spread: StarControl = { key: "spread", label: "星束宽度", min: 0, max: 4, step: 0.05, unit: "×" };
const curve: StarControl = { key: "curvature", label: "弯曲程度", min: -4, max: 4, step: 0.05, unit: "×" };
const clumping: StarControl = { key: "clumping", label: "聚簇程度", min: 0, max: 1, step: 0.01, unit: "%", scale: 100 };
const trail: StarControl = { key: "trail", label: "尾迹长度", min: 0.05, max: 3, step: 0.05, unit: "×" };
const turbulence: StarControl = { key: "turbulence", label: "扰动幅度", min: 0, max: 3, step: 0.05, unit: "×" };

export const MODE_CONTROLS: Record<StarMode, StarControl[]> = {
  rays: [
    { key: "count", label: "射线数量", min: 3, max: 36, step: 1, unit: "条" },
    { key: "bunches", label: "每条线的星簇", min: 1, max: 24, step: 1, unit: "簇" },
    spread, clumping, curve,
    { key: "reach", label: "延伸距离", min: 0.25, max: 2, step: 0.05, unit: "×" },
    { key: "angle", label: "整体旋转", min: -180, max: 180, step: 1, unit: "°" },
  ],
  comet: [
    { key: "count", label: "彗星数量", min: 1, max: 18, step: 1, unit: "颗" },
    trail, { ...spread, label: "尾迹宽度" }, { ...curve, label: "尾迹弯曲" },
    { key: "angle", label: "迎面方位", min: -180, max: 180, step: 1, unit: "°" }, turbulence,
  ],
  fall: [
    { key: "count", label: "星团数量", min: 2, max: 24, step: 1, unit: "团" },
    { ...spread, label: "星团半径" }, clumping,
    { key: "gravity", label: "接近加速", min: 0, max: 4, step: 0.05, unit: "×" },
    { ...trail, label: "纵深拖尾" },
    { key: "angle", label: "迎面方位", min: -180, max: 180, step: 1, unit: "°" }, turbulence,
  ],
};

interface MotionPreset { name: string; settings: Partial<PlaygroundSettings> }
export const MOTION_PRESETS: Record<StarMode, MotionPreset[]> = {
  rays: [
    { name: "舒展星线", settings: { ...base } },
    { name: "宽幅爆发", settings: { count: 24, spread: 2.8, flow: 2.2, density: 0.8, starSize: 1.5, curvature: 0.15, clumping: 0.15, reach: 1.4 } },
    { name: "旋转星束", settings: { count: 8, spread: 1.2, curvature: 3, flow: 0.8, clumping: 0.65, bunches: 6, density: 0.7 } },
  ],
  comet: [
    { name: "远行彗星", settings: {} },
    { name: "彗星群", settings: { count: 16, trail: 0.5, spread: 0.35, flow: 2, angle: 48, curvature: 0, density: 0.85 } },
    { name: "长尾掠影", settings: { count: 3, trail: 2.7, spread: 1.7, flow: 0.55, curvature: 1.6, angle: -18, turbulence: 1.2 } },
  ],
  fall: [
    { name: "迎面星团", settings: {} },
    { name: "密集冲刺", settings: { count: 20, spread: 0.55, flow: 2, gravity: 3.2, trail: 0.8, density: 0.9, angle: 18 } },
    { name: "缓慢靠近", settings: { count: 6, spread: 1.7, flow: 0.3, gravity: 0, trail: 0.08, turbulence: 1.8, clumping: 0.4 } },
  ],
};

export function createModeSettings(): Record<StarMode, PlaygroundSettings> {
  return {
    rays: { ...SELECTED_PLAYGROUND.modes.rays },
    comet: { ...SELECTED_PLAYGROUND.modes.comet },
    fall: { ...SELECTED_PLAYGROUND.modes.fall },
  };
}

export function normalizePlaygroundSettings(value: Partial<PlaygroundSettings>, mode: StarMode): PlaygroundSettings {
  const settings = { ...STAR_MODES.find(item => item.id === mode)!.defaults };
  for (const control of [...COMMON_CONTROLS, ...MODE_CONTROLS[mode]]) {
    const number = value[control.key];
    if (typeof number !== "number" || !Number.isFinite(number)) continue;
    const snapped = control.min + Math.round((number - control.min) / control.step) * control.step;
    settings[control.key] = Number(THREE.MathUtils.clamp(snapped, control.min, control.max).toFixed(4));
  }
  return settings;
}

export function formatControlValue(value: number, control: StarControl): string {
  const scaled = value * (control.scale ?? 1);
  return Number(scaled.toFixed(2)).toString();
}

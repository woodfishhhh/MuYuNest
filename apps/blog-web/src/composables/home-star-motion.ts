import * as THREE from "three";
import selected from "@/content/home-stars.json";
import { createStarMotion, type StarMotionSettings } from "./star-motion";
import type { StarClockView } from "./star-clock";

export const HOME_STAR_SETTINGS: StarMotionSettings = selected.settings;
export const HOME_STAR_SEED = selected.seed;

// Capture the current roaming field on entry, and hand it back after the exit
// transition. Warp continues updating that source while the rays are visible.
export function createHomeStarMotion(positions: Float32Array, opacity: Float32Array, sizes: Float32Array, settings: StarMotionSettings) {
  let motion: ReturnType<typeof createStarMotion> | undefined;
  function update(delta: number, active: boolean, group: THREE.Group, view: StarClockView, immediate = false) {
    if (!motion) {
      if (!active) return false;
      motion = createStarMotion(positions, opacity, sizes, HOME_STAR_SEED, settings, "rays");
    }
    motion.update(delta, active, group, view, immediate);
    if (!active && !motion.isActive()) motion = undefined;
    return true;
  }
  return { update, sourceFor: (index: number) => motion?.sourceFor(index) ?? positions };
}

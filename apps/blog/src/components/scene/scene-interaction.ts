import type { SiteMode, WorksViewMode } from "@/stores/site";
import { supportsWideLayout } from "@/utils/responsive";

export const SCENE_HOVER_RAYCAST_INTERVAL = 1 / 30;

export type ScenePointerDownAction = "activate-card" | "grab-card" | "focus-geometry" | "none";

export interface ScenePointerDownActionOptions {
  mode: SiteMode;
  worksViewMode: WorksViewMode;
  isFocusing: boolean;
  isMobile: boolean;
  hasWorksActionHit: boolean;
  hasWorksCardHit: boolean;
  hasGeometryHit: boolean;
}

export function isDesktopWorksOrbitMode(
  mode: SiteMode,
  worksViewMode: WorksViewMode,
  isMobile: boolean,
) {
  return mode === "works" && worksViewMode === "orbit" && !isMobile;
}

export function supportsWorksOrbitViewport(width: number) {
  return supportsWideLayout(width);
}

export function shouldRaycastSceneGeometry(
  mode: SiteMode,
  _worksViewMode: WorksViewMode,
  isFocusing: boolean,
  _isMobile: boolean,
) {
  return mode === "home" && !isFocusing;
}

export function shouldRunSceneHoverRaycast(elapsed: number, lastRunAt: number) {
  return (
    !Number.isFinite(lastRunAt) ||
    elapsed < lastRunAt ||
    elapsed - lastRunAt >= SCENE_HOVER_RAYCAST_INTERVAL
  );
}

export function resolveScenePointerDownAction({
  mode,
  worksViewMode,
  isFocusing,
  isMobile,
  hasWorksActionHit,
  hasWorksCardHit,
  hasGeometryHit,
}: ScenePointerDownActionOptions): ScenePointerDownAction {
  if (isFocusing) return "none";
  if (mode === "works" && !isMobile) {
    if (hasWorksActionHit) return "activate-card";
    if (worksViewMode === "orbit" && hasWorksCardHit) return "grab-card";
    return "none";
  }

  if (!shouldRaycastSceneGeometry(mode, worksViewMode, isFocusing, isMobile)) {
    return "none";
  }

  return hasGeometryHit ? "focus-geometry" : "none";
}

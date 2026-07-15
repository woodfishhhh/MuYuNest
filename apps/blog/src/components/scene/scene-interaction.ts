import type { SiteMode, WorksViewMode } from "@/stores/site";

export const SCENE_HOVER_RAYCAST_INTERVAL = 1 / 30;
export const WORKS_ORBIT_MIN_WIDTH = 1024;

export type ScenePointerDownAction = "grab-card" | "focus-geometry" | "none";

export interface ScenePointerDownActionOptions {
  mode: SiteMode;
  worksViewMode: WorksViewMode;
  isFocusing: boolean;
  isMobile: boolean;
  hasWorksHit: boolean;
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
  return width >= WORKS_ORBIT_MIN_WIDTH;
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
  hasWorksHit,
  hasGeometryHit,
}: ScenePointerDownActionOptions): ScenePointerDownAction {
  if (isFocusing) return "none";
  if (mode === "works" && !isMobile) {
    if (worksViewMode !== "orbit") return "none";
    return hasWorksHit ? "grab-card" : "none";
  }

  if (!shouldRaycastSceneGeometry(mode, worksViewMode, isFocusing, isMobile)) {
    return "none";
  }

  return hasGeometryHit ? "focus-geometry" : "none";
}

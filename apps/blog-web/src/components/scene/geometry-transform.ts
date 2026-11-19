import type { SiteMode } from "@/stores/site";

const WORKS_MODE_BASE_SCALE = 1.2;
const CENTERED_PANEL_MODES = new Set<SiteMode>(["home", "blog", "friend"]);

export interface GeometryTransformTargetOptions {
  mode: SiteMode;
  isFocusing: boolean;
  isMobile: boolean;
  inwardOffset: number;
}

export interface GeometryTransformTarget {
  x: number;
  y: number;
  z: number;
  baseScale: number;
}

export function hasEquivalentGeometryTransformMode(left: SiteMode, right: SiteMode) {
  return (
    left === right || (CENTERED_PANEL_MODES.has(left) && CENTERED_PANEL_MODES.has(right))
  );
}

export function getGeometryTransformTarget({
  mode,
  isFocusing,
  isMobile,
  inwardOffset,
}: GeometryTransformTargetOptions): GeometryTransformTarget {
  const target: GeometryTransformTarget = {
    x: 0,
    y: 0,
    z: 0,
    baseScale: isMobile ? 0.75 : 1,
  };

  if (isFocusing) {
    target.z = 2;
    return target;
  }

  if (mode === "author") {
    if (isMobile) target.y = 3;
    else target.x = -inwardOffset;
    return target;
  }

  if (mode === "works") {
    target.baseScale *= WORKS_MODE_BASE_SCALE;
    return target;
  }

  if (mode === "reading") {
    if (isMobile) target.y = 3.5;
    else target.x = 5;
    target.baseScale = 0.5;
  }

  return target;
}

export interface MagneticPointerPoint {
  x: number;
  y: number;
}

export interface MagneticPointerTarget {
  corners?: MagneticPointerQuad;
  height: number;
  key: string;
  left: number;
  radius?: number;
  top: number;
  width: number;
}

export interface MagneticPointerFrame {
  corners?: MagneticPointerQuad;
  height: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}

export type MagneticPointerQuad = readonly [
  MagneticPointerPoint,
  MagneticPointerPoint,
  MagneticPointerPoint,
  MagneticPointerPoint,
];

export interface MagneticPointerNdcBounds {
  corners?: MagneticPointerQuad;
  halfHeight: number;
  halfWidth: number;
  x: number;
  y: number;
}

interface ViewportBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

export const MAGNETIC_POINTER_DOT_SIZE = 7;
export const MAGNETIC_POINTER_TARGET_PADDING = 12;
export const MAGNETIC_POINTER_PULL = 0.1;
export const MAGNETIC_POINTER_STYLE_STORAGE_KEY = "vuecubeblog:magnetic-pointer-style";
export const MAGNETIC_POINTER_STYLE_IDS = [
  "corners",
  "corners-hairline",
  "corners-axis",
  "corners-contrast",
  "glass",
  "precision",
  "inverse",
] as const;
export type MagneticPointerStyle = (typeof MAGNETIC_POINTER_STYLE_IDS)[number];
export const DEFAULT_MAGNETIC_POINTER_STYLE: MagneticPointerStyle = "corners-contrast";

let sceneTarget: MagneticPointerTarget | null = null;

export function resolveMagneticPointerStyle(value: string | null | undefined) {
  return MAGNETIC_POINTER_STYLE_IDS.includes(value as MagneticPointerStyle)
    ? (value as MagneticPointerStyle)
    : DEFAULT_MAGNETIC_POINTER_STYLE;
}

export function readMagneticPointerStyle() {
  if (typeof window === "undefined") return DEFAULT_MAGNETIC_POINTER_STYLE;
  try {
    return resolveMagneticPointerStyle(
      window.localStorage.getItem(MAGNETIC_POINTER_STYLE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_MAGNETIC_POINTER_STYLE;
  }
}

export function applyMagneticPointerStyle(style: MagneticPointerStyle) {
  const nextStyle = resolveMagneticPointerStyle(style);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.magneticPointerStyle = nextStyle;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MAGNETIC_POINTER_STYLE_STORAGE_KEY, nextStyle);
    } catch {
      // The visual setting still applies when storage is unavailable.
    }
  }
  return nextStyle;
}

export function initializeMagneticPointerStyle() {
  return applyMagneticPointerStyle(readMagneticPointerStyle());
}

export function setSceneMagneticPointerTarget(target: MagneticPointerTarget) {
  sceneTarget = target;
}

export function clearSceneMagneticPointerTarget(key?: string) {
  if (!key || sceneTarget?.key === key) {
    sceneTarget = null;
  }
}

export function getSceneMagneticPointerTarget() {
  return sceneTarget;
}

export function resolveMagneticPointerFrame(
  pointer: MagneticPointerPoint,
  target: MagneticPointerTarget | null,
): MagneticPointerFrame {
  if (!target) {
    return {
      height: MAGNETIC_POINTER_DOT_SIZE,
      radius: MAGNETIC_POINTER_DOT_SIZE / 2,
      width: MAGNETIC_POINTER_DOT_SIZE,
      x: pointer.x,
      y: pointer.y,
    };
  }

  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;

  if (target.corners) {
    const horizontalScale = 1 + MAGNETIC_POINTER_TARGET_PADDING / Math.max(target.width, 1);
    const verticalScale = 1 + MAGNETIC_POINTER_TARGET_PADDING / Math.max(target.height, 1);
    const corners = target.corners.map((corner) => ({
      x: centerX + (corner.x - centerX) * horizontalScale,
      y: centerY + (corner.y - centerY) * verticalScale,
    })) as unknown as MagneticPointerQuad;
    const left = Math.min(...corners.map((corner) => corner.x));
    const right = Math.max(...corners.map((corner) => corner.x));
    const top = Math.min(...corners.map((corner) => corner.y));
    const bottom = Math.max(...corners.map((corner) => corner.y));

    return {
      corners,
      height: Math.max(24, bottom - top),
      radius: Math.max(4, target.radius ?? 8),
      width: Math.max(24, right - left),
      x: (left + right) / 2,
      y: (top + bottom) / 2,
    };
  }

  return {
    height: Math.max(24, target.height + MAGNETIC_POINTER_TARGET_PADDING),
    radius: Math.max(4, (target.radius ?? 8) + MAGNETIC_POINTER_TARGET_PADDING / 2),
    width: Math.max(24, target.width + MAGNETIC_POINTER_TARGET_PADDING),
    x: centerX + (pointer.x - centerX) * MAGNETIC_POINTER_PULL,
    y: centerY + (pointer.y - centerY) * MAGNETIC_POINTER_PULL,
  };
}

export function projectNdcBoundsToPointerTarget(
  key: string,
  bounds: MagneticPointerNdcBounds,
  viewport: ViewportBounds,
  radius = 8,
): MagneticPointerTarget {
  const left = viewport.left + ((bounds.x - bounds.halfWidth + 1) / 2) * viewport.width;
  const right = viewport.left + ((bounds.x + bounds.halfWidth + 1) / 2) * viewport.width;
  const top = viewport.top + ((1 - (bounds.y + bounds.halfHeight)) / 2) * viewport.height;
  const bottom = viewport.top + ((1 - (bounds.y - bounds.halfHeight)) / 2) * viewport.height;

  const corners = bounds.corners?.map((corner) => ({
    x: viewport.left + ((corner.x + 1) / 2) * viewport.width,
    y: viewport.top + ((1 - corner.y) / 2) * viewport.height,
  })) as MagneticPointerQuad | undefined;

  return {
    corners,
    height: Math.max(0, bottom - top),
    key,
    left,
    radius,
    top,
    width: Math.max(0, right - left),
  };
}

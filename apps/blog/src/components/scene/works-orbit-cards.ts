import * as THREE from "three";

import {
  createWorksCardPresentation,
  WORKS_CARD_PRESET,
  WORKS_WEBGL_GLASS_PROFILE,
} from "@/components/home/works/works-card-preset";
import type { ThemeMode } from "@/composables/useTheme";
import type { WorkProjectData } from "@/types/content";

export type WorksOrbitCardAction = "live" | "github";
export type WorksCardsLayout = "orbit" | "case";
export type WorksOrbitCardReleaseResult =
  | { action: "launch"; url: string }
  | { action: "resume" }
  | null;

export interface WorksOrbitCardHit {
  slug: string;
  action: WorksOrbitCardAction;
  url: string;
}

export interface WorksOrbitCardFrame {
  angle: number;
  depth: number;
  frontness: number;
  opacity: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  scale: number;
}

export interface WorksOrbitCardFrameOptions {
  center?: {
    x: number;
    y: number;
    z: number;
  };
  count: number;
  elapsed: number;
  index: number;
  radiusX?: number;
  radiusY?: number;
  radiusZ?: number;
  phaseOffset?: number;
  reducedMotion?: boolean;
}

export interface WorksOrbitCardScreenBounds {
  corners?: readonly [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  halfHeight: number;
  halfWidth: number;
  x: number;
  y: number;
}

interface WorksOrbitCardsOptions {
  theme: ThemeMode;
  works: WorkProjectData[];
}

interface WorksOrbitCardsUpdateOptions {
  camera: THREE.PerspectiveCamera;
  center: THREE.Vector3;
  delta: number;
  elapsed: number;
  layout: WorksCardsLayout;
  pointerNdc?: THREE.Vector2;
  reducedMotion: boolean;
  viewport: {
    width: number;
    height: number;
  };
  visible: boolean;
}

export interface WorksOrbitCards {
  group: THREE.Group;
  beginDrag: (hit: WorksOrbitCardHit, pointerNdc: THREE.Vector2) => void;
  captureBackdrop: (renderer: THREE.WebGLRenderer) => void;
  clearInteraction: () => void;
  dispose: () => void;
  drag: (pointerNdc: THREE.Vector2) => void;
  getActionScreenBounds: (hit: WorksOrbitCardHit) => WorksOrbitCardScreenBounds | null;
  getScreenBounds: (slug: string) => WorksOrbitCardScreenBounds | null;
  isInteracting: () => boolean;
  isLayoutTransitioning: () => boolean;
  pick: (raycaster: THREE.Raycaster, pointerNdc?: THREE.Vector2) => WorksOrbitCardHit | null;
  pickHover: (raycaster: THREE.Raycaster, pointerNdc?: THREE.Vector2) => WorksOrbitCardHit | null;
  release: (elapsed: number) => WorksOrbitCardReleaseResult;
  setHovered: (hit: WorksOrbitCardHit | null) => void;
  setTheme: (theme: ThemeMode) => void;
  update: (options: WorksOrbitCardsUpdateOptions) => void;
}

const TAU = Math.PI * 2;
const ORBIT_SPEED = 0.24;
const WORKS_ORBIT_CARD_WORLD_SCALE = 0.875;
export const WORKS_ORBIT_CARD_SIZE = {
  height: (WORKS_CARD_PRESET.height / 100) * WORKS_ORBIT_CARD_WORLD_SCALE,
  width: (WORKS_CARD_PRESET.width / 100) * WORKS_ORBIT_CARD_WORLD_SCALE,
} as const;
const CARD_WIDTH = WORKS_ORBIT_CARD_SIZE.width;
const CARD_HEIGHT = WORKS_ORBIT_CARD_SIZE.height;
const TEXTURE_SCALE = 2;
const TEXTURE_WIDTH = WORKS_CARD_PRESET.width * TEXTURE_SCALE;
const TEXTURE_HEIGHT = WORKS_CARD_PRESET.height * TEXTURE_SCALE;
const WORKS_ACTION_TEXTURE_RECTS = {
  live: { bottom: 358, left: 512, right: 664, top: 316 },
  github: { bottom: 412, left: 536, right: 664, top: 370 },
} as const;
interface WorksLocalRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function textureRectToLocalRect(rect: (typeof WORKS_ACTION_TEXTURE_RECTS)[WorksOrbitCardAction]) {
  return {
    bottom: (0.5 - rect.bottom / TEXTURE_HEIGHT) * CARD_HEIGHT,
    left: (rect.left / TEXTURE_WIDTH - 0.5) * CARD_WIDTH,
    right: (rect.right / TEXTURE_WIDTH - 0.5) * CARD_WIDTH,
    top: (0.5 - rect.top / TEXTURE_HEIGHT) * CARD_HEIGHT,
  } satisfies WorksLocalRect;
}

const WORKS_ACTION_LOCAL_RECTS = {
  live: textureRectToLocalRect(WORKS_ACTION_TEXTURE_RECTS.live),
  github: textureRectToLocalRect(WORKS_ACTION_TEXTURE_RECTS.github),
} as const;
const WORKS_CARD_LOCAL_RECT = {
  bottom: -CARD_HEIGHT / 2,
  left: -CARD_WIDTH / 2,
  right: CARD_WIDTH / 2,
  top: CARD_HEIGHT / 2,
} as const satisfies WorksLocalRect;
const DRAG_DISTANCE_FROM_CAMERA = 5.2;
const DRAG_LERP_SPEED = 18;
const DRAG_PICKUP_DURATION = 0.32;
const DRAG_PICKUP_DURATION_REDUCED = 0.12;
const DRAG_ROTATION_LERP_SPEED = 12;
const DRAG_SCALE_LERP_SPEED = 11;
const DRAG_MAX_VIEWPORT_FRACTION = 0.46;
const LAUNCH_ZONE_HALF_NDC = 0.28;
const MAGNET_FALLOFF_NDC = 0.78;
const REDUCED_MOTION_INTENSITY_CAP = 0.25;
const INTERACTION_RENDER_ORDER = 1_000;
const RETURN_ANIMATION_DURATION = 0.38;
const RETURN_ANIMATION_DURATION_REDUCED = 0.18;
const VIEW_TRANSITION_SPEED = 12;
const VIEW_TRANSITION_EPSILON = 0.002;
const LAYOUT_TRANSITION_DURATION = 0.72;
const LAYOUT_TRANSITION_EPSILON = 0.001;
const CASE_CARD_GAP_PX = 24;
const CASE_CENTER_Y_OFFSET_PX = 18;
const CASE_MIN_CARD_WIDTH_PX = 248;
const CASE_MAX_COLUMNS = 5;
const CARD_HOVER_MAX_TILT = THREE.MathUtils.degToRad(6.5);
const CARD_HOVER_TILT_SPEED = 10;
const CARD_HOVER_SCALE_SPEED = 8;
const ORBIT_CARD_HOVER_SCALE = 1.08;
const CASE_CARD_HOVER_SCALE = 1.025;
export const WORKS_ORBIT_CARD_RENDER_LAYER = 1;
const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;
const ORBIT_CENTER_Y_OFFSET = -0.32;
const ORBIT_SAFE_AREA_PX = {
  bottom: 32,
  side: 24,
  top: 104,
} as const;

export const LIQUID_GLASS_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const LIQUID_GLASS_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uBackdrop;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uCardSize;
  uniform vec3 uBaseColor;
  uniform vec3 uGlassTint;
  uniform float uAberration;
  uniform float uBevelDepth;
  uniform float uBevelWidth;
  uniform float uDayBorderWidthPx;
  uniform float uDayMode;
  uniform float uFrost;
  uniform float uGlassOpacity;
  uniform float uHover;
  uniform float uRefraction;
  uniform float uRimWidthPx;
  uniform float uSaturation;
  uniform float uTintStrength;
  uniform float uViewAlpha;

  varying vec2 vUv;

  float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
    vec2 distanceToEdge = abs(point) - halfSize + radius;
    return min(max(distanceToEdge.x, distanceToEdge.y), 0.0)
      + length(max(distanceToEdge, 0.0)) - radius;
  }

  vec3 readBackdrop(vec2 uv) {
    vec4 sampled = texture2D(uBackdrop, clamp(uv, vec2(0.001), vec2(0.999)));
    vec3 restored = clamp(sampled.rgb / max(sampled.a, 0.001), 0.0, 1.0);
    return mix(uBaseColor, restored, smoothstep(0.0, 0.92, sampled.a));
  }

  vec3 saturateColor(vec3 color, float saturation) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luminance), color, saturation);
  }

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 readFrostedBackdrop(vec2 uv, vec2 pixel) {
    vec3 color = vec3(0.0);
    float radius = uFrost * 4.0;

    for (int index = 0; index < 16; index++) {
      float sampleIndex = float(index);
      float angle = random(uv + sampleIndex) * 6.283185;
      float distance = sqrt(random(uv - sampleIndex)) * radius;
      vec2 offset = vec2(cos(angle), sin(angle)) * pixel * distance;
      color += readBackdrop(uv + offset);
    }

    return saturateColor(color / 16.0, uSaturation);
  }

  vec3 screenBlend(vec3 base, vec3 blend) {
    return 1.0 - (1.0 - base) * (1.0 - blend);
  }

  vec3 overlayBlend(vec3 base, vec3 blend) {
    vec3 low = 2.0 * base * blend;
    vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    return mix(low, high, step(vec3(0.5), base));
  }

  void main() {
    vec2 localPoint = (vUv - 0.5) * vec2(${CARD_ASPECT.toFixed(6)}, 1.0);
    vec2 halfSize = vec2(${(CARD_ASPECT * 0.5 - 0.012).toFixed(6)}, 0.488);
    float radius = ${(WORKS_CARD_PRESET.cornerRadius / WORKS_CARD_PRESET.height).toFixed(6)};
    float distance = roundedBoxSdf(localPoint, halfSize, radius);

    if (distance > 0.0) discard;

    float epsilon = 0.003;
    vec2 normal = normalize(vec2(
      roundedBoxSdf(localPoint + vec2(epsilon, 0.0), halfSize, radius)
        - roundedBoxSdf(localPoint - vec2(epsilon, 0.0), halfSize, radius),
      roundedBoxSdf(localPoint + vec2(0.0, epsilon), halfSize, radius)
        - roundedBoxSdf(localPoint - vec2(0.0, epsilon), halfSize, radius)
    ) + vec2(0.0001));

    float insideDistance = -distance;
    float edge = 1.0 - smoothstep(0.0, uBevelWidth, insideDistance);

    vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
    vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
    float displacementAmount = edge * uRefraction + pow(edge, 10.0) * uBevelDepth;
    vec2 displacement = normal * displacementAmount;
    vec2 refractedUv = screenUv - displacement;
    vec3 refracted = readFrostedBackdrop(refractedUv, pixel);
    if (uAberration > 0.0) {
      vec2 chroma = displacement * uAberration;
      refracted.r = readBackdrop(refractedUv - chroma).r;
      refracted.b = readBackdrop(refractedUv + chroma).b;
    }

    vec2 pointerVector = (uPointer - screenUv) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    pointerVector = normalize(pointerVector + vec2(0.0001));
    float pointerLight = max(dot(normal, pointerVector), 0.0);
    float ambientLight = max(dot(normal, normalize(vec2(-0.72, 0.68))), 0.0);
    float rimWidth = uRimWidthPx / max(uCardSize.y, 1.0);
    float screenRim = 1.0 - smoothstep(0.0, rimWidth * 1.8, insideDistance);
    float overlayRim = smoothstep(rimWidth * 1.5, rimWidth * 3.0, insideDistance)
      * (1.0 - smoothstep(rimWidth * 3.0, rimWidth * 7.0, insideDistance));
    float dayBorderWidth = uDayBorderWidthPx / max(uCardSize.y, 1.0);
    float dayBorder = 1.0 - smoothstep(0.0, dayBorderWidth * 1.15, insideDistance);

    vec3 color = mix(refracted, uGlassTint, uTintStrength + edge * 0.045);
    float screenStrength = screenRim * (0.16 + pointerLight * 0.26 + ambientLight * 0.16);
    float overlayStrength = overlayRim * (0.22 + uHover * 0.08);
    color = mix(color, vec3(0.0), dayBorder * uDayMode * 0.2);
    color = mix(color, screenBlend(color, vec3(1.0)), clamp(screenStrength, 0.0, 0.72));
    color = mix(color, overlayBlend(color, mix(uGlassTint, vec3(1.0), 0.7)), overlayStrength);

    gl_FragColor = vec4(
      color,
      clamp(uGlassOpacity + screenRim * 0.08, 0.0, 0.88) * uViewAlpha
    );
  }
`;

interface CardInteractionState {
  grabOffset: THREE.Vector3 | null;
  hit: WorksOrbitCardHit;
  pickupElapsed: number;
  pointerNdc: THREE.Vector2;
  slug: string;
  startPointerNdc: THREE.Vector2;
  startPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  startRenderOrder: number;
  startScale: number;
}

interface CardScreenHit {
  actions: Record<WorksOrbitCardAction, WorksOrbitCardScreenBounds>;
  corners: NonNullable<WorksOrbitCardScreenBounds["corners"]>;
  frontness: number;
  githubHit: WorksOrbitCardHit;
  halfHeight: number;
  halfWidth: number;
  liveHit: WorksOrbitCardHit;
  x: number;
  y: number;
}

interface CardReturnState {
  startedAt: number;
  startPosition: THREE.Vector3;
  startScale: number;
}

const orbitPosition = new THREE.Vector3();
const casePosition = new THREE.Vector3();
const resolvedPosition = new THREE.Vector3();
const dragRaycaster = new THREE.Raycaster();
const caseRaycaster = new THREE.Raycaster();
const dragPosition = new THREE.Vector3();
const dragCardCenterNdc = new THREE.Vector2();
const dragCardCenterPosition = new THREE.Vector3();
const dragTargetPosition = new THREE.Vector3();
const dragTargetQuaternion = new THREE.Quaternion();
const caseCameraPosition = new THREE.Vector3();
const casePointerNdc = new THREE.Vector2();
const lastCenter = new THREE.Vector3();
const framebufferSize = new THREE.Vector2();
const screenPosition = new THREE.Vector3();
const cameraSpacePosition = new THREE.Vector3();
const projectedCorner = new THREE.Vector3();
let lastRadii = getWorksOrbitRadii(1440);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function createWorksOrbitCardFrame({
  center = { x: 0, y: 0, z: 0 },
  count,
  elapsed,
  index,
  radiusX = 6.2,
  radiusY = 2.6,
  radiusZ = 6.2,
  phaseOffset = 0,
  reducedMotion = false,
}: WorksOrbitCardFrameOptions): WorksOrbitCardFrame {
  const safeCount = Math.max(count, 1);
  const phase = (index / safeCount) * TAU - Math.PI * 0.12 + phaseOffset;
  const angle = phase + (reducedMotion ? 0 : elapsed * ORBIT_SPEED);
  const depth = Math.sin(angle);
  const frontness = (depth + 1) / 2;

  return {
    angle: round(angle),
    depth: round(depth),
    frontness: round(frontness),
    opacity: 1,
    position: {
      x: round(center.x + Math.cos(angle) * radiusX),
      y: round(center.y + ORBIT_CENTER_Y_OFFSET + depth * radiusY),
      z: round(center.z + depth * radiusZ),
    },
    scale: round(0.86 - frontness * 0.16),
  };
}

export function getWorksOrbitRadii(width: number) {
  return {
    radiusX: clamp(width / 160, 6.2, 9.2),
    radiusY: clamp(width / 600, 2.1, 2.6),
    radiusZ: clamp(width / 190, 6.2, 8.2),
  };
}

export function isWorksLaunchZone(pointerNdc: THREE.Vector2) {
  return (
    Math.abs(pointerNdc.x) <= LAUNCH_ZONE_HALF_NDC && Math.abs(pointerNdc.y) <= LAUNCH_ZONE_HALF_NDC
  );
}

export function getWorksCenterMagnetStrength(pointerNdc: THREE.Vector2, reducedMotion = false) {
  const distance = Math.hypot(pointerNdc.x, pointerNdc.y);
  const strength = clamp(1 - distance / MAGNET_FALLOFF_NDC, 0, 1);
  return reducedMotion ? Math.min(strength, REDUCED_MOTION_INTENSITY_CAP) : strength;
}

export interface WorksCaseGridSlot {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface WorksCaseGridLayout {
  cardHeight: number;
  cardWidth: number;
  centerY: number;
  columns: number;
  count: number;
  gap: number;
  gridHeight: number;
  rows: number;
}

interface WorksCaseGridCandidate extends WorksCaseGridLayout {
  aspectError: number;
  emptySlots: number;
  scale: number;
}

export function resolveWorksCaseGridLayout(
  count: number,
  viewport: { height: number; width: number },
): WorksCaseGridLayout {
  const safeCount = Math.max(1, Math.floor(count));
  const availableWidth = Math.max(viewport.width - ORBIT_SAFE_AREA_PX.side * 2, 1);
  const availableHeight = Math.max(
    viewport.height -
      ORBIT_SAFE_AREA_PX.top -
      ORBIT_SAFE_AREA_PX.bottom -
      CASE_CENTER_Y_OFFSET_PX * 2,
    1,
  );
  const availableAspect = availableWidth / availableHeight;
  const widthLimitedColumns = Math.max(
    1,
    Math.floor((availableWidth + CASE_CARD_GAP_PX) / (CASE_MIN_CARD_WIDTH_PX + CASE_CARD_GAP_PX)),
  );
  const maxColumns = Math.min(safeCount, CASE_MAX_COLUMNS, widthLimitedColumns);
  let best: WorksCaseGridCandidate | null = null;

  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const rows = Math.ceil(safeCount / columns);
    const naturalWidth =
      columns * WORKS_CARD_PRESET.width + (columns - 1) * CASE_CARD_GAP_PX;
    const naturalHeight = rows * WORKS_CARD_PRESET.height + (rows - 1) * CASE_CARD_GAP_PX;
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    const cardWidth = WORKS_CARD_PRESET.width * scale;
    const cardHeight = WORKS_CARD_PRESET.height * scale;
    const gap = CASE_CARD_GAP_PX * scale;
    const gridHeight = rows * cardHeight + (rows - 1) * gap;
    const candidate: WorksCaseGridCandidate = {
      aspectError: Math.abs(Math.log(naturalWidth / naturalHeight / availableAspect)),
      cardHeight,
      cardWidth,
      centerY:
        ORBIT_SAFE_AREA_PX.top +
        (viewport.height - ORBIT_SAFE_AREA_PX.top - ORBIT_SAFE_AREA_PX.bottom) * 0.5 +
        CASE_CENTER_Y_OFFSET_PX * scale,
      columns,
      count: safeCount,
      emptySlots: columns * rows - safeCount,
      gap,
      gridHeight,
      rows,
      scale,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    const hasBetterScale = candidate.scale > best.scale + 0.001;
    const hasEqualScale = Math.abs(candidate.scale - best.scale) <= 0.001;
    const wastesFewerSlots = hasEqualScale && candidate.emptySlots < best.emptySlots;
    const hasBetterAspect =
      hasEqualScale &&
      candidate.emptySlots === best.emptySlots &&
      candidate.aspectError < best.aspectError;

    if (hasBetterScale || wastesFewerSlots || hasBetterAspect) best = candidate;
  }

  const { aspectError: _aspectError, emptySlots: _emptySlots, scale: _scale, ...layout } = best!;
  return layout;
}

function getWorksCaseGridSlotFromLayout(
  index: number,
  layout: WorksCaseGridLayout,
): WorksCaseGridSlot {
  const safeIndex = clamp(Math.floor(index), 0, layout.count - 1);
  const row = Math.floor(safeIndex / layout.columns);
  const column = safeIndex % layout.columns;
  const itemsInRow = Math.min(
    layout.columns,
    Math.max(layout.count - row * layout.columns, 1),
  );
  const rowWidth = itemsInRow * layout.cardWidth + (itemsInRow - 1) * layout.gap;

  return {
    height: layout.cardHeight,
    width: layout.cardWidth,
    x:
      -rowWidth * 0.5 +
      layout.cardWidth * 0.5 +
      column * (layout.cardWidth + layout.gap),
    y:
      layout.centerY -
      layout.gridHeight * 0.5 +
      layout.cardHeight * 0.5 +
      row * (layout.cardHeight + layout.gap),
  };
}

export function getWorksCaseGridSlot(
  index: number,
  count: number,
  viewport: { height: number; width: number },
): WorksCaseGridSlot {
  const slot = getWorksCaseGridSlotFromLayout(
    index,
    resolveWorksCaseGridLayout(count, viewport),
  );
  slot.x += viewport.width * 0.5;
  return slot;
}

function setCaseWorldPositionAndGetScale(
  camera: THREE.PerspectiveCamera,
  slot: WorksCaseGridSlot,
  viewport: WorksOrbitCardsUpdateOptions["viewport"],
) {
  casePointerNdc.set(
    (slot.x / Math.max(viewport.width, 1)) * 2 - 1,
    1 - (slot.y / Math.max(viewport.height, 1)) * 2,
  );
  caseRaycaster.setFromCamera(casePointerNdc, camera);
  casePosition
    .copy(caseRaycaster.ray.origin)
    .addScaledVector(caseRaycaster.ray.direction, DRAG_DISTANCE_FROM_CAMERA);

  const viewDepth = Math.max(
    Math.abs(caseCameraPosition.copy(casePosition).applyMatrix4(camera.matrixWorldInverse).z),
    0.001,
  );
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * viewDepth;
  const viewWidth = viewHeight * camera.aspect;

  return ((slot.width / Math.max(viewport.width, 1)) * viewWidth) / CARD_WIDTH;
}

function easeLayoutTransition(progress: number) {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2;
}

function easePickup(progress: number) {
  const safeProgress = clamp(progress, 0, 1);
  return safeProgress * safeProgress * (3 - 2 * safeProgress);
}

function getBaseAngle(index: number, count: number, elapsed: number) {
  const safeCount = Math.max(count, 1);
  return (index / safeCount) * TAU - Math.PI * 0.12 + elapsed * ORBIT_SPEED;
}

function getPointerWorldPosition(
  pointerNdc: THREE.Vector2,
  camera: THREE.PerspectiveCamera,
  target = dragPosition,
) {
  dragRaycaster.setFromCamera(pointerNdc, camera);
  return target
    .copy(dragRaycaster.ray.origin)
    .addScaledVector(dragRaycaster.ray.direction, DRAG_DISTANCE_FROM_CAMERA);
}

function getDragScale(camera: THREE.PerspectiveCamera, frameScale: number, strength: number) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fov / 2) * DRAG_DISTANCE_FROM_CAMERA;
  const viewWidth = viewHeight * camera.aspect;
  const maxScale = (viewWidth * DRAG_MAX_VIEWPORT_FRACTION) / CARD_WIDTH;
  const minScale = Math.max(frameScale * 1.06, maxScale * 0.72);
  return THREE.MathUtils.lerp(minScale, Math.max(minScale, maxScale), strength);
}

function projectLocalRect(
  camera: THREE.PerspectiveCamera,
  cardGroup: THREE.Group,
  rect: WorksLocalRect,
): NonNullable<WorksOrbitCardScreenBounds["corners"]> {
  const project = (x: number, y: number) => {
    projectedCorner.set(x, y, 0.03).applyMatrix4(cardGroup.matrixWorld).project(camera);
    return { x: projectedCorner.x, y: projectedCorner.y };
  };

  return [
    project(rect.left, rect.top),
    project(rect.right, rect.top),
    project(rect.right, rect.bottom),
    project(rect.left, rect.bottom),
  ];
}

function getBoundsFromCorners(
  corners: NonNullable<WorksOrbitCardScreenBounds["corners"]>,
): WorksOrbitCardScreenBounds {
  const left = Math.min(...corners.map((corner) => corner.x));
  const right = Math.max(...corners.map((corner) => corner.x));
  const top = Math.max(...corners.map((corner) => corner.y));
  const bottom = Math.min(...corners.map((corner) => corner.y));

  return {
    corners,
    halfHeight: (top - bottom) / 2,
    halfWidth: (right - left) / 2,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

function getCardScreenHit(
  camera: THREE.PerspectiveCamera,
  cardGroup: THREE.Group,
  liveHit: WorksOrbitCardHit,
  githubHit: WorksOrbitCardHit,
  frontness: number,
): CardScreenHit {
  cardGroup.updateWorldMatrix(true, false);
  const cardBounds = getBoundsFromCorners(
    projectLocalRect(camera, cardGroup, WORKS_CARD_LOCAL_RECT),
  );

  return {
    ...cardBounds,
    actions: {
      live: getBoundsFromCorners(
        projectLocalRect(camera, cardGroup, WORKS_ACTION_LOCAL_RECTS.live),
      ),
      github: getBoundsFromCorners(
        projectLocalRect(camera, cardGroup, WORKS_ACTION_LOCAL_RECTS.github),
      ),
    },
    corners: cardBounds.corners!,
    frontness,
    githubHit,
    liveHit,
  };
}

function containsPoint(
  bounds: WorksOrbitCardScreenBounds,
  pointerNdc: THREE.Vector2,
) {
  if (!bounds.corners) {
    return (
      Math.abs(pointerNdc.x - bounds.x) <= bounds.halfWidth &&
      Math.abs(pointerNdc.y - bounds.y) <= bounds.halfHeight
    );
  }

  let hasPositiveCross = false;
  let hasNegativeCross = false;
  for (let index = 0; index < bounds.corners.length; index += 1) {
    const current = bounds.corners[index]!;
    const next = bounds.corners[(index + 1) % bounds.corners.length]!;
    const cross =
      (next.x - current.x) * (pointerNdc.y - current.y) -
      (next.y - current.y) * (pointerNdc.x - current.x);
    hasPositiveCross ||= cross > 0;
    hasNegativeCross ||= cross < 0;
    if (hasPositiveCross && hasNegativeCross) return false;
  }
  return true;
}

function clampProjectedCenter(value: number, min: number, max: number) {
  return min > max ? (min + max) * 0.5 : clamp(value, min, max);
}

function constrainOrbitPositionToViewport(
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  scale: number,
  rotationZ: number,
  viewport: WorksOrbitCardsUpdateOptions["viewport"],
) {
  screenPosition.copy(position).project(camera);

  const fov = THREE.MathUtils.degToRad(camera.fov);
  const viewDepth = Math.max(
    Math.abs(cameraSpacePosition.copy(position).applyMatrix4(camera.matrixWorldInverse).z),
    0.001,
  );
  const viewHeight = 2 * Math.tan(fov / 2) * viewDepth;
  const viewWidth = viewHeight * camera.aspect;
  const cosine = Math.abs(Math.cos(rotationZ));
  const sine = Math.abs(Math.sin(rotationZ));
  const rotatedWidth = CARD_WIDTH * cosine + CARD_HEIGHT * sine;
  const rotatedHeight = CARD_HEIGHT * cosine + CARD_WIDTH * sine;
  const halfWidthNdc = (rotatedWidth * scale) / viewWidth;
  const halfHeightNdc = (rotatedHeight * scale) / viewHeight;
  const sideInsetNdc = (ORBIT_SAFE_AREA_PX.side * 2) / Math.max(viewport.width, 1);
  const topInsetNdc = (ORBIT_SAFE_AREA_PX.top * 2) / Math.max(viewport.height, 1);
  const bottomInsetNdc = (ORBIT_SAFE_AREA_PX.bottom * 2) / Math.max(viewport.height, 1);

  const nextX = clampProjectedCenter(
    screenPosition.x,
    -1 + sideInsetNdc + halfWidthNdc,
    1 - sideInsetNdc - halfWidthNdc,
  );
  const nextY = clampProjectedCenter(
    screenPosition.y,
    -1 + bottomInsetNdc + halfHeightNdc,
    1 - topInsetNdc - halfHeightNdc,
  );

  if (nextX === screenPosition.x && nextY === screenPosition.y) return;

  screenPosition.set(nextX, nextY, screenPosition.z).unproject(camera);
  position.copy(screenPosition);
}

function getLerpAlpha(delta: number, speed: number) {
  return 1 - Math.exp(-Math.max(delta, 0) * speed);
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  return canvas;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + nextRadius, y);
  ctx.lineTo(x + width - nextRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  ctx.lineTo(x + width, y + height - nextRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  ctx.lineTo(x + nextRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  ctx.lineTo(x, y + nextRadius);
  ctx.quadraticCurveTo(x, y, x + nextRadius, y);
  ctx.closePath();
}

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  let nextText = text;
  while (ctx.measureText(nextText).width > maxWidth && nextText.length > 4) {
    nextText = `${nextText.slice(0, -2)}…`;
  }
  ctx.fillText(nextText, x, y);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = "";

  for (const char of chars) {
    const next = `${current}${char}`;
    if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
      current = next;
      continue;
    }

    lines.push(current);
    current = char;
    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    const suffix = index === maxLines - 1 && lines.length >= maxLines ? "…" : "";
    drawTextLine(ctx, `${line}${suffix}`, x, y + index * lineHeight, maxWidth);
  });
}

interface WorksCardPalette {
  badgeFill: string;
  badgeStroke: string;
  fg: string;
  muted: string;
  shadow: string;
}

function getWorksCardPalette(isDay: boolean): WorksCardPalette {
  if (isDay) {
    return {
      badgeFill: "rgba(255, 255, 255, 0.3)",
      badgeStroke: "rgba(17, 24, 39, 0.12)",
      fg: "rgba(17, 24, 39, 0.92)",
      muted: "rgba(17, 24, 39, 0.72)",
      shadow: "rgba(255, 255, 255, 0.28)",
    };
  }

  return {
    badgeFill: "rgba(0, 0, 0, 0.1)",
    badgeStroke: "rgba(255, 255, 255, 0.12)",
    fg: "rgba(248, 250, 255, 0.96)",
    muted: "rgba(255, 255, 255, 0.92)",
    shadow: "rgba(0, 0, 0, 0.4)",
  };
}

function drawCardTexture(
  canvas: HTMLCanvasElement,
  work: WorkProjectData,
  index: number,
  theme: ThemeMode,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDay = theme === "day";
  ctx.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const palette = getWorksCardPalette(isDay);
  const presentation = createWorksCardPresentation(work, index);

  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = palette.shadow;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = palette.fg;
  ctx.font = '600 40px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  drawTextLine(ctx, presentation.title, 64, 84, 576);
  ctx.restore();

  roundedRect(ctx, 64, 120, 96, 96, 48);
  ctx.fillStyle = palette.badgeFill;
  ctx.fill();
  roundedRect(ctx, 64, 120, 96, 96, 48);
  ctx.strokeStyle = palette.badgeStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = palette.fg;
  ctx.font = '600 27px "IBM Plex Mono", "Cascadia Code", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(presentation.orderLabel, 112, 168);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = palette.fg;
  ctx.font = '500 32px "Avenir Next", "Segoe UI", sans-serif';
  drawTextLine(ctx, presentation.kind, 184, 154, 456);

  ctx.fillStyle = palette.muted;
  ctx.font = '400 24px "Avenir Next", "Segoe UI", sans-serif';
  wrapText(ctx, presentation.description, 184, 188, 456, 28, 2);

  ctx.fillStyle = palette.muted;
  ctx.font = '500 25px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(presentation.actionLabels.website, 64, 344);
  ctx.fillText(presentation.actionLabels.source, 64, 398);

  ctx.fillStyle = palette.fg;
  ctx.font = '600 25px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(presentation.actionLabels.live, 640, 344);
  ctx.fillText(presentation.actionLabels.github, 640, 398);
  ctx.textAlign = "left";
}

export function applyGlassMaterialTheme(material: THREE.ShaderMaterial, theme: ThemeMode) {
  const isDay = theme === "day";
  (material.uniforms.uBaseColor.value as THREE.Color).set(isDay ? "#fafaf7" : "#050510");
  (material.uniforms.uGlassTint.value as THREE.Color).set("#ffffff");
  material.uniforms.uAberration.value = isDay ? 0.01 : 0;
  material.uniforms.uDayMode.value = isDay ? 1 : 0;
  material.uniforms.uGlassOpacity.value = isDay ? 0.58 : 0.64;
  material.uniforms.uTintStrength.value = isDay ? 0.18 : 0.075;
}

export function createWorksLiquidGlassMaterial(
  backdropTexture: THREE.Texture,
  theme: ThemeMode,
) {
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: LIQUID_GLASS_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uAberration: { value: WORKS_WEBGL_GLASS_PROFILE.aberration },
      uBackdrop: { value: backdropTexture },
      uBaseColor: { value: new THREE.Color() },
      uBevelDepth: { value: WORKS_WEBGL_GLASS_PROFILE.bevelDepth },
      uBevelWidth: { value: WORKS_WEBGL_GLASS_PROFILE.bevelWidth },
      uCardSize: {
        value: new THREE.Vector2(WORKS_CARD_PRESET.width, WORKS_CARD_PRESET.height),
      },
      uDayBorderWidthPx: { value: WORKS_CARD_PRESET.dayBorderWidth },
      uDayMode: { value: 0 },
      uFrost: { value: WORKS_WEBGL_GLASS_PROFILE.frost },
      uGlassTint: { value: new THREE.Color() },
      uGlassOpacity: { value: 0.64 },
      uHover: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uRefraction: { value: WORKS_WEBGL_GLASS_PROFILE.refraction },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uRimWidthPx: { value: WORKS_CARD_PRESET.rimWidth },
      uSaturation: { value: WORKS_CARD_PRESET.saturation },
      uTintStrength: { value: 0.075 },
      uViewAlpha: { value: 1 },
    },
    vertexShader: LIQUID_GLASS_VERTEX_SHADER,
  });
  applyGlassMaterialTheme(material, theme);
  return material;
}

function createCard(
  work: WorkProjectData,
  index: number,
  theme: ThemeMode,
  geometry: THREE.PlaneGeometry,
  backdropTexture: THREE.FramebufferTexture,
) {
  const canvas = createCanvas();
  drawCardTexture(canvas, work, index, theme);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;

  const cardMaterial = new THREE.MeshBasicMaterial({
    alphaTest: 0.02,
    color: 0xffffff,
    depthTest: true,
    depthWrite: false,
    map: texture,
    opacity: 1,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  const cardMesh = new THREE.Mesh(geometry, cardMaterial);
  cardMesh.name = `work-card-content-${work.slug}`;
  cardMesh.position.z = 0.018;
  cardMesh.renderOrder = 91;
  cardMesh.layers.set(WORKS_ORBIT_CARD_RENDER_LAYER);

  const glassMaterial = createWorksLiquidGlassMaterial(backdropTexture, theme);
  glassMaterial.depthTest = true;

  const glassMesh = new THREE.Mesh(geometry, glassMaterial);
  glassMesh.name = `work-card-glass-${work.slug}`;
  glassMesh.renderOrder = 90;
  glassMesh.layers.set(WORKS_ORBIT_CARD_RENDER_LAYER);

  const group = new THREE.Group();
  group.name = `work-orbit-card-${work.slug}`;
  group.add(glassMesh, cardMesh);

  return {
    cardMaterial,
    cardMesh,
    glassMaterial,
    glassMesh,
    group,
    texture,
    work,
  };
}

function createHitMesh(
  geometry: THREE.PlaneGeometry,
  material: THREE.MeshBasicMaterial,
  hit: WorksOrbitCardHit,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = hit;
  mesh.renderOrder = 120;
  return mesh;
}

function createBackdropTexture(width: number, height: number) {
  const texture = new THREE.FramebufferTexture(width, height);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export function createWorksOrbitCards({ theme, works }: WorksOrbitCardsOptions): WorksOrbitCards {
  const group = new THREE.Group();
  group.name = "works-orbit-cards";
  group.visible = false;

  let backdropTexture = createBackdropTexture(1, 1);
  const cardGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
  const actionHitGeometries = {
    live: new THREE.PlaneGeometry(
      WORKS_ACTION_LOCAL_RECTS.live.right - WORKS_ACTION_LOCAL_RECTS.live.left,
      WORKS_ACTION_LOCAL_RECTS.live.top - WORKS_ACTION_LOCAL_RECTS.live.bottom,
    ),
    github: new THREE.PlaneGeometry(
      WORKS_ACTION_LOCAL_RECTS.github.right - WORKS_ACTION_LOCAL_RECTS.github.left,
      WORKS_ACTION_LOCAL_RECTS.github.top - WORKS_ACTION_LOCAL_RECTS.github.bottom,
    ),
  };
  const hitMaterial = new THREE.MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const hitMeshes: THREE.Mesh[] = [];
  const cards = works.map((work, index) => {
    const card = createCard(work, index, theme, cardGeometry, backdropTexture);
    const liveHit: WorksOrbitCardHit = {
      action: "live",
      slug: work.slug,
      url: work.liveUrl,
    };
    const githubHit: WorksOrbitCardHit = {
      action: "github",
      slug: work.slug,
      url: work.githubUrl,
    };
    const liveHitMesh = createHitMesh(actionHitGeometries.live, hitMaterial, liveHit);
    liveHitMesh.position.set(
      (WORKS_ACTION_LOCAL_RECTS.live.left + WORKS_ACTION_LOCAL_RECTS.live.right) / 2,
      (WORKS_ACTION_LOCAL_RECTS.live.top + WORKS_ACTION_LOCAL_RECTS.live.bottom) / 2,
      0.03,
    );
    const githubHitMesh = createHitMesh(actionHitGeometries.github, hitMaterial, githubHit);
    githubHitMesh.position.set(
      (WORKS_ACTION_LOCAL_RECTS.github.left + WORKS_ACTION_LOCAL_RECTS.github.right) / 2,
      (WORKS_ACTION_LOCAL_RECTS.github.top + WORKS_ACTION_LOCAL_RECTS.github.bottom) / 2,
      0.03,
    );
    card.group.add(liveHitMesh, githubHitMesh);
    hitMeshes.push(liveHitMesh, githubHitMesh);

    group.add(card.group);
    return {
      ...card,
      githubHit,
      hoverScale: 1,
      hoverTilt: new THREE.Vector2(),
      index,
      liveHit,
    };
  });
  const cardsBySlug = new Map(cards.map((card) => [card.work.slug, card]));

  let hoveredSlug: string | null = null;
  let interaction: CardInteractionState | null = null;
  let interactionEnabled = false;
  let hasResolvedVisibility = false;
  let viewAlpha = 0;
  let layoutProgress = 0;
  let layoutTransitionElapsed = 0;
  let layoutTransitionStart = 0;
  let layoutTarget = 0;
  const phaseOffsets = new Map<string, number>();
  const returnStates = new Map<string, CardReturnState>();
  const screenHits = new Map<string, CardScreenHit>();
  let caseSlots: WorksCaseGridSlot[] = [];
  let caseSlotsViewportHeight = -1;
  let caseSlotsViewportWidth = -1;

  function resolveCaseSlots(viewport: WorksOrbitCardsUpdateOptions["viewport"]) {
    if (
      viewport.width === caseSlotsViewportWidth &&
      viewport.height === caseSlotsViewportHeight &&
      caseSlots.length === cards.length
    ) {
      return caseSlots;
    }

    const layout = resolveWorksCaseGridLayout(cards.length, viewport);
    caseSlots = cards.map((_card, index) => {
      const slot = getWorksCaseGridSlotFromLayout(index, layout);
      slot.x += viewport.width * 0.5;
      return slot;
    });
    caseSlotsViewportWidth = viewport.width;
    caseSlotsViewportHeight = viewport.height;
    return caseSlots;
  }

  function findTopScreenHit(pointerNdc: THREE.Vector2) {
    let topHit: CardScreenHit | undefined;
    for (const screenHit of screenHits.values()) {
      const containsPointer = containsPoint(screenHit, pointerNdc);
      if (containsPointer && (!topHit || screenHit.frontness > topHit.frontness)) {
        topHit = screenHit;
      }
    }
    return topHit;
  }

  function findTopActionHit(pointerNdc: THREE.Vector2) {
    const screenHit = findTopScreenHit(pointerNdc);
    if (!screenHit) return null;
    if (containsPoint(screenHit.actions.live, pointerNdc)) return screenHit.liveHit;
    if (containsPoint(screenHit.actions.github, pointerNdc)) return screenHit.githubHit;
    return null;
  }

  return {
    group,
    beginDrag(hit, pointerNdc) {
      const card = cardsBySlug.get(hit.slug);
      if (!card) return;
      returnStates.delete(card.work.slug);
      interaction = {
        grabOffset: null,
        hit: {
          action: "live",
          slug: card.work.slug,
          url: card.work.liveUrl,
        },
        pickupElapsed: 0,
        pointerNdc: pointerNdc.clone(),
        slug: card.work.slug,
        startPointerNdc: pointerNdc.clone(),
        startPosition: card.group.position.clone(),
        startQuaternion: card.group.quaternion.clone(),
        startRenderOrder: card.group.renderOrder,
        startScale: card.group.scale.x,
      };
      hoveredSlug = card.work.slug;
    },
    captureBackdrop(renderer) {
      renderer.getDrawingBufferSize(framebufferSize);
      const width = Math.max(1, Math.round(framebufferSize.x));
      const height = Math.max(1, Math.round(framebufferSize.y));
      const image = backdropTexture.image as { height: number; width: number };

      if (image.width !== width || image.height !== height) {
        const previousTexture = backdropTexture;
        backdropTexture = createBackdropTexture(width, height);

        for (const card of cards) {
          card.glassMaterial.uniforms.uBackdrop.value = backdropTexture;
        }

        previousTexture.dispose();
      }

      for (const card of cards) {
        (card.glassMaterial.uniforms.uResolution.value as THREE.Vector2).set(width, height);
      }

      renderer.copyFramebufferToTexture(backdropTexture);
    },
    clearInteraction() {
      interaction = null;
    },
    drag(pointerNdc) {
      if (!interaction) return;
      interaction.pointerNdc.copy(pointerNdc);
    },
    getActionScreenBounds(hit) {
      return screenHits.get(hit.slug)?.actions[hit.action] ?? null;
    },
    getScreenBounds(slug) {
      const bounds = screenHits.get(slug);
      if (!bounds) return null;
      return {
        corners: bounds.corners,
        halfHeight: bounds.halfHeight,
        halfWidth: bounds.halfWidth,
        x: bounds.x,
        y: bounds.y,
      };
    },
    dispose() {
      for (const card of cards) {
        card.texture.dispose();
        card.cardMaterial.dispose();
        card.glassMaterial.dispose();
      }
      backdropTexture.dispose();
      cardGeometry.dispose();
      actionHitGeometries.live.dispose();
      actionHitGeometries.github.dispose();
      hitMaterial.dispose();
      group.clear();
    },
    isInteracting() {
      return interaction !== null;
    },
    isLayoutTransitioning() {
      return Math.abs(layoutProgress - layoutTarget) > LAYOUT_TRANSITION_EPSILON;
    },
    pick(raycaster, pointerNdc) {
      if (!group.visible || !interactionEnabled) return null;

      if (pointerNdc) return findTopActionHit(pointerNdc);

      const intersections = raycaster.intersectObjects(hitMeshes, false);
      const hit = intersections[0]?.object.userData as Partial<WorksOrbitCardHit> | undefined;
      if (hit?.slug && hit.action && hit.url) {
        return {
          action: hit.action,
          slug: hit.slug,
          url: hit.url,
        };
      }

      return null;
    },
    pickHover(raycaster, pointerNdc) {
      if (!group.visible || !interactionEnabled) return null;

      if (pointerNdc) return findTopScreenHit(pointerNdc)?.liveHit ?? null;

      const intersections = raycaster.intersectObjects(hitMeshes, false);
      const hit = intersections[0]?.object.userData as Partial<WorksOrbitCardHit> | undefined;
      if (hit?.slug && hit.action && hit.url) {
        return {
          action: hit.action,
          slug: hit.slug,
          url: hit.url,
        };
      }

      return null;
    },
    release(elapsed) {
      if (!interaction) return null;

      const activeInteraction = interaction;
      const card = cardsBySlug.get(activeInteraction.slug);
      interaction = null;

      if (!card) return null;
      hoveredSlug = card.work.slug;

      if (isWorksLaunchZone(activeInteraction.pointerNdc)) {
        returnStates.delete(card.work.slug);
        return {
          action: "launch",
          url: card.work.liveUrl || activeInteraction.hit.url,
        };
      }

      const localX = (card.group.position.x - lastCenter.x) / lastRadii.radiusX;
      const localZ = (card.group.position.z - lastCenter.z) / lastRadii.radiusZ;
      const projectedAngle = Math.atan2(localZ, localX);
      phaseOffsets.set(
        card.work.slug,
        projectedAngle - getBaseAngle(card.index, cards.length, elapsed),
      );
      returnStates.set(card.work.slug, {
        startedAt: elapsed,
        startPosition: card.group.position.clone(),
        startScale: card.group.scale.x,
      });

      return { action: "resume" };
    },
    setHovered(hit) {
      hoveredSlug = interactionEnabled ? (hit?.slug ?? null) : null;
    },
    setTheme(nextTheme) {
      cards.forEach((card, index) => {
        drawCardTexture(card.texture.image as HTMLCanvasElement, card.work, index, nextTheme);
        card.texture.needsUpdate = true;
        applyGlassMaterialTheme(card.glassMaterial, nextTheme);
      });
    },
    update({ camera, center, delta, elapsed, layout, pointerNdc, reducedMotion, viewport, visible }) {
      const nextLayoutTarget = layout === "case" ? 1 : 0;
      if (nextLayoutTarget !== layoutTarget) {
        layoutTransitionStart = layoutProgress;
        layoutTransitionElapsed = 0;
        layoutTarget = nextLayoutTarget;
        interaction = null;
        hoveredSlug = null;
        returnStates.clear();
      }

      if (reducedMotion) {
        layoutProgress = layoutTarget;
      } else if (Math.abs(layoutProgress - layoutTarget) > LAYOUT_TRANSITION_EPSILON) {
        layoutTransitionElapsed += Math.max(delta, 0);
        const distance = Math.max(Math.abs(layoutTarget - layoutTransitionStart), 0.001);
        const progress = clamp(
          layoutTransitionElapsed / (LAYOUT_TRANSITION_DURATION * distance),
          0,
          1,
        );
        layoutProgress = THREE.MathUtils.lerp(
          layoutTransitionStart,
          layoutTarget,
          easeLayoutTransition(progress),
        );
        if (progress >= 1) layoutProgress = layoutTarget;
      }

      const targetViewAlpha = visible ? 1 : 0;
      if (!visible) {
        viewAlpha = 0;
        hasResolvedVisibility = true;
      } else if (!hasResolvedVisibility || reducedMotion) {
        viewAlpha = targetViewAlpha;
        hasResolvedVisibility = true;
      } else {
        viewAlpha = THREE.MathUtils.lerp(
          viewAlpha,
          targetViewAlpha,
          getLerpAlpha(delta, VIEW_TRANSITION_SPEED),
        );
        if (Math.abs(viewAlpha - targetViewAlpha) <= VIEW_TRANSITION_EPSILON) {
          viewAlpha = targetViewAlpha;
        }
      }

      interactionEnabled =
        visible && Math.abs(layoutProgress - layoutTarget) <= LAYOUT_TRANSITION_EPSILON;
      group.visible = visible || viewAlpha > 0;
      cards.forEach((card) => {
        card.cardMaterial.opacity = viewAlpha;
        card.glassMaterial.uniforms.uViewAlpha.value = viewAlpha;
      });

      if (!visible) {
        interaction = null;
        hoveredSlug = null;
        screenHits.clear();
      }
      if (!group.visible) {
        cards.forEach((card) => {
          card.hoverScale = 1;
          card.hoverTilt.set(0, 0);
        });
        return;
      }

      const radii = getWorksOrbitRadii(viewport.width);
      const activePointer = interaction?.pointerNdc ?? pointerNdc;
      const pointerX = (activePointer?.x ?? 0) * 0.5 + 0.5;
      const pointerY = (activePointer?.y ?? 0) * 0.5 + 0.5;
      lastCenter.copy(center);
      lastRadii = radii;
      const previousScreenHits = new Map(screenHits);
      screenHits.clear();
      const activeCaseSlots = resolveCaseSlots(viewport);
      cards.forEach((card, index) => {
        const frame = createWorksOrbitCardFrame({
          center,
          count: cards.length,
          elapsed,
          index,
          phaseOffset: phaseOffsets.get(card.work.slug) ?? 0,
          radiusX: radii.radiusX,
          radiusY: radii.radiusY,
          radiusZ: radii.radiusZ,
          reducedMotion,
        });
        const hovered = hoveredSlug === card.work.slug;
        const activeInteraction = interaction?.slug === card.work.slug ? interaction : null;
        const returnState = returnStates.get(card.work.slug);
        const hoverTarget = hovered || activeInteraction ? 1 : 0;
        const currentHover = card.glassMaterial.uniforms.uHover.value as number;
        card.glassMaterial.uniforms.uHover.value = reducedMotion
          ? hoverTarget
          : THREE.MathUtils.lerp(currentHover, hoverTarget, getLerpAlpha(delta, 10));
        (card.glassMaterial.uniforms.uPointer.value as THREE.Vector2).set(
          reducedMotion ? 0.5 : pointerX,
          reducedMotion ? 0.5 : pointerY,
        );

        const orbitRotationZ = (index - 1) * 0.025;
        const cardRotationZ = THREE.MathUtils.lerp(orbitRotationZ, 0, layoutProgress);
        const caseSlot = activeCaseSlots[index]!;
        const previousScreenHit = previousScreenHits.get(card.work.slug);
        const hoverTiltActive =
          hovered && !activeInteraction && Boolean(pointerNdc) && Boolean(previousScreenHit) && !reducedMotion;
        const hoverTiltTargetX = hoverTiltActive
          ? clamp(
              (pointerNdc!.y - previousScreenHit!.y) / previousScreenHit!.halfHeight,
              -1,
              1,
            ) * CARD_HOVER_MAX_TILT
          : 0;
        const hoverTiltTargetY = hoverTiltActive
          ? clamp(
              (pointerNdc!.x - previousScreenHit!.x) / previousScreenHit!.halfWidth,
              -1,
              1,
            ) * CARD_HOVER_MAX_TILT
          : 0;
        const hoverTiltLerp = reducedMotion ? 1 : getLerpAlpha(delta, CARD_HOVER_TILT_SPEED);
        card.hoverTilt.set(
          THREE.MathUtils.lerp(card.hoverTilt.x, hoverTiltTargetX, hoverTiltLerp),
          THREE.MathUtils.lerp(card.hoverTilt.y, hoverTiltTargetY, hoverTiltLerp),
        );
        if (activeInteraction) {
          const pointerPosition = getPointerWorldPosition(
            activeInteraction.pointerNdc,
            camera,
            dragPosition,
          );
          if (!activeInteraction.grabOffset) {
            screenPosition.copy(activeInteraction.startPosition).project(camera);
            dragCardCenterNdc.set(screenPosition.x, screenPosition.y);
            getPointerWorldPosition(dragCardCenterNdc, camera, dragCardCenterPosition);
            getPointerWorldPosition(
              activeInteraction.startPointerNdc,
              camera,
              dragTargetPosition,
            );
            activeInteraction.grabOffset = dragCardCenterPosition
              .clone()
              .sub(dragTargetPosition);
          }
          dragTargetPosition.copy(pointerPosition).add(activeInteraction.grabOffset);
          const strength = getWorksCenterMagnetStrength(
            activeInteraction.pointerNdc,
            reducedMotion,
          );
          const targetScale = getDragScale(camera, frame.scale, strength);
          const pickupDuration = reducedMotion
            ? DRAG_PICKUP_DURATION_REDUCED
            : DRAG_PICKUP_DURATION;
          activeInteraction.pickupElapsed += delta;
          const pickupProgress = clamp(
            activeInteraction.pickupElapsed / pickupDuration,
            0,
            1,
          );
          const pickupEase = easePickup(pickupProgress);
          dragTargetQuaternion.copy(camera.quaternion);

          if (pickupProgress < 1) {
            card.group.position.lerpVectors(
              activeInteraction.startPosition,
              dragTargetPosition,
              pickupEase,
            );
            card.group.scale.setScalar(
              THREE.MathUtils.lerp(
                activeInteraction.startScale,
                targetScale,
                pickupEase,
              ),
            );
            card.group.quaternion.slerpQuaternions(
              activeInteraction.startQuaternion,
              dragTargetQuaternion,
              pickupEase,
            );
          } else {
            card.group.position.lerp(
              dragTargetPosition,
              getLerpAlpha(delta, DRAG_LERP_SPEED),
            );
            card.group.scale.setScalar(
              THREE.MathUtils.lerp(
                card.group.scale.x,
                targetScale,
                getLerpAlpha(delta, DRAG_SCALE_LERP_SPEED),
              ),
            );
            card.group.quaternion.slerp(
              dragTargetQuaternion,
              getLerpAlpha(delta, DRAG_ROTATION_LERP_SPEED),
            );
          }

          const interactionRenderOrder = Math.round(
            THREE.MathUtils.lerp(
              activeInteraction.startRenderOrder,
              INTERACTION_RENDER_ORDER,
              pickupEase,
            ),
          );
          card.group.renderOrder = interactionRenderOrder;
          card.cardMesh.renderOrder = interactionRenderOrder;
          card.glassMesh.renderOrder = interactionRenderOrder - 1;
          card.cardMaterial.opacity = viewAlpha;
          card.cardMaterial.color.set("#ffffff");
          if (interactionEnabled) {
            screenHits.set(
              card.work.slug,
              getCardScreenHit(
                camera,
                card.group,
                activeInteraction.hit,
                card.githubHit,
                1,
              ),
            );
          }
          return;
        }

        card.group.quaternion.copy(camera.quaternion);
        card.group.rotateX(card.hoverTilt.x);
        card.group.rotateY(card.hoverTilt.y);
        card.group.rotateZ(cardRotationZ);

        orbitPosition.set(frame.position.x, frame.position.y, frame.position.z);
        const viewScale = 0.965 + viewAlpha * 0.035;
        const hoverScaleTarget =
          hovered && !reducedMotion
            ? THREE.MathUtils.lerp(
                ORBIT_CARD_HOVER_SCALE,
                CASE_CARD_HOVER_SCALE,
                layoutProgress,
              )
            : 1;
        card.hoverScale = reducedMotion
          ? 1
          : THREE.MathUtils.lerp(
              card.hoverScale,
              hoverScaleTarget,
              getLerpAlpha(delta, CARD_HOVER_SCALE_SPEED),
            );
        const orbitScale = frame.scale * card.hoverScale * viewScale;
        constrainOrbitPositionToViewport(
          camera,
          orbitPosition,
          orbitScale,
          cardRotationZ,
          viewport,
        );
        const caseScale = setCaseWorldPositionAndGetScale(
          camera,
          caseSlot,
          viewport,
        );
        resolvedPosition.lerpVectors(orbitPosition, casePosition, layoutProgress);
        const resolvedCaseScale = caseScale * card.hoverScale * viewScale;
        const resolvedScale = THREE.MathUtils.lerp(
          orbitScale,
          resolvedCaseScale,
          layoutProgress,
        );
        const orbitRenderOrder = Math.round(90 + frame.frontness * 50);
        const caseRenderOrder = 100 + index;
        const cardRenderOrder = Math.round(
          THREE.MathUtils.lerp(orbitRenderOrder, caseRenderOrder, layoutProgress),
        );
        let resolvedRenderOrder = cardRenderOrder;

        if (returnState) {
          const duration = reducedMotion
            ? RETURN_ANIMATION_DURATION_REDUCED
            : RETURN_ANIMATION_DURATION;
          const progress = clamp((elapsed - returnState.startedAt) / duration, 0, 1);
          const easedProgress = 1 - (1 - progress) ** 3;

          card.group.position.lerpVectors(
            returnState.startPosition,
            resolvedPosition,
            easedProgress,
          );
          card.group.scale.setScalar(
            THREE.MathUtils.lerp(returnState.startScale, resolvedScale, easedProgress),
          );
          resolvedRenderOrder = Math.round(
            THREE.MathUtils.lerp(INTERACTION_RENDER_ORDER, cardRenderOrder, easedProgress),
          );

          if (progress >= 1) {
            returnStates.delete(card.work.slug);
          }
        } else {
          card.group.position.copy(resolvedPosition);
          card.group.scale.setScalar(resolvedScale);
        }

        card.group.renderOrder = resolvedRenderOrder;
        card.cardMesh.renderOrder = resolvedRenderOrder;
        card.glassMesh.renderOrder = resolvedRenderOrder - 1;
        card.cardMaterial.opacity = viewAlpha;
        card.cardMaterial.color.set("#ffffff");
        if (interactionEnabled) {
          screenHits.set(
            card.work.slug,
            getCardScreenHit(
              camera,
              card.group,
              card.liveHit,
              card.githubHit,
              THREE.MathUtils.lerp(frame.frontness, 1 - index * 0.01, layoutProgress),
            ),
          );
        }
      });
    },
  };
}

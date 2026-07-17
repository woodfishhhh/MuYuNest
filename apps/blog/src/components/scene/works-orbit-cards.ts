import * as THREE from "three";

import {
  createWorksCardPresentation,
  WORKS_CARD_PRESET,
} from "@/components/home/works/works-card-preset";
import type { ThemeMode } from "@/composables/useTheme";
import type { WorkProjectData } from "@/types/content";

export type WorksOrbitCardAction = "live" | "github";
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

interface WorksOrbitCardsOptions {
  theme: ThemeMode;
  works: WorkProjectData[];
}

interface WorksOrbitCardsUpdateOptions {
  camera: THREE.PerspectiveCamera;
  center: THREE.Vector3;
  delta: number;
  elapsed: number;
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
  isInteracting: () => boolean;
  pick: (raycaster: THREE.Raycaster, pointerNdc?: THREE.Vector2) => WorksOrbitCardHit | null;
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
const DRAG_DISTANCE_FROM_CAMERA = 5.2;
const DRAG_LERP_SPEED = 18;
const DRAG_MAX_VIEWPORT_FRACTION = 0.46;
const LAUNCH_ZONE_HALF_NDC = 0.28;
const MAGNET_FALLOFF_NDC = 0.78;
const REDUCED_MOTION_INTENSITY_CAP = 0.25;
const INTERACTION_RENDER_ORDER = 1_000;
const RETURN_ANIMATION_DURATION = 0.38;
const RETURN_ANIMATION_DURATION_REDUCED = 0.18;
const VIEW_TRANSITION_SPEED = 12;
const VIEW_TRANSITION_EPSILON = 0.002;
export const WORKS_ORBIT_CARD_RENDER_LAYER = 1;
const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;
const ORBIT_CENTER_Y_OFFSET = -0.32;
const ORBIT_SAFE_AREA_PX = {
  bottom: 32,
  side: 24,
  top: 104,
} as const;

const LIQUID_GLASS_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LIQUID_GLASS_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uBackdrop;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec2 uCardSize;
  uniform vec3 uBaseColor;
  uniform vec3 uGlassTint;
  uniform float uAberrationBlur;
  uniform float uAberrationIntensity;
  uniform float uBlurPx;
  uniform float uDayBorderWidthPx;
  uniform float uDayMode;
  uniform float uDisplacementScale;
  uniform float uHover;
  uniform float uRimWidthPx;
  uniform float uSaturation;
  uniform float uViewAlpha;

  varying vec2 vUv;

  float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
    vec2 distanceToEdge = abs(point) - halfSize + radius;
    return min(max(distanceToEdge.x, distanceToEdge.y), 0.0)
      + length(max(distanceToEdge, 0.0)) - radius;
  }

  vec3 readBackdrop(vec2 uv) {
    vec4 sampled = texture2D(uBackdrop, clamp(uv, vec2(0.001), vec2(0.999)));
    vec3 restored = sampled.rgb / max(sampled.a, 0.001);
    return mix(uBaseColor, restored, smoothstep(0.0, 0.92, sampled.a));
  }

  vec3 saturateColor(vec3 color, float saturation) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luminance), color, saturation);
  }

  vec3 readBlurredBackdrop(vec2 uv, vec2 radius) {
    vec3 color = readBackdrop(uv) * 0.24;
    color += readBackdrop(uv + vec2(radius.x, 0.0)) * 0.12;
    color += readBackdrop(uv - vec2(radius.x, 0.0)) * 0.12;
    color += readBackdrop(uv + vec2(0.0, radius.y)) * 0.12;
    color += readBackdrop(uv - vec2(0.0, radius.y)) * 0.12;
    color += readBackdrop(uv + radius) * 0.07;
    color += readBackdrop(uv - radius) * 0.07;
    color += readBackdrop(uv + vec2(radius.x, -radius.y)) * 0.07;
    color += readBackdrop(uv + vec2(-radius.x, radius.y)) * 0.07;
    return saturateColor(color, uSaturation);
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
    float edgeDisplacement = 1.0 - smoothstep(0.0, 0.065, insideDistance);
    edgeDisplacement = edgeDisplacement * edgeDisplacement * edgeDisplacement;

    vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
    vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
    vec2 displacement = normal * edgeDisplacement * uDisplacementScale * pixel;
    float greenScale = 1.0 + uAberrationIntensity * 0.05;
    float blueScale = 1.0 + uAberrationIntensity * 0.1;
    vec2 blurRadius = pixel * uBlurPx * (1.0 + uAberrationBlur * 0.05);

    vec3 refracted;
    refracted.r = readBlurredBackdrop(screenUv - displacement, blurRadius).r;
    refracted.g = readBlurredBackdrop(screenUv - displacement * greenScale, blurRadius).g;
    refracted.b = readBlurredBackdrop(screenUv - displacement * blueScale, blurRadius).b;

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

    vec3 color = mix(refracted, uGlassTint, 0.035 + edgeDisplacement * 0.045);
    float screenStrength = screenRim * (0.16 + pointerLight * 0.26 + ambientLight * 0.16);
    float overlayStrength = overlayRim * (0.22 + uHover * 0.08);
    color = mix(color, vec3(0.0), dayBorder * uDayMode * 0.62);
    color = mix(color, screenBlend(color, vec3(1.0)), clamp(screenStrength, 0.0, 0.72));
    color = mix(color, overlayBlend(color, mix(uGlassTint, vec3(1.0), 0.7)), overlayStrength);

    gl_FragColor = vec4(
      color,
      clamp(0.88 + screenRim * 0.08, 0.0, 0.96) * uViewAlpha
    );
  }
`;

interface CardInteractionState {
  hit: WorksOrbitCardHit;
  pointerNdc: THREE.Vector2;
  slug: string;
}

interface CardScreenHit {
  frontness: number;
  halfHeight: number;
  halfWidth: number;
  hit: WorksOrbitCardHit;
  x: number;
  y: number;
}

interface CardReturnState {
  startedAt: number;
  startPosition: THREE.Vector3;
  startScale: number;
}

const orbitPosition = new THREE.Vector3();
const dragRaycaster = new THREE.Raycaster();
const dragPosition = new THREE.Vector3();
const lastCenter = new THREE.Vector3();
const framebufferSize = new THREE.Vector2();
const screenPosition = new THREE.Vector3();
const cameraSpacePosition = new THREE.Vector3();
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

function getBaseAngle(index: number, count: number, elapsed: number) {
  const safeCount = Math.max(count, 1);
  return (index / safeCount) * TAU - Math.PI * 0.12 + elapsed * ORBIT_SPEED;
}

function getPointerWorldPosition(pointerNdc: THREE.Vector2, camera: THREE.PerspectiveCamera) {
  dragRaycaster.setFromCamera(pointerNdc, camera);
  return dragPosition
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

function getCardScreenHit(
  camera: THREE.PerspectiveCamera,
  cardPosition: THREE.Vector3,
  scale: number,
  hit: WorksOrbitCardHit,
  frontness: number,
): CardScreenHit {
  screenPosition.copy(cardPosition).project(camera);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const viewDepth = Math.max(
    Math.abs(cameraSpacePosition.copy(cardPosition).applyMatrix4(camera.matrixWorldInverse).z),
    0.001,
  );
  const viewHeight = 2 * Math.tan(fov / 2) * viewDepth;
  const viewWidth = viewHeight * camera.aspect;

  return {
    frontness,
    halfHeight: (CARD_HEIGHT * scale) / viewHeight,
    halfWidth: (CARD_WIDTH * scale) / viewWidth,
    hit,
    x: screenPosition.x,
    y: screenPosition.y,
  };
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

function applyGlassMaterialTheme(material: THREE.ShaderMaterial, theme: ThemeMode) {
  const isDay = theme === "day";
  (material.uniforms.uBaseColor.value as THREE.Color).set(isDay ? "#fafaf7" : "#050510");
  (material.uniforms.uGlassTint.value as THREE.Color).set(isDay ? "#ffffff" : "#afc7ff");
  material.uniforms.uDayMode.value = isDay ? 1 : 0;
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

  const glassMaterial = new THREE.ShaderMaterial({
    depthTest: true,
    depthWrite: true,
    fragmentShader: LIQUID_GLASS_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uAberrationBlur: { value: WORKS_CARD_PRESET.aberrationBlur },
      uAberrationIntensity: { value: WORKS_CARD_PRESET.aberrationIntensity },
      uBackdrop: { value: backdropTexture },
      uBaseColor: { value: new THREE.Color() },
      uBlurPx: { value: WORKS_CARD_PRESET.blurPx },
      uCardSize: {
        value: new THREE.Vector2(WORKS_CARD_PRESET.width, WORKS_CARD_PRESET.height),
      },
      uDisplacementScale: { value: WORKS_CARD_PRESET.displacementScale },
      uDayBorderWidthPx: { value: WORKS_CARD_PRESET.dayBorderWidth },
      uDayMode: { value: 0 },
      uGlassTint: { value: new THREE.Color() },
      uHover: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uRimWidthPx: { value: WORKS_CARD_PRESET.rimWidth },
      uSaturation: { value: WORKS_CARD_PRESET.saturation },
      uViewAlpha: { value: 1 },
    },
    vertexShader: LIQUID_GLASS_VERTEX_SHADER,
  });
  applyGlassMaterialTheme(glassMaterial, theme);

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
  const liveHitGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
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
    const liveHitMesh = createHitMesh(liveHitGeometry, hitMaterial, {
      action: "live",
      slug: work.slug,
      url: work.liveUrl,
    });
    liveHitMesh.position.z = 0.03;
    card.group.add(liveHitMesh);
    hitMeshes.push(liveHitMesh);

    group.add(card.group);
    return card;
  });

  let hoveredSlug: string | null = null;
  let interaction: CardInteractionState | null = null;
  let interactionEnabled = false;
  let hasResolvedVisibility = false;
  let viewAlpha = 0;
  const phaseOffsets = new Map<string, number>();
  const returnStates = new Map<string, CardReturnState>();
  const screenHits = new Map<string, CardScreenHit>();

  return {
    group,
    beginDrag(hit, pointerNdc) {
      const card = cards.find((item) => item.work.slug === hit.slug);
      if (!card) return;
      returnStates.delete(card.work.slug);
      interaction = {
        hit: {
          action: "live",
          slug: card.work.slug,
          url: card.work.liveUrl,
        },
        pointerNdc: pointerNdc.clone(),
        slug: card.work.slug,
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
    dispose() {
      for (const card of cards) {
        card.texture.dispose();
        card.cardMaterial.dispose();
        card.glassMaterial.dispose();
      }
      backdropTexture.dispose();
      cardGeometry.dispose();
      liveHitGeometry.dispose();
      hitMaterial.dispose();
      group.clear();
    },
    isInteracting() {
      return interaction !== null;
    },
    pick(raycaster, pointerNdc) {
      if (!group.visible || !interactionEnabled) return null;

      const intersections = raycaster.intersectObjects(hitMeshes, false);
      const hit = intersections[0]?.object.userData as Partial<WorksOrbitCardHit> | undefined;
      if (hit?.slug && hit.action && hit.url) {
        return {
          action: hit.action,
          slug: hit.slug,
          url: hit.url,
        };
      }

      if (!pointerNdc) return null;
      return (
        [...screenHits.values()]
          .filter((screenHit) => {
            return (
              Math.abs(pointerNdc.x - screenHit.x) <= screenHit.halfWidth &&
              Math.abs(pointerNdc.y - screenHit.y) <= screenHit.halfHeight
            );
          })
          .sort((a, b) => b.frontness - a.frontness)[0]?.hit ?? null
      );
    },
    release(elapsed) {
      if (!interaction) return null;

      const activeInteraction = interaction;
      const cardIndex = cards.findIndex((card) => card.work.slug === activeInteraction.slug);
      const card = cards[cardIndex];
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
        projectedAngle - getBaseAngle(cardIndex, cards.length, elapsed),
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
    update({ camera, center, delta, elapsed, pointerNdc, reducedMotion, viewport, visible }) {
      const targetViewAlpha = visible ? 1 : 0;
      if (!hasResolvedVisibility || reducedMotion) {
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

      interactionEnabled = visible;
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
        return;
      }

      const radii = getWorksOrbitRadii(viewport.width);
      const activePointer = interaction?.pointerNdc ?? pointerNdc;
      const pointerX = (activePointer?.x ?? 0) * 0.5 + 0.5;
      const pointerY = (activePointer?.y ?? 0) * 0.5 + 0.5;
      lastCenter.copy(center);
      lastRadii = radii;
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

        const cardRotationZ = (index - 1) * 0.025;
        card.group.quaternion.copy(camera.quaternion);
        card.group.rotateZ(cardRotationZ);

        if (activeInteraction) {
          const targetPosition = getPointerWorldPosition(activeInteraction.pointerNdc, camera);
          const strength = getWorksCenterMagnetStrength(
            activeInteraction.pointerNdc,
            reducedMotion,
          );
          const lerpAlpha = getLerpAlpha(delta, DRAG_LERP_SPEED);
          card.group.position.lerp(targetPosition, lerpAlpha);
          card.group.scale.setScalar(getDragScale(camera, frame.scale, strength));
          card.group.renderOrder = INTERACTION_RENDER_ORDER;
          card.cardMesh.renderOrder = INTERACTION_RENDER_ORDER;
          card.glassMesh.renderOrder = INTERACTION_RENDER_ORDER - 1;
          card.cardMaterial.opacity = viewAlpha;
          card.cardMaterial.color.set("#ffffff");
          if (interactionEnabled) {
            screenHits.set(
              card.work.slug,
              getCardScreenHit(
                camera,
                card.group.position,
                card.group.scale.x,
                activeInteraction.hit,
                1,
              ),
            );
          }
          return;
        }

        orbitPosition.set(frame.position.x, frame.position.y, frame.position.z);
        const viewScale = 0.965 + viewAlpha * 0.035;
        const orbitScale = frame.scale * (hovered ? 1.08 : 1) * viewScale;
        constrainOrbitPositionToViewport(
          camera,
          orbitPosition,
          orbitScale,
          cardRotationZ,
          viewport,
        );
        const cardRenderOrder = Math.round(90 + frame.frontness * 50);
        let resolvedRenderOrder = cardRenderOrder;

        if (returnState) {
          const duration = reducedMotion
            ? RETURN_ANIMATION_DURATION_REDUCED
            : RETURN_ANIMATION_DURATION;
          const progress = clamp((elapsed - returnState.startedAt) / duration, 0, 1);
          const easedProgress = 1 - (1 - progress) ** 3;

          card.group.position.lerpVectors(returnState.startPosition, orbitPosition, easedProgress);
          card.group.scale.setScalar(
            THREE.MathUtils.lerp(returnState.startScale, orbitScale, easedProgress),
          );
          resolvedRenderOrder = Math.round(
            THREE.MathUtils.lerp(INTERACTION_RENDER_ORDER, cardRenderOrder, easedProgress),
          );

          if (progress >= 1) {
            returnStates.delete(card.work.slug);
          }
        } else {
          card.group.position.copy(orbitPosition);
          card.group.scale.setScalar(orbitScale);
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
              card.group.position,
              card.group.scale.x,
              {
                action: "live",
                slug: card.work.slug,
                url: card.work.liveUrl,
              },
              frame.frontness,
            ),
          );
        }
      });
    },
  };
}

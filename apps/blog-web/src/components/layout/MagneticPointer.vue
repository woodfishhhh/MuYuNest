<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";

import {
  initializeMagneticPointerStyle,
  clearSceneMagneticPointerTarget,
  getSceneMagneticPointerTarget,
  resolveMagneticPointerFrame,
  type MagneticPointerFrame,
  type MagneticPointerPoint,
  type MagneticPointerTarget,
} from "@/utils/magnetic-pointer";

const pointerElement = useTemplateRef<HTMLElement>("pointerOverlay");
const pointerPosition = { x: 0, y: 0 };
let animationFrameId: number | null = null;
let currentFrame: MagneticPointerFrame | null = null;
let domTarget: HTMLElement | null = null;
let enabled = false;
let lastFrameTime = 0;
let magnetic = false;
let pressed = false;
let visible = false;

function supportsMagneticPointer() {
  if (typeof window.matchMedia !== "function") return true;
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function findDomTarget(event: PointerEvent) {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLElement && node.matches("[data-magnetic-pointer]")) {
      return node;
    }
  }
  return null;
}

function readBorderBoxSize(element: HTMLElement, style: CSSStyleDeclaration) {
  const parsedWidth = Number.parseFloat(style.width);
  const parsedHeight = Number.parseFloat(style.height);
  const horizontalExtras =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth);
  const verticalExtras =
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom) +
    Number.parseFloat(style.borderTopWidth) +
    Number.parseFloat(style.borderBottomWidth);

  return {
    height:
      Number.isFinite(parsedHeight) && parsedHeight > 0
        ? parsedHeight + (style.boxSizing === "border-box" ? 0 : verticalExtras)
        : element.offsetHeight,
    width:
      Number.isFinite(parsedWidth) && parsedWidth > 0
        ? parsedWidth + (style.boxSizing === "border-box" ? 0 : horizontalExtras)
        : element.offsetWidth,
  };
}

function resolveTransformedCorners(
  element: HTMLElement,
  bounds: DOMRect,
  style: CSSStyleDeclaration,
): MagneticPointerTarget["corners"] | undefined {
  if (style.transform === "none" || typeof DOMMatrixReadOnly === "undefined") return undefined;

  try {
    const matrix = new DOMMatrixReadOnly(style.transform);
    const size = readBorderBoxSize(element, style);
    if (size.width <= 0 || size.height <= 0) return undefined;

    const [originX = size.width / 2, originY = size.height / 2] = style.transformOrigin
      .split(" ")
      .map((value) => Number.parseFloat(value));
    const localCorners = [
      { x: 0, y: 0 },
      { x: size.width, y: 0 },
      { x: size.width, y: size.height },
      { x: 0, y: size.height },
    ] as const;
    const transformedCorners = localCorners.map((corner) => {
      const transformed = matrix.transformPoint({
        w: 1,
        x: corner.x - originX,
        y: corner.y - originY,
        z: 0,
      });
      const inverseW = Math.abs(transformed.w) > 0.000001 ? 1 / transformed.w : 1;
      return {
        x: transformed.x * inverseW + originX,
        y: transformed.y * inverseW + originY,
      };
    });
    const localLeft = Math.min(...transformedCorners.map((corner) => corner.x));
    const localTop = Math.min(...transformedCorners.map((corner) => corner.y));

    return transformedCorners.map((corner) => ({
      x: bounds.left + corner.x - localLeft,
      y: bounds.top + corner.y - localTop,
    })) as unknown as MagneticPointerTarget["corners"];
  } catch {
    return undefined;
  }
}

function resolveDomTarget(): MagneticPointerTarget | null {
  if (!domTarget?.isConnected) {
    domTarget = null;
    return null;
  }

  const bounds = domTarget.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const style = getComputedStyle(domTarget);
  const radiusValue = Number.parseFloat(style.borderRadius);
  return {
    corners: resolveTransformedCorners(domTarget, bounds, style),
    height: bounds.height,
    key: domTarget.dataset.magneticPointer || "dom-card",
    left: bounds.left,
    radius: Number.isFinite(radiusValue) ? radiusValue : 8,
    top: bounds.top,
    width: bounds.width,
  };
}

function setDataState(name: "magnetic" | "pressed" | "visible", value: boolean) {
  const element = pointerElement.value;
  if (!element) return;
  element.dataset[name] = String(value);
}

function lerp(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

function getFrameCorners(frame: MagneticPointerFrame): readonly MagneticPointerPoint[] {
  if (frame.corners) return frame.corners;
  const left = frame.x - frame.width / 2;
  const right = frame.x + frame.width / 2;
  const top = frame.y - frame.height / 2;
  const bottom = frame.y + frame.height / 2;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function setShapePoints(frame: MagneticPointerFrame) {
  const element = pointerElement.value;
  if (!element) return;
  const shape = element.querySelector<SVGPolygonElement>("[data-magnetic-pointer-shape]");
  if (!shape) return;
  const left = frame.x - frame.width / 2;
  const top = frame.y - frame.height / 2;
  const localCorners = getFrameCorners(frame).map((corner) => ({
    x: corner.x - left,
    y: corner.y - top,
  }));
  shape.setAttribute(
    "points",
    localCorners.map((corner) => `${corner.x},${corner.y}`).join(" "),
  );

  element.querySelectorAll<SVGPolylineElement>("[data-magnetic-pointer-corner]").forEach(
    (cornerElement, index) => {
      const current = localCorners[index]!;
      const previous = localCorners[(index + localCorners.length - 1) % localCorners.length]!;
      const next = localCorners[(index + 1) % localCorners.length]!;
      const segment = 0.24;
      cornerElement.setAttribute(
        "points",
        [
          {
            x: current.x + (previous.x - current.x) * segment,
            y: current.y + (previous.y - current.y) * segment,
          },
          current,
          {
            x: current.x + (next.x - current.x) * segment,
            y: current.y + (next.y - current.y) * segment,
          },
        ]
          .map((point) => `${point.x},${point.y}`)
          .join(" "),
      );
    },
  );
}

function renderFrame(timestamp: number) {
  animationFrameId = null;
  if (!enabled || !visible || !pointerElement.value) return;

  const target = getSceneMagneticPointerTarget() ?? resolveDomTarget();
  const nextMagnetic = Boolean(target);
  if (magnetic !== nextMagnetic) {
    magnetic = nextMagnetic;
    setDataState("magnetic", magnetic);
  }

  const desiredFrame = resolveMagneticPointerFrame(pointerPosition, target);
  const elapsedSeconds = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 0;
  lastFrameTime = timestamp;

  if (!currentFrame) {
    currentFrame = { ...desiredFrame };
  } else {
    const positionAlpha = 1 - Math.exp(-24 * elapsedSeconds);
    const shapeAlpha = 1 - Math.exp(-18 * elapsedSeconds);
    currentFrame.x = lerp(currentFrame.x, desiredFrame.x, positionAlpha);
    currentFrame.y = lerp(currentFrame.y, desiredFrame.y, positionAlpha);
    currentFrame.width = lerp(currentFrame.width, desiredFrame.width, shapeAlpha);
    currentFrame.height = lerp(currentFrame.height, desiredFrame.height, shapeAlpha);
    currentFrame.radius = lerp(currentFrame.radius, desiredFrame.radius, shapeAlpha);
    const currentCorners = getFrameCorners(currentFrame);
    const desiredCorners = getFrameCorners(desiredFrame);
    currentFrame.corners = currentCorners.map((corner, index) => ({
      x: lerp(corner.x, desiredCorners[index]!.x, shapeAlpha),
      y: lerp(corner.y, desiredCorners[index]!.y, shapeAlpha),
    })) as unknown as MagneticPointerFrame["corners"];
  }

  const frame = currentFrame;
  pointerElement.value.style.width = `${frame.width}px`;
  pointerElement.value.style.height = `${frame.height}px`;
  pointerElement.value.style.borderRadius = `${frame.radius}px`;
  pointerElement.value.style.transform = `translate3d(${frame.x - frame.width / 2}px, ${frame.y - frame.height / 2}px, 0)`;
  setShapePoints(frame);

  animationFrameId = requestAnimationFrame(renderFrame);
}

function ensureAnimationFrame() {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(renderFrame);
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!enabled || (event.pointerType && event.pointerType !== "mouse")) return;
  pointerPosition.x = event.clientX;
  pointerPosition.y = event.clientY;
  domTarget = findDomTarget(event);
  if (!visible) {
    visible = true;
    currentFrame = null;
    lastFrameTime = 0;
    setDataState("visible", true);
  }
  ensureAnimationFrame();
}

function handlePointerDown(event: PointerEvent) {
  if (!enabled || (event.pointerType && event.pointerType !== "mouse")) return;
  pressed = true;
  setDataState("pressed", true);
}

function handlePointerUp() {
  if (!pressed) return;
  pressed = false;
  setDataState("pressed", false);
}

function hidePointer() {
  visible = false;
  magnetic = false;
  domTarget = null;
  currentFrame = null;
  lastFrameTime = 0;
  setDataState("visible", false);
  setDataState("magnetic", false);
  handlePointerUp();
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) hidePointer();
}

onMounted(() => {
  initializeMagneticPointerStyle();
  enabled = supportsMagneticPointer();
  if (!enabled) return;

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  window.addEventListener("pointerup", handlePointerUp, { passive: true });
  window.addEventListener("pointercancel", handlePointerUp, { passive: true });
  window.addEventListener("blur", hidePointer);
  document.documentElement.addEventListener("mouseleave", hidePointer);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onBeforeUnmount(() => {
  hidePointer();
  clearSceneMagneticPointerTarget();
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerdown", handlePointerDown);
  window.removeEventListener("pointerup", handlePointerUp);
  window.removeEventListener("pointercancel", handlePointerUp);
  window.removeEventListener("blur", hidePointer);
  document.documentElement.removeEventListener("mouseleave", hidePointer);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div
    ref="pointerOverlay"
    aria-hidden="true"
    class="magnetic-pointer"
    data-magnetic="false"
    data-magnetic-pointer-overlay
    data-pressed="false"
    data-visible="false"
  >
    <svg aria-hidden="true" class="magnetic-pointer__shape" preserveAspectRatio="none">
      <polygon data-magnetic-pointer-shape points="0,0 7,0 7,7 0,7" />
      <polyline data-magnetic-pointer-corner="0" points="0,2 0,0 2,0" />
      <polyline data-magnetic-pointer-corner="1" points="5,0 7,0 7,2" />
      <polyline data-magnetic-pointer-corner="2" points="7,5 7,7 5,7" />
      <polyline data-magnetic-pointer-corner="3" points="2,7 0,7 0,5" />
    </svg>
    <span class="magnetic-pointer__dot" />
  </div>
</template>

<style>
.magnetic-pointer {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 120;
  box-sizing: border-box;
  width: 7px;
  height: 7px;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(-20px, -20px, 0);
  transition: opacity 120ms ease;
  will-change: width, height, transform;
}

.magnetic-pointer[data-visible="true"] {
  opacity: 1;
}

.magnetic-pointer__shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  opacity: 0;
  filter: drop-shadow(0 8px 18px color-mix(in srgb, var(--accent) 14%, transparent));
  transition: opacity 160ms ease;
}

.magnetic-pointer__shape polygon {
  fill: transparent;
  stroke: var(--stage-fg);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.magnetic-pointer__shape polyline {
  fill: none;
  stroke: var(--stage-fg);
  stroke-linecap: square;
  stroke-linejoin: miter;
  stroke-width: 1.5;
  opacity: 0;
  vector-effect: non-scaling-stroke;
}

.magnetic-pointer[data-magnetic="true"] .magnetic-pointer__shape {
  opacity: 1;
}

:root:is(
    [data-magnetic-pointer-style="corners"],
    [data-magnetic-pointer-style="corners-hairline"],
    [data-magnetic-pointer-style="corners-axis"],
    [data-magnetic-pointer-style="corners-contrast"]
  )
  .magnetic-pointer__shape {
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 26%, transparent));
}

:root:is(
    [data-magnetic-pointer-style="corners"],
    [data-magnetic-pointer-style="corners-hairline"],
    [data-magnetic-pointer-style="corners-axis"],
    [data-magnetic-pointer-style="corners-contrast"]
  )
  .magnetic-pointer__shape
  polygon {
  opacity: 0;
}

:root:is(
    [data-magnetic-pointer-style="corners"],
    [data-magnetic-pointer-style="corners-hairline"],
    [data-magnetic-pointer-style="corners-axis"],
    [data-magnetic-pointer-style="corners-contrast"]
  )
  .magnetic-pointer__shape
  polyline {
  stroke: color-mix(in srgb, var(--stage-fg) 72%, var(--accent));
  opacity: 0.92;
}

:root[data-magnetic-pointer-style="corners-hairline"] .magnetic-pointer__shape {
  filter: none;
}

:root[data-magnetic-pointer-style="corners-hairline"] .magnetic-pointer__shape polyline {
  stroke: color-mix(in srgb, var(--stage-fg) 76%, transparent);
  stroke-width: 1;
  opacity: 0.72;
}

:root[data-magnetic-pointer-style="corners-axis"] .magnetic-pointer {
  background:
    linear-gradient(var(--accent), var(--accent)) center top / 1px 5px no-repeat,
    linear-gradient(var(--accent), var(--accent)) right center / 5px 1px no-repeat,
    linear-gradient(var(--accent), var(--accent)) center bottom / 1px 5px no-repeat,
    linear-gradient(var(--accent), var(--accent)) left center / 5px 1px no-repeat;
}

:root[data-magnetic-pointer-style="corners-axis"] .magnetic-pointer__shape {
  filter: none;
}

:root[data-magnetic-pointer-style="corners-axis"] .magnetic-pointer__shape polyline {
  stroke: color-mix(in srgb, var(--stage-fg) 48%, var(--accent));
  stroke-width: 1;
  opacity: 0.58;
}

:root[data-magnetic-pointer-style="corners-contrast"] .magnetic-pointer__shape {
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 34%, transparent));
}

:root[data-magnetic-pointer-style="corners-contrast"] .magnetic-pointer__shape polyline {
  stroke: var(--accent);
  stroke-width: 2;
  opacity: 1;
}

:root[data-magnetic-pointer-style="glass"] .magnetic-pointer__shape polygon {
  fill: color-mix(in srgb, var(--surface-2) 30%, transparent);
  stroke: color-mix(in srgb, var(--stage-fg) 46%, var(--accent));
  stroke-width: 1;
}

:root[data-magnetic-pointer-style="glass"] .magnetic-pointer__shape {
  filter: drop-shadow(0 8px 20px color-mix(in srgb, var(--accent) 16%, transparent));
}

:root[data-magnetic-pointer-style="precision"] .magnetic-pointer__shape polygon {
  fill: transparent;
  stroke: color-mix(in srgb, var(--accent) 76%, var(--stage-fg));
  stroke-dasharray: 2 2;
  stroke-width: 1;
}

:root[data-magnetic-pointer-style="precision"] .magnetic-pointer__shape {
  filter: none;
}

:root[data-magnetic-pointer-style="inverse"] .magnetic-pointer__shape {
  filter: none;
  mix-blend-mode: difference;
}

:root[data-magnetic-pointer-style="inverse"] .magnetic-pointer__shape polygon {
  fill: rgba(255, 255, 255, 0.92);
  stroke: white;
  stroke-width: 0;
}

.magnetic-pointer__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  border: 1px solid color-mix(in srgb, var(--surface-2) 35%, transparent);
  border-radius: 50%;
  background: var(--stage-fg);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 46%, transparent);
  transform: translate(-50%, -50%);
  transition:
    width 160ms ease,
    height 160ms ease,
    opacity 160ms ease,
    transform 100ms ease;
}

.magnetic-pointer[data-magnetic="true"] .magnetic-pointer__dot {
  width: 3px;
  height: 3px;
  opacity: 0.72;
}

:root:is(
    [data-magnetic-pointer-style="corners"],
    [data-magnetic-pointer-style="corners-hairline"],
    [data-magnetic-pointer-style="corners-axis"],
    [data-magnetic-pointer-style="corners-contrast"]
  )
  .magnetic-pointer__dot {
  background: color-mix(in srgb, var(--stage-fg) 70%, var(--accent));
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 36%, transparent);
}

:root[data-magnetic-pointer-style="corners-hairline"] .magnetic-pointer__dot {
  width: 4px;
  height: 4px;
  background: var(--stage-fg);
  box-shadow: none;
}

:root[data-magnetic-pointer-style="corners-axis"] .magnetic-pointer__dot {
  width: 6px;
  height: 6px;
  border-color: var(--accent);
  background: transparent;
  box-shadow: none;
}

:root[data-magnetic-pointer-style="corners-contrast"] .magnetic-pointer__dot {
  width: 4px;
  height: 4px;
  border-color: transparent;
  background: var(--accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 50%, transparent);
}

:root[data-magnetic-pointer-style="glass"] .magnetic-pointer__dot {
  background: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 50%, transparent);
}

:root[data-magnetic-pointer-style="precision"] .magnetic-pointer__dot {
  width: 5px;
  height: 5px;
  background: var(--stage-fg);
  box-shadow: none;
}

:root[data-magnetic-pointer-style="inverse"] .magnetic-pointer__dot {
  border-color: transparent;
  background: white;
  box-shadow: none;
  mix-blend-mode: difference;
}

.magnetic-pointer[data-pressed="true"] .magnetic-pointer__dot {
  transform: translate(-50%, -50%) scale(1.7);
}

@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
  .magnetic-pointer {
    display: none;
  }
}
</style>

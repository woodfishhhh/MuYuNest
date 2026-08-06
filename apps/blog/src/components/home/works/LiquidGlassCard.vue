<script lang="ts">
const registeredDynamicSelectors = new Set<string>();
</script>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import { computed, onMounted, onUnmounted, ref, useId, useTemplateRef } from "vue";

import { supportsContentLayout } from "@/utils/responsive";

import { WORKS_WEBGL_GLASS_PROFILE } from "./works-card-preset";

const props = withDefaults(
  defineProps<{
    cornerRadius?: number;
    dynamicSelector?: string;
    padding?: string;
    snapshotSelector?: string;
    variant?: "card" | "action" | "case";
    webglEnabled?: boolean;
  }>(),
  {
    cornerRadius: 8,
    dynamicSelector: "[data-liquid-gl-snapshot]",
    padding: "24px 32px",
    snapshotSelector: "[data-liquid-gl-snapshot]",
    variant: "card",
    webglEnabled: true,
  },
);

const root = useTemplateRef<HTMLElement>("root");
const targetId = `liquid-gl-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
const webglReady = ref(false);

let initializationPending = false;
let initializationTimer: number | null = null;
let webglInitialized = false;
let resizeObserver: ResizeObserver | null = null;
let unmounted = false;

const rootStyle = computed<CSSProperties>(() => ({
  "--glass-padding": props.padding,
  "--glass-radius": `${props.cornerRadius}px`,
}));

function hasUsableSize() {
  const bounds = root.value?.getBoundingClientRect();
  return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
}

function resolveSnapshotResolution() {
  return supportsContentLayout(window.innerWidth)
    ? WORKS_WEBGL_GLASS_PROFILE.resolution
    : WORKS_WEBGL_GLASS_PROFILE.mobileResolution;
}

async function waitForSnapshotTarget(selector: string) {
  const deadline = performance.now() + 3000;

  while (!unmounted && performance.now() < deadline) {
    if (document.querySelector(selector)) return true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  return false;
}

async function initializeWebGL() {
  if (
    unmounted ||
    initializationPending ||
    webglInitialized ||
    webglReady.value ||
    !props.webglEnabled ||
    !hasUsableSize() ||
    typeof WebGLRenderingContext === "undefined"
  ) {
    return;
  }

  initializationPending = true;

  try {
    const hasSnapshot = await waitForSnapshotTarget(props.snapshotSelector);
    if (!hasSnapshot || unmounted) return;

    const { default: liquidGL } = await import("liquid-gl");
    if (unmounted) return;
    liquidGL({
      target: `#${targetId}`,
      snapshot: props.snapshotSelector,
      resolution: resolveSnapshotResolution(),
      refraction: WORKS_WEBGL_GLASS_PROFILE.refraction,
      aberration: WORKS_WEBGL_GLASS_PROFILE.aberration,
      bevelDepth: WORKS_WEBGL_GLASS_PROFILE.bevelDepth,
      bevelWidth: WORKS_WEBGL_GLASS_PROFILE.bevelWidth,
      frost: WORKS_WEBGL_GLASS_PROFILE.frost,
      shadow: WORKS_WEBGL_GLASS_PROFILE.shadow,
      specular: WORKS_WEBGL_GLASS_PROFILE.specular,
      reveal: "none",
      tilt: WORKS_WEBGL_GLASS_PROFILE.tilt,
      magnify: WORKS_WEBGL_GLASS_PROFILE.magnify,
      on: {
        init: () => {
          webglReady.value = true;
        },
      },
    });
    webglInitialized = true;

    if (
      props.dynamicSelector &&
      !registeredDynamicSelectors.has(props.dynamicSelector)
    ) {
      liquidGL.registerDynamic(props.dynamicSelector);
      registeredDynamicSelectors.add(props.dynamicSelector);
    }
  } catch {
    webglInitialized = false;
    webglReady.value = false;
  } finally {
    initializationPending = false;
  }
}

function scheduleInitialization() {
  if (webglInitialized || webglReady.value || unmounted || !props.webglEnabled) return;
  if (initializationTimer !== null) window.clearTimeout(initializationTimer);
  initializationTimer = window.setTimeout(() => void initializeWebGL(), 80);
}

onMounted(() => {
  scheduleInitialization();

  if (typeof ResizeObserver !== "undefined" && root.value) {
    resizeObserver = new ResizeObserver(() => scheduleInitialization());
    resizeObserver.observe(root.value);
  }
});

onUnmounted(() => {
  unmounted = true;
  if (initializationTimer !== null) window.clearTimeout(initializationTimer);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="root"
    class="webgl-liquid-glass"
    :class="`webgl-liquid-glass--${props.variant}`"
    data-glass-preset="webgl-liquid-gl"
    :data-glass-variant="props.variant"
    :data-liquid-gl-state="props.webglEnabled && webglReady ? 'ready' : 'fallback'"
    :style="rootStyle"
  >
    <div
      :id="targetId"
      aria-hidden="true"
      class="webgl-liquid-glass__lens"
      data-liquid-gl-target
    ></div>
    <div class="webgl-liquid-glass__content" data-liquid-ignore>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.webgl-liquid-glass {
  --glass-border: rgba(232, 240, 255, 0.5);
  --glass-ready-tint: rgba(255, 255, 255, 0.075);
  --glass-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
  --glass-tint: rgba(255, 255, 255, 0.1);
  position: relative;
  display: block;
  min-height: 14.75rem;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  background: var(--glass-tint);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    var(--glass-shadow);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
}

:root[data-theme="day"] .webgl-liquid-glass {
  --glass-border: rgba(17, 24, 39, 0.2);
  --glass-ready-tint: rgba(255, 255, 255, 0.18);
  --glass-shadow: 0 12px 30px rgba(35, 43, 58, 0.16);
  --glass-tint: rgba(255, 255, 255, 0.3);
}

.webgl-liquid-glass[data-liquid-gl-state="ready"] {
  background: var(--glass-ready-tint);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.webgl-liquid-glass--case {
  --glass-border: rgba(248, 250, 255, 0.14);
  --glass-ready-tint: rgba(255, 255, 255, 0.048);
  --glass-shadow: none;
  --glass-tint: rgba(255, 255, 255, 0.075);
}

:root[data-theme="day"] .webgl-liquid-glass--case {
  --glass-border: rgba(17, 24, 39, 0.12);
  --glass-ready-tint: rgba(255, 255, 255, 0.1);
  --glass-shadow: none;
  --glass-tint: rgba(255, 255, 255, 0.18);
}

.webgl-liquid-glass__lens {
  position: absolute;
  z-index: 2;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.webgl-liquid-glass__content {
  position: relative;
  z-index: 3;
  min-height: inherit;
  box-sizing: border-box;
  padding: var(--glass-padding);
}

.webgl-liquid-glass--action {
  display: inline-flex;
  min-height: 0;
  flex: 0 0 auto;
  vertical-align: middle;
}

.webgl-liquid-glass--action .webgl-liquid-glass__content {
  display: flex;
  min-height: 0;
  width: 100%;
  align-items: stretch;
}

@media (prefers-reduced-motion: reduce) {
  .webgl-liquid-glass,
  .webgl-liquid-glass__lens {
    transition: none !important;
  }
}
</style>

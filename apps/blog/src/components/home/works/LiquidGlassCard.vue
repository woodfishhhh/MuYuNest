<script setup lang="ts">
/*
 * Vue port of the Card Example from rdev/liquid-glass-react.
 * Copyright 2025 Max Rovensky
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Source: https://github.com/rdev/liquid-glass-react
 */
import type { CSSProperties } from "vue";
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  useId,
  useTemplateRef,
  watch,
} from "vue";

import { LIQUID_GLASS_DISPLACEMENT_MAP } from "./liquid-glass-displacement";

const props = withDefaults(
  defineProps<{
    aberrationIntensity?: number;
    blurAmount?: number;
    cornerRadius?: number;
    displacementScale?: number;
    elasticity?: number;
    mouseContainer?: HTMLElement | null;
    overLight?: boolean;
    padding?: string;
    saturation?: number;
  }>(),
  {
    aberrationIntensity: 2,
    blurAmount: 0.5,
    cornerRadius: 32,
    displacementScale: 100,
    elasticity: 0,
    mouseContainer: null,
    overLight: false,
    padding: "24px 32px",
    saturation: 140,
  },
);

const glassElement = useTemplateRef<HTMLDivElement>("glass");
const filterId = `liquid-glass-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
const glassSize = reactive({ height: 69, width: 270 });
const globalMousePosition = reactive({ x: 0, y: 0 });
const mouseOffset = reactive({ x: 0, y: 0 });
const isFirefox = import.meta.client && navigator.userAgent.toLowerCase().includes("firefox");

let resizeObserver: ResizeObserver | null = null;

function updateGlassSize() {
  const rect = glassElement.value?.getBoundingClientRect();
  if (!rect) return;
  glassSize.width = rect.width;
  glassSize.height = rect.height;
}

function handleMouseMove(event: MouseEvent) {
  const container = props.mouseContainer ?? glassElement.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  mouseOffset.x = ((event.clientX - centerX) / rect.width) * 100;
  mouseOffset.y = ((event.clientY - centerY) / rect.height) * 100;
  globalMousePosition.x = event.clientX;
  globalMousePosition.y = event.clientY;
}

function calculateFadeInFactor() {
  const element = glassElement.value;
  if (!globalMousePosition.x || !globalMousePosition.y || !element) return 0;

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const edgeDistanceX = Math.max(
    0,
    Math.abs(globalMousePosition.x - centerX) - glassSize.width / 2,
  );
  const edgeDistanceY = Math.max(
    0,
    Math.abs(globalMousePosition.y - centerY) - glassSize.height / 2,
  );
  const edgeDistance = Math.hypot(edgeDistanceX, edgeDistanceY);
  const activationZone = 200;

  return edgeDistance > activationZone ? 0 : 1 - edgeDistance / activationZone;
}

const transformStyle = computed(() => {
  const element = glassElement.value;
  if (
    !globalMousePosition.x ||
    !globalMousePosition.y ||
    !element ||
    props.elasticity === 0
  ) {
    return "translate(0px, 0px) scale(1)";
  }

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = globalMousePosition.x - centerX;
  const deltaY = globalMousePosition.y - centerY;
  const edgeDistanceX = Math.max(0, Math.abs(deltaX) - glassSize.width / 2);
  const edgeDistanceY = Math.max(0, Math.abs(deltaY) - glassSize.height / 2);
  const edgeDistance = Math.hypot(edgeDistanceX, edgeDistanceY);
  const fadeInFactor = calculateFadeInFactor();

  if (edgeDistance > 200) return "translate(0px, 0px) scale(1)";

  const centerDistance = Math.hypot(deltaX, deltaY);
  if (centerDistance === 0) return "translate(0px, 0px) scale(1)";

  const normalizedX = deltaX / centerDistance;
  const normalizedY = deltaY / centerDistance;
  const stretchIntensity =
    Math.min(centerDistance / 300, 1) * props.elasticity * fadeInFactor;
  const scaleX =
    1 +
    Math.abs(normalizedX) * stretchIntensity * 0.3 -
    Math.abs(normalizedY) * stretchIntensity * 0.15;
  const scaleY =
    1 +
    Math.abs(normalizedY) * stretchIntensity * 0.3 -
    Math.abs(normalizedX) * stretchIntensity * 0.15;
  const translateX = deltaX * props.elasticity * 0.1 * fadeInFactor;
  const translateY = deltaY * props.elasticity * 0.1 * fadeInFactor;

  return `translate(${translateX}px, ${translateY}px) scaleX(${Math.max(0.8, scaleX)}) scaleY(${Math.max(0.8, scaleY)})`;
});

const rootStyle = computed<CSSProperties>(() => ({
  transform: transformStyle.value,
  transition: "all ease-out 0.2s",
}));

const glassStyle = computed<CSSProperties>(() => ({
  borderRadius: `${props.cornerRadius}px`,
  boxShadow: props.overLight
    ? "0px 16px 70px rgba(0, 0, 0, 0.75)"
    : "0px 12px 40px rgba(0, 0, 0, 0.25)",
  padding: props.padding,
}));

const backdropStyle = computed<CSSProperties>(() => {
  const blur = (props.overLight ? 12 : 4) + props.blurAmount * 32;
  const backdropFilter = `blur(${blur}px) saturate(${props.saturation}%)`;

  return {
    WebkitBackdropFilter: backdropFilter,
    backdropFilter,
    filter: isFirefox ? undefined : `url(#${filterId})`,
  };
});

const edgeMaskTableValues = computed(() => `0 ${props.aberrationIntensity * 0.05} 1`);
const redScale = computed(() => -props.displacementScale);
const greenScale = computed(
  () => props.displacementScale * (-1 - props.aberrationIntensity * 0.05),
);
const blueScale = computed(
  () => props.displacementScale * (-1 - props.aberrationIntensity * 0.1),
);
const aberrationBlur = computed(() => Math.max(0.1, 0.5 - props.aberrationIntensity * 0.1));

function createRimStyle(firstAlpha: number, secondAlpha: number): CSSProperties {
  const absoluteX = Math.abs(mouseOffset.x);
  const angle = 135 + mouseOffset.x * 1.2;
  const firstStop = Math.max(10, 33 + mouseOffset.y * 0.3);
  const secondStop = Math.min(90, 66 + mouseOffset.y * 0.4);

  return {
    background: `linear-gradient(
      ${angle}deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, ${firstAlpha + absoluteX * 0.008}) ${firstStop}%,
      rgba(255, 255, 255, ${secondAlpha + absoluteX * 0.012}) ${secondStop}%,
      rgba(255, 255, 255, 0) 100%
    )`,
    borderRadius: `${props.cornerRadius}px`,
  };
}

const screenRimStyle = computed<CSSProperties>(() => createRimStyle(0.12, 0.4));
const overlayRimStyle = computed<CSSProperties>(() => createRimStyle(0.32, 0.6));

watch(
  () => props.mouseContainer ?? glassElement.value,
  (container, _previous, onCleanup) => {
    if (!import.meta.client || !container) return;
    container.addEventListener("mousemove", handleMouseMove);
    onCleanup(() => container.removeEventListener("mousemove", handleMouseMove));
  },
  { flush: "post", immediate: true },
);

onMounted(() => {
  updateGlassSize();
  window.addEventListener("resize", updateGlassSize);

  if (typeof ResizeObserver !== "undefined" && glassElement.value) {
    resizeObserver = new ResizeObserver(updateGlassSize);
    resizeObserver.observe(glassElement.value);
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", updateGlassSize);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    class="liquid-glass"
    data-glass-preset="card-example"
    :style="rootStyle"
  >
    <svg
      aria-hidden="true"
      class="liquid-glass__filter"
      focusable="false"
      :height="glassSize.height"
      :width="glassSize.width"
    >
      <defs>
        <filter
          :id="filterId"
          color-interpolation-filters="sRGB"
          height="170%"
          width="170%"
          x="-35%"
          y="-35%"
        >
          <feImage
            id="feimage"
            :href="LIQUID_GLASS_DISPLACEMENT_MAP"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            result="DISPLACEMENT_MAP"
            width="100%"
            x="0"
            y="0"
          />
          <feColorMatrix
            in="DISPLACEMENT_MAP"
            result="EDGE_INTENSITY"
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0 0 0 1 0"
          />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" :tableValues="edgeMaskTableValues" />
          </feComponentTransfer>
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            result="RED_DISPLACED"
            :scale="redScale"
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            result="RED_CHANNEL"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            result="GREEN_DISPLACED"
            :scale="greenScale"
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            result="GREEN_CHANNEL"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            result="BLUE_DISPLACED"
            :scale="blueScale"
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            result="BLUE_CHANNEL"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
          />
          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
          <feGaussianBlur
            in="RGB_COMBINED"
            result="ABERRATED_BLURRED"
            :stdDeviation="aberrationBlur"
          />
          <feComposite
            in="ABERRATED_BLURRED"
            in2="EDGE_MASK"
            operator="in"
            result="EDGE_ABERRATION"
          />
          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite
            in="CENTER_ORIGINAL"
            in2="INVERTED_MASK"
            operator="in"
            result="CENTER_CLEAN"
          />
          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
        </filter>
      </defs>
    </svg>

    <span
      aria-hidden="true"
      class="liquid-glass__over-light liquid-glass__over-light--shade"
      :class="{ 'liquid-glass__over-light--visible': overLight }"
      :style="{ borderRadius: `${cornerRadius}px` }"
    ></span>
    <span
      aria-hidden="true"
      class="liquid-glass__over-light liquid-glass__over-light--overlay"
      :class="{ 'liquid-glass__over-light--visible': overLight }"
      :style="{ borderRadius: `${cornerRadius}px` }"
    ></span>

    <div ref="glass" class="liquid-glass__glass" :style="glassStyle">
      <span aria-hidden="true" class="liquid-glass__warp" :style="backdropStyle"></span>
      <div class="liquid-glass__content" :class="{ 'liquid-glass__content--over-light': overLight }">
        <slot />
      </div>
    </div>

    <span
      aria-hidden="true"
      class="liquid-glass__rim liquid-glass__rim--screen"
      data-blend="screen"
      :style="screenRimStyle"
    ></span>
    <span
      aria-hidden="true"
      class="liquid-glass__rim liquid-glass__rim--overlay"
      data-blend="overlay"
      :style="overlayRimStyle"
    ></span>
  </div>
</template>

<style scoped>
.liquid-glass {
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}

.liquid-glass__filter {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.liquid-glass__glass {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 100%;
  align-items: center;
  gap: 24px;
  overflow: hidden;
  box-sizing: border-box;
  background: transparent;
  transition: all 0.2s ease-in-out;
}

.liquid-glass__warp {
  position: absolute;
  inset: 0;
  background: transparent;
}

.liquid-glass__content {
  position: relative;
  z-index: 1;
  width: 100%;
  color: white;
  font: 500 20px/1 system-ui;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  transition: all 150ms ease-in-out;
}

.liquid-glass__content--over-light {
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0);
}

.liquid-glass__over-light,
.liquid-glass__rim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.liquid-glass__over-light {
  z-index: 0;
  background: black;
  opacity: 0;
  transition: all 150ms ease-in-out;
}

.liquid-glass__over-light--shade.liquid-glass__over-light--visible {
  opacity: 0.2;
}

.liquid-glass__over-light--overlay {
  mix-blend-mode: overlay;
}

.liquid-glass__over-light--overlay.liquid-glass__over-light--visible {
  opacity: 1;
}

.liquid-glass__rim {
  z-index: 2;
  padding: 1.5px;
  box-sizing: border-box;
  box-shadow:
    0 0 0 0.5px rgba(255, 255, 255, 0.5) inset,
    0 1px 3px rgba(255, 255, 255, 0.25) inset,
    0 1px 4px rgba(0, 0, 0, 0.35);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.liquid-glass__rim--screen {
  opacity: 0.2;
  mix-blend-mode: screen;
}

.liquid-glass__rim--overlay {
  mix-blend-mode: overlay;
}
</style>

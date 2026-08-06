<script setup lang="ts">
import { computed, shallowRef } from "vue";

import type { FriendLinkData } from "@/types/content";

const props = withDefaults(
  defineProps<{
    link: FriendLinkData;
    focusable?: boolean;
    rotateDeg?: number;
  }>(),
  {
    focusable: true,
    rotateDeg: 0,
  },
);

const avatarBroken = shallowRef(false);
const tilt = shallowRef(createTiltState());

const domain = computed(() => {
  try {
    return new URL(props.link.link).hostname.replace(/^www\./, "");
  } catch {
    return props.link.link.replace(/^https?:\/\//, "").split(/[/?#]/)[0] || props.link.link;
  }
});

const cardStyle = computed<Record<string, string>>(() => ({
  "--card-rotate": `${props.rotateDeg}deg`,
  "--tilt-rotate-x": tilt.value.rotateX,
  "--tilt-rotate-y": tilt.value.rotateY,
  "--tilt-glare-x": tilt.value.glareX,
  "--tilt-glare-y": tilt.value.glareY,
  "--tilt-glare-opacity": tilt.value.glareOpacity,
  "--card-lift": tilt.value.lift,
  "--card-shadow-y": tilt.value.shadowY,
  "--card-shadow-blur": tilt.value.shadowBlur,
}));

function createTiltState() {
  return {
    rotateX: "0deg",
    rotateY: "0deg",
    glareX: "50%",
    glareY: "50%",
    glareOpacity: "0",
    lift: "0px",
    shadowY: "24px",
    shadowBlur: "52px",
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType !== "mouse" || prefersReducedMotion()) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  const maxTilt = 13;

  tilt.value = {
    rotateX: `${(-y * maxTilt).toFixed(2)}deg`,
    rotateY: `${(x * maxTilt).toFixed(2)}deg`,
    glareX: `${((x + 0.5) * 100).toFixed(1)}%`,
    glareY: `${((y + 0.5) * 100).toFixed(1)}%`,
    glareOpacity: "0.34",
    lift: "-7px",
    shadowY: "34px",
    shadowBlur: "72px",
  };
}

function handleFocus() {
  if (prefersReducedMotion()) {
    return;
  }

  tilt.value = {
    ...createTiltState(),
    glareOpacity: "0.22",
    lift: "-4px",
    shadowY: "30px",
    shadowBlur: "64px",
  };
}

function resetTilt() {
  tilt.value = createTiltState();
}
</script>

<template>
  <a
    data-testid="friend-link-card"
    data-analytics-event="friend-outbound"
    :data-analytics-event-site="domain"
    :href="props.link.link"
    :style="cardStyle"
    :tabindex="props.focusable ? undefined : -1"
    class="friend-link-card group"
    rel="noreferrer noopener"
    target="_blank"
    @blur="resetTilt"
    @focus="handleFocus"
    @pointerleave="resetTilt"
    @pointermove="handlePointerMove"
  >
    <div class="friend-link-card__pin" aria-hidden="true" />
    <div class="friend-link-card__inner">
      <div class="flex items-start gap-4">
        <img
          v-if="props.link.avatar && !avatarBroken"
          :alt="props.link.name"
          :src="props.link.avatar"
          class="friend-link-card__avatar h-16 w-16 shrink-0 rounded-[8px] border border-[var(--border-subtle)] object-cover shadow-[0_10px_28px_rgba(34,24,12,0.2)]"
          loading="lazy"
          @error="avatarBroken = true"
        />
        <div
          v-else
          class="friend-link-card__avatar h-16 w-16 shrink-0 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-soft)]"
        />

        <div class="min-w-0 flex-1">
          <h3 class="friend-link-card__title text-xl font-semibold text-[var(--stage-fg)]">
            {{ props.link.name }}
          </h3>
          <p class="friend-link-card__domain mt-2 text-[12px] text-[var(--stage-hint-strong)]">
            {{ domain }}
          </p>
        </div>
      </div>

      <p class="friend-link-card__description mt-6 text-[15px] leading-7 text-[var(--stage-hint)]">
        {{ props.link.descr || "新的博客坐标，等待下一次相遇。" }}
      </p>
    </div>
  </a>
</template>

<style scoped>
.friend-link-card {
  position: relative;
  display: block;
  overflow: hidden;
  border: 1px solid rgba(76, 61, 43, 0.16);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 253, 246, 0.85), rgba(250, 245, 232, 0.72)),
    var(--surface-soft);
  color: var(--stage-fg);
  --card-shadow-color: rgba(37, 28, 16, 0.16);
  box-shadow: 0 var(--card-shadow-y) var(--card-shadow-blur) var(--card-shadow-color);
  transform: perspective(920px) translateY(var(--card-lift)) rotateX(var(--tilt-rotate-x))
    rotateY(var(--tilt-rotate-y)) rotateZ(var(--card-rotate));
  transform-style: preserve-3d;
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 220ms ease;
  contain: layout style;
  will-change: transform;
}

.friend-link-card::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background:
    radial-gradient(
      circle at var(--tilt-glare-x) var(--tilt-glare-y),
      rgba(255, 255, 255, 0.58),
      rgba(255, 255, 255, 0.16) 28%,
      transparent 58%
    );
  content: "";
  opacity: var(--tilt-glare-opacity);
  pointer-events: none;
  transition: opacity 180ms ease;
}

.friend-link-card::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), transparent 38%);
  content: "";
  pointer-events: none;
  transform: translateZ(1px);
}

.friend-link-card:hover {
  border-color: rgba(53, 88, 204, 0.28);
  --card-shadow-color: rgba(37, 28, 16, 0.22);
}

.friend-link-card:focus-visible {
  border-color: rgba(53, 88, 204, 0.38);
  outline: 2px solid rgba(53, 88, 204, 0.28);
  outline-offset: 3px;
}

.friend-link-card__inner {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  transform: translateZ(24px);
}

.friend-link-card__avatar {
  transform: translateZ(18px);
}

.friend-link-card__description,
.friend-link-card__title,
.friend-link-card__domain {
  overflow-wrap: anywhere;
}

.friend-link-card__title {
  line-height: 1.2;
}

.friend-link-card__pin {
  position: absolute;
  top: 0.7rem;
  left: 50%;
  z-index: 4;
  height: 0.6rem;
  width: 0.6rem;
  border-radius: 999px;
  background: rgba(155, 101, 24, 0.42);
  box-shadow: 0 2px 8px rgba(37, 28, 16, 0.24);
  transform: translateX(-50%);
}

:root[data-theme="night"] .friend-link-card {
  border-color: var(--border-subtle);
  --card-shadow-color: rgba(0, 0, 0, 0.28);
  background:
    linear-gradient(135deg, rgba(22, 28, 48, 0.72), rgba(12, 16, 32, 0.58)), var(--surface-soft);
}

:root[data-theme="night"] .friend-link-card:hover {
  border-color: rgba(138, 178, 255, 0.3);
  --card-shadow-color: rgba(0, 0, 0, 0.34);
}

:root[data-theme="night"] .friend-link-card::before {
  background:
    radial-gradient(
      circle at var(--tilt-glare-x) var(--tilt-glare-y),
      rgba(138, 178, 255, 0.34),
      rgba(255, 255, 255, 0.1) 30%,
      transparent 60%
    );
}

:root[data-theme="night"] .friend-link-card__pin {
  background: rgba(138, 178, 255, 0.44);
}

@media (pointer: coarse), (prefers-reduced-motion: reduce) {
  .friend-link-card,
  .friend-link-card:hover {
    transform: none;
    will-change: auto;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .friend-link-card::before {
    opacity: 0;
  }

  .friend-link-card__inner,
  .friend-link-card__avatar,
  .friend-link-card::after {
    transform: none;
  }
}
</style>

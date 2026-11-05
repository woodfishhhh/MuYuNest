<script setup lang="ts">
import type { HomeExperience } from "@/stores/site";

const props = defineProps<{ modelValue: HomeExperience }>();
const emit = defineEmits<{ "update:modelValue": [value: HomeExperience] }>();
</script>

<template>
  <button
    class="home-mode-toggle"
    type="button"
    role="switch"
    aria-label="拾光模式"
    aria-description="关闭时进入漫游模式"
    :aria-checked="props.modelValue === 'collect'"
    :data-home-experience-toggle="props.modelValue"
    @click="emit('update:modelValue', props.modelValue === 'collect' ? 'roam' : 'collect')"
  >
    <span class="home-mode-toggle__thumb" aria-hidden="true" />
    <span :class="{ 'is-active': props.modelValue === 'roam' }">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><ellipse cx="10" cy="10" rx="2.7" ry="6.5"/><path d="M3.5 10h13"/></svg>
      漫游
    </span>
    <span :class="{ 'is-active': props.modelValue === 'collect' }">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 1.8 5.6L18 10l-6.2 2.4L10 18l-1.8-5.6L2 10l6.2-2.4Z"/></svg>
      拾光
    </span>
  </button>
</template>

<style scoped>
.home-mode-toggle {
  position: fixed;
  right: max(24px, env(safe-area-inset-right));
  bottom: max(24px, calc(env(safe-area-inset-bottom) + 16px));
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  width: 172px;
  height: 48px;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: color-mix(in srgb, var(--stage-bg) 78%, transparent);
  backdrop-filter: blur(16px);
  color: var(--stage-hint);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 24px #0000000d;
}
.home-mode-toggle > span:not(.home-mode-toggle__thumb) {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 12px;
  letter-spacing: 0.06em;
  transition: color 180ms;
}
.home-mode-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.2; }
.home-mode-toggle .is-active { color: var(--stage-fg); }
.home-mode-toggle__thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  border-radius: inherit;
  background: color-mix(in srgb, var(--stage-fg) 10%, transparent);
  transition: transform 250ms cubic-bezier(.2,.8,.2,1);
}
.home-mode-toggle[aria-checked="true"] .home-mode-toggle__thumb { transform: translateX(100%); }
.home-mode-toggle:hover { border-color: var(--border-strong); }
.home-mode-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
@media (max-width: 767px) {
  .home-mode-toggle { right: max(16px, env(safe-area-inset-right)); width: 148px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .home-mode-toggle__thumb, .home-mode-toggle > span { transition: none; }
}
</style>

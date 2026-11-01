<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue";

import { FILM_CHAPTERS } from "@/components/home/film/film-script";

const props = defineProps<{
  activeIndex: number;
}>();

const emit = defineEmits<{ jump: [index: number] }>();

const labelRef = useTemplateRef<HTMLElement>("label");
const GLITCH_MS = 650;
let glitchTimer: number | null = null;

watch(
  () => props.activeIndex,
  async () => {
    await nextTick();
    const label = labelRef.value;
    if (!label) return;
    label.classList.remove("is-glitching");
    void label.offsetWidth;
    label.classList.add("is-glitching");
    if (glitchTimer !== null) window.clearTimeout(glitchTimer);
    glitchTimer = window.setTimeout(() => label.classList.remove("is-glitching"), GLITCH_MS);
  },
);
</script>

<template>
  <div class="film-hud">
    <div class="film-hud__scene film-kicker">
      <span class="film-hud__index">{{ String(props.activeIndex + 1).padStart(2, "0") }} / {{ String(FILM_CHAPTERS.length).padStart(2, "0") }}</span>
      <span ref="label" class="film-glitch" :data-text="FILM_CHAPTERS[props.activeIndex]?.label">{{ FILM_CHAPTERS[props.activeIndex]?.label }}</span>
    </div>
    <nav class="film-hud__ticks" aria-label="首页章节">
      <button
        v-for="(chapter, index) in FILM_CHAPTERS"
        :key="chapter.id"
        type="button"
        :aria-label="chapter.label"
        :aria-current="index === props.activeIndex ? 'true' : undefined"
        :class="{ 'is-active': index === props.activeIndex }"
        @click="emit('jump', index)"
      />
    </nav>
    <span class="film-hud__progress" aria-hidden="true" />
  </div>
</template>

<style scoped>
.film-hud {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 0 var(--film-gutter) 1rem;
  pointer-events: none;
}

.film-hud__scene {
  display: flex;
  gap: 1rem;
}

.film-hud__index {
  color: var(--stage-fg);
  font-variant-numeric: tabular-nums;
}

.film-hud__ticks {
  display: flex;
  gap: 0.45rem;
  pointer-events: auto;
}

.film-hud__ticks button {
  width: 1.4rem;
  height: 1.1rem;
  padding: 0;
  border: 0;
  background: linear-gradient(var(--stage-hint), var(--stage-hint)) center / 100% 1px no-repeat;
  opacity: 0.5;
  cursor: pointer;
  transition: opacity 200ms ease, background-size 200ms ease;
}

.film-hud__ticks button.is-active,
.film-hud__ticks button:hover {
  background-image: linear-gradient(var(--accent), var(--accent));
  background-size: 100% 3px;
  opacity: 1;
}

/* The film's playhead, set by the page as --film-progress. */
.film-hud__progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--accent);
  transform: scaleX(var(--film-progress, 0));
  transform-origin: 0 50%;
}

@media (max-width: 767px) {
  .film-hud__ticks {
    display: none;
  }
}
</style>

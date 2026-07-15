<script setup lang="ts">
import { useTemplateRef } from "vue";

import AuthorAboutScreen from "@/components/home/author/AuthorAboutScreen.vue";
import AuthorCapsuleScreen from "@/components/home/author/AuthorCapsuleScreen.vue";
import AuthorHeroScreen from "@/components/home/author/AuthorHeroScreen.vue";
import AuthorPoemScreen from "@/components/home/author/AuthorPoemScreen.vue";
import { useAuthorSlider } from "@/composables/useAuthorSlider";
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  author: AuthorProfileData;
}>();

const viewportRef = useTemplateRef<HTMLElement>("viewport");
const trackRef = useTemplateRef<HTMLElement>("track");

const { activeIndex, goToSlide } = useAuthorSlider({
  viewportRef,
  trackRef,
});

const screens = [
  { id: "hero", label: "Hero" },
  { id: "about", label: "About" },
  { id: "capsules", label: "Stack" },
  { id: "poem", label: "Poem" },
];
</script>

<template>
  <div class="author-stage" data-testid="author-panel-root">
    <div ref="viewport" id="author-scroll-container" class="author-stage__wrapper">
      <div ref="track" class="author-stage__content">
        <AuthorHeroScreen :author="props.author" />
        <AuthorAboutScreen :author="props.author" />
        <AuthorCapsuleScreen :active="activeIndex === 2" :skills="props.author.skills" />
        <AuthorPoemScreen :poem="props.author.poem" />
      </div>
    </div>

    <nav class="author-stage__dots" aria-label="Author sections">
      <button
        v-for="(screen, index) in screens"
        :key="screen.id"
        :aria-current="activeIndex === index ? 'true' : undefined"
        :aria-label="screen.label"
        class="author-stage__dot"
        :class="{ 'is-active': activeIndex === index }"
        data-author-nav-dot
        type="button"
        @click="goToSlide(index)"
      ></button>
    </nav>
  </div>
</template>

<style scoped>
.author-stage {
  position: absolute;
  inset: 0;
}

.author-stage__wrapper,
.author-stage__content {
  height: 100%;
}

.author-stage__wrapper {
  overflow: hidden;
}

.author-stage__content {
  background: transparent;
  will-change: transform;
}

.author-stage__dots {
  position: fixed;
  top: 50%;
  right: clamp(1rem, 2vw, 2rem);
  z-index: 35;
  display: inline-flex;
  flex-direction: column;
  gap: 0.7rem;
  transform: translateY(-50%);
}

.author-stage__dot {
  width: 0.72rem;
  height: 0.72rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  transition:
    transform 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.author-stage__dot.is-active {
  transform: scale(1.35);
  background: linear-gradient(135deg, #87b7ff, #ffe796);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.36);
}

:deep(.author-screen) {
  height: 100dvh;
}

:deep(.author-screen__shell) {
  display: flex;
  height: 100%;
  box-sizing: border-box;
  justify-content: flex-end;
  padding: 0;
  background: var(--author-shell-bg);
}

:deep(.author-screen__panel) {
  position: relative;
  display: flex;
  width: 50vw;
  min-height: 100%;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  padding: clamp(2.5rem, 5vh, 4.5rem) clamp(2rem, 5vw, 4rem);
  background: var(--author-panel-surface);
  box-shadow: var(--author-panel-shadow);
}

:deep(.author-screen__panel--poster) {
  overflow: hidden;
  isolation: isolate;
}

/* Hero poster: no default padding — inner elements control their own spacing */
:deep(.author-screen__panel--hero) {
  padding: 0;
  justify-content: flex-start;
}

/* About panel: nav clearance — shell top padding removed, so panel carries the offset */
:deep(.author-screen__panel--about) {
  padding-top: clamp(5.5rem, 11vh, 8rem);
}

/* Fullbleed capsule screen: panel completely fills the half-screen boundary */
:deep(.author-screen--fullbleed .author-screen__shell) {
  padding: 0 !important;
}

:deep(.author-screen--fullbleed .author-screen__panel) {
  padding: 0 !important;
}

:deep(.author-section-kicker) {
  margin-bottom: 1.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--stage-hint);
}

:root[data-theme="day"] .author-stage__dot {
  background: rgba(21, 28, 40, 0.14);
  box-shadow: inset 0 0 0 1px rgba(21, 28, 40, 0.18);
}

@media (max-width: 767px) {
  .author-stage__dots {
    right: 0.9rem;
    gap: 0.6rem;
  }

  :deep(.author-screen__shell) {
    padding: 0;
    background: var(--author-shell-bg-mobile);
  }

  :deep(.author-screen__panel) {
    width: 100%;
    min-height: 100%;
    padding: clamp(1.2rem, 3vh, 2rem) 1.5rem 1.5rem;
    overflow-y: auto;
  }

  /* About panel on mobile: nav clearance */
  :deep(.author-screen__panel--about) {
    padding-top: clamp(4.5rem, 9vh, 6.5rem);
  }
}

@media (min-width: 768px) {
  :deep(.author-screen__panel--poster) {
    overflow: visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .author-stage__dot {
    transition: none;
  }
}
</style>

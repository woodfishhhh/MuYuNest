<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from "vue";

import WorksCaseView from "@/components/home/works/WorksCaseView.vue";
import WorksViewToggle from "@/components/home/works/WorksViewToggle.vue";
import { WORKS_ORBIT_MIN_WIDTH } from "@/components/scene/scene-interaction";
import { useSiteStore } from "@/stores/site";
import type { WorkProjectData } from "@/types/content";

defineProps<{
  works: WorkProjectData[];
}>();

const largeViewportQuery = `(min-width: ${WORKS_ORBIT_MIN_WIDTH}px)`;
const isLargeViewport = shallowRef(resolveIsLargeViewport());
const store = useSiteStore();

let mediaQueryList: MediaQueryList | null = null;

const isDesktopOrbit = computed(() => isLargeViewport.value && store.worksViewMode === "orbit");
const showCaseView = computed(() => !isLargeViewport.value || store.worksViewMode === "case");
const panelDescription = "作品卡片已进入WebGL轨道。按住卡片拖向中心,松手打开Live站点。";

function resolveIsLargeViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }

  return window.matchMedia(largeViewportQuery).matches;
}

function handleMediaChange(event: MediaQueryListEvent) {
  isLargeViewport.value = event.matches;
}

onMounted(() => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }

  mediaQueryList = window.matchMedia(largeViewportQuery);
  isLargeViewport.value = mediaQueryList.matches;

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleMediaChange);
    return;
  }

  mediaQueryList.addListener(handleMediaChange);
});

onUnmounted(() => {
  if (!mediaQueryList) {
    return;
  }

  if (typeof mediaQueryList.removeEventListener === "function") {
    mediaQueryList.removeEventListener("change", handleMediaChange);
    return;
  }

  mediaQueryList.removeListener(handleMediaChange);
});
</script>

<template>
  <div class="works-panel">
    <div class="works-panel__header px-4 sm:px-6 pt-20 sm:pt-24 lg:px-10 lg:pt-24 pb-0">
      <div class="works-panel__title">
        <p v-if="isDesktopOrbit">{{ panelDescription }}</p>
      </div>
      <WorksViewToggle
        v-if="isLargeViewport"
        :model-value="store.worksViewMode"
        class="works-panel__toggle"
        @update:model-value="store.setWorksViewMode"
      />
    </div>

    <ul v-if="isDesktopOrbit" class="works-panel__a11y-links" aria-label="作品链接">
      <li v-for="work in works" :key="work.slug">
        <a :href="work.liveUrl" rel="noreferrer noopener" target="_blank">
          {{ work.name }}
        </a>
        <a :href="work.githubUrl" rel="noreferrer noopener" target="_blank">
          {{ work.name }} GitHub
        </a>
      </li>
    </ul>

    <div v-if="showCaseView" class="works-panel__body">
      <WorksCaseView :works="works" />
    </div>
  </div>
</template>

<style scoped>
.works-panel {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  text-align: left;
  pointer-events: none;
}

.works-panel__header {
  display: flex;
  flex: none;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  pointer-events: none;
}

.works-panel__title {
  min-width: 0;
}

.works-panel__toggle {
  pointer-events: auto;
}

.works-panel__title p {
  max-width: 40rem;
  margin: 0;
  color: var(--stage-hint);
  font-size: 0.92rem;
  line-height: 1.8;
}

.works-panel__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  pointer-events: auto;
}

.works-panel__a11y-links {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.works-panel__a11y-links:focus-within {
  top: 6.6rem;
  left: clamp(1.5rem, 4vw, 4rem);
  z-index: 30;
  display: flex;
  width: min(calc(100% - 3rem), 54rem);
  height: auto;
  margin: 0;
  gap: 0.5rem;
  overflow-x: auto;
  clip: auto;
  clip-path: none;
  padding: 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--stage-bg) 86%, transparent);
  backdrop-filter: blur(14px);
  list-style: none;
  pointer-events: auto;
}

.works-panel__a11y-links:focus-within li {
  display: contents;
}

.works-panel__a11y-links:focus-within a {
  flex: none;
  padding: 0.6rem 0.75rem;
  color: var(--stage-fg);
  font-size: 0.76rem;
  text-decoration: none;
}

.works-panel__a11y-links:focus-within a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 1023px) {
  .works-panel {
    overflow-y: auto;
    pointer-events: auto;
  }

  .works-panel__header {
    display: block;
    pointer-events: auto;
    padding: 5rem 1.25rem 0;
  }

  .works-panel__title p {
    font-size: 0.88rem;
  }

  .works-panel__body {
    overflow-y: visible;
    padding: 1rem 1.25rem 4rem;
  }
}
</style>

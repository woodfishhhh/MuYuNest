<script setup lang="ts">
import { computed } from "vue";

import { useTheme } from "@/composables/useTheme";
import type { WorkProjectData } from "@/types/content";

import LiquidGlassCard from "./LiquidGlassCard.vue";
import WorkActionLinks from "./WorkActionLinks.vue";
import { createWorksCardPresentation } from "./works-card-preset";

const props = defineProps<{
  works: WorkProjectData[];
}>();

const { theme } = useTheme();

const caseItems = computed(() =>
  props.works.map((work, index) => createWorksCardPresentation(work, index)),
);
</script>

<template>
  <section
    class="works-case"
    :class="{ 'works-case--day': theme === 'day' }"
    data-testid="works-view-case"
  >
    <div class="works-case__list" data-layout="webgl-glass-grid">
      <LiquidGlassCard
        v-for="item in caseItems"
        :key="item.work.slug"
        class="works-case__glass"
        :corner-radius="8"
        data-glass="liquid"
        data-testid="works-item"
        padding="clamp(1.125rem, 5vw, 2rem)"
        variant="case"
      >
        <article class="works-case__card">
          <h3 class="works-case__title">{{ item.title }}</h3>

          <div class="works-case__identity">
            <span class="works-case__avatar">
              <img :src="item.avatarUrl" alt="" width="48" height="48" />
            </span>
            <div class="works-case__summary">
              <strong>{{ item.kind }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </div>

          <WorkActionLinks :work="item.work" />
        </article>
      </LiquidGlassCard>
    </div>
  </section>
</template>

<style scoped>
.works-case {
  --works-card-fg: white;
  --works-card-muted: rgba(255, 255, 255, 0.92);
  position: relative;
  display: grid;
  min-height: 100%;
  align-content: center;
  overflow: hidden;
  padding: clamp(1rem, 2.5vh, 2rem) clamp(1rem, 3vw, 3rem) 2rem;
}

.works-case__list {
  position: relative;
  z-index: 1;
  display: grid;
  width: min(100%, 45.5rem);
  margin-inline: auto;
  grid-template-columns: repeat(2, minmax(0, 22rem));
  justify-content: center;
  gap: 1.5rem;
}

.works-case__glass {
  width: min(22rem, 100%);
}

.works-case__card {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 11.75rem;
  flex-direction: column;
  color: var(--works-card-fg);
}

.works-case__title {
  margin: 0 0 1rem;
  color: var(--works-card-fg);
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.2;
}

.works-case__identity {
  display: flex;
  min-height: 3rem;
  align-items: center;
  gap: 0.75rem;
}

.works-case__avatar {
  display: inline-flex;
  width: 3rem;
  height: 3rem;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.625rem;
  background: rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.works-case__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.works-case__summary {
  min-width: 0;
}

.works-case__summary strong {
  display: block;
  color: var(--works-card-fg);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.1;
  text-transform: uppercase;
}

.works-case__summary p {
  margin: 0.18rem 0 0;
  color: var(--works-card-muted);
  font-size: 0.76rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.works-case--day {
  --works-card-fg: rgba(17, 24, 39, 0.94);
  --works-card-muted: rgba(17, 24, 39, 0.72);
}

.works-case--day .works-case__avatar {
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 1023px) {
  .works-case {
    align-content: start;
    overflow: visible;
    padding: 0.5rem 0 2rem;
  }

  .works-case__list {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: 1rem;
  }
}
</style>

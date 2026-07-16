<script setup lang="ts">
import { computed, useTemplateRef } from "vue";

import { useTheme } from "@/composables/useTheme";
import type { WorkProjectData } from "@/types/content";

import LiquidGlassCard from "./LiquidGlassCard.vue";
import WorkActionLinks from "./WorkActionLinks.vue";
import { createWorksCardPresentation, WORKS_CARD_PRESET } from "./works-card-preset";

const props = defineProps<{
  works: WorkProjectData[];
}>();

const { theme } = useTheme();
const caseSurface = useTemplateRef<HTMLElement>("caseSurface");

const caseItems = computed(() =>
  props.works.map((work, index) => createWorksCardPresentation(work, index)),
);
</script>

<template>
  <section
    ref="caseSurface"
    class="works-case"
    :class="{ 'works-case--day': theme === 'day' }"
    data-testid="works-view-case"
  >
    <div class="works-case__list" data-layout="card-example-grid">
      <LiquidGlassCard
        v-for="item in caseItems"
        :key="item.work.slug"
        :aberration-intensity="WORKS_CARD_PRESET.aberrationIntensity"
        :blur-amount="0.5"
        class="works-case__glass"
        :corner-radius="WORKS_CARD_PRESET.cornerRadius"
        data-glass="liquid"
        data-testid="works-item"
        :displacement-scale="WORKS_CARD_PRESET.displacementScale"
        :elasticity="0"
        :mouse-container="caseSurface"
        :padding="WORKS_CARD_PRESET.padding"
        :saturation="WORKS_CARD_PRESET.saturation * 100"
      >
        <article class="works-case__card">
          <h3 class="works-case__title">{{ item.title }}</h3>

          <div class="works-case__identity">
            <span class="works-case__avatar">{{ item.orderLabel }}</span>
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
  width: 18rem;
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
  line-height: 1;
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
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  color: var(--works-card-fg);
  font-size: 0.84rem;
  font-weight: 600;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
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
  display: -webkit-box;
  margin: 0.18rem 0 0;
  overflow: hidden;
  color: var(--works-card-muted);
  font-size: 0.76rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.works-case--day {
  --works-card-fg: rgba(17, 24, 39, 0.94);
  --works-card-muted: rgba(17, 24, 39, 0.72);
}

.works-case--day .works-case__avatar {
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: rgba(255, 255, 255, 0.3);
}

.works-case--day .works-case__glass::after {
  position: absolute;
  z-index: 1;
  inset: 0;
  border: 1px solid rgba(0, 0, 0, 0.62);
  border-radius: 32px;
  box-sizing: border-box;
  content: "";
  pointer-events: none;
}

@media (max-width: 1023px) {
  .works-case {
    align-content: start;
    overflow: visible;
    padding: 0.5rem 1rem 2rem;
  }

  .works-case__list {
    grid-template-columns: minmax(0, 22rem);
    gap: 1rem;
  }

  .works-case__card {
    width: min(18rem, calc(100vw - 6rem));
  }
}

@media (max-width: 359px) {
  .works-case {
    padding-inline: 0.75rem;
  }

  .works-case__card {
    width: calc(100vw - 5.5rem);
  }
}
</style>

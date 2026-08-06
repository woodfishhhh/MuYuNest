<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";

import FriendLinkCard from "@/components/home/friend/FriendLinkCard.vue";
import type { FriendLinkData } from "@/types/content";

const props = defineProps<{
  links: FriendLinkData[];
}>();

interface FriendCardLayout {
  id: string;
  link: FriendLinkData;
  rotateDeg: number;
  weight: number;
}

const layoutCards = shallowRef<FriendCardLayout[]>([]);

const waterfallColumns = computed(() => splitIntoColumns(layoutCards.value));

watch(
  () => props.links,
  () => {
    layoutCards.value = createCardLayout(props.links);
  },
  { immediate: true },
);

function createCardLayout(links: FriendLinkData[]) {
  return shuffleLinks(links).map((link, index) => {
    const descriptionLength = link.descr?.length ?? 0;
    const estimatedDescriptionLines = Math.max(1, Math.ceil(descriptionLength / 24));
    const estimatedHeight = 124 + estimatedDescriptionLines * 28;

    return {
      id: `${link.name}-${link.link}-${index}`,
      link,
      rotateDeg: Number(((Math.random() - 0.5) * 4.8).toFixed(2)),
      weight: estimatedHeight,
    };
  });
}

function shuffleLinks(links: FriendLinkData[]) {
  const shuffled = [...links];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function splitIntoColumns(cards: FriendCardLayout[]) {
  const columns: FriendCardLayout[][] = [[], []];
  const heights = [0, 0];

  cards.forEach((card) => {
    const targetColumn = heights[0] <= heights[1] ? 0 : 1;
    columns[targetColumn].push(card);
    heights[targetColumn] += card.weight;
  });

  return columns;
}
</script>

<template>
  <div data-testid="friend-waterfall-scroller" class="friend-waterfall-scroller">
    <div data-testid="friend-waterfall-grid" class="friend-waterfall-grid">
      <section
        v-for="(column, columnIndex) in waterfallColumns"
        :key="columnIndex"
        data-testid="friend-waterfall-column"
        class="friend-waterfall-column"
      >
        <TransitionGroup name="friend-card-list" tag="div" class="friend-waterfall-column__cards">
          <FriendLinkCard
            v-for="card in column"
            :key="card.id"
            :link="card.link"
            :rotate-deg="card.rotateDeg"
          />
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>

<style scoped>
.friend-waterfall-scroller {
  min-height: max-content;
  overflow: visible;
  padding: 0.35rem 0.65rem 1.8rem;
}

.friend-waterfall-grid {
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.05rem;
}

.friend-waterfall-column,
.friend-waterfall-column__cards {
  display: grid;
  align-content: start;
  gap: 1.05rem;
  min-width: 0;
}

.friend-waterfall-column {
  padding-block: 0.35rem;
}

.friend-card-list-enter-active,
.friend-card-list-leave-active,
.friend-card-list-move {
  transition:
    opacity 260ms ease,
    transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.friend-card-list-enter-from,
.friend-card-list-leave-to {
  opacity: 0;
  transform: translateY(18px);
}

@media (max-width: 639px) {
  .friend-waterfall-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .friend-waterfall-column,
  .friend-waterfall-column__cards {
    gap: 1rem;
  }
}

@media (min-width: 768px) {
  .friend-waterfall-scroller {
    padding: 0.5rem 0.9rem 2.2rem;
  }

  .friend-waterfall-grid,
  .friend-waterfall-column,
  .friend-waterfall-column__cards {
    gap: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .friend-card-list-enter-active,
  .friend-card-list-leave-active,
  .friend-card-list-move {
    transition: none;
  }
}
</style>

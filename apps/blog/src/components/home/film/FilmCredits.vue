<script setup lang="ts">
import { computed } from "vue";

import VisitorCountBadge from "@/components/home/VisitorCountBadge.vue";
import type { SitePanelMode } from "@/stores/site";
import type { AuthorProfileData, WorkProjectData } from "@/types/content";
import { getRouteLocationForSiteMode } from "@/utils/site-mode";

const props = defineProps<{
  author: AuthorProfileData;
  works: WorkProjectData[];
  visitorTotal: number | null;
  visitorLoading: boolean;
  visitorError: boolean;
}>();

const emit = defineEmits<{ rewind: [] }>();

interface CreditRow {
  id: Exclude<SitePanelMode, "home">;
  english: string;
  title: string;
  meta: string;
}

const year = new Date().getFullYear();
const rows = computed<CreditRow[]>(() => [
  { id: "works", english: "WORKS", title: "作品", meta: `${props.works.length} 个项目` },
  { id: "blog", english: "BLOG", title: "笔记", meta: `${props.author.postsCount} 篇` },
  { id: "friend", english: "FRIEND", title: "朋友", meta: "友链" },
]);
</script>

<template>
  <footer class="film-credits" aria-label="继续逛逛">
    <nav class="film-credits__rows" aria-label="站点入口">
      <RouterLink
        v-for="(row, index) in rows"
        :key="row.id"
        :to="getRouteLocationForSiteMode(row.id)"
        class="film-credits__row"
        :data-credit-entry="row.id"
      >
        <span class="film-credits__index film-display film-outline">0{{ index + 1 }}</span>
        <span class="film-credits__name">
          <span class="film-display">{{ row.english }}</span>
          <small>{{ row.title }}</small>
        </span>
        <span class="film-credits__meta">{{ row.meta }}</span>
        <span class="film-credits__arrow" aria-hidden="true">→</span>
      </RouterLink>
    </nav>

    <div class="film-credits__base">
      <span>© {{ year }} {{ props.author.name }} · WoodFishNest</span>
      <VisitorCountBadge :total="props.visitorTotal" :is-loading="props.visitorLoading" :has-error="props.visitorError" />
      <button type="button" class="film-credits__rewind" @click="emit('rewind')">回到片头 ↑</button>
    </div>
  </footer>
</template>

<style scoped>
.film-credits {
  position: relative;
  box-sizing: border-box;
  /* The bottom padding keeps the footer clear of the fixed chapter HUD. */
  padding: clamp(3rem, 10vh, 6rem) var(--film-gutter) 4.5rem;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--stage-bg) 88%, transparent) 18%);
  pointer-events: auto;
}

.film-credits__rows {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-strong);
}

.film-credits__row {
  display: grid;
  grid-template-columns: clamp(4rem, 9vw, 8rem) minmax(0, 1fr) auto auto;
  align-items: center;
  gap: clamp(0.8rem, 2vw, 2rem);
  padding: clamp(1.2rem, 3vh, 2rem) 0;
  border-bottom: 1px solid var(--border-strong);
  color: var(--stage-fg);
}

.film-credits__index {
  font-size: clamp(2.4rem, 5vw, 4.6rem);
  color: var(--stage-hint);
}

.film-credits__name {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.film-credits__name .film-display {
  font-size: clamp(2.6rem, 6.4vw, 6rem);
  transition: color 220ms ease;
}

.film-credits__name small {
  font-family: var(--film-heading-cn);
  font-size: clamp(1rem, 1.6vw, 1.4rem);
  font-weight: 700;
  color: var(--stage-hint-strong);
}

.film-credits__meta {
  font-size: 0.9rem;
  letter-spacing: 0.14em;
  color: var(--stage-hint);
}

.film-credits__arrow {
  font-size: clamp(1.6rem, 3vw, 2.6rem);
  transition: transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1);
}

.film-credits__row:hover .film-display,
.film-credits__row:focus-visible .film-display {
  color: var(--accent);
}

.film-credits__row:hover .film-credits__arrow,
.film-credits__row:focus-visible .film-credits__arrow {
  transform: translateX(0.4em);
}

.film-credits__base {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: clamp(3rem, 9vh, 5rem);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: var(--stage-hint);
}

.film-credits__rewind {
  border: 0;
  background: none;
  color: var(--stage-hint);
  letter-spacing: 0.2em;
  cursor: pointer;
}

.film-credits__rewind:hover {
  color: var(--stage-fg);
}

@media (max-width: 767px) {
  .film-credits__row {
    grid-template-columns: 3.2rem minmax(0, 1fr) auto;
  }

  .film-credits__meta {
    display: none;
  }
}
</style>

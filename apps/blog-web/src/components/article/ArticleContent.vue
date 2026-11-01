<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";

import { useArticleReading } from "@/composables/useArticleReading";
import type { PostArticle } from "@/types/content";
import ArticleHero from "./ArticleHero.vue";
import ArticleProse from "./ArticleProse.vue";
import ArticleToc from "./ArticleToc.vue";

const props = withDefaults(
  defineProps<{
    article: PostArticle;
    overlay?: boolean;
    scrollContainer?: HTMLElement | null;
  }>(),
  {
    overlay: false,
    scrollContainer: null,
  },
);

const contentRoot = useTemplateRef<HTMLElement>("contentRoot");
const fallbackScrollContainer = shallowRef<HTMLElement | null>(null);
const resolvedScrollContainer = computed(() => props.scrollContainer ?? fallbackScrollContainer.value);
const tocItems = computed(() => props.article.toc);
const { activeId, jumpToHeading, readProgress } = useArticleReading({
  contentRoot,
  scrollContainer: resolvedScrollContainer,
  tocItems,
});
const progressStyle = computed(() => ({
  transform: `scaleX(${Math.max(0, Math.min(100, readProgress.value)) / 100})`,
}));

watch(
  contentRoot,
  (element) => {
    fallbackScrollContainer.value = element?.closest<HTMLElement>(".article-page") ?? null;
  },
  { flush: "post", immediate: true },
);
</script>

<template>
  <div class="article-progress" :class="{ 'article-progress--overlay': props.overlay }">
    <div class="article-progress__bar" data-testid="article-progress-bar" :style="progressStyle" />
  </div>

  <section class="article-shell">
    <div v-if="tocItems.length > 0" class="article-shell__rail" data-testid="article-toc-rail">
      <ArticleToc :items="tocItems" :active-id="activeId" variant="desktop" @jump="jumpToHeading" />
    </div>

    <article
      :aria-labelledby="`article-title-${props.article.canonicalSlug}`"
      :class="['article-view', { 'article-view--overlay': props.overlay }]"
    >
      <div class="article-view__column">
        <ArticleHero :article="props.article" :overlay="props.overlay" />

        <div v-if="tocItems.length > 0" class="article-view__mobile-toc" data-testid="article-toc-mobile">
          <ArticleToc :items="tocItems" :active-id="activeId" variant="mobile" @jump="jumpToHeading" />
        </div>

        <div ref="contentRoot" class="article-view__content">
          <ArticleProse :article="props.article" />
        </div>
      </div>
    </article>
  </section>
</template>

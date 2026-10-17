<script setup lang="ts">
import { computed } from "vue";

import type { PostArticle } from "@/types/content";

const props = withDefaults(
  defineProps<{
    article: PostArticle;
    overlay?: boolean;
  }>(),
  {
    overlay: false,
  },
);

const eyebrowLabel = computed(() => (props.overlay ? "Immersive Reading" : "Field Notes"));
const metadataItems = computed(() => [
  { label: "发布于", value: props.article.publishedAt.slice(0, 10) },
  { label: "阅读约", value: `${props.article.readingMinutes} 分钟` },
  { label: "Category", value: props.article.categories[0] ?? "Notebook" },
  {
    label: "Tags",
    value: props.article.tags.slice(0, 3).join(" / ") || "Curated archive",
  },
]);
</script>

<template>
  <section class="article-hero" data-testid="article-hero">
    <div class="article-hero__signal">
      <p class="article-hero__eyebrow">{{ eyebrowLabel }}</p>
      <span class="article-hero__read-time">{{ props.article.readingMinutes }} min read</span>
    </div>

    <div class="article-hero__grid" :class="{ 'article-hero__grid--with-cover': !!props.article.coverImage }">
      <div class="article-hero__body">
        <h1 :id="`article-title-${props.article.canonicalSlug}`" class="article-hero__title">
          {{ props.article.title }}
        </h1>
        <p class="article-hero__excerpt">{{ props.article.excerpt }}</p>

        <div aria-label="Article metadata" class="article-hero__metadata">
          <div v-for="item in metadataItems" :key="item.label" class="article-hero__meta-chip">
            <span class="article-hero__meta-label">{{ item.label }}</span>
            <span class="article-hero__meta-value">{{ item.value }}</span>
          </div>
        </div>
      </div>

      <figure v-if="props.article.coverImage" class="article-hero__cover">
        <img
          :alt="`${props.article.title} cover`"
          :src="props.article.coverImage"
          class="article-hero__cover-image"
          data-testid="article-cover"
          decoding="async"
          loading="eager"
        />
      </figure>
    </div>
  </section>
</template>

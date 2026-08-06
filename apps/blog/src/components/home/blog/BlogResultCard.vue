<script setup lang="ts">
import type { LocationQueryRaw } from "vue-router";

import { loadPostArticle } from "@/content/posts";
import type { PostSummary } from "@/types/content";

const props = defineProps<{
  post: PostSummary;
  index: number;
  blogQuery: LocationQueryRaw;
}>();

// ─────────────────────────────────────────────────────────────────────────────
// 文章 Prefetch（鼠标悬停预加载）
//
// 原理：当鼠标悬停在文章卡片上时，悄悄下载这篇文章的完整 JSON。
// 等用户点击时，内容已经在浏览器缓存里了，实现"瞬时打开"效果。
// 这是 Google Chrome 推荐的性能优化模式，叫 "Signed Exchange" 或简单版 Prefetch。
// ─────────────────────────────────────────────────────────────────────────────
function prefetchArticle() {
  void loadPostArticle(props.post.canonicalSlug);
}
</script>

<template>
  <RouterLink
    data-magnetic-pointer="blog-card"
    data-testid="blog-result-card"
    :to="{ name: 'post', params: { slug: props.post.canonicalSlug }, query: props.blogQuery }"
    class="blog-result-row group relative grid gap-3 border-b border-[var(--border-subtle)] py-5 transition-colors last:border-b-0 hover:bg-[var(--surface-soft)] md:grid-cols-[8.5rem_minmax(0,1fr)] md:gap-6 md:px-3"
    :class="{ 'blog-result-row--enter': props.index < 10 }"
    :style="props.index < 10 ? { animationDelay: `${props.index * 28}ms` } : undefined"
    @mouseenter="prefetchArticle"
  >
    <span
      class="absolute left-0 top-5 hidden h-[calc(100%-2.5rem)] w-px bg-cyan-300/70 opacity-0 transition-opacity group-hover:opacity-100 md:block"
    />

    <div
      class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--stage-hint)] md:block md:space-y-2"
    >
      <time class="block text-[var(--stage-hint-strong)]" :datetime="props.post.publishedAt">{{
        props.post.publishedLabel
      }}</time>
      <span
        class="inline-block rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-1 text-cyan-100"
      >
        {{ props.post.type }}
      </span>
      <span class="block">{{ props.post.readingMinutes }} min read</span>
    </div>

    <div class="min-w-0">
      <h3
        class="text-xl font-semibold leading-snug text-[var(--stage-fg)] transition-colors group-hover:text-cyan-100 md:text-2xl"
      >
        {{ props.post.title }}
      </h3>

      <p class="blog-result-row__excerpt mt-2 text-sm leading-7 text-[var(--stage-hint)]">
        {{ props.post.excerpt }}
      </p>

      <div class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="category in props.post.categories"
          :key="category"
          class="rounded-full border border-blue-300/20 bg-blue-400/10 px-2.5 py-1 text-xs text-[var(--accent)]"
        >
          {{ category }}
        </span>
        <span
          v-for="tag in props.post.tags.slice(0, 3)"
          :key="tag"
          class="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2.5 py-1 text-xs text-[var(--stage-hint)]"
        >
          #{{ tag }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.blog-result-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 190px;
}

.blog-result-row--enter {
  animation: blog-row-enter 360ms cubic-bezier(0.33, 1, 0.68, 1) both;
}

.blog-result-row__excerpt {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@keyframes blog-row-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .blog-result-row--enter {
    animation: none;
    transition: none;
  }
}
</style>

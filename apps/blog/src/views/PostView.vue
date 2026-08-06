<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import { useRoute, type LocationQueryValue } from "vue-router";

import ArticleContent from "@/components/article/ArticleContent.vue";
import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { useTheme } from "@/composables/useTheme";
import { getPostSummaries, loadPostArticle, resolvePostSlug } from "@/content/posts";
import { sanitizeSlug } from "@/utils/input-validator";
import { trackAnalyticsEvent } from "@/utils/analytics";
import type { PostArticle, PostSummary } from "@/types/content";

const route = useRoute();
const pageRoot = useTemplateRef<HTMLElement>("pageRoot");
const article = shallowRef<PostArticle | null>(null);
const isLoading = shallowRef(true);
const resolvedSlug = shallowRef("");
const previousPost = shallowRef<PostSummary | null>(null);
const nextPost = shallowRef<PostSummary | null>(null);
const { theme, toggleThemeAt } = useTheme();
const blogReturnQuery = computed(() => {
  const nextQuery: Record<string, string> = {};

  for (const key of ["q", "type", "category", "tag", "sort"] as const) {
    const value = readQueryValue(route.query[key]);
    if (value) {
      nextQuery[key] = value;
    }
  }

  return nextQuery;
});
const hasBlogReturnContext = computed(() => Object.keys(blogReturnQuery.value).length > 0);
const backLinkTarget = computed(() =>
  hasBlogReturnContext.value ? { name: "blog", query: blogReturnQuery.value } : { name: "home" },
);
const backLinkLabel = computed(() => (hasBlogReturnContext.value ? "Back to Blog" : "Back Home"));

let requestToken = 0;
const trackedReadDepths = new Set<number>();

// slug 校验：先 sanitize 再用，防止超长或含控制字符的 slug 引发问题
const incomingSlug = computed(() => sanitizeSlug(String(route.params.slug ?? "")));

watch(
  incomingSlug,
  async (slug) => {
    const currentToken = ++requestToken;

    isLoading.value = true;
    article.value = null;
    resolvedSlug.value = "";
    previousPost.value = null;
    nextPost.value = null;
    trackedReadDepths.clear();

    const [canonicalSlug, nextArticle, postSummaries] = slug
      ? await Promise.all([resolvePostSlug(slug), loadPostArticle(slug), getPostSummaries()])
      : [null, null, []];
    if (currentToken !== requestToken) {
      return;
    }

    resolvedSlug.value = canonicalSlug ?? "";
    article.value = nextArticle;
    if (canonicalSlug) {
      const currentIndex = postSummaries.findIndex((post) => post.canonicalSlug === canonicalSlug);
      previousPost.value = currentIndex > 0 ? (postSummaries[currentIndex - 1] ?? null) : null;
      nextPost.value = currentIndex >= 0 ? (postSummaries[currentIndex + 1] ?? null) : null;
    }
    document.title = nextArticle
      ? `${nextArticle.title} | WOODFISH`
      : "Article not found | WOODFISH";

    if (pageRoot.value) {
      pageRoot.value.scrollTop = 0;
    }

    isLoading.value = false;
  },
  { immediate: true },
);

function readQueryValue(value: LocationQueryValue | LocationQueryValue[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function handleToggleTheme(payload: { x: number; y: number }) {
  trackAnalyticsEvent("theme-change", { theme: theme.value === "day" ? "night" : "day" });
  toggleThemeAt(payload.x, payload.y);
}

function handleReadingProgress() {
  const container = pageRoot.value;
  if (!container || !resolvedSlug.value) return;

  const scrollRange = container.scrollHeight - container.clientHeight;
  if (scrollRange <= 0) return;

  const progress = container.scrollTop / scrollRange;
  for (const depth of [50, 90]) {
    if (progress < depth / 100 || trackedReadDepths.has(depth)) continue;
    trackedReadDepths.add(depth);
    trackAnalyticsEvent("post-read-depth", { depth, post: resolvedSlug.value });
  }
}
</script>

<template>
  <main
    ref="pageRoot"
    data-post-page
    class="article-page stage-panel-gradient stage-panel-gradient--friend"
    @scroll.passive="handleReadingProgress"
  >
    <div class="article-page__ambient article-page__ambient--left" />
    <div class="article-page__ambient article-page__ambient--right" />

    <div class="article-page__nav-shell">
      <RouterLink
        class="article-page__nav-link"
        :aria-label="backLinkLabel"
        :title="backLinkLabel"
        :to="backLinkTarget"
        data-testid="post-view-back-link"
      >
        <svg class="article-page__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="m12 19-7-7 7-7"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
          />
          <path d="M19 12H5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
        </svg>
      </RouterLink>

      <div class="article-page__nav-actions">
        <span v-if="resolvedSlug" class="article-page__nav-meta">/ posts / {{ resolvedSlug }}</span>
        <ThemeToggle :theme="theme" @toggle-theme="handleToggleTheme" />
      </div>
    </div>

    <div data-post-surface>
      <div v-if="isLoading" class="article-page__status" data-testid="post-view-loading">
        <p class="article-page__status-label">Decoding article signal</p>
        <p class="article-page__status-text">
          Pulling the latest generated content and aligning the reading surface.
        </p>
      </div>

      <div
        v-else-if="!article"
        class="article-page__status article-page__status--empty"
        data-testid="post-view-not-found"
      >
        <p class="article-page__status-label">Article not found</p>
        <p class="article-page__status-text">
          The requested route does not map to an available post in this generated archive.
        </p>
      </div>

      <div
        v-else
        class="article-page__article w-full max-w-full"
        data-testid="post-view-article"
      >
        <ArticleContent :article="article" :scroll-container="pageRoot" />

        <nav
          v-if="previousPost || nextPost"
          class="article-page__adjacent-nav"
          aria-label="Adjacent posts"
        >
          <RouterLink
            v-if="previousPost"
            :to="{ path: `/posts/${previousPost.canonicalSlug}` }"
            class="article-page__adjacent-link article-page__adjacent-link--previous flex flex-col sm:flex-row gap-2 sm:gap-4"
            data-testid="post-view-previous-link"
          >
            <span class="article-page__adjacent-label">上一篇</span>
            <strong class="article-page__adjacent-title">{{ previousPost.title }}</strong>
            <span class="article-page__adjacent-meta">{{ previousPost.publishedLabel }}</span>
          </RouterLink>

          <RouterLink
            v-if="nextPost"
            :to="{ path: `/posts/${nextPost.canonicalSlug}` }"
            class="article-page__adjacent-link article-page__adjacent-link--next flex flex-col sm:flex-row gap-2 sm:gap-4"
            data-testid="post-view-next-link"
          >
            <span class="article-page__adjacent-label">下一篇</span>
            <strong class="article-page__adjacent-title">{{ nextPost.title }}</strong>
            <span class="article-page__adjacent-meta">{{ nextPost.publishedLabel }}</span>
          </RouterLink>
        </nav>
      </div>
    </div>
  </main>
</template>

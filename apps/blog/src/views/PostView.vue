<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DocsLayout from "@/components/docs/DocsLayout.vue";
import ArticleContent from "@/components/article/ArticleContent.vue";
import { buildDocsNavigation, findDocsPlacement, getDocsNeighbors } from "@/content/docs-navigation";
import { getPostSummaries, loadPostArticle, resolvePostSlug } from "@/content/posts";
import { normalizeDocsLinks } from "@/content/docs-links";
import { sanitizeSlug } from "@/utils/input-validator";
import { trackAnalyticsEvent } from "@/utils/analytics";
import type { PostArticle, PostSummary } from "@/types/content";

const route = useRoute();
const router = useRouter();
const article = ref<PostArticle | null>(null);
const posts = ref<PostSummary[]>([]);
const isLoading = ref(true);
const error = ref(false);
const resolvedSlug = ref("");
const navigation = computed(() => buildDocsNavigation(posts.value));
const placement = computed(() => findDocsPlacement(navigation.value, resolvedSlug.value));
const readingArticle = computed(() =>
  article.value
    ? { ...article.value, html: normalizeDocsLinks(article.value.html, resolvedSlug.value, navigation.value) }
    : null,
);
const neighbors = computed(() => getDocsNeighbors(placement.value));
const backQuery = computed(() => {
  const query: Record<string, string> = {};
  for (const key of ["q", "type", "category", "tag", "sort", "topic", "series"]) {
    const value = route.query[key];
    if (typeof value === "string" && value) query[key] = value;
  }
  return query;
});
let requestToken = 0;
onBeforeUnmount(() => {
  requestToken++;
});
const trackedDepths = new Set<number>();
async function load() {
  const token = ++requestToken;
  const slug = sanitizeSlug(String(route.params.slug ?? ""));
  isLoading.value = true;
  error.value = false;
  article.value = null;
  resolvedSlug.value = "";
  trackedDepths.clear();
  try {
    const [canonical, nextArticle, summaries] = await Promise.all([
      resolvePostSlug(slug),
      loadPostArticle(slug),
      getPostSummaries(),
    ]);
    if (token !== requestToken) return;
    posts.value = summaries;
    article.value = nextArticle;
    resolvedSlug.value = canonical ?? "";
    document.title = nextArticle ? `${nextArticle.title} | WOODFISH` : "文章不存在 | WOODFISH";
  } catch {
    if (token === requestToken) error.value = true;
  } finally {
    if (token === requestToken) isLoading.value = false;
  }
}
watch(
  () => route.params.slug,
  () => void load(),
  { immediate: true },
);
function handleArticleLink(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return;
  const link = (event.target as Element)?.closest<HTMLAnchorElement>("#article-container a[href]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/posts/")) return;
  event.preventDefault();
  if (url.pathname === location.pathname && url.hash) {
    window.location.hash = url.hash;
    return;
  }
  void router.push({
    path: url.pathname,
    query: { ...backQuery.value, ...Object.fromEntries(url.searchParams) },
    hash: url.hash,
  });
}
function trackReading(container: HTMLElement) {
  const range = container.scrollHeight - container.clientHeight;
  if (!resolvedSlug.value || range <= 0) return;
  for (const depth of [50, 90]) {
    if (container.scrollTop / range < depth / 100 || trackedDepths.has(depth)) continue;
    trackedDepths.add(depth);
    trackAnalyticsEvent("post-read-depth", { depth, post: resolvedSlug.value });
  }
}
</script>

<template>
  <DocsLayout
    :ready="!isLoading"
    :topics="navigation"
    :current-slug="resolvedSlug"
    v-slot="{ scrollContainer }"
    @scroll="trackReading"
  >
    <div data-post-page data-post-surface class="docs-post" @click="handleArticleLink">
      <nav class="docs-breadcrumb" aria-label="面包屑">
        <RouterLink :to="{ name: 'blog', query: backQuery }" data-testid="post-view-back-link">← 返回知识库</RouterLink>
        <template v-if="placement"
          ><span>/</span
          ><RouterLink :to="{ path: '/blog', query: { topic: placement.topic.id } }">{{
            placement.topic.title
          }}</RouterLink
          ><span>/</span
          ><RouterLink :to="{ path: '/blog', query: { topic: placement.topic.id, series: placement.group.id } }">{{
            placement.group.title
          }}</RouterLink></template
        >
      </nav>
      <div v-if="isLoading" class="docs-status" role="status" data-testid="post-view-loading">正在载入文章…</div>
      <div v-else-if="error" class="docs-status" role="alert">
        <h1>文章暂时无法加载</h1>
        <p>请检查网络后重试。</p>
        <button type="button" @click="load">重新加载</button>
      </div>
      <div v-else-if="!article" class="docs-status" data-testid="post-view-not-found">
        <h1>文章不存在</h1>
        <p>这篇文章可能已移动或移除，请从左侧目录重新选择。</p>
      </div>
      <div v-else data-testid="post-view-article">
        <ArticleContent :key="article.canonicalSlug" :article="readingArticle!" :scroll-container="scrollContainer" />
        <nav class="docs-adjacent" aria-label="同系列文章">
          <RouterLink
            v-if="neighbors.previous"
            :to="{ path: `/posts/${neighbors.previous.canonicalSlug}`, query: backQuery }"
            data-testid="post-view-previous-link"
            ><small>← 上一篇</small><strong>{{ neighbors.previous.title }}</strong></RouterLink
          >
          <RouterLink
            v-if="neighbors.next"
            :to="{ path: `/posts/${neighbors.next.canonicalSlug}`, query: backQuery }"
            data-testid="post-view-next-link"
            class="docs-adjacent__next"
            ><small>下一篇 →</small><strong>{{ neighbors.next.title }}</strong></RouterLink
          >
        </nav>
      </div>
    </div>
  </DocsLayout>
</template>

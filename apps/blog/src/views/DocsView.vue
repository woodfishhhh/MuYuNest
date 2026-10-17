<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import DocsLayout from "@/components/docs/DocsLayout.vue";
import { buildDocsNavigation, findDocsPlacement } from "@/content/docs-navigation";
import { getPostSummaries } from "@/content/posts";
import { buildBlogFacets, filterBlogPosts, sortBlogPosts } from "@/content/blog-hub";
import { useBlogQueryState } from "@/composables/useBlogQueryState";
import type { PostSummary } from "@/types/content";

const route = useRoute();
const posts = ref<PostSummary[]>([]);
const loading = ref(true);
const error = ref(false);
const navigation = computed(() => buildDocsNavigation(posts.value));
const topic = computed(() => navigation.value.find((item) => item.id === route.query.topic));
const group = computed(() => topic.value?.groups.find((item) => item.id === route.query.series));
const { searchQuery, selectedType, selectedCategory, selectedTag, sortKey, filters, hasActiveFilters, clearFilters } =
  useBlogQueryState();
const facets = computed(() => buildBlogFacets(posts.value));
const scopePosts = computed(
  () => group.value?.posts ?? topic.value?.groups.flatMap((item) => item.posts) ?? posts.value,
);
const results = computed(() => sortBlogPosts(filterBlogPosts(scopePosts.value, filters.value), sortKey.value));
const title = computed(() => group.value?.title ?? topic.value?.title ?? "知识库");
const overviewSections = computed(() =>
  topic.value
    ? topic.value.groups.map((item) => ({ id: item.id, title: item.title }))
    : navigation.value.map((item) => ({ id: item.id, title: item.title })),
);
const missingSelection = computed(
  () => (!!route.query.topic && !topic.value) || (!!route.query.series && !group.value),
);
async function load() {
  loading.value = true;
  error.value = false;
  try {
    posts.value = await getPostSummaries();
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
function label(post: PostSummary) {
  const place = findDocsPlacement(navigation.value, post.canonicalSlug);
  return place ? `${place.topic.title} / ${place.group.title}` : "其他笔记";
}
function postTarget(post: PostSummary) {
  const place = findDocsPlacement(navigation.value, post.canonicalSlug);
  return {
    path: `/posts/${post.canonicalSlug}`,
    query: { ...route.query, topic: place?.topic.id, series: place?.group.id },
  };
}
function jump(id: string, container: HTMLElement | null) {
  const target = document.getElementById(`section-${id}`);
  if (target && container)
    container.scrollTo({
      top: target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 24,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
}
onMounted(() => {
  document.title = "知识库 | WOODFISH";
  void load();
});
</script>

<template>
  <DocsLayout :topics="navigation" v-slot="{ scrollContainer }">
    <div v-if="loading" class="docs-status" role="status">正在载入知识库…</div>
    <div v-else-if="error" class="docs-status" role="alert">
      <h1>知识库暂时无法加载</h1>
      <button type="button" @click="load">重新加载</button>
    </div>
    <div v-else class="docs-index-grid">
      <div class="docs-index-content">
        <nav class="docs-breadcrumb" aria-label="面包屑">
          <RouterLink to="/blog">知识库</RouterLink
          ><template v-if="topic"
            ><span>/</span
            ><RouterLink :to="{ path: '/blog', query: { topic: topic.id } }">{{ topic.title }}</RouterLink></template
          ><template v-if="group"
            ><span>/</span><span>{{ group.title }}</span></template
          >
        </nav>
        <header class="docs-intro">
          <h1>{{ title }}</h1>
          <div class="docs-stats">
            <span
              ><strong>{{ scopePosts.length }}</strong> 篇笔记</span
            ><span
              ><strong>{{ topic ? topic.groups.length : navigation.length }}</strong>
              {{ topic ? "个系列" : "个主题" }}</span
            >
          </div>
        </header>
        <p v-if="missingSelection" class="docs-notice">
          这个主题或系列暂不可用，已展示现有内容。<RouterLink to="/blog">返回总览</RouterLink>
        </p>
        <section class="docs-search-panel" aria-label="查找文章">
          <div class="docs-search-input">
            <span aria-hidden="true">⌕</span
            ><input v-model="searchQuery" type="search" aria-label="搜索文章" placeholder="搜索标题、关键词或正文…" />
          </div>
          <details :open="hasActiveFilters">
            <summary>
              筛选与排序<span v-if="hasActiveFilters"> · {{ results.length }} 个结果</span>
            </summary>
            <div class="docs-filters">
              <label
                >类型<select v-model="selectedType">
                  <option value="">全部类型</option>
                  <option v-for="item in facets.types" :key="item.value" :value="item.value">{{ item.value }}</option>
                </select></label
              >
              <label
                >分类<select v-model="selectedCategory">
                  <option value="">全部分类</option>
                  <option v-for="item in facets.categories" :key="item.value" :value="item.value">
                    {{ item.value }}
                  </option>
                </select></label
              >
              <label
                >标签<select v-model="selectedTag">
                  <option value="">全部标签</option>
                  <option v-for="item in facets.tags" :key="item.value" :value="item.value">{{ item.value }}</option>
                </select></label
              >
              <label
                >排序<select v-model="sortKey">
                  <option value="latest">最近发布</option>
                  <option value="oldest">最早发布</option>
                  <option value="alphabetical">标题顺序</option>
                  <option value="reading-time">阅读时长</option>
                </select></label
              >
              <button v-if="hasActiveFilters" type="button" @click="clearFilters">清除筛选</button>
            </div>
          </details>
        </section>
        <section v-if="hasActiveFilters || group" class="docs-article-list">
          <div class="docs-section-heading">
            <h2>{{ hasActiveFilters ? "搜索结果" : "阅读目录" }}</h2>
            <span>{{ hasActiveFilters ? results.length : group?.posts.length }} 篇</span>
          </div>
          <p v-if="hasActiveFilters && !results.length" class="docs-status">
            没有找到相关笔记，试试其他关键词或清除筛选。
          </p>
          <RouterLink
            v-for="(post, index) in hasActiveFilters ? results : (group?.posts ?? [])"
            :key="post.canonicalSlug"
            :to="postTarget(post)"
            class="docs-article-row"
            ><span class="docs-row-number">{{ String(index + 1).padStart(2, "0") }}</span>
            <div>
              <small>{{ label(post) }}</small>
              <h3>{{ post.title }}</h3>
              <p v-if="post.excerpt && post.excerpt !== '返回课程目录'">{{ post.excerpt }}</p>
              <span class="docs-row-meta"
                >{{ post.readingMinutes }} 分钟阅读 · {{ post.publishedAt.slice(0, 10) }}</span
              >
            </div>
            <span aria-hidden="true">↗</span></RouterLink
          >
        </section>
        <template v-else-if="topic">
          <section v-for="item in topic.groups" :id="`section-${item.id}`" :key="item.id" class="docs-topic-section">
            <div class="docs-section-heading">
              <h2>{{ item.title }}</h2>
              <span>{{ item.posts.length }} 篇</span>
            </div>
            <RouterLink
              v-for="(post, index) in item.posts"
              :key="post.canonicalSlug"
              :to="postTarget(post)"
              class="docs-chapter-link"
              ><span>{{ String(index + 1).padStart(2, "0") }}</span
              >{{ post.title }}<small>{{ post.readingMinutes }} 分钟</small></RouterLink
            >
          </section>
        </template>
        <template v-else>
          <section class="docs-topic-cards" aria-label="浏览主题">
            <RouterLink
              v-for="(item, index) in navigation"
              :key="item.id"
              :to="{ path: '/blog', query: { topic: item.id } }"
              class="docs-topic-card"
              ><span class="docs-topic-card__number">{{ String(index + 1).padStart(2, "0") }} <span>↗</span></span>
              <h2>{{ item.title }}</h2>
              <p>{{ item.description }}</p>
              <small>{{ item.count }} 篇笔记 · {{ item.groups.length }} 个系列</small></RouterLink
            >
          </section>
          <section v-for="item in navigation" :id="`section-${item.id}`" :key="item.id" class="docs-topic-section">
            <div class="docs-section-heading">
              <h2>{{ item.title }}</h2>
              <RouterLink :to="{ path: '/blog', query: { topic: item.id } }">查看全部 ↗</RouterLink>
            </div>
            <div class="docs-series-list">
              <RouterLink
                v-for="series in item.groups"
                :key="series.id"
                :to="{ path: '/blog', query: { topic: item.id, series: series.id } }"
                ><span>{{ series.title }}</span
                ><small>{{ series.posts.length }} 篇 <span aria-hidden="true">→</span></small></RouterLink
              >
            </div>
          </section>
        </template>
      </div>
      <aside class="docs-index-toc" aria-label="本页导航">
        <p class="docs-eyebrow">{{ hasActiveFilters ? "查找笔记" : "本页导航" }}</p>
        <template v-if="!hasActiveFilters && !group"
          ><button
            v-for="section in overviewSections"
            :key="section.id"
            type="button"
            @click="jump(section.id, scrollContainer)"
          >
            {{ section.title }}
          </button></template
        >
        <p v-else>
          {{
            hasActiveFilters
              ? "搜索覆盖标题、标签与正文。可结合分类缩小范围。"
              : "左侧切换文章，进入正文后可在这里查看标题目录。"
          }}
        </p>
      </aside>
    </div>
  </DocsLayout>
</template>

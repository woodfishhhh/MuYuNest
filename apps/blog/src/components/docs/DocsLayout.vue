<script lang="ts">
const scrollPositions = new Map<string, number>();
</script>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { useTheme } from "@/composables/useTheme";
import DocsTree from "./DocsTree.vue";
import type { DocsTopic } from "@/content/docs-navigation";
import "@/assets/docs.css";

defineProps<{ topics: DocsTopic[]; currentSlug?: string }>();
const emit = defineEmits<{ scroll: [container: HTMLElement] }>();
const route = useRoute();
const router = useRouter();
const { theme, toggleThemeAt } = useTheme();
const scrollContainer = useTemplateRef<HTMLElement>("scrollContainer");
const drawer = useTemplateRef<HTMLDialogElement>("drawer");
const menuButton = useTemplateRef<HTMLButtonElement>("menuButton");
const search = ref(String(route.query.q ?? ""));
let restoreFrame = 0;
let initialKey = route.fullPath;
function onScroll() {
  if (!scrollContainer.value) return;
  scrollPositions.set(route.fullPath, scrollContainer.value.scrollTop);
  emit("scroll", scrollContainer.value);
}
function restoreScroll() {
  let attempts = 0;
  const target = scrollPositions.get(initialKey) ?? 0;
  const restore = () => {
    const el = scrollContainer.value;
    if (!el) return;
    el.scrollTop = target;
    if (target > el.scrollTop + 1 && attempts++ < 90) restoreFrame = requestAnimationFrame(restore);
  };
  restoreFrame = requestAnimationFrame(restore);
}
function closeDrawer() {
  drawer.value?.close();
}
function submitSearch() {
  void router.push({ path: "/blog", query: search.value.trim() ? { q: search.value.trim() } : {} });
}
watch(
  () => route.fullPath,
  async () => {
    cancelAnimationFrame(restoreFrame);
    closeDrawer();
    search.value = String(route.query.q ?? "");
    initialKey = route.fullPath;
    await nextTick();
    if (!route.hash) restoreScroll();
  },
);
onMounted(() => {
  if (!route.hash) restoreScroll();
});
onBeforeUnmount(() => cancelAnimationFrame(restoreFrame));
</script>

<template>
  <div class="docs-app">
    <a class="docs-skip" href="#docs-main">跳到正文</a>
    <header class="docs-header">
      <RouterLink to="/" class="docs-brand"
        ><span class="docs-brand__mark">W</span><span>WOODFISH<small>知识库 / NOTES</small></span></RouterLink
      >
      <nav aria-label="站点导航" class="docs-site-nav">
        <RouterLink to="/">首页</RouterLink><RouterLink to="/blog" class="is-active">博客</RouterLink
        ><RouterLink to="/works">作品</RouterLink><RouterLink to="/author">关于</RouterLink
        ><RouterLink to="/friend">友链</RouterLink>
      </nav>
      <form class="docs-header-search" role="search" @submit.prevent="submitSearch">
        <span aria-hidden="true">⌕</span
        ><input v-model="search" aria-label="搜索知识库" placeholder="搜索文章…" type="search" /><button
          type="submit"
          aria-label="提交搜索"
        >
          ↵
        </button>
      </form>
      <ThemeToggle :theme="theme" @toggle-theme="toggleThemeAt($event.x, $event.y)" />
    </header>
    <div class="docs-mobile-bar">
      <button ref="menuButton" type="button" aria-haspopup="dialog" @click="drawer?.showModal()">☰ 文档目录</button
      ><span>WOODFISH / 知识库</span>
    </div>
    <div class="docs-workspace">
      <aside class="docs-sidebar">
        <DocsTree :topics="topics" :current-slug="currentSlug" />
        <div class="docs-sidebar-foot">保持好奇，持续记录。<span>LEARN · BUILD · SHARE</span></div>
      </aside>
      <main id="docs-main" ref="scrollContainer" tabindex="-1" class="docs-main" @scroll.passive="onScroll">
        <slot :scroll-container="scrollContainer" />
      </main>
    </div>
    <dialog
      ref="drawer"
      class="docs-drawer"
      aria-label="文档目录"
      @close="menuButton?.focus()"
      @click="$event.target === drawer && closeDrawer()"
    >
      <div class="docs-drawer-head">
        <strong>文档目录</strong><button type="button" aria-label="关闭文档目录" @click="closeDrawer">✕</button>
      </div>
      <nav class="docs-drawer-links" aria-label="移动端站点导航">
        <RouterLink to="/">首页</RouterLink><RouterLink to="/works">作品</RouterLink
        ><RouterLink to="/author">关于</RouterLink><RouterLink to="/friend">友链</RouterLink>
      </nav>
      <DocsTree :topics="topics" :current-slug="currentSlug" @navigate="closeDrawer" />
    </dialog>
  </div>
</template>

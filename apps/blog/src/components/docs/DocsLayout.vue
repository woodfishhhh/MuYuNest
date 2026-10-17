<script lang="ts">
const scrollPositions = new Map<string, number>();
</script>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DocsTree from "./DocsTree.vue";
import type { DocsTopic } from "@/content/docs-navigation";
import "@/assets/docs.css";

defineProps<{ topics: DocsTopic[]; currentSlug?: string }>();
const emit = defineEmits<{ scroll: [container: HTMLElement] }>();
const route = useRoute();
const router = useRouter();
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
    <div class="docs-mobile-bar">
      <button ref="menuButton" type="button" aria-haspopup="dialog" @click="drawer?.showModal()">☰ 文档目录</button>
      <form class="docs-library-search" role="search" @submit.prevent="submitSearch">
        <input v-model="search" aria-label="搜索知识库" placeholder="搜索文章…" type="search" />
        <button type="submit" aria-label="提交搜索">↵</button>
      </form>
    </div>
    <div class="docs-workspace">
      <aside class="docs-sidebar">
        <form class="docs-library-search" role="search" @submit.prevent="submitSearch">
          <input v-model="search" aria-label="搜索知识库" placeholder="搜索文章…" type="search" />
          <button type="submit" aria-label="提交搜索">↵</button>
        </form>
        <DocsTree :topics="topics" :current-slug="currentSlug" />
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
      <DocsTree :topics="topics" :current-slug="currentSlug" @navigate="closeDrawer" />
    </dialog>
  </div>
</template>

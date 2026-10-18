<script lang="ts">
const scrollPositions = new Map<string, number>();
let sidebarScroll = 0;
</script>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, provide, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import gsap from "gsap";
import { docsScrollKey } from "@/composables/useDocsPage";
import { useDocsMotion } from "@/composables/useDocsMotion";
import { reducedDocsMotion } from "@/motion/docs-motion";
import DocsTree from "./DocsTree.vue";
import type { DocsTopic } from "@/content/docs-navigation";
import "@/assets/docs.css";

const props = withDefaults(defineProps<{ topics: DocsTopic[]; currentSlug?: string; ready?: boolean }>(), {
  ready: true,
});
const root = useTemplateRef<HTMLElement>("root");
const sidebar = useTemplateRef<HTMLElement>("sidebar");
const { brief } = useDocsMotion(root, () => props.ready);
watch(
  () => props.ready,
  async (ready) => {
    if (ready && brief) {
      await nextTick();
      if (sidebar.value) sidebar.value.scrollTo({ top: sidebarScroll, behavior: "instant" });
    }
  },
  { flush: "post" },
);
const emit = defineEmits<{ scroll: [container: HTMLElement] }>();
const route = useRoute();
const router = useRouter();
const scrollContainer = useTemplateRef<HTMLElement>("scrollContainer");
provide(docsScrollKey, scrollContainer);
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
let drawerMotion: gsap.core.Timeline | null = null;
function openDrawer() {
  const el = drawer.value;
  if (!el) return;
  drawerMotion?.kill();
  const reopening = el.open;
  if (!reopening) el.showModal();
  if (reducedDocsMotion()) {
    gsap.set([el, ...el.querySelectorAll(".docs-tree__topic")], { clearProps: "all" });
    return;
  }
  if (!reopening) gsap.set(el, { xPercent: -100, opacity: 1, "--drawer-backdrop": 0 });
  drawerMotion = gsap
    .timeline()
    .to(el, { xPercent: 0, "--drawer-backdrop": 1, duration: 0.48, ease: "back.out(0.35)" })
    .fromTo(
      el.querySelectorAll(".docs-tree__topic"),
      { x: -18, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, stagger: 0.025, clearProps: "opacity,transform" },
      0.1,
    );
}
function closeDrawer(immediate = false) {
  const el = drawer.value;
  if (!el?.open) return;
  drawerMotion?.kill();
  const finish = () => {
    el.close();
    gsap.set([el, ...el.querySelectorAll(".docs-tree__topic")], { clearProps: "all" });
  };
  if (immediate || reducedDocsMotion()) {
    finish();
    return;
  }
  drawerMotion = gsap
    .timeline({ onComplete: finish })
    .to(el, { xPercent: -100, "--drawer-backdrop": 0, duration: 0.24, ease: "power3.in" });
}
function submitSearch() {
  void router.push({ path: "/blog", query: search.value.trim() ? { q: search.value.trim() } : {} });
}
watch(
  () => route.fullPath,
  async () => {
    cancelAnimationFrame(restoreFrame);
    closeDrawer(true);
    search.value = String(route.query.q ?? "");
    initialKey = route.fullPath;
    await nextTick();
    if (!route.hash) restoreScroll();
  },
);
onMounted(() => {
  if (!route.hash) restoreScroll();
});
onBeforeUnmount(() => {
  cancelAnimationFrame(restoreFrame);
  drawerMotion?.kill();
  if (drawer.value?.open) drawer.value.close();
});
</script>

<template>
  <div ref="root" class="docs-app docs-motion-pending" :class="{ 'docs-motion-brief': brief, 'docs-app--library': route.name === 'blog' }">
    <div class="docs-entry-light" aria-hidden="true" />
    <a class="docs-skip" href="#docs-main">跳到正文</a>
    <div class="docs-mobile-bar">
      <button ref="menuButton" type="button" aria-haspopup="dialog" @click="openDrawer">☰ 文档目录</button>
      <form class="docs-library-search" role="search" @submit.prevent="submitSearch">
        <input v-model="search" aria-label="搜索知识库" placeholder="搜索文章…" type="search" />
        <button type="submit" aria-label="提交搜索">↵</button>
      </form>
    </div>
    <div class="docs-workspace">
      <aside ref="sidebar" class="docs-sidebar" @scroll.passive="sidebarScroll = sidebar?.scrollTop ?? 0">
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
      @cancel.prevent="closeDrawer()"
      @click="$event.target === drawer && closeDrawer()"
    >
      <div class="docs-drawer-head">
        <strong>文档目录</strong><button type="button" aria-label="关闭文档目录" @click="closeDrawer()">✕</button>
      </div>
      <DocsTree :topics="topics" :current-slug="currentSlug" @navigate="closeDrawer()" />
    </dialog>
  </div>
</template>

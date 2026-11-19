<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch, nextTick } from "vue";

import { enhanceCodeBlocks } from "@/utils/code-blocks";

import type { PostArticle } from "@/types/content";

const props = defineProps<{
  article: PostArticle;
}>();

const containerRef = useTemplateRef<HTMLElement>("proseContainer");

let cleanup: (() => void) | undefined;
watch(
  () => props.article.html,
  async () => {
    cleanup?.();
    await nextTick();
    if (containerRef.value) cleanup = enhanceCodeBlocks(containerRef.value);
  },
  { immediate: true, flush: "post" },
);
onBeforeUnmount(() => cleanup?.());

onMounted(() => {
  const el = containerRef.value;
  if (!el) return;

  const scrollRoot = el.closest<HTMLElement>("[style*='overflow'], .article-page");
  if (!scrollRoot || scrollRoot === document.documentElement) return;

  for (const img of el.querySelectorAll<HTMLImageElement>("img[loading='lazy']")) {
    img.removeAttribute("loading");
  }
});
</script>

<template>
  <section class="article-prose-shell">
    <div
      id="article-container"
      ref="proseContainer"
      class="article-markdown article-prose"
      data-testid="article-prose"
      role="region"
      tabindex="-1"
      v-html="article.html"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";

import DocsCollapse from "../docs/DocsCollapse.vue";

import type { TocItem } from "@/types/content";

const props = withDefaults(
  defineProps<{
    items: TocItem[];
    activeId?: string;
    variant?: "desktop" | "mobile";
  }>(),
  {
    activeId: "",
    variant: "desktop",
  },
);

const emit = defineEmits<{
  jump: [id: string];
}>();

let pendingJump = "";
function finishCollapse() {
  if (pendingJump) {
    emit("jump", pendingJump);
    pendingJump = "";
  }
}
function handleJump(id: string) {
  if (props.variant === "mobile") {
    pendingJump = id;
    isExpanded.value = false;
  } else emit("jump", id);
}

const isExpanded = shallowRef(false);
const isMobile = computed(() => props.variant === "mobile");
const showItems = computed(() => !isMobile.value || isExpanded.value);
const outline = useTemplateRef<HTMLElement>("outline");

watch(
  () => props.activeId,
  () => {
    const el = outline.value;
    const current = el?.querySelector<HTMLElement>("[aria-current='location']");
    if (!el || !current || isMobile.value) return;
    const viewport = el.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    if (item.top < viewport.top || item.bottom > viewport.bottom) {
      el.scrollTo({
        top: el.scrollTop + item.top - viewport.top - el.clientHeight / 3,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  },
  { flush: "post" },
);

function toggleMobileToc() {
  pendingJump = "";
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <aside
    v-if="props.items.length > 0"
    :class="['article-toc', `article-toc--${props.variant}`]"
    data-testid="article-toc"
    aria-label="本页目录"
  >
    <div class="article-toc__card">
      <div class="article-toc__head" data-testid="article-toc-header">
        <div class="article-toc__title">本页目录</div>
        <div class="article-toc__meta">{{ props.items.length }} 个章节</div>
        <button
          v-if="isMobile"
          class="article-toc__toggle"
          data-testid="article-toc-mobile-toggle"
          type="button"
          :aria-expanded="isExpanded"
          @click="toggleMobileToc"
        >
          {{ isExpanded ? "收起" : "展开" }}
        </button>
      </div>
      <DocsCollapse :open="showItems" @closed="finishCollapse"
        ><div ref="outline" class="article-toc__scroll" data-testid="article-toc-scroll">
          <div class="article-toc__items">
            <button
              v-for="item in props.items"
              :key="item.id"
              :aria-current="props.activeId === item.id ? 'location' : undefined"
              :class="[
                'article-toc__item',
                `article-toc__item--level-${item.level}`,
                { 'is-active': props.activeId === item.id },
              ]"
              :data-toc-id="item.id"
              data-testid="article-toc-item"
              type="button"
              @click="handleJump(item.id)"
            >
              <span v-if="item.html" class="article-toc__label" v-html="item.html" />
              <span v-else>{{ item.text }}</span>
            </button>
          </div>
        </div></DocsCollapse
      >
    </div>
  </aside>
</template>

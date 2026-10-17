<script setup lang="ts">
import { computed, nextTick, shallowRef } from "vue";

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

async function handleJump(id: string) {
  if (props.variant === "mobile") {
    isExpanded.value = false;
    await nextTick();
  }

  emit("jump", id);
}

const isExpanded = shallowRef(false);
const isMobile = computed(() => props.variant === "mobile");
const showItems = computed(() => !isMobile.value || isExpanded.value);

function toggleMobileToc() {
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
      <div v-if="showItems" class="article-toc__scroll" data-testid="article-toc-scroll">
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
      </div>
    </div>
  </aside>
</template>

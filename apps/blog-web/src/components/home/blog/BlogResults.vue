<script setup lang="ts">
import type { LocationQueryRaw } from "vue-router";

import BlogResultCard from "@/components/home/blog/BlogResultCard.vue";
import type { PostSummary } from "@/types/content";

const props = defineProps<{
  posts: PostSummary[];
  blogQuery: LocationQueryRaw;
}>();
</script>

<template>
  <section class="space-y-4">
    <div
      v-if="props.posts.length === 0"
      class="rounded-[18px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)] p-8 text-center"
    >
      <div class="text-sm uppercase tracking-[0.28em] text-[var(--stage-hint)]">No Results</div>
      <p class="mt-4 text-sm leading-7 text-[var(--stage-hint)]">
        这组条件下暂时没有命中的文章，试试清空筛选或换一个关键词。
      </p>
    </div>

    <div v-else class="border-y border-[var(--border-subtle)]">
      <BlogResultCard
        v-for="(post, index) in props.posts"
        :key="post.canonicalSlug"
        :post="post"
        :index="index"
        :blog-query="props.blogQuery"
      />
    </div>
  </section>
</template>

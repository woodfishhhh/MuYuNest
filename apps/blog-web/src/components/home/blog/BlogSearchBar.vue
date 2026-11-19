<script setup lang="ts">
import type { BlogSortKey } from "@/content/blog-hub";

const props = defineProps<{
  query: string;
  sort: BlogSortKey;
  totalCount: number;
  resultCount: number;
  hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
  "update:query": [value: string];
  "update:sort": [value: BlogSortKey];
}>();

const sortOptions: { value: BlogSortKey; label: string }[] = [
  { value: "latest", label: "最新优先" },
  { value: "oldest", label: "最早优先" },
  { value: "reading-time", label: "阅读时长" },
  { value: "alphabetical", label: "标题字母序" },
];
</script>

<template>
  <section class="border-b border-[var(--border-subtle)] pb-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2">
        <div class="text-[11px] uppercase tracking-[0.36em] text-[color:var(--accent)] opacity-75">
          Blog Archive
        </div>
        <h2 class="max-w-3xl text-3xl font-light leading-tight text-[var(--stage-fg)] md:text-4xl">
          Field notes for code, study, and small systems.
        </h2>
        <p class="max-w-2xl text-sm leading-7 text-[var(--stage-hint)]">
          可搜索标题、摘要、类型、标签与正文内容。
        </p>
      </div>

      <div class="border-l border-[var(--border-subtle)] pl-4 text-sm text-[var(--stage-hint)]">
        <div class="text-[var(--stage-fg)]">
          {{ props.resultCount }} / {{ props.totalCount }} posts
        </div>
        <div class="mt-1 text-xs text-[var(--stage-hint)]">
          {{ props.hasActiveFilters ? "筛选后的目录视图" : "完整文章目录" }}
        </div>
      </div>
    </div>

    <div class="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
      <label class="flex-1">
        <span class="sr-only">搜索博客内容</span>
        <input
          data-testid="blog-search-input"
          :value="props.query"
          name="blogSearch"
          type="search"
          placeholder="搜索标题、标签、分类或正文关键字"
          class="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--stage-fg)] outline-none transition-colors placeholder:text-[var(--stage-hint)] focus:border-cyan-300/60"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="block">
        <span class="sr-only">排序方式</span>
        <select
          data-testid="blog-sort-select"
          class="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--stage-fg)] outline-none transition-colors focus:border-cyan-300/60"
          :value="props.sort"
          @change="emit('update:sort', ($event.target as HTMLSelectElement).value as BlogSortKey)"
        >
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>
  </section>
</template>

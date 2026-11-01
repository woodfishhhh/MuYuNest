<script setup lang="ts">
import type { BlogFacet } from "@/content/blog-hub";

const props = defineProps<{
  types: BlogFacet[];
  categories: BlogFacet[];
  tags: BlogFacet[];
  totalCount: number;
  resultCount: number;
  hasActiveFilters: boolean;
  selectedType: string;
  selectedCategory: string;
  selectedTag: string;
}>();

const emit = defineEmits<{
  "toggle:type": [value: string];
  "toggle:category": [value: string];
  "toggle:tag": [value: string];
  clear: [];
}>();
</script>

<template>
  <aside
    data-testid="blog-filter-rail"
    class="max-h-72 overflow-y-auto rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden"
  >
    <div class="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
      <div>
        <div class="text-[11px] uppercase tracking-[0.32em] text-[color:var(--accent)] opacity-70">
          Filter Rail
        </div>
        <h3 class="mt-2 text-xl font-light text-[var(--stage-fg)]">筛选轨道</h3>
        <p class="mt-1 text-xs text-[var(--stage-hint)]">
          {{ props.resultCount }} / {{ props.totalCount }} results
        </p>
      </div>
      <button
        data-testid="blog-clear-filters"
        type="button"
        class="shrink-0 rounded-full border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--stage-hint)] transition-colors hover:border-cyan-300/50 hover:text-[var(--stage-fg)] disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!props.hasActiveFilters"
        @click="emit('clear')"
      >
        清空
      </button>
    </div>

    <div class="mt-4 space-y-5 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pr-1">
      <section class="space-y-3">
        <div class="text-xs uppercase tracking-[0.24em] text-[var(--stage-hint)]">Type</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="facet in props.types"
            :key="facet.value"
            :data-testid="`blog-filter-type-${facet.value}`"
            type="button"
            class="rounded-full border px-3 py-2 text-sm transition-colors"
            :class="
              props.selectedType === facet.value
                ? 'border-cyan-300/70 bg-cyan-400/10 text-cyan-100'
                : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--stage-hint)] hover:border-[var(--border-strong)] hover:text-[var(--stage-fg)]'
            "
            :aria-pressed="props.selectedType === facet.value"
            @click="emit('toggle:type', facet.value)"
          >
            {{ facet.value }} · {{ facet.count }}
          </button>
        </div>
      </section>

      <section class="space-y-3">
        <div class="text-xs uppercase tracking-[0.24em] text-[var(--stage-hint)]">Category</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="facet in props.categories"
            :key="facet.value"
            :data-testid="`blog-filter-category-${facet.value}`"
            type="button"
            class="rounded-full border px-3 py-2 text-sm transition-colors"
            :class="
              props.selectedCategory === facet.value
                ? 'border-blue-300/70 bg-blue-400/10 text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--stage-hint)] hover:border-[var(--border-strong)] hover:text-[var(--stage-fg)]'
            "
            :aria-pressed="props.selectedCategory === facet.value"
            @click="emit('toggle:category', facet.value)"
          >
            {{ facet.value }} · {{ facet.count }}
          </button>
        </div>
      </section>

      <section class="space-y-3">
        <div class="text-xs uppercase tracking-[0.24em] text-[var(--stage-hint)]">Tag</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="facet in props.tags"
            :key="facet.value"
            :data-testid="`blog-filter-tag-${facet.value}`"
            type="button"
            class="rounded-full border px-3 py-2 text-sm transition-colors"
            :class="
              props.selectedTag === facet.value
                ? 'border-fuchsia-300/70 bg-fuchsia-400/10 text-fuchsia-100'
                : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--stage-hint)] hover:border-[var(--border-strong)] hover:text-[var(--stage-fg)]'
            "
            :aria-pressed="props.selectedTag === facet.value"
            @click="emit('toggle:tag', facet.value)"
          >
            #{{ facet.value }} · {{ facet.count }}
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>

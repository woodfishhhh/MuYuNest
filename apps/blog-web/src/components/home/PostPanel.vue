<script setup lang="ts">
import { computed } from "vue";

import { buildBlogFacets, filterBlogPosts, sortBlogPosts } from "@/content/blog-hub";
import BlogFilterRail from "@/components/home/blog/BlogFilterRail.vue";
import BlogResults from "@/components/home/blog/BlogResults.vue";
import BlogSearchBar from "@/components/home/blog/BlogSearchBar.vue";
import { useBlogQueryState } from "@/composables/useBlogQueryState";
import type { PostSummary } from "@/types/content";

const props = defineProps<{
  posts: PostSummary[];
}>();

const {
  searchQuery,
  selectedType,
  selectedCategory,
  selectedTag,
  sortKey,
  filters,
  activeQuery,
  hasActiveFilters,
  clearFilters,
} = useBlogQueryState();

const facets = computed(() => buildBlogFacets(props.posts));
const orderedPosts = computed(() => sortBlogPosts(props.posts, sortKey.value));
const sortedPosts = computed(() => filterBlogPosts(orderedPosts.value, filters.value));

function toggleType(value: string) {
  selectedType.value = selectedType.value === value ? "" : value;
}

function toggleCategory(value: string) {
  selectedCategory.value = selectedCategory.value === value ? "" : value;
}

function toggleTag(value: string) {
  selectedTag.value = selectedTag.value === value ? "" : value;
}
</script>

<template>
  <div class="space-y-6 overflow-hidden text-left lg:overflow-visible">
    <BlogSearchBar
      :query="searchQuery"
      :sort="sortKey"
      :total-count="props.posts.length"
      :result-count="sortedPosts.length"
      :has-active-filters="hasActiveFilters"
      @update:query="searchQuery = $event"
      @update:sort="sortKey = $event"
    />

    <div
      data-testid="blog-editorial-layout"
      class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start xl:gap-8"
    >
      <div class="order-2 min-w-0 lg:order-none">
        <BlogResults :posts="sortedPosts" :blog-query="activeQuery" />
      </div>

      <div class="order-1 self-start lg:order-none lg:sticky lg:top-0">
        <BlogFilterRail
          :types="facets.types"
          :categories="facets.categories"
          :tags="facets.tags"
          :total-count="props.posts.length"
          :result-count="sortedPosts.length"
          :has-active-filters="hasActiveFilters"
          :selected-type="selectedType"
          :selected-category="selectedCategory"
          :selected-tag="selectedTag"
          @toggle:type="toggleType"
          @toggle:category="toggleCategory"
          @toggle:tag="toggleTag"
          @clear="clearFilters"
        />
      </div>
    </div>
  </div>
</template>

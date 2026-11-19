import { computed } from "vue";
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw, type LocationQueryValue } from "vue-router";

import { sanitizeFilterValue, sanitizeSearchQuery } from "@/utils/input-validator";
import type { BlogFilters, BlogSortKey } from "@/content/blog-hub";

type BlogQueryKey = "q" | "type" | "category" | "tag" | "sort";

const DEFAULT_SORT: BlogSortKey = "latest";

export function useBlogQueryState() {
  const route = useRoute();
  const router = useRouter();

  const searchQuery = computed({
    get: () => readAndSanitizeQueryValue(route.query.q, "search"),
    set: (value: string) => {
      void replaceQuery({ q: value });
    },
  });

  const selectedType = computed({
    get: () => readAndSanitizeQueryValue(route.query.type, "filter"),
    set: (value: string) => {
      void replaceQuery({ type: value });
    },
  });

  const selectedCategory = computed({
    get: () => readAndSanitizeQueryValue(route.query.category, "filter"),
    set: (value: string) => {
      void replaceQuery({ category: value });
    },
  });

  const selectedTag = computed({
    get: () => readAndSanitizeQueryValue(route.query.tag, "filter"),
    set: (value: string) => {
      void replaceQuery({ tag: value });
    },
  });

  const sortKey = computed<BlogSortKey>({
    get: () => {
      const value = readQueryValue(route.query.sort);
      return isBlogSortKey(value) ? value : DEFAULT_SORT;
    },
    set: (value) => {
      void replaceQuery({ sort: value });
    },
  });

  const filters = computed<BlogFilters>(() => ({
    query: searchQuery.value,
    type: selectedType.value,
    category: selectedCategory.value,
    tag: selectedTag.value,
  }));

  const activeQuery = computed<LocationQueryRaw>(() =>
    buildNextQuery(
      {},
      {
        q: searchQuery.value,
        type: selectedType.value,
        category: selectedCategory.value,
        tag: selectedTag.value,
        sort: sortKey.value,
      },
    ),
  );

  const hasActiveFilters = computed(() => Object.keys(activeQuery.value).length > 0);

  async function clearFilters() {
    await router.replace({
      name: getRouteName(),
      params: route.params,
      query: { topic: route.query.topic, series: route.query.series },
      hash: route.hash,
    });
  }

  async function replaceQuery(updates: Partial<Record<BlogQueryKey, string>>) {
    const nextQuery = buildNextQuery(route.query, updates);

    await router.replace({
      name: getRouteName(),
      params: route.params,
      query: nextQuery,
      hash: route.hash,
    });
  }

  function getRouteName() {
    return typeof route.name === "string" ? route.name : "blog";
  }

  return {
    searchQuery,
    selectedType,
    selectedCategory,
    selectedTag,
    sortKey,
    filters,
    activeQuery,
    hasActiveFilters,
    clearFilters,
  };
}

function buildNextQuery(currentQuery: LocationQuery, updates: Partial<Record<BlogQueryKey, string>>): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = {
    ...currentQuery,
  };

  for (const [key, value] of Object.entries(updates) as [BlogQueryKey, string][]) {
    const normalizedValue = value.trim();
    if (!normalizedValue || (key === "sort" && normalizedValue === DEFAULT_SORT)) {
      delete nextQuery[key];
      continue;
    }

    nextQuery[key] = normalizedValue;
  }

  return nextQuery;
}

function readQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

/**
 * 读取并校验 query 值（用于 computed getter）
 * 过滤控制字符并截断到最大长度
 */
function readAndSanitizeQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
  type: "search" | "filter",
): string {
  const raw = readQueryValue(value);
  if (type === "search") {
    return sanitizeSearchQuery(raw);
  }
  return sanitizeFilterValue(raw);
}

function isBlogSortKey(value: string): value is BlogSortKey {
  return value === "latest" || value === "oldest" || value === "reading-time" || value === "alphabetical";
}

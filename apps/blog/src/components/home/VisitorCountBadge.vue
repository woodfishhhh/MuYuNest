<script setup lang="ts">
import { getBaseUrl } from "@/utils/base-url";

const props = defineProps<{
  total: number | null;
  isLoading: boolean;
  hasError: boolean;
}>();
</script>

<template>
  <a
    v-if="!props.hasError && (props.isLoading || props.total !== null)"
    data-testid="visitor-count-badge"
    :href="`${getBaseUrl()}analytics/`"
    aria-label="打开网站统计"
    title="打开网站统计"
    class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[var(--stage-hint)] backdrop-blur-md transition-colors hover:border-[var(--stage-hint)] hover:text-[var(--stage-fg)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--stage-fg)]"
  >
    <span>Visitors</span>
    <span class="text-[var(--stage-fg)]">
      {{ props.isLoading ? "..." : props.total }}
    </span>
  </a>
</template>

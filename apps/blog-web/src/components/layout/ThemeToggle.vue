<script setup lang="ts">
import type { ThemeMode } from "@/composables/useTheme";

const props = defineProps<{ theme: ThemeMode }>();
const emit = defineEmits<{ toggleTheme: [{ x: number; y: number }] }>();

function onToggle(event: MouseEvent) {
  const { clientX, clientY, currentTarget } = event;
  if (clientX > 0 || clientY > 0) {
    emit("toggleTheme", { x: clientX, y: clientY });
    return;
  }

  const button = currentTarget as HTMLElement | null;
  if (!button) {
    emit("toggleTheme", { x: 0, y: 0 });
    return;
  }

  const rect = button.getBoundingClientRect();
  emit("toggleTheme", {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
}
</script>

<template>
  <button
    :aria-label="props.theme === 'night' ? '切换到白昼模式' : '切换到黑夜模式'"
    :aria-pressed="props.theme === 'day'"
    class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--stage-hint)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--stage-fg)]"
    type="button"
    @click="onToggle"
  >
    <svg
      v-if="props.theme === 'night'"
      aria-hidden="true"
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.9"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2.1M12 19.9V22M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2.1M19.9 12H22M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"
      />
    </svg>
    <svg v-else aria-hidden="true" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.6 3a8.9 8.9 0 1 0 8.4 12.2A9.2 9.2 0 0 1 12.6 3Z" />
    </svg>
  </button>
</template>

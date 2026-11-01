<script setup lang="ts">
import type { WorksViewMode } from "./types";

const props = defineProps<{
  modelValue: WorksViewMode;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: WorksViewMode];
}>();

const options: { label: string; value: WorksViewMode }[] = [
  { label: "Orbit", value: "orbit" },
  { label: "Case", value: "case" },
];

function selectView(value: WorksViewMode) {
  emit("update:modelValue", value);
}
</script>

<template>
  <div
    aria-label="切换作品展示方式"
    class="works-toggle"
    data-testid="works-view-toggle"
    role="group"
  >
    <button
      v-for="option in options"
      :key="option.value"
      :aria-pressed="props.modelValue === option.value"
      :class="{ 'works-toggle__button--active': props.modelValue === option.value }"
      :data-testid="`works-view-toggle-${option.value}`"
      data-analytics-event="works-view-mode"
      :data-analytics-event-mode="option.value"
      class="works-toggle__button"
      type="button"
      @click="selectView(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.works-toggle {
  display: inline-flex;
  flex: none;
  gap: 0.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-1);
  padding: 0.25rem;
}

.works-toggle__button {
  cursor: pointer;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0.6rem 0.92rem;
  color: var(--stage-hint);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  line-height: 1;
  text-transform: uppercase;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.works-toggle__button:hover {
  color: var(--stage-fg);
}

.works-toggle__button--active {
  background: var(--accent);
  color: var(--stage-bg);
  transform: translateY(-1px);
}
</style>

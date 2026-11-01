<script setup lang="ts">
import { computed, inject, onBeforeUnmount, useTemplateRef } from "vue";

import { filmFrameKey } from "@/components/home/film/film-frame";
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  tenyear: AuthorProfileData["tenyear"];
}>();

const DAY_MS = 86_400_000;
// The count runs while the chapter plays from here to there.
const COUNT_FROM = 0.06;
const COUNT_TO = 0.55;

const numberRef = useTemplateRef<HTMLElement>("number");
const range = computed(() => {
  const start = new Date(props.tenyear.start).getTime();
  const end = new Date(props.tenyear.end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
});
const now = Date.now();
const percent = computed(() =>
  range.value ? Math.min(100, Math.max(0, ((now - range.value.start) / (range.value.end - range.value.start)) * 100)) : 0,
);
const daysPassed = computed(() => (range.value ? Math.max(0, Math.floor((now - range.value.start) / DAY_MS)) : 0));
const daysLeft = computed(() => (range.value ? Math.max(0, Math.ceil((range.value.end - now) / DAY_MS)) : 0));
const startYear = computed(() => props.tenyear.start.slice(0, 4));
const endYear = computed(() => props.tenyear.end.slice(0, 4));

const unregister = inject(filmFrameKey)?.((progress) => {
  const element = numberRef.value;
  if (!element) return;
  const local = Math.min(1, Math.max(0, ((progress.time ?? 0) - COUNT_FROM) / (COUNT_TO - COUNT_FROM)));
  const eased = 1 - (1 - local) ** 3;
  element.textContent = (percent.value * eased).toFixed(1);
});

onBeforeUnmount(() => unregister?.());
</script>

<template>
  <div class="film-time" :style="{ '--percent': percent / 100 }">
    <span class="film-time__ghost film-display film-outline" aria-hidden="true">{{ startYear }}—{{ endYear }}</span>

    <div class="film-time__copy">
      <p class="film-kicker film-cue" style="--at: 0.02"><b>03</b> · 时间</p>
      <h2 class="film-time__title film-cue" style="--at: 0.05">{{ props.tenyear.title }}</h2>
      <p class="film-time__value film-display" :aria-label="`${percent.toFixed(1)}%`">
        <span ref="number" aria-hidden="true">0.0</span><small aria-hidden="true">%</small>
      </p>
      <p class="film-time__note film-cue" style="--at: 0.45">
        第 {{ daysPassed }} 天 · 还剩 {{ daysLeft }} 天 · {{ props.tenyear.text }}
      </p>
    </div>

    <div class="film-time__line" aria-hidden="true">
      <span class="film-time__track" />
      <span class="film-time__now">今天</span>
      <span class="film-time__edge">{{ props.tenyear.start }}</span>
      <span class="film-time__edge film-time__edge--end">{{ props.tenyear.end }}</span>
    </div>
  </div>
</template>

<style scoped>
.film-time {
  --k: clamp(0, (var(--t) - 0.06) / 0.49, 1);
  position: absolute;
  inset: 0;
}

/* Slow background layer drifting the other way. */
.film-time__ghost {
  position: absolute;
  top: 50%;
  left: 0;
  font-size: clamp(7rem, 24vw, 24rem);
  white-space: nowrap;
  color: var(--stage-hint);
  opacity: 0.22;
  transform: translate3d(calc(18vw - var(--t) * 40vw), -50%, 0);
}

.film-time__copy {
  position: absolute;
  top: 50%;
  right: var(--film-gutter);
  width: min(42rem, 48vw);
  transform: translateY(-58%);
  text-align: right;
}

.film-time__title {
  margin: 1rem 0 0;
  font-family: var(--film-heading-cn);
  font-size: clamp(1.6rem, 2.6vw, 2.4rem);
  font-weight: 700;
  color: var(--stage-fg);
}

.film-time__value {
  margin: 0.6rem 0 0;
  font-size: clamp(6rem, 16vw, 16rem);
  font-variant-numeric: tabular-nums;
  color: var(--stage-fg);
}

.film-time__value small {
  font-size: 0.36em;
  color: var(--accent);
}

.film-time__note {
  margin: 1rem 0 0;
  font-size: clamp(0.95rem, 1.3vw, 1.15rem);
  letter-spacing: 0.08em;
  color: var(--stage-hint-strong);
}

.film-time__line {
  position: absolute;
  right: var(--film-gutter);
  bottom: clamp(3.5rem, 11vh, 6.5rem);
  left: var(--film-gutter);
  height: 1px;
  background: var(--border-subtle);
}

.film-time__track {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--accent), var(--film-warm));
  transform: scaleX(calc(var(--k) * var(--percent)));
  transform-origin: 0 50%;
}

.film-time__now {
  position: absolute;
  bottom: 0.9rem;
  left: calc(var(--k) * var(--percent) * 100%);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: var(--accent);
  opacity: var(--k);
  translate: -50% 0;
}

.film-time__now::after {
  content: "";
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 50%;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
  translate: -50% 0;
}

.film-time__edge {
  position: absolute;
  top: 0.9rem;
  left: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--stage-hint);
}

.film-time__edge--end {
  right: 0;
  left: auto;
}

@media (max-width: 767px) {
  .film-time__copy {
    top: auto;
    bottom: 9rem;
    width: auto;
    left: var(--film-gutter);
    transform: none;
    text-align: left;
  }
}
</style>

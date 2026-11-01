<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";

import { useTheme } from "@/composables/useTheme";

const props = defineProps<{
  name: string;
  roles: string[];
  location: string;
  /** The splash has lifted; the title may rise into place. */
  ready: boolean;
}>();

const { theme } = useTheme();
const letters = computed(() => Array.from(props.name.toUpperCase()));
const geometryName = computed(() => (theme.value === "day" ? "莫比乌斯带" : "超立方体"));
const clockFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const clock = shallowRef(clockFormat.format(new Date()));
// The rise-in eases on a transition; after it lands, scroll must move the letters directly.
const LETTER_RISE_MS = 1600;
const settled = shallowRef(false);
let clockTimer: number | null = null;
let settleTimer: number | null = null;

watch(
  () => props.ready,
  (ready) => {
    if (!ready || settled.value) return;
    settleTimer = window.setTimeout(() => {
      settled.value = true;
    }, LETTER_RISE_MS);
  },
  { immediate: true },
);

onMounted(() => {
  clockTimer = window.setInterval(() => {
    clock.value = clockFormat.format(new Date());
  }, 1000);
});

onBeforeUnmount(() => {
  if (clockTimer !== null) window.clearInterval(clockTimer);
  if (settleTimer !== null) window.clearTimeout(settleTimer);
});
</script>

<template>
  <div class="film-opening" :class="{ 'is-ready': props.ready, 'is-settled': settled }">
    <div class="film-opening__meta film-kicker">
      <span class="film-opening__live"><i aria-hidden="true" />在线</span>
      <span>WOODFISH NEST</span>
      <span><time>{{ clock }}</time> · {{ props.location }}</span>
    </div>

    <h1 class="film-opening__title film-display" :aria-label="props.name">
      <span class="film-opening__ghost film-outline" aria-hidden="true">{{ props.name }}</span>
      <span class="film-opening__word film-glitch" data-glitch :data-text="props.name.toUpperCase()" aria-hidden="true">
        <span v-for="(letter, index) in letters" :key="index" class="film-opening__mask">
          <span class="film-opening__letter" :style="{ '--i': index }">{{ letter }}</span>
        </span>
      </span>
    </h1>

    <div class="film-opening__foot">
      <p class="film-opening__sub">
        <strong>木鱼的鱼窝</strong>
        <span>{{ props.roles.join(" / ") }}</span>
      </p>
      <p class="film-opening__hint film-kicker">点击{{ geometryName }}进入沉浸 · 向下滚动开场</p>
    </div>
  </div>
</template>

<style scoped>
.film-opening {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  padding: clamp(6.5rem, 14vh, 9rem) var(--film-gutter) clamp(2rem, 6vh, 3.5rem);
}

/* Leaving: everything drifts up and dissolves at its own rate. */
.film-opening__meta,
.film-opening__foot {
  opacity: calc(1 - var(--t) * 2.2);
  transform: translate3d(0, calc(var(--t) * -14vh), 0);
}

.film-opening__meta {
  position: absolute;
  top: clamp(6.5rem, 14vh, 9rem);
  left: var(--film-gutter);
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.8rem;
}

.film-opening__meta time {
  color: var(--stage-fg);
  font-variant-numeric: tabular-nums;
}

.film-opening__live {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--stage-fg);
}

.film-opening__live i {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: #4ade80;
  box-shadow: 0 0 0 4px color-mix(in srgb, #4ade80 22%, transparent);
}

.film-opening__title {
  position: relative;
  margin: 0;
  font-size: clamp(5.2rem, 21vw, 23rem);
  color: var(--stage-fg);
}

/* The outline copy trails behind at half speed: the first parallax layer. */
.film-opening__ghost {
  position: absolute;
  top: -0.12em;
  left: 0.05em;
  color: var(--accent);
  opacity: calc(0.7 - var(--t) * 0.6);
  transform: translate3d(0, calc(var(--t) * -9vh), 0);
}

.film-opening__word {
  display: flex;
}

.film-opening__mask {
  display: inline-block;
  overflow: hidden;
  padding-top: 0.06em;
}

/* Each letter lifts at its own speed as the camera pushes in. */
.film-opening__letter {
  display: inline-block;
  transform: translate3d(0, 110%, 0);
  transition: transform 1100ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--i) * 55ms);
}

.film-opening.is-ready .film-opening__letter {
  transform: translate3d(0, calc(var(--t) * (-24vh - var(--i) * 6vh)), 0)
    rotate(calc(var(--t) * (var(--i) - 3.5) * 5deg));
  transition: transform 1100ms cubic-bezier(0.16, 1, 0.3, 1) calc(var(--i) * 55ms);
}

/* Once the letters have landed, scrolling must move them without lag. */
.film-opening.is-ready.is-settled .film-opening__letter {
  transition: none;
}

.film-opening__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem 2rem;
  margin-top: clamp(1rem, 3vh, 2rem);
}

.film-opening__sub {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 1.4rem;
  margin: 0;
}

.film-opening__sub strong {
  font-family: var(--film-heading-cn);
  font-size: clamp(1.4rem, 2.6vw, 2.4rem);
  font-weight: 700;
  color: var(--stage-fg);
}

.film-opening__sub span {
  font-size: clamp(0.85rem, 1.1vw, 1rem);
  letter-spacing: 0.08em;
  color: var(--stage-hint-strong);
}

.film-opening__hint {
  margin: 0;
}

@media (max-width: 767px) {
  .film-opening {
    padding-top: 5.5rem;
    padding-bottom: 4rem;
  }

  .film-opening__meta {
    top: 5.5rem;
    gap: 0.4rem 1rem;
  }

  .film-opening__title {
    font-size: clamp(4.2rem, 23vw, 8rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .film-opening__letter,
  .film-opening.is-ready .film-opening__letter {
    transition: none;
  }
}
</style>

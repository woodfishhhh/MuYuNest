<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import gsap from "gsap";

const emit = defineEmits<{ lift: []; done: [] }>();

const rootRef = useTemplateRef<HTMLElement>("root");
const counterRef = useTemplateRef<HTMLElement>("counter");
const wordRef = useTemplateRef<HTMLElement>("word");
let timeline: gsap.core.Timeline | null = null;

onMounted(async () => {
  const root = rootRef.value;
  if (!root) return;
  const count = { value: 0 };

  // Count while the display face loads, so the title never flashes a fallback.
  await Promise.race([document.fonts?.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);
  if (!rootRef.value) return;

  timeline = gsap
    .timeline({ onComplete: () => emit("done") })
    .from("[data-splash-letter]", { yPercent: 120, duration: 0.9, ease: "expo.out", stagger: 0.05 }, 0)
    .to(count, {
      value: 100,
      duration: 1.3,
      ease: "power2.inOut",
      onUpdate: () => {
        if (counterRef.value) counterRef.value.textContent = String(Math.round(count.value)).padStart(3, "0");
      },
    }, 0)
    .add(() => wordRef.value?.classList.add("is-glitching"), 1.2)
    .add(() => emit("lift"), 1.55)
    .to("[data-splash-half='top']", { yPercent: -100, duration: 1, ease: "expo.inOut" }, 1.55)
    .to("[data-splash-half='bottom']", { yPercent: 100, duration: 1, ease: "expo.inOut" }, 1.55)
    .to("[data-splash-content]", { opacity: 0, scale: 1.08, duration: 0.5, ease: "power2.in" }, 1.55);
});

onBeforeUnmount(() => timeline?.kill());
</script>

<template>
  <!-- Above the navigation, which lives outside the route stage's stacking context. -->
  <Teleport to="body">
  <div ref="root" class="film-splash home-film" aria-hidden="true">
    <div class="film-splash__half" data-splash-half="top" />
    <div class="film-splash__half film-splash__half--bottom" data-splash-half="bottom" />

    <div class="film-splash__content" data-splash-content>
      <p ref="word" class="film-splash__word film-display film-glitch" data-text="WOODFISH">
        <span v-for="(letter, index) in 'WOODFISH'" :key="index" class="film-splash__mask">
          <span data-splash-letter>{{ letter }}</span>
        </span>
      </p>
      <div class="film-splash__meta film-kicker">
        <span>木鱼的鱼窝 · 正在入场</span>
        <span ref="counter" class="film-splash__counter">000</span>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.film-splash {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: auto;
}

.film-splash__half {
  position: absolute;
  inset: 0 0 50%;
  background: var(--stage-bg);
}

.film-splash__half--bottom {
  inset: 50% 0 0;
}

.film-splash__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
}

.film-splash__word {
  display: flex;
  margin: 0;
  font-size: clamp(4rem, 14vw, 13rem);
  color: var(--stage-fg);
}

.film-splash__mask {
  display: inline-block;
  overflow: hidden;
}

.film-splash__mask > span {
  display: inline-block;
}

.film-splash__meta {
  display: flex;
  width: min(90vw, 40rem);
  justify-content: space-between;
}

.film-splash__counter {
  color: var(--stage-fg);
  font-variant-numeric: tabular-nums;
}
</style>

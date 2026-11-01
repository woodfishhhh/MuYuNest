<script setup lang="ts">
import { computed } from "vue";

import { useTheme } from "@/composables/useTheme";
import { getContactLinks } from "@/content/contact-links";
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  contacts: AuthorProfileData["contacts"];
}>();

// Where each contact lands around the title, in % of the stage, with a tilt.
const SPOTS = [
  { x: 16, y: 30, r: -14 },
  { x: 33, y: 20, r: 8 },
  { x: 67, y: 19, r: -6 },
  { x: 84, y: 30, r: 12 },
  { x: 14, y: 68, r: 10 },
  { x: 31, y: 78, r: -8 },
  { x: 69, y: 79, r: 6 },
  { x: 86, y: 67, r: -12 },
] as const;

const { theme } = useTheme();
const links = computed(() => {
  const color = theme.value === "day" ? "17191f" : "f6f8ff";
  return getContactLinks(props.contacts).map((link, index) => ({
    ...link,
    iconSrc: `https://api.iconify.design/${link.icon}.svg?color=%23${color}`,
    spot: SPOTS[index % SPOTS.length]!,
    at: 0.12 + index * 0.045,
  }));
});
</script>

<template>
  <div class="film-end">
    <p class="film-end__kicker film-kicker film-cue" style="--at: 0.02"><b>07</b> · 片尾</p>
    <h2 class="film-end__title film-display film-cue" style="--at: 0.04">
      <span class="film-glitch" data-glitch data-text="SEE YOU">SEE YOU</span>
    </h2>
    <p class="film-end__line film-cue" style="--at: 0.08">下次再来鱼窝坐坐</p>

    <a
      v-for="link in links"
      :key="link.id"
      class="film-end__contact film-pop"
      :href="link.href"
      target="_blank"
      rel="noopener noreferrer"
      :title="link.value ? `${link.label}：${link.value}` : link.label"
      :style="{ '--at': link.at, left: `${link.spot.x}%`, top: `${link.spot.y}%`, rotate: `${link.spot.r}deg` }"
    >
      <img :src="link.iconSrc" alt="" draggable="false" />
      <span>{{ link.value ?? link.label }}</span>
    </a>
  </div>
</template>

<style scoped>
.film-end {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.film-end__kicker {
  margin: 0;
}

.film-end__title {
  margin: 1rem 0 0;
  font-size: clamp(5.5rem, 17vw, 17rem);
  color: var(--stage-fg);
}

.film-end__line {
  margin: 1.2rem 0 0;
  font-size: clamp(1rem, 1.6vw, 1.4rem);
  letter-spacing: 0.24em;
  color: var(--stage-hint-strong);
}

.film-end__contact {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 1rem 0.6rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: color-mix(in srgb, var(--stage-bg) 70%, transparent);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--stage-fg);
  translate: -50% -50%;
  pointer-events: auto;
  transition: border-color 200ms ease, color 200ms ease;
}

.film-end__contact:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.film-end__contact img {
  width: 1.3rem;
  height: 1.3rem;
}

@media (max-width: 767px) {
  .film-end__contact span {
    display: none;
  }

  .film-end__contact {
    padding: 0.6rem;
  }
}
</style>

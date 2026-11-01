<script setup lang="ts">
import { computed } from "vue";

import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  skills: AuthorProfileData["skills"];
}>();

// Monochrome logos that vanish on the night sky unless inverted.
const NIGHT_INVERTED = new Set([
  "Drizzle ORM",
  "Express",
  "GitHub Actions",
  "Hono",
  "MCP",
  "Matter.js",
  "Nginx",
  "Next.js",
  "Prisma",
  "shadcn/ui",
  "TanStack Start",
  "Three.js",
  "Turborepo",
  "Zod",
]);
// Pop-ins spread over this much of the chapter, outer ring first.
const POP_WINDOW = 0.38;

const rings = computed(() => {
  const outerCount = Math.ceil(props.skills.length / 2);
  const total = props.skills.length;
  return [
    { id: "outer", items: props.skills.slice(0, outerCount) },
    { id: "inner", items: props.skills.slice(outerCount) },
  ].map((ring, ringIndex) => ({
    ...ring,
    items: ring.items.map((skill, slot) => ({
      skill,
      slot,
      at: 0.04 + ((ringIndex * outerCount + slot) / total) * POP_WINDOW,
      inverted: NIGHT_INVERTED.has(skill.title),
    })),
  }));
});
</script>

<template>
  <div class="film-tools">
    <header class="film-tools__head">
      <p class="film-kicker film-cue" style="--at: 0.01"><b>04</b> · 工具</p>
      <h2 class="film-tools__title film-display film-cue" style="--at: 0.03">
        <span class="film-glitch" data-glitch data-text="TOOLBOX">TOOLBOX</span>
      </h2>
      <p class="film-tools__note film-cue" style="--at: 0.06">手边的 {{ props.skills.length }} 件工具，围着它转</p>
    </header>

    <!-- Two rings orbit the geometry in opposite directions as the chapter plays. -->
    <ul
      v-for="ring in rings"
      :key="ring.id"
      class="film-tools__ring"
      :class="`film-tools__ring--${ring.id}`"
      :style="{ '--count': ring.items.length }"
    >
      <li v-for="item in ring.items" :key="item.skill.title" class="film-tools__item" :style="{ '--slot': item.slot, '--at': item.at }">
        <a :href="item.skill.officialUrl" target="_blank" rel="noopener noreferrer" :title="item.skill.title">
          <img
            v-if="item.skill.img"
            :src="item.skill.img"
            alt=""
            loading="lazy"
            draggable="false"
            :class="{ 'is-inverted': item.inverted }"
          />
          <span>{{ item.skill.title }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.film-tools {
  position: absolute;
  inset: 0;
}

.film-tools__head {
  position: absolute;
  top: clamp(6rem, 13vh, 8.5rem);
  left: var(--film-gutter);
}

.film-tools__title {
  margin: 0.8rem 0 0;
  font-size: clamp(3.4rem, 8vw, 8rem);
  color: var(--stage-fg);
}

.film-tools__note {
  margin: 0.8rem 0 0;
  letter-spacing: 0.1em;
  color: var(--stage-hint-strong);
}

.film-tools__ring {
  position: absolute;
  top: 56%;
  left: 50%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.film-tools__ring--outer {
  --rx: min(43vw, 46rem);
  --ry: 30vh;
  --spin: 150deg;
}

.film-tools__ring--inner {
  --rx: min(31vw, 32rem);
  --ry: 21vh;
  --spin: -120deg;
}

/* Position on an ellipse; the near (lower) half reads larger and brighter. */
.film-tools__item {
  --a: calc(var(--slot) * 1turn / var(--count) + var(--t) * var(--spin));
  --near: calc((sin(var(--a)) + 1) / 2);
  --k: clamp(0, (var(--t) - var(--at)) / 0.08, 1);
  --pop: calc(var(--k) + sin(calc(var(--k) * 3.14159rad)) * 0.4);
  position: absolute;
  top: 0;
  left: 0;
  opacity: calc(var(--k) * (0.32 + var(--near) * 0.68));
  transform: translate(-50%, -50%) translate(calc(cos(var(--a)) * var(--rx)), calc(sin(var(--a)) * var(--ry)))
    scale(calc((0.72 + var(--near) * 0.4) * var(--pop)));
  white-space: nowrap;
}

.film-tools__item a {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono);
  font-size: clamp(0.7rem, 0.9vw, 0.85rem);
  letter-spacing: 0.04em;
  color: var(--stage-fg);
  pointer-events: auto;
}

.film-tools__item a:hover span {
  color: var(--accent);
}

.film-tools__item img {
  width: 1.3em;
  height: 1.3em;
  object-fit: contain;
}

:root[data-theme="night"] .film-tools__item img.is-inverted {
  filter: invert(1) brightness(1.1);
}

@media (max-width: 767px) {
  .film-tools__ring--outer {
    --rx: 44vw;
    --ry: 25vh;
  }

  .film-tools__ring--inner {
    --rx: 28vw;
    --ry: 13vh;
  }

  .film-tools__item span {
    display: none;
  }

  .film-tools__item img {
    width: 1.6rem;
    height: 1.6rem;
  }
}
</style>

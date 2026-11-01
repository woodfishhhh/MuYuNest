<script setup lang="ts">
import { computed } from "vue";

import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  poem: AuthorProfileData["poem"];
}>();

// Each column inks in from the top, one after another.
const FIRST_LINE_AT = 0.16;
const LINE_STEP = 0.13;

const subject = computed(() => props.poem.title.split("·").at(-1)?.trim().charAt(0) || props.poem.title.charAt(0));
</script>

<template>
  <div class="film-poem">
    <span class="film-poem__ghost film-outline" aria-hidden="true">{{ subject }}</span>
    <p class="film-poem__kicker film-kicker film-cue" style="--at: 0.02"><b>05</b> · 诗</p>

    <div class="film-poem__page">
      <h2 class="film-poem__title film-poem__ink" style="--at: 0.04">{{ props.poem.title }}</h2>
      <p
        v-for="(line, index) in props.poem.lines"
        :key="line"
        class="film-poem__line film-poem__ink"
        :style="{ '--at': FIRST_LINE_AT + index * LINE_STEP }"
      >
        {{ line }}
      </p>
      <p class="film-poem__byline film-cue" :style="{ '--at': FIRST_LINE_AT + props.poem.lines.length * LINE_STEP }">
        {{ props.poem.author }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.film-poem {
  position: absolute;
  inset: 0;
}

/* The subject character climbs slowly behind the page. */
.film-poem__ghost {
  position: absolute;
  right: 4vw;
  bottom: -12vh;
  font-family: var(--film-heading-cn);
  font-size: clamp(18rem, 58vh, 42rem);
  font-weight: 800;
  line-height: 1;
  color: var(--stage-hint);
  opacity: 0.18;
  transform: translate3d(0, calc(var(--t) * -24vh), 0);
}

.film-poem__kicker {
  position: absolute;
  top: clamp(6rem, 13vh, 8.5rem);
  right: var(--film-gutter);
  margin: 0;
}

.film-poem__page {
  position: absolute;
  top: 50%;
  right: calc(var(--film-gutter) + 4vw);
  display: block;
  height: min(30rem, 62vh);
  transform: translateY(-46%);
  writing-mode: vertical-rl;
}

.film-poem__page > * + * {
  margin-block-start: clamp(1rem, 2.6vw, 2.4rem);
}

/* Ink runs down the column as the playhead passes. */
.film-poem__ink {
  --k: clamp(0, (var(--t) - var(--at)) / 0.12, 1);
  clip-path: inset(0 0 calc((1 - var(--k)) * 100%) 0);
}

.film-poem__title {
  margin: 0;
  font-family: var(--film-heading-cn);
  font-size: clamp(2.4rem, 6vh, 4.2rem);
  font-weight: 800;
  letter-spacing: 0.2em;
  color: var(--stage-fg);
}

.film-poem__line {
  margin: 0;
  padding-top: 3em;
  font-size: clamp(1.15rem, 2.8vh, 1.7rem);
  line-height: 1.9;
  letter-spacing: 0.3em;
  white-space: nowrap;
  color: var(--stage-hint-strong);
}

.film-poem__line:nth-of-type(odd) {
  padding-top: 4.4em;
}

.film-poem__byline {
  margin: 0;
  align-self: flex-end;
  padding-top: 14em;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.4em;
  color: var(--accent);
}

@media (max-width: 767px) {
  .film-poem__page {
    top: auto;
    right: 50%;
    bottom: 6vh;
    height: 44vh;
    transform: translateX(50%);
  }

  .film-poem__line,
  .film-poem__line:nth-of-type(odd) {
    padding-top: 1.6em;
    font-size: 1.05rem;
  }

  .film-poem__byline {
    padding-top: 8em;
  }
}
</style>

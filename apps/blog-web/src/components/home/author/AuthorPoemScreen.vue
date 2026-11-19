<script setup lang="ts">
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  poem: AuthorProfileData["poem"];
}>();
</script>

<template>
  <section class="author-screen" data-author-screen data-testid="author-screen-poem">
    <div class="author-screen__shell">
      <article class="author-screen__panel author-screen__panel--poster author-screen__panel--poem">
        <!-- Decorative ambient layers -->
        <div aria-hidden="true" class="author-poem__bg-glow author-poem__bg-glow--warm"></div>
        <div aria-hidden="true" class="author-poem__bg-glow author-poem__bg-glow--cool"></div>

        <!-- Large watermark character -->
        <span aria-hidden="true" class="author-poem__watermark">勤</span>

        <!-- Header: title fills the space -->
        <header class="author-poem__header" data-author-reveal>
          <h2 class="author-poem__title">{{ props.poem.title }}</h2>
          <p class="author-poem__byline">— {{ props.poem.author }}</p>
        </header>

        <!-- Poem body: generous vertical rhythm -->
        <div class="author-poem__body">
          <p
            v-for="line in props.poem.lines"
            :key="line"
            class="author-poem__line"
            data-author-reveal
          >
            {{ line }}
          </p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.author-screen__panel--poem {
  position: relative;
  justify-content: flex-end;
  gap: 0;
  overflow: hidden;
}

/* Atmospheric glow orbs */
.author-poem__bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  pointer-events: none;
}

.author-poem__bg-glow--warm {
  top: -8%;
  right: -6%;
  width: 52%;
  height: 42%;
  background: radial-gradient(circle, rgba(255, 220, 90, 0.14), transparent 70%);
}

.author-poem__bg-glow--cool {
  bottom: 18%;
  left: -4%;
  width: 44%;
  height: 40%;
  background: radial-gradient(circle, rgba(135, 183, 255, 0.18), transparent 70%);
}

/* Full-height background character */
.author-poem__watermark {
  position: absolute;
  right: -0.08em;
  top: -0.06em;
  z-index: 0;
  font-size: clamp(14rem, 28vw, 26rem);
  line-height: 1;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.028);
  user-select: none;
  pointer-events: none;
  letter-spacing: -0.02em;
}

/* Title: large architectural type */
.author-poem__header {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-bottom: 2rem;
}

.author-poem__title {
  margin: 0;
  font-size: clamp(4.4rem, 8.5vw, 8.8rem);
  line-height: 0.86;
  letter-spacing: -0.02em;
  color: var(--stage-fg);
  max-width: 14ch;
}

.author-poem__byline {
  margin: 1.4rem 0 0;
  font-size: 0.8rem;
  letter-spacing: 0.36em;
  text-transform: uppercase;
  color: var(--stage-hint);
}

/* Poem lines: right-aligned, generous spacing */
.author-poem__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  align-self: flex-end;
  max-width: 32rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-subtle);
}

.author-poem__line {
  margin: 0;
  font-size: clamp(1.18rem, 1.6vw, 1.52rem);
  line-height: 1.85;
  color: var(--stage-hint-strong);
  text-align: right;
}

@media (max-width: 767px) {
  .author-poem__watermark {
    font-size: 10rem;
    right: -0.1em;
    top: 0.2em;
  }

  .author-poem__title {
    font-size: 3.4rem;
  }

  .author-poem__header {
    padding-bottom: 1.4rem;
  }

  .author-poem__body {
    gap: 1.1rem;
    max-width: 100%;
  }

  .author-poem__line {
    font-size: 1.1rem;
    text-align: left;
  }
}

:root[data-theme="day"] .author-poem__watermark {
  color: rgba(23, 25, 31, 0.04);
}

@media (prefers-reduced-motion: reduce) {
  .author-poem__bg-glow {
    display: none;
  }
}
</style>

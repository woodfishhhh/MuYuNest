<script setup lang="ts">
import AuthorContactLinks from "@/components/home/author/AuthorContactLinks.vue";
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  author: AuthorProfileData;
}>();
</script>

<template>
  <section class="author-screen" data-author-screen data-testid="author-screen-hero">
    <div class="author-screen__shell">
      <article class="author-screen__panel author-screen__panel--poster author-screen__panel--hero">
        <!-- Cover: full-bleed image with name/title overlaid -->
        <div class="author-hero__cover" data-author-reveal>
          <img
            :alt="props.author.name"
            :src="props.author.heroImage"
            class="author-hero__cover-img"
            draggable="false"
          />
          <div aria-hidden="true" class="author-hero__cover-shade"></div>
          <div class="author-hero__cover-id">
            <h2 class="author-hero__name">{{ props.author.name }}</h2>
            <p class="author-hero__role">{{ props.author.title }}</p>
          </div>
        </div>

        <!-- Footer strip: stats + contact links -->
        <footer class="author-hero__footer">
          <dl class="author-hero__stats" data-author-reveal>
            <div class="author-hero__stat">
              <dt>Articles</dt>
              <dd>{{ props.author.postsCount }}</dd>
            </div>
            <div class="author-hero__stat">
              <dt>Tags</dt>
              <dd>{{ props.author.tagsCount }}</dd>
            </div>
            <div class="author-hero__stat">
              <dt>Categories</dt>
              <dd>{{ props.author.categoriesCount }}</dd>
            </div>
          </dl>
          <div data-author-reveal>
            <AuthorContactLinks :contacts="props.author.contacts" />
          </div>
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
/* Cover fills the flex-1 area */
.author-hero__cover {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
}

/* Subtle ambient glow behind image */
.author-hero__cover::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 22% 12%, rgba(135, 183, 255, 0.22), transparent 44%),
    radial-gradient(ellipse at 80% 20%, rgba(255, 228, 107, 0.16), transparent 38%);
  pointer-events: none;
}

.author-hero__cover-img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}

/* Gradient overlay: transparent at top, deep at bottom */
.author-hero__cover-shade {
  position: absolute;
  inset: 0;
  z-index: 2;
  background:
    linear-gradient(
      180deg,
      rgba(5, 5, 16, 0.04) 0%,
      transparent 28%,
      rgba(5, 5, 16, 0.72) 68%,
      rgba(5, 5, 16, 0.96) 100%
    ),
    linear-gradient(90deg, rgba(5, 5, 16, 0.18), transparent 50%);
  pointer-events: none;
}

/* Name + role overlaid at the bottom of the cover */
.author-hero__cover-id {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 3;
  padding: clamp(1.2rem, 1.8vw, 2rem) clamp(1.4rem, 2.7vw, 3rem);
}

.author-hero__name {
  margin: 0;
  font-family: "Iowan Old Style", Baskerville, "Palatino Linotype", Palatino, serif;
  font-size: clamp(3.6rem, 6.5vw, 6.4rem);
  font-style: italic;
  font-weight: 400;
  font-kerning: normal;
  font-optical-sizing: auto;
  line-height: 0.84;
  letter-spacing: -0.055em;
  color: #f6f8ff;
  text-shadow: 0 0.18em 0.55em rgba(0, 0, 0, 0.32);
}

.author-hero__role {
  margin: 0.85rem 0 0;
  max-width: 38rem;
  font-size: clamp(0.82rem, 1.05vw, 1rem);
  line-height: 1.7;
  color: rgba(233, 239, 255, 0.72);
}

/* Footer: stats in a row, contacts on the right */
.author-hero__footer {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.2rem;
  padding: clamp(0.9rem, 1.4vw, 1.4rem) clamp(1.4rem, 2.7vw, 3rem);
  border-top: 1px solid var(--border-subtle);
}

.author-hero__stats {
  display: flex;
  gap: clamp(1.2rem, 2vw, 2.4rem);
  margin: 0;
  flex-wrap: wrap;
}

.author-hero__stat dt {
  font-size: 0.66rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--stage-hint);
}

.author-hero__stat dd {
  margin: 0.55rem 0 0;
  font-size: clamp(1.8rem, 2.8vw, 2.6rem);
  line-height: 1;
  color: var(--stage-fg);
}

@media (max-width: 767px) {
  .author-hero__cover-shade {
    background: linear-gradient(
      180deg,
      rgba(5, 5, 16, 0.08) 0%,
      transparent 24%,
      rgba(5, 5, 16, 0.82) 64%,
      rgba(5, 5, 16, 0.98) 100%
    );
  }

  .author-hero__footer {
    flex-direction: column;
    gap: 0.9rem;
  }

  .author-hero__stats {
    gap: 1rem;
  }

  .author-hero__stat dd {
    font-size: 1.7rem;
  }
}

:root[data-theme="day"] .author-hero__cover-shade {
  background: linear-gradient(
    180deg,
    rgba(247, 243, 234, 0.06) 0%,
    transparent 26%,
    rgba(247, 243, 234, 0.74) 68%,
    rgba(247, 243, 234, 0.97) 100%
  );
}

:root[data-theme="day"] .author-hero__name {
  color: #17191f;
  text-shadow: 0 0.16em 0.5em rgba(255, 255, 255, 0.42);
}

:root[data-theme="day"] .author-hero__role {
  color: rgba(23, 25, 31, 0.72);
}

@media (prefers-reduced-motion: reduce) {
  .author-hero__cover-img {
    transition: none;
  }
}
</style>

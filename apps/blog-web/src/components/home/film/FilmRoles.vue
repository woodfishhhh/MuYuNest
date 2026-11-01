<script setup lang="ts">
export interface FilmRole {
  title: string;
  english: string;
  line: string;
  link?: { href: string; label: string };
}

const props = defineProps<{
  roles: FilmRole[];
}>();
</script>

<template>
  <div class="film-roles">
    <!-- Vertical scroll slides the reel sideways; numbers and labels drift at other speeds. -->
    <div class="film-roles__reel" :style="{ '--count': props.roles.length }">
      <div class="film-roles__panel film-roles__panel--intro">
        <p class="film-kicker"><b>02</b> · 身份</p>
        <h2 class="film-roles__intro film-display">
          <span class="film-glitch" data-glitch data-text="I'M A">I'M A</span>
        </h2>
        <p class="film-roles__intro-note">一个人，{{ props.roles.length }} 件在做的事 →</p>
      </div>

      <article v-for="(role, index) in props.roles" :key="role.title" class="film-roles__panel">
        <span class="film-roles__number film-display film-outline" aria-hidden="true">0{{ index + 1 }}</span>
        <div class="film-roles__copy">
          <span v-if="role.english.toLowerCase() !== role.title.toLowerCase()" class="film-roles__english film-display">
            {{ role.english }}
          </span>
          <h3 class="film-roles__title">{{ role.title }}</h3>
          <p class="film-roles__line">{{ role.line }}</p>
          <a
            v-if="role.link"
            class="film-roles__link"
            :href="role.link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ role.link.label }} ↗
          </a>
        </div>
      </article>
    </div>

    <div class="film-roles__rail" aria-hidden="true">
      <span />
    </div>
  </div>
</template>

<style scoped>
.film-roles {
  --intro-width: 72vw;
  --panel-width: 86vw;
  position: absolute;
  inset: 0;
}

.film-roles__reel {
  --travel: calc(var(--intro-width) + var(--panel-width) * var(--count) - 100vw);
  position: absolute;
  inset: 0 auto 0 0;
  display: flex;
  height: 100%;
  transform: translate3d(calc(var(--t) * var(--travel) * -1), 0, 0);
}

.film-roles__panel {
  position: relative;
  display: flex;
  flex: none;
  width: var(--panel-width);
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 var(--film-gutter) clamp(4.5rem, 13vh, 8rem);
}

.film-roles__panel--intro {
  width: var(--intro-width);
  justify-content: center;
  gap: 1.4rem;
}

.film-roles__intro {
  margin: 0;
  font-size: clamp(6rem, 22vw, 22rem);
  color: var(--stage-fg);
}

.film-roles__intro-note {
  margin: 0;
  font-size: clamp(1rem, 1.5vw, 1.3rem);
  letter-spacing: 0.12em;
  color: var(--stage-hint-strong);
}

/* Slower layer: the big numeral lags behind its panel. */
.film-roles__number {
  position: absolute;
  top: clamp(5.5rem, 14vh, 9rem);
  left: var(--film-gutter);
  font-size: clamp(8rem, 26vw, 26rem);
  color: var(--stage-hint);
  opacity: 0.55;
  transform: translate3d(calc(var(--t) * 34vw), 0, 0);
}

.film-roles__copy {
  position: relative;
  max-width: 46rem;
}

/* Faster layer: the English label runs ahead. */
.film-roles__english {
  display: block;
  font-size: clamp(1.4rem, 2.6vw, 2.6rem);
  color: var(--accent);
  transform: translate3d(calc(var(--t) * -12vw), 0, 0);
}

.film-roles__title {
  margin: 0.6rem 0 0;
  font-family: var(--film-heading-cn);
  font-size: clamp(3rem, 8.4vw, 8.6rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--stage-fg);
}

.film-roles__line {
  max-width: 34rem;
  margin: 1.2rem 0 0;
  font-size: clamp(1rem, 1.4vw, 1.25rem);
  line-height: 1.8;
  color: var(--stage-hint-strong);
}

.film-roles__link {
  display: inline-block;
  margin-top: 1rem;
  border-bottom: 1px solid var(--accent);
  color: var(--accent);
  letter-spacing: 0.08em;
  pointer-events: auto;
}

.film-roles__rail {
  position: absolute;
  right: var(--film-gutter);
  bottom: clamp(2rem, 6vh, 3.5rem);
  left: var(--film-gutter);
  height: 1px;
  background: var(--border-subtle);
}

.film-roles__rail span {
  position: absolute;
  inset: 0;
  background: var(--accent);
  transform: scaleX(var(--t));
  transform-origin: 0 50%;
}

@media (max-width: 767px) {
  .film-roles {
    --intro-width: 100vw;
    --panel-width: 100vw;
  }

  .film-roles__panel {
    padding-bottom: 5rem;
  }

  .film-roles__number {
    top: auto;
    bottom: 46vh;
  }
}
</style>

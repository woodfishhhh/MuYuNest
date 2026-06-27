<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";

import { useMatterCapsules } from "@/composables/useMatterCapsules";
import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  active: boolean;
  skills: AuthorProfileData["skills"];
}>();

const sceneRef = useTemplateRef<HTMLElement>("scene");
const skillsRef = shallowRef(props.skills);
const activeRef = computed(() => props.active);

const { activateSkill } = useMatterCapsules({
  active: activeRef,
  sceneRef,
  skills: skillsRef,
});
</script>

<template>
  <section
    class="author-screen author-screen--fullbleed"
    data-author-screen
    data-testid="author-screen-capsules"
  >
    <div class="author-screen__shell">
      <article
        class="author-screen__panel author-screen__panel--poster author-screen__panel--capsules"
      >
        <div ref="scene" class="author-capsules__field" data-author-reveal>
          <div class="author-capsules__watermark" aria-hidden="true">
            <div class="watermark-outline">TECH STACK</div>
            <div class="watermark-cn">技术栈</div>
          </div>

          <div
            class="author-capsule author-capsule--dropzone"
            data-author-dropzone
            aria-label="这是什么?"
          >
            <span class="author-capsule__label">这是什么?</span>
          </div>

          <button
            v-for="(skill, index) in props.skills"
            :key="skill.title"
            :aria-label="skill.title"
            class="author-capsule"
            data-author-capsule
            type="button"
            @click="activateSkill(index)"
          >
            <img
              v-if="skill.img"
              :alt="skill.title"
              :src="skill.img"
              draggable="false"
              class="author-capsule__icon"
            />
            <span class="author-capsule__label">{{ skill.title }}</span>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.author-screen__panel--capsules {
  justify-content: stretch;
  padding: 0 !important;
  /* Subtle scene-level atmosphere */
  background: var(--author-capsule-scene-bg);
}

.author-capsules__field {
  position: relative;
  overflow: hidden;
  width: 100%;
  flex: 1;
  min-height: 0;
  /* Reserve space for SiteNav and avoid overlap with content */
  padding-top: env(safe-area-inset-top, 0px);
  cursor: grab;
}

.author-capsules__field::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 22%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03), transparent 42%);
  pointer-events: none;
}

.author-capsules__watermark {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 0;
  user-select: none;
  width: 100%;
}

.watermark-outline {
  font-size: clamp(2.5rem, 6vw, 6rem);
  font-weight: 900;
  color: transparent;
  -webkit-text-stroke: 1px var(--author-capsule-border);
  letter-spacing: 0.1em;
  opacity: 0.5;
}

.watermark-cn {
  font-size: clamp(4rem, 11vw, 11rem);
  font-weight: 900;
  color: var(--author-capsule-text);
  line-height: 1;
  margin-top: -0.25em;
  opacity: 0.04;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.author-capsule {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px solid var(--author-capsule-border);
  background: var(--author-capsule-bg);
  box-shadow: var(--author-capsule-shadow);
  backdrop-filter: blur(10px);
  color: var(--stage-fg);
  cursor: grab;
  user-select: none;
  touch-action: none;
  will-change: transform;
  z-index: 1;
  transition: box-shadow 0.15s ease;
}

.author-capsule:hover {
  box-shadow:
    var(--author-capsule-shadow),
    inset 0 0 0 2px var(--author-capsule-hover-ring);
  border-color: var(--author-capsule-hover-border);
}

.author-capsule.is-snap-preview,
.author-capsule--dropzone.is-snap-active {
  box-shadow:
    var(--author-capsule-shadow),
    inset 0 0 0 2px var(--author-capsule-hover-ring);
  border-color: var(--author-capsule-hover-border);
}

.author-capsule:active {
  cursor: grabbing;
}

.author-capsule {
  display: inline-flex;
  align-items: center;
  gap: 0.72rem;
  min-width: 7rem;
  padding: 0.84rem 1.18rem;
  border-radius: 999px;
}

.author-capsule__icon {
  width: 1.2rem;
  height: 1.2rem;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.author-capsule__label {
  font-size: 0.9rem;
  line-height: 1;
  white-space: nowrap;
  color: var(--author-capsule-text);
  pointer-events: none;
}

.author-capsule--dropzone {
  top: clamp(5.8rem, 13vh, 7.6rem);
  right: clamp(1rem, 3vw, 2rem);
  left: auto;
  width: fit-content;
  min-width: 0;
  justify-content: center;
  gap: 0;
  opacity: 0;
  visibility: hidden;
  transform: translate(
      var(--dropzone-magnet-x, 0px),
      calc(6px + var(--dropzone-magnet-y, 0px))
    )
    scale(var(--dropzone-magnet-scale, 0.96));
  pointer-events: none;
  z-index: 0;
  cursor: default;
  transition:
    opacity 0.16s ease,
    visibility 0s linear 0.16s,
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.author-capsule--dropzone.is-dropzone-visible {
  opacity: 1;
  visibility: visible;
  transform: translate(var(--dropzone-magnet-x, 0px), var(--dropzone-magnet-y, 0px))
    scale(var(--dropzone-magnet-scale, 1));
  transition-delay: 0s;
}

.author-capsule--dropzone.is-dropzone-visible.is-snap-active {
  transform: translate(var(--dropzone-magnet-x, 0px), var(--dropzone-magnet-y, 0px))
    scale(var(--dropzone-magnet-scale, 1.02));
}

.author-capsule--dropzone.is-dropzone-visible.is-snap-locked {
  transform: translate(var(--dropzone-magnet-x, 0px), var(--dropzone-magnet-y, 0px))
    scale(var(--dropzone-magnet-scale, 1.04));
}

@media (max-width: 767px) {
  .author-capsule {
    min-width: 3.6rem;
    padding: 0.36rem 0.46rem;
    gap: 0.36rem;
  }

  .author-capsule__label {
    font-size: 0.5rem;
  }

  .author-capsule__icon {
    width: 1.6rem;
    height: 1.6rem;
  }

  .author-capsule--dropzone {
    top: clamp(4.6rem, 9vh, 6rem);
    right: 0.9rem;
  }
}
</style>

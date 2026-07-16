<script setup lang="ts">
import type { WorkProjectData } from "@/types/content";

defineProps<{
  work: WorkProjectData;
  compact?: boolean;
}>();
</script>

<template>
  <div class="work-actions" :class="{ 'work-actions--compact': compact }">
    <a
      :href="work.liveUrl"
      :aria-label="`进入 ${work.name} 网站`"
      class="work-actions__link work-actions__link--live"
      data-kind="live"
      rel="noreferrer noopener"
      target="_blank"
    >
      <span class="work-actions__label">Website:</span>
      <span class="work-actions__value">进入项目</span>
    </a>
    <a
      :href="work.githubUrl"
      :aria-label="`查看 ${work.name} GitHub 仓库`"
      class="work-actions__link work-actions__link--github"
      data-kind="github"
      rel="noreferrer noopener"
      target="_blank"
    >
      <span class="work-actions__label">Source:</span>
      <span class="work-actions__value">
        <svg
          aria-hidden="true"
          class="work-actions__github-icon"
          data-testid="github-icon"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.72-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.08 1.84 2.82 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.91 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.54.12-3.21 0 0 1.01-.32 3.3 1.23a11.48 11.48 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.67.24 2.9.12 3.21.77.84 1.24 1.91 1.24 3.22 0 4.59-2.8 5.61-5.48 5.91.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.58A12 12 0 0 0 12 .5Z"
          />
        </svg>
        GitHub
      </span>
    </a>
  </div>
</template>

<style scoped>
.work-actions {
  display: grid;
  margin-top: auto;
  gap: 0.5rem;
  padding-top: 1rem;
}

.work-actions--compact {
  padding-top: 0.75rem;
}

.work-actions__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 1.35rem;
  color: var(--works-card-fg, white);
  font-size: 0.78rem;
  letter-spacing: 0;
  line-height: 1.25;
  text-decoration: none;
  transition:
    opacity 150ms ease,
    text-shadow 150ms ease;
}

.work-actions__link:hover {
  opacity: 0.78;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
}

.work-actions__link:focus-visible {
  border-radius: 3px;
  outline: 2px solid white;
  outline-offset: 3px;
}

.work-actions__label {
  color: var(--works-card-muted, rgba(255, 255, 255, 0.92));
}

.work-actions__value {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.4rem;
  color: var(--works-card-fg, white);
  text-align: right;
}

.work-actions__github-icon {
  width: 0.9rem;
  height: 0.9rem;
  flex: none;
}

</style>

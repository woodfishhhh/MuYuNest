<script setup lang="ts">
import { computed } from "vue";

import type { AuthorProfileData } from "@/types/content";

const props = defineProps<{
  author: AuthorProfileData;
}>();

const identityItems = computed(() => [
  {
    label: "位置",
    value: props.author.oneself.location,
  },
  {
    label: "出生",
    value: props.author.oneself.birthDate,
  },
  {
    label: "学校",
    value: props.author.oneself.university,
  },
  {
    label: "专业",
    value: props.author.oneself.major,
  },
]);

const universityProgress = computed(() => {
  const start = new Date(props.author.tenyear.start).getTime();
  const end = new Date(props.author.tenyear.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  const now = Date.now();
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
});

const universityProgressLabel = computed(() => `${universityProgress.value.toFixed(1)}%`);

const timeHour = new Date().getHours();
const greeting = computed(() => {
  if (timeHour < 6) return "夜深了 🌙，注意休息";
  if (timeHour < 12) return "早上好 ☀️，元气满满";
  if (timeHour < 14) return "中午好 ☀️，记得午休";
  if (timeHour < 18) return "下午好 ☕，喝杯咖啡";
  if (timeHour < 22) return "晚上好 🌆，放松一下";
  return "夜深了 🌙，早点休息";
});
</script>

<template>
  <section class="author-screen" data-author-screen data-testid="author-screen-about">
    <div class="author-screen__shell">
      <article class="author-screen__panel author-screen__panel--about">
        <div class="author-section-kicker" data-author-reveal>About Me</div>

        <div class="author-about__layout">
          <div class="author-about__identity">
            <div data-author-reveal>
              <h2 class="author-about__greeting">{{ greeting }}</h2>
            </div>

            <dl class="author-about__grid">
              <div
                v-for="item in identityItems"
                :key="item.label"
                class="author-about__item"
                data-author-reveal
              >
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>

            <section class="author-about__progress" data-author-reveal>
              <div class="author-about__progress-head">
                <div>
                  <p class="author-about__progress-kicker">
                    {{ props.author.tenyear.title }}
                  </p>
                  <p class="author-about__progress-copy">
                    {{ props.author.tenyear.text }}
                  </p>
                </div>
                <strong>{{ universityProgressLabel }}</strong>
              </div>
              <div
                aria-label="大学阶段进度"
                class="author-about__progress-track"
                role="meter"
                :aria-valuenow="Number(universityProgress.toFixed(1))"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span :style="{ width: universityProgressLabel }"></span>
              </div>
              <div class="author-about__progress-dates">
                <span>{{ props.author.tenyear.start }}</span>
                <span>{{ props.author.tenyear.end }}</span>
              </div>
            </section>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.author-screen__panel--about {
  justify-content: center;
}

.author-about__layout {
  display: block;
}

.author-about__identity {
  min-width: 0;
}

.author-about__progress-kicker {
  margin: 0 0 0.7rem;
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--stage-hint);
}

.author-about__greeting {
  margin: 0;
  font-size: 2.8rem;
  line-height: 1.1;
  font-weight: 700;
  color: var(--stage-fg);
}

.author-about__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.2rem;
  margin: 2rem 0 0;
}

.author-about__item {
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.author-about__item dt {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: var(--stage-hint);
}

.author-about__item dd {
  margin: 0.68rem 0 0;
  font-size: 1.55rem;
  line-height: 1.24;
  color: var(--stage-fg);
}

.author-about__progress {
  margin-top: 2rem;
  border-top: 1px solid var(--border-subtle);
  padding-top: 1.25rem;
}

.author-about__progress-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.author-about__progress-copy {
  margin: 0;
  color: var(--stage-hint-strong);
}

.author-about__progress-head strong {
  font-size: 2rem;
  line-height: 1;
  color: var(--stage-fg);
}

.author-about__progress-track {
  overflow: hidden;
  height: 0.55rem;
  margin-top: 1rem;
  background: rgba(255, 255, 255, 0.08);
}

.author-about__progress-track span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #87b7ff, #ffe796);
  box-shadow: 0 0 22px rgba(135, 183, 255, 0.36);
}

.author-about__progress-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 0.72rem;
  font-size: 0.78rem;
  color: var(--stage-hint);
}

@media (max-width: 767px) {
  .author-screen__panel--about {
    overflow-y: auto;
    max-height: 100%;
  }

  .author-about__layout {
    display: block;
  }

  .author-about__name {
    font-size: 3rem;
  }

  .author-about__greeting {
    font-size: 1.7rem;
  }

  .author-about__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem 0.8rem;
    margin-top: 1rem;
  }

  .author-about__item {
    padding-top: 0.6rem;
  }

  .author-about__item dd {
    font-size: 1.1rem;
    margin-top: 0.4rem;
  }

  .author-about__progress {
    margin-top: 1.2rem;
    padding-top: 0.8rem;
  }

  .author-about__progress-head strong {
    font-size: 1.4rem;
  }
}
</style>

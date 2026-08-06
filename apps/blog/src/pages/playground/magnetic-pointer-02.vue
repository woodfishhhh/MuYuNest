<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { useTheme } from "@/composables/useTheme";
import {
  applyMagneticPointerStyle,
  initializeMagneticPointerStyle,
  type MagneticPointerStyle,
} from "@/utils/magnetic-pointer";
import { getRouteLocationForSiteMode } from "@/utils/site-mode";

definePageMeta({ name: "magnetic-pointer-playground-02" });

useHead({ title: "Corner Pointer Studies | Woodfish" });

const studies = [
  {
    code: "01",
    detail: "原始比例 / 柔和蓝光",
    id: "corners",
    name: "基准四角",
  },
  {
    code: "01A",
    detail: "一像素线 / 无外发光",
    id: "corners-hairline",
    name: "极细角标",
  },
  {
    code: "01B",
    detail: "四边刻度 / 空心圆点",
    id: "corners-axis",
    name: "坐标刻度",
  },
  {
    code: "01C",
    detail: "高对比角 / 蓝色焦点",
    id: "corners-contrast",
    name: "信号切角",
  },
] as const satisfies readonly {
  code: string;
  detail: string;
  id: MagneticPointerStyle;
  name: string;
}[];

type CornerStudy = (typeof studies)[number];

const activeStyle = ref<CornerStudy["id"]>("corners");
const activeStudy = computed(
  () => studies.find((study) => study.id === activeStyle.value) ?? studies[0],
);
const { theme, toggleThemeAt } = useTheme();

function selectStudy(study: CornerStudy) {
  activeStyle.value = study.id;
  applyMagneticPointerStyle(study.id);
}

function handleToggleTheme(payload: { x: number; y: number }) {
  toggleThemeAt(payload.x, payload.y);
}

onMounted(() => {
  const storedStyle = initializeMagneticPointerStyle();
  const storedStudy = studies.find((study) => study.id === storedStyle);
  if (storedStudy) {
    activeStyle.value = storedStudy.id;
    return;
  }
  applyMagneticPointerStyle(activeStyle.value);
});
</script>

<template>
  <main class="corner-lab" data-testid="magnetic-pointer-playground-02">
    <header class="corner-lab__header">
      <RouterLink :to="getRouteLocationForSiteMode('home')" class="corner-lab__brand">
        WOODFISH
      </RouterLink>
      <span class="corner-lab__edition">POINTER LAB / 02</span>
      <nav aria-label="Playground navigation" class="corner-lab__nav">
        <RouterLink to="/playground/magnetic-pointer">LAB 01</RouterLink>
        <RouterLink :to="getRouteLocationForSiteMode('works')">WORKS</RouterLink>
        <ThemeToggle :theme="theme" @toggle-theme="handleToggleTheme" />
      </nav>
    </header>

    <div class="corner-lab__workbench">
      <aside class="corner-lab__rail">
        <div class="corner-lab__title">
          <span>CORNER SYSTEM</span>
          <h1>四角锁定变体</h1>
          <p>{{ activeStudy.code }} / {{ activeStudy.name }}</p>
        </div>

        <div aria-label="四角光标样式" class="corner-lab__studies" role="radiogroup">
          <button
            v-for="study in studies"
            :key="study.id"
            :aria-checked="activeStyle === study.id"
            class="corner-study"
            :class="{ 'corner-study--active': activeStyle === study.id }"
            :data-magnetic-pointer="`corner-study-${study.id}`"
            role="radio"
            type="button"
            @click="selectStudy(study)"
          >
            <span class="corner-study__code">{{ study.code }}</span>
            <span class="corner-study__copy">
              <strong>{{ study.name }}</strong>
              <small>{{ study.detail }}</small>
            </span>
            <span aria-hidden="true" class="corner-study__mark" :data-variant="study.id">
              <i></i>
            </span>
          </button>
        </div>
      </aside>

      <section class="corner-stage" aria-label="四角光标实时预览">
        <div class="corner-stage__meta">
          <span>LIVE / {{ activeStudy.code }}</span>
          <span>{{ activeStudy.detail }}</span>
        </div>

        <article class="corner-stage__feature">
          <div class="corner-stage__index">01</div>
          <div class="corner-stage__feature-copy">
            <p>WEBGL / INTERACTIVE</p>
            <h2>Liquid Orbit</h2>
            <span>折射玻璃、空间轨道与克制的蓝色信号。</span>
          </div>
          <div class="corner-stage__actions">
            <a href="#study-live" data-magnetic-pointer="study-live" @click.prevent>
              进入项目
            </a>
            <a href="#study-source" data-magnetic-pointer="study-source" @click.prevent>
              GitHub
            </a>
          </div>
        </article>

        <div class="corner-stage__grid">
          <article>
            <span>02 / SYSTEM</span>
            <strong>Scene Signals</strong>
            <button data-magnetic-pointer="study-scene" type="button">VIEW CASE</button>
          </article>
          <article>
            <span>03 / MOTION</span>
            <strong>Pointer Field</strong>
            <button data-magnetic-pointer="study-motion" type="button">OPEN NOTE</button>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.corner-lab {
  min-height: 100dvh;
  overflow-x: hidden;
  background:
    linear-gradient(color-mix(in srgb, var(--stage-fg) 3%, transparent) 1px, transparent 1px)
      0 0 / 40px 40px,
    var(--stage-bg);
  color: var(--stage-fg);
  pointer-events: auto;
}

.corner-lab__header {
  display: grid;
  min-height: 4.75rem;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
  padding-inline: clamp(1rem, 3vw, 3rem);
  grid-template-columns: auto 1fr auto;
  gap: 1.25rem;
}

.corner-lab__brand,
.corner-lab__nav a {
  color: var(--stage-fg);
  text-decoration: none;
}

.corner-lab__brand {
  font-size: 1rem;
  font-weight: 760;
}

.corner-lab__edition,
.corner-lab__title > span,
.corner-stage__meta,
.corner-stage__feature-copy p,
.corner-stage__grid article > span {
  color: var(--stage-hint);
  font-family: var(--font-mono);
  font-size: 0.68rem;
}

.corner-lab__nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.corner-lab__nav a {
  color: var(--stage-hint-strong);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.corner-lab__nav a:hover {
  color: var(--accent);
}

.corner-lab__workbench {
  display: grid;
  width: min(100%, 96rem);
  min-height: calc(100dvh - 4.75rem);
  margin-inline: auto;
  grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
}

.corner-lab__rail {
  border-right: 1px solid var(--border-subtle);
  padding: clamp(2rem, 5vw, 4.5rem) clamp(1rem, 2.5vw, 2.5rem);
}

.corner-lab__title h1 {
  margin: 0.7rem 0 1rem;
  font-size: 1.9rem;
  font-weight: 600;
  line-height: 1.15;
}

.corner-lab__title p {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.corner-lab__studies {
  display: grid;
  margin-top: 3rem;
  border-top: 1px solid var(--border-subtle);
}

.corner-study {
  display: grid;
  min-height: 5.5rem;
  align-items: center;
  border: 0;
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
  padding: 0.85rem 0;
  color: var(--stage-fg);
  cursor: pointer;
  text-align: left;
  grid-template-columns: 2.4rem 1fr 2.8rem;
  gap: 0.6rem;
  transition:
    background 180ms ease,
    padding 180ms ease;
}

.corner-study:hover,
.corner-study--active {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  padding-inline: 0.55rem;
}

.corner-study__code {
  color: var(--stage-hint);
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.corner-study__copy {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.corner-study__copy strong {
  font-size: 0.86rem;
  font-weight: 560;
}

.corner-study__copy small {
  overflow: hidden;
  color: var(--stage-hint);
  font-size: 0.67rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.corner-study__mark {
  position: relative;
  display: block;
  width: 2.5rem;
  height: 1.7rem;
  background:
    linear-gradient(var(--accent), var(--accent)) left top / 7px 1px no-repeat,
    linear-gradient(var(--accent), var(--accent)) left top / 1px 7px no-repeat,
    linear-gradient(var(--accent), var(--accent)) right top / 7px 1px no-repeat,
    linear-gradient(var(--accent), var(--accent)) right top / 1px 7px no-repeat,
    linear-gradient(var(--accent), var(--accent)) left bottom / 7px 1px no-repeat,
    linear-gradient(var(--accent), var(--accent)) left bottom / 1px 7px no-repeat,
    linear-gradient(var(--accent), var(--accent)) right bottom / 7px 1px no-repeat,
    linear-gradient(var(--accent), var(--accent)) right bottom / 1px 7px no-repeat;
  opacity: 0.76;
}

.corner-study__mark i {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--stage-fg);
  transform: translate(-50%, -50%);
}

.corner-study__mark[data-variant="corners-hairline"] {
  filter: grayscale(1);
  opacity: 0.5;
}

.corner-study__mark[data-variant="corners-axis"] {
  background:
    linear-gradient(var(--accent), var(--accent)) center top / 1px 5px no-repeat,
    linear-gradient(var(--accent), var(--accent)) right center / 5px 1px no-repeat,
    linear-gradient(var(--accent), var(--accent)) center bottom / 1px 5px no-repeat,
    linear-gradient(var(--accent), var(--accent)) left center / 5px 1px no-repeat;
  border: 1px solid color-mix(in srgb, var(--stage-fg) 25%, transparent);
}

.corner-study__mark[data-variant="corners-axis"] i {
  border: 1px solid var(--accent);
  background: transparent;
}

.corner-study__mark[data-variant="corners-contrast"] {
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 45%, transparent));
  opacity: 1;
}

.corner-study__mark[data-variant="corners-contrast"] i {
  background: var(--accent);
}

.corner-stage {
  padding: clamp(2rem, 5vw, 4.5rem) clamp(1rem, 4vw, 4.5rem);
}

.corner-stage__meta {
  display: flex;
  margin-bottom: 1.25rem;
  justify-content: space-between;
  gap: 1rem;
}

.corner-stage__feature {
  display: grid;
  min-height: 24rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-2) 64%, transparent);
  padding: clamp(1.5rem, 4vw, 3rem);
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: 1fr auto;
  gap: 1.25rem;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--stage-fg) 10%, transparent);
}

.corner-stage__index {
  display: grid;
  width: 3rem;
  height: 3rem;
  border: 1px solid var(--border-subtle);
  place-items: center;
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.corner-stage__feature-copy h2 {
  margin: 0.55rem 0 0.8rem;
  font-size: clamp(1.8rem, 4vw, 3.4rem);
  font-weight: 540;
  line-height: 1;
}

.corner-stage__feature-copy > span {
  color: var(--stage-hint-strong);
  font-size: 0.84rem;
}

.corner-stage__actions {
  display: flex;
  align-self: end;
  grid-column: 2 / -1;
  justify-content: flex-end;
  gap: 0.75rem;
}

.corner-stage__actions a,
.corner-stage__grid button {
  min-height: 2.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  padding: 0 1rem;
  color: var(--stage-fg);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-decoration: none;
}

.corner-stage__actions a {
  display: inline-flex;
  align-items: center;
}

.corner-stage__actions a:hover,
.corner-stage__grid button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.corner-stage__grid {
  display: grid;
  margin-top: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.corner-stage__grid article {
  display: grid;
  min-height: 11rem;
  align-content: space-between;
  border-top: 1px solid var(--border-subtle);
  padding: 1.25rem 0 0;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

.corner-stage__grid strong {
  align-self: end;
  font-size: 1.05rem;
  font-weight: 560;
}

.corner-stage__grid button {
  align-self: end;
}

@media (max-width: 900px) {
  .corner-lab__workbench {
    grid-template-columns: 1fr;
  }

  .corner-lab__rail {
    border-right: 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .corner-lab__studies {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .corner-study:nth-child(odd) {
    border-right: 1px solid var(--border-subtle);
  }
}

@media (max-width: 640px) {
  .corner-lab__header {
    min-height: 4.5rem;
    grid-template-columns: 1fr auto;
  }

  .corner-lab__edition,
  .corner-lab__nav a:last-of-type {
    display: none;
  }

  .corner-lab__rail,
  .corner-stage {
    padding: 1.5rem 0.75rem;
  }

  .corner-lab__studies,
  .corner-stage__grid {
    grid-template-columns: 1fr;
  }

  .corner-study:nth-child(odd) {
    border-right: 0;
  }

  .corner-stage__feature {
    min-height: 21rem;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .corner-stage__actions {
    grid-column: 1 / -1;
  }

  .corner-stage__grid article {
    min-height: 8rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .corner-study {
    transition: none;
  }
}
</style>

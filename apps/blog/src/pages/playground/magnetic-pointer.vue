<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { useTheme } from "@/composables/useTheme";
import {
  applyMagneticPointerStyle,
  DEFAULT_MAGNETIC_POINTER_STYLE,
  initializeMagneticPointerStyle,
  type MagneticPointerStyle,
} from "@/utils/magnetic-pointer";
import { getRouteLocationForSiteMode } from "@/utils/site-mode";

definePageMeta({ name: "magnetic-pointer-playground" });

useHead({ title: "Magnetic Pointer Playground | Woodfish" });

const presets = [
  {
    detail: "透明中心 · 几何切线",
    id: "corners",
    name: "四角锁定",
    code: "01",
  },
  {
    detail: "柔和填充 · 液态高光",
    id: "glass",
    name: "雾面玻璃",
    code: "02",
  },
  {
    detail: "细密虚线 · 技术标记",
    id: "precision",
    name: "精密线框",
    code: "03",
  },
  {
    detail: "黑白反相 · 强烈聚焦",
    id: "inverse",
    name: "反相墨块",
    code: "04",
  },
] as const satisfies readonly {
  code: string;
  detail: string;
  id: MagneticPointerStyle;
  name: string;
}[];

const activeStyle = ref<MagneticPointerStyle>(DEFAULT_MAGNETIC_POINTER_STYLE);
const activePreset = computed(
  () =>
    presets.find((preset) => preset.id === activeStyle.value) ?? {
      code: "02",
      detail: "四角锁定延伸实验",
      id: "corners",
      name: "四角实验",
    },
);
const { theme, toggleThemeAt } = useTheme();

function selectStyle(style: MagneticPointerStyle) {
  activeStyle.value = applyMagneticPointerStyle(style);
}

function handleToggleTheme(payload: { x: number; y: number }) {
  toggleThemeAt(payload.x, payload.y);
}

onMounted(() => {
  activeStyle.value = initializeMagneticPointerStyle();
});
</script>

<template>
  <main class="pointer-playground" data-testid="magnetic-pointer-playground">
    <header class="pointer-playground__header">
      <RouterLink
        :to="getRouteLocationForSiteMode('home')"
        class="pointer-playground__brand"
      >
        WOODFISH
      </RouterLink>
      <span class="pointer-playground__edition">POINTER LAB / 01</span>
      <div class="pointer-playground__header-actions">
        <RouterLink to="/playground/magnetic-pointer-02" class="pointer-playground__back">
          LAB 02
        </RouterLink>
        <RouterLink
          :to="getRouteLocationForSiteMode('works')"
          class="pointer-playground__back"
        >
          返回 Works
        </RouterLink>
        <ThemeToggle :theme="theme" @toggle-theme="handleToggleTheme" />
      </div>
    </header>

    <section class="pointer-playground__workspace">
      <div class="pointer-playground__intro">
        <p>MAGNETIC POINTER</p>
        <h1>选择光标材质</h1>
        <div class="pointer-playground__active">
          <span>当前生效</span>
          <strong>{{ activePreset.code }} / {{ activePreset.name }}</strong>
        </div>
      </div>

      <div
        aria-label="磁力光标样式"
        class="pointer-playground__presets"
        role="radiogroup"
      >
        <button
          v-for="preset in presets"
          :key="preset.id"
          :aria-checked="activeStyle === preset.id"
          class="pointer-preset"
          :class="{ 'pointer-preset--active': activeStyle === preset.id }"
          :data-style="preset.id"
          role="radio"
          type="button"
          @click="selectStyle(preset.id)"
        >
          <span class="pointer-preset__code">{{ preset.code }}</span>
          <span class="pointer-preset__copy">
            <strong>{{ preset.name }}</strong>
            <small>{{ preset.detail }}</small>
          </span>
          <span aria-hidden="true" class="pointer-preset__swatch">
            <span class="pointer-preset__swatch-frame"></span>
            <span class="pointer-preset__swatch-dot"></span>
          </span>
        </button>
      </div>
    </section>

    <section class="pointer-preview" aria-label="磁力光标预览">
      <div class="pointer-preview__meta">
        <span>LIVE SURFACE</span>
        <span>{{ activePreset.name }}</span>
      </div>

      <div class="pointer-preview__cards">
        <article class="pointer-preview-card pointer-preview-card--primary">
          <span class="pointer-preview-card__number">01</span>
          <div>
            <p class="pointer-preview-card__kind">WEBGL / PORTFOLIO</p>
            <h2>WoodFishNest</h2>
            <p class="pointer-preview-card__description">
              Three.js 场景、液态玻璃与交互叙事组成的个人站点。
            </p>
          </div>
          <div class="pointer-preview-card__actions">
            <span>Website:</span>
            <a href="#preview-live" data-magnetic-pointer="playground-live" @click.prevent>
              进入项目
            </a>
            <span>Source:</span>
            <a href="#preview-source" data-magnetic-pointer="playground-source" @click.prevent>
              GitHub
            </a>
          </div>
        </article>

        <article class="pointer-preview-card pointer-preview-card--secondary">
          <span class="pointer-preview-card__number">02</span>
          <div>
            <p class="pointer-preview-card__kind">INTERACTION / DETAIL</p>
            <h2>Orbit Signal</h2>
            <p class="pointer-preview-card__description">
              克制的线条、轻量高光与黑白场景中的蓝色信号。
            </p>
          </div>
          <button
            class="pointer-preview-card__command"
            data-magnetic-pointer="playground-command"
            type="button"
          >
            OPEN CASE
          </button>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.pointer-playground {
  position: relative;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--stage-bg);
  color: var(--stage-fg);
  pointer-events: auto;
}

.pointer-playground::before {
  position: fixed;
  z-index: 0;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--stage-fg) 4%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--stage-fg) 4%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  content: "";
  mask-image: linear-gradient(to bottom, black, transparent 88%);
  pointer-events: none;
}

.pointer-playground__header {
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 5rem;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 clamp(1rem, 3vw, 3rem);
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
}

.pointer-playground__brand {
  color: var(--stage-fg);
  font-size: 1.05rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-decoration: none;
}

.pointer-playground__edition {
  color: var(--stage-hint);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}

.pointer-playground__header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pointer-playground__back {
  color: var(--stage-hint-strong);
  font-size: 0.78rem;
  letter-spacing: 0;
  text-decoration: none;
  transition: color 160ms ease;
}

.pointer-playground__back:hover {
  color: var(--stage-fg);
}

.pointer-playground__workspace {
  position: relative;
  z-index: 1;
  display: grid;
  width: min(100% - 2rem, 86rem);
  margin-inline: auto;
  padding: clamp(2rem, 6vh, 4.5rem) 0 clamp(1.5rem, 4vh, 3rem);
  grid-template-columns: minmax(14rem, 0.7fr) minmax(32rem, 1.3fr);
  gap: clamp(2rem, 6vw, 7rem);
}

.pointer-playground__intro p,
.pointer-preview__meta,
.pointer-preview-card__kind {
  margin: 0;
  color: var(--stage-hint);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}

.pointer-playground__intro h1 {
  margin: 0.7rem 0 2rem;
  font-size: clamp(1.75rem, 3vw, 2.6rem);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.1;
}

.pointer-playground__active {
  display: grid;
  width: fit-content;
  border-left: 2px solid var(--accent);
  padding-left: 0.8rem;
  gap: 0.25rem;
}

.pointer-playground__active span {
  color: var(--stage-hint);
  font-size: 0.7rem;
}

.pointer-playground__active strong {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 500;
}

.pointer-playground__presets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.pointer-preset {
  position: relative;
  display: grid;
  min-height: 6.5rem;
  align-items: center;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-1) 58%, transparent);
  padding: 1rem;
  color: var(--stage-fg);
  cursor: pointer;
  text-align: left;
  grid-template-columns: auto 1fr auto;
  gap: 0.85rem;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pointer-preset:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.pointer-preset--active {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-1));
}

.pointer-preset__code {
  color: var(--stage-hint);
  font-family: var(--font-mono);
  font-size: 0.66rem;
}

.pointer-preset__copy {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
}

.pointer-preset__copy strong {
  font-size: 0.92rem;
  font-weight: 550;
  letter-spacing: 0;
}

.pointer-preset__copy small {
  color: var(--stage-hint);
  font-size: 0.7rem;
  letter-spacing: 0;
}

.pointer-preset__swatch {
  position: relative;
  display: grid;
  width: 3.2rem;
  height: 2rem;
  place-items: center;
}

.pointer-preset__swatch-frame {
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--stage-fg) 52%, var(--accent));
  border-radius: 3px;
}

.pointer-preset__swatch-dot {
  position: relative;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--stage-fg);
}

.pointer-preset[data-style="corners"] .pointer-preset__swatch-frame {
  border-style: dashed;
  border-color: var(--accent);
}

.pointer-preset[data-style="glass"] .pointer-preset__swatch-frame {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
  box-shadow: 0 5px 14px color-mix(in srgb, var(--accent) 14%, transparent);
}

.pointer-preset[data-style="precision"] .pointer-preset__swatch-frame {
  border-style: dotted;
  border-color: var(--accent);
}

.pointer-preset[data-style="inverse"] .pointer-preset__swatch-frame {
  border-color: var(--stage-fg);
  background: var(--stage-fg);
}

.pointer-preset[data-style="inverse"] .pointer-preset__swatch-dot {
  background: var(--stage-bg);
}

.pointer-preview {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--border-subtle);
  padding: 1.25rem clamp(1rem, 3vw, 3rem) clamp(2rem, 5vh, 4rem);
}

.pointer-preview__meta {
  display: flex;
  width: min(100%, 86rem);
  margin: 0 auto 1.25rem;
  justify-content: space-between;
}

.pointer-preview__cards {
  display: grid;
  width: min(100%, 86rem);
  margin-inline: auto;
  grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.75fr);
  gap: 1rem;
}

.pointer-preview-card {
  position: relative;
  display: grid;
  min-height: 15rem;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-2) 68%, transparent);
  padding: clamp(1.25rem, 3vw, 2rem);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--stage-fg) 10%, transparent);
}

.pointer-preview-card--primary {
  grid-template-columns: auto minmax(0, 1fr);
  align-content: start;
  column-gap: 1rem;
}

.pointer-preview-card__number {
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.pointer-preview-card h2 {
  margin: 0.4rem 0 0.65rem;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0;
}

.pointer-preview-card__description {
  max-width: 34rem;
  margin: 0;
  color: var(--stage-hint-strong);
  font-size: 0.82rem;
  line-height: 1.6;
}

.pointer-preview-card__actions {
  display: grid;
  align-self: end;
  margin-top: 2.5rem;
  grid-column: 1 / -1;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.65rem 1rem;
  font-size: 0.78rem;
}

.pointer-preview-card__actions span {
  color: var(--stage-hint);
}

.pointer-preview-card__actions a,
.pointer-preview-card__command {
  border-radius: 4px;
  color: var(--stage-fg);
  font: inherit;
  text-decoration: none;
}

.pointer-preview-card__command {
  width: fit-content;
  min-height: 2.5rem;
  align-self: end;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--accent);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

@media (max-width: 900px) {
  .pointer-playground__workspace {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .pointer-preview__cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .pointer-playground__header {
    min-height: 4.5rem;
    grid-template-columns: 1fr auto;
  }

  .pointer-playground__edition,
  .pointer-playground__back {
    display: none;
  }

  .pointer-playground__workspace {
    width: min(100% - 1.5rem, 86rem);
    padding-top: 1.5rem;
  }

  .pointer-playground__presets {
    grid-template-columns: 1fr;
  }

  .pointer-preset {
    min-height: 5.75rem;
  }

  .pointer-preview {
    padding-inline: 0.75rem;
  }

  .pointer-preview-card {
    min-height: 16rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pointer-preset {
    transition: none;
  }
}
</style>

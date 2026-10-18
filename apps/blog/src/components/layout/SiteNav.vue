<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue";
import gsap from "gsap";
import { Flip } from "gsap/Flip";

import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { useTheme } from "@/composables/useTheme";
import { getRouteLocationForSiteMode } from "@/utils/site-mode";
import { useSiteStore } from "@/stores/site";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { getBaseUrl } from "@/utils/base-url";

const props = defineProps<{ activePage?: string; documentation?: boolean }>();
const siteStore = useSiteStore();
const { theme, toggleThemeAt } = useTheme();
const isOpen = shallowRef(false);
const avatarUrl = `${getBaseUrl()}favicon.png`;
const navRoot = useTemplateRef<HTMLElement>("navRoot");
gsap.registerPlugin(Flip);
let indicatorMotion: gsap.core.Timeline | null = null;
let indicatorVersion = 0;
watch(
  () => props.activePage ?? siteStore.mode,
  async () => {
    const version = ++indicatorVersion;
    indicatorMotion?.progress(1).kill();
    const old = navRoot.value?.querySelector<HTMLElement>("[data-testid='nav-active-indicator']");
    if (!old || !old.getBoundingClientRect().width || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      return;
    const state = Flip.getState(old);
    await nextTick();
    if (version !== indicatorVersion) return;
    const next = navRoot.value?.querySelector<HTMLElement>("[data-testid='nav-active-indicator']");
    if (next) indicatorMotion = Flip.from(state, { targets: next, duration: 0.4, ease: "power3.out", scale: true });
  },
  { flush: "pre" },
);
onBeforeUnmount(() => {
  indicatorVersion++;
  indicatorMotion?.kill();
});

const navItems = [
  { id: "home", label: "Home", to: getRouteLocationForSiteMode("home") },
  { id: "works", label: "Works", to: getRouteLocationForSiteMode("works") },
  { id: "blog", label: "Blog", to: getRouteLocationForSiteMode("blog") },
  { id: "author", label: "Author", to: getRouteLocationForSiteMode("author") },
  { id: "friend", label: "Friend", to: getRouteLocationForSiteMode("friend") },
] as const;

function handleNav() {
  siteStore.exitFocus();
  isOpen.value = false;
}

function handleToggleTheme(payload: { x: number; y: number }) {
  trackAnalyticsEvent("theme-change", { theme: theme.value === "day" ? "night" : "day" });
  toggleThemeAt(payload.x, payload.y);
}

function isActive(id: (typeof navItems)[number]["id"]) {
  return (props.activePage ?? siteStore.mode) === id;
}
watch(
  () => props.activePage,
  () => {
    isOpen.value = false;
  },
);
</script>

<template>
  <nav
    ref="navRoot"
    aria-label="站点导航"
    data-testid="site-nav"
    :class="{
      'site-nav--docs': props.documentation,
      'site-nav--blog': props.documentation || siteStore.mode === 'blog',
    }"
    class="site-nav-gradient pointer-events-none fixed left-0 top-0 z-50 flex w-full items-center justify-between p-4 sm:p-6"
  >
    <div class="pointer-events-auto flex items-center gap-3">
      <RouterLink
        :to="getRouteLocationForSiteMode('home')"
        aria-label="WOODFISH"
        class="inline-flex items-center gap-2 cursor-pointer text-lg sm:text-xl font-bold tracking-widest text-[var(--stage-fg)]"
        @click="handleNav()"
      >
        <img :src="avatarUrl" alt="木鱼的头像" width="32" height="32" class="rounded-full" />
        <span>WOODFISH</span>
      </RouterLink>
      <span data-scene-blog-dock class="site-nav__scene-dock" aria-hidden="true" />
    </div>

    <div data-testid="site-nav-wide" class="pointer-events-auto hidden items-center gap-3 lg:flex">
      <div data-nav-group="desktop" class="flex gap-8">
        <RouterLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.to"
          :aria-current="isActive(item.id) ? 'page' : undefined"
          :data-nav-item="item.id"
          :class="isActive(item.id) ? 'text-[var(--accent)]' : 'text-[var(--stage-hint)] hover:text-[var(--stage-fg)]'"
          class="relative text-sm uppercase tracking-widest transition-colors"
          @click="handleNav()"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="isActive(item.id)"
            data-testid="nav-active-indicator"
            data-flip-id="site-navigation-indicator"
            class="absolute -bottom-2 left-0 h-px w-full bg-[var(--accent)]"
          />
        </RouterLink>
      </div>
      <ThemeToggle data-nav-theme-toggle="desktop" :theme="theme" @toggle-theme="handleToggleTheme" />
    </div>

    <div data-testid="site-nav-compact" class="pointer-events-auto flex items-center gap-2 lg:hidden">
      <ThemeToggle data-nav-theme-toggle="mobile" :theme="theme" @toggle-theme="handleToggleTheme" />
      <button
        aria-label="Toggle Menu"
        :aria-expanded="isOpen"
        aria-controls="site-navigation-menu"
        class="p-2 text-[var(--stage-fg)] transition-colors hover:text-[var(--accent)]"
        type="button"
        @click="isOpen = !isOpen"
      >
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            v-if="isOpen"
            d="M6 18L18 6M6 6l12 12"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <path v-else d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        </svg>
      </button>
    </div>

    <Transition name="fade-slide">
      <div
        v-if="isOpen"
        id="site-navigation-menu"
        class="pointer-events-auto absolute right-4 top-16 sm:right-6 sm:top-20 flex min-w-[150px] flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-4 shadow-lg lg:hidden"
      >
        <RouterLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.to"
          :aria-current="isActive(item.id) ? 'page' : undefined"
          :data-nav-item="item.id"
          :class="isActive(item.id) ? 'text-[var(--accent)]' : 'text-[var(--stage-hint)] hover:text-[var(--stage-fg)]'"
          class="relative w-full text-left text-sm uppercase tracking-widest transition-colors"
          @click="handleNav()"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="isActive(item.id)"
            data-testid="nav-active-indicator"
            class="absolute -bottom-1 left-0 h-px w-10 bg-[var(--accent)]"
          />
        </RouterLink>
      </div>
    </Transition>
  </nav>
</template>

<style scoped>
.site-nav-gradient {
  font-family: "Avenir Next", "IBM Plex Sans", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  height: 80px;
  padding-block: 20px;
  border-bottom: 1px solid transparent;
}

.site-nav--docs {
  border-bottom-color: var(--border-subtle);
  background: color-mix(in srgb, var(--background) 92%, transparent);
  backdrop-filter: blur(20px);
}
@media (max-width: 959px) {
  .site-nav-gradient {
    height: 68px;
    padding-block: 14px;
  }
}

/* Keep the scene's dock visible through the navigation surface. */
.site-nav-gradient.site-nav--blog {
  background: none;
  backdrop-filter: none;
}
.site-nav__scene-dock {
  display: block;
  flex: none;

  height: 1.75rem;
  width: 3.15rem;
  pointer-events: none;
}
</style>

<script setup lang="ts">
import { shallowRef } from "vue";

import ThemeToggle from "@/components/layout/ThemeToggle.vue";
import { useTheme } from "@/composables/useTheme";
import { getRouteLocationForSiteMode } from "@/utils/site-mode";
import { useSiteStore } from "@/stores/site";
import { TRAVELLINGS_TITLE, TRAVELLINGS_URL } from "@/utils/travellings";
import { trackAnalyticsEvent } from "@/utils/analytics";

const siteStore = useSiteStore();
const { theme, toggleThemeAt } = useTheme();
const isOpen = shallowRef(false);

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
  return siteStore.mode === id;
}
</script>

<template>
  <nav
    class="site-nav-gradient pointer-events-none fixed left-0 top-0 z-50 flex w-full items-center justify-between p-4 sm:p-6"
  >
    <div class="pointer-events-auto flex items-center gap-3">
      <RouterLink
        :to="getRouteLocationForSiteMode('home')"
        class="cursor-pointer text-lg sm:text-xl font-bold tracking-widest text-[var(--stage-fg)] mix-blend-difference"
        @click="handleNav()"
      >
        WOODFISH
      </RouterLink>
      <a
        data-testid="nav-travellings"
        class="site-nav__travellings"
        :href="TRAVELLINGS_URL"
        :aria-label="TRAVELLINGS_TITLE"
        :title="TRAVELLINGS_TITLE"
        target="_blank"
        rel="noopener noreferrer"
        data-analytics-event="travellings-outbound"
        data-analytics-event-location="navigation"
      >
        开往
      </a>
    </div>

    <div data-testid="site-nav-wide" class="pointer-events-auto hidden items-center gap-3 lg:flex">
      <div data-nav-group="desktop" class="flex gap-8">
        <RouterLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.to"
          :aria-current="isActive(item.id) ? 'page' : undefined"
          :data-nav-item="item.id"
          :class="
            isActive(item.id)
              ? 'text-[var(--accent)]'
              : 'text-[var(--stage-hint)] hover:text-[var(--stage-fg)]'
          "
          class="relative text-sm uppercase tracking-widest transition-colors"
          @click="handleNav()"
        >
          <span>{{ item.label }}</span>
          <span
            v-if="isActive(item.id)"
            data-testid="nav-active-indicator"
            class="absolute -bottom-2 left-0 h-px w-full bg-[var(--accent)]"
          />
        </RouterLink>
      </div>
      <ThemeToggle
        data-nav-theme-toggle="desktop"
        :theme="theme"
        @toggle-theme="handleToggleTheme"
      />
    </div>

    <div data-testid="site-nav-compact" class="pointer-events-auto flex items-center gap-2 lg:hidden">
      <ThemeToggle
        data-nav-theme-toggle="mobile"
        :theme="theme"
        @toggle-theme="handleToggleTheme"
      />
      <button
        aria-label="Toggle Menu"
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
          <path
            v-else
            d="M4 6h16M4 12h16M4 18h16"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
      </button>
    </div>

    <Transition name="fade-slide">
      <div
        v-if="isOpen"
        class="pointer-events-auto absolute right-4 top-16 sm:right-6 sm:top-20 flex min-w-[150px] flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-4 shadow-lg lg:hidden"
      >
        <RouterLink
          v-for="item in navItems"
          :key="item.id"
          :to="item.to"
          :aria-current="isActive(item.id) ? 'page' : undefined"
          :data-nav-item="item.id"
          :class="
            isActive(item.id)
              ? 'text-[var(--accent)]'
              : 'text-[var(--stage-hint)] hover:text-[var(--stage-fg)]'
          "
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
.site-nav__travellings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  min-width: 3.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  padding: 0 0.62rem;
  color: var(--stage-fg);
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.14em;
  line-height: 1;
  text-decoration: none;
  text-transform: uppercase;
  backdrop-filter: blur(12px);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.site-nav__travellings:hover,
.site-nav__travellings:focus-visible {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.22);
  color: var(--accent);
  transform: translateY(-1px);
}

.site-nav__travellings:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

:global(:root[data-theme="night"]) .site-nav__travellings {
  background: rgba(8, 12, 24, 0.34);
}
</style>

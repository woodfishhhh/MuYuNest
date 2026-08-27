<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from "vue";

import { playRouteTransition } from "@/composables/useRouteTransitionOrchestrator";
import { resolveTransitionIntent } from "@/motion/route-transition-intent";
import { useSiteStore, type SiteMode } from "@/stores/site";

const ThreeSceneCanvas = defineAsyncComponent(() => import("@/components/scene/ThreeSceneCanvas.vue"));
const HomeView = defineAsyncComponent(() => import("@/views/HomeView.vue"));

interface Snapshot {
  routeName: string | null;
  siteMode: SiteMode;
  activePostSlug: string | null;
}

const HOME_ROUTE_NAMES = new Set([
  "home",
  "blog",
  "author",
  "author-page",
  "author-page-root",
  "friend",
  "works",
]);
const SCENE_ROUTE_NAMES = new Set([...HOME_ROUTE_NAMES, "post"]);

const route = useRoute();
const siteStore = useSiteStore();
const isHomeRoute = computed(
  () => typeof route.name === "string" && HOME_ROUTE_NAMES.has(route.name),
);

let initialized = false;
let previousSnapshot: Snapshot = {
  routeName: null,
  siteMode: siteStore.mode,
  activePostSlug: siteStore.activePostSlug,
};

onMounted(() => {
  previousSnapshot = {
    routeName: typeof route.name === "string" ? route.name : null,
    siteMode: siteStore.mode,
    activePostSlug: siteStore.activePostSlug,
  };
});

watch(
  () => [typeof route.name === "string" ? route.name : null, siteStore.mode, siteStore.activePostSlug] as const,
  ([routeName, siteMode, activePostSlug]) => {
    const nextSnapshot: Snapshot = {
      routeName,
      siteMode,
      activePostSlug,
    };

    const intent = resolveTransitionIntent({
      fromRouteName: previousSnapshot.routeName,
      toRouteName: nextSnapshot.routeName,
      fromSiteMode: previousSnapshot.siteMode,
      toSiteMode: nextSnapshot.siteMode,
      fromActivePostSlug: previousSnapshot.activePostSlug,
      toActivePostSlug: nextSnapshot.activePostSlug,
      isInitialNavigation: !initialized,
    });

    previousSnapshot = nextSnapshot;
    initialized = true;

    if (intent.type === "none") return;
    void playRouteTransition({ kind: intent.type, directEntry: intent.directEntry });
  },
  { flush: "post" },
);
</script>

<template>
  <div data-route-shell class="route-transition-shell">
    <div data-transition-scrim class="route-transition-scrim" />
    <div data-transition-blade class="route-transition-blade" />
    <!-- 3D 场景层：在首页家族与文章页持续存在，作为透明页面后的背景 -->
    <!-- z-[1]: stage(z-[2]) 之下的背景层，透明 canvas 接受空白区域的鼠标事件 -->
    <div
      v-if="SCENE_ROUTE_NAMES.has(typeof route.name === 'string' ? route.name : '')"
      class="fixed inset-0 z-[1] h-full w-full"
      data-scene-layer
    >
      <div class="absolute inset-0 z-0">
        <ThreeSceneCanvas />
      </div>
    </div>
    <div data-route-stage class="route-transition-stage">
      <HomeView v-if="isHomeRoute" key="home-family" data-route-view />
      <NuxtPage v-slot="{ Component, route: routeView }">
        <component
          v-if="!isHomeRoute"
          :is="Component"
          :key="routeView.fullPath"
          data-route-view
        />
      </NuxtPage>
    </div>
  </div>
</template>

<style scoped>
.route-transition-shell {
  position: relative;
  min-height: 100dvh;
}

.route-transition-stage {
  position: relative;
  min-height: 100dvh;
  z-index: 2;
  pointer-events: none;
}

.route-transition-scrim {
  position: fixed;
  inset: 0;
  z-index: 120;
  pointer-events: none;
  opacity: 0;
  background: var(--route-transition-scrim-bg);
}

.route-transition-blade {
  position: fixed;
  inset: -12% -20%;
  z-index: 121;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(100deg, transparent 22%, rgba(255, 255, 255, 0.18) 50%, transparent 78%);
  filter: blur(12px);
}
</style>

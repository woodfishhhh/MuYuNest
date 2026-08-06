<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  useTemplateRef,
  watch,
} from "vue";

import ReadingOverlay from "@/components/home/ReadingOverlay.vue";
import SlideController from "@/components/home/SlideController.vue";
import VisitorCountBadge from "@/components/home/VisitorCountBadge.vue";
import SiteNav from "@/components/layout/SiteNav.vue";
import { useHomePanels } from "@/composables/useHomePanels";
import { useTheme } from "@/composables/useTheme";
import { useVisitorCount } from "@/composables/useVisitorCount";
import { useSiteStore, type SiteMode } from "@/stores/site";

const AuthorPanel = defineAsyncComponent(() => import("@/components/home/AuthorPanel.vue"));
const FriendPanel = defineAsyncComponent(() => import("@/components/home/FriendPanel.vue"));
const PostPanel = defineAsyncComponent(() => import("@/components/home/PostPanel.vue"));
const WorksPanel = defineAsyncComponent(() => import("@/components/home/WorksPanel.vue"));

const siteStore = useSiteStore();
const { theme } = useTheme();
const currentMode = computed(() => siteStore.mode);
type CachedPanelMode = Exclude<SiteMode, "home" | "reading">;
const cachedPanelModes = reactive(new Set<CachedPanelMode>());
const blogScrollContainerRef = useTemplateRef<HTMLElement>("blogScrollContainer");
const { posts, author, friendLinks, works, isPostsLoading, isAuthorLoading, isFriendLinksLoading } =
  useHomePanels(currentMode);

const homeHint = computed(() => siteStore.mode === "home" && !siteStore.isFocusing);
const focusHint = computed(() => siteStore.isFocusing);
const focusHintTarget = computed(() => (theme.value === "day" ? "莫比乌斯带" : "超立方体"));
const showVisitorCount = computed(() => siteStore.mode === "home");
const {
  total: visitorCountTotal,
  isLoading: visitorCountLoading,
  hasError: visitorCountError,
  hydrate: hydrateVisitorCount,
} = useVisitorCount();
const MAX_BLOG_SCROLL_RESTORE_FRAMES = 120;
let pendingBlogScrollTop: number | null = null;
let blogScrollRestoreFrame: number | null = null;
let blogScrollRestoreFrameCount = 0;

function cachePanelMode(mode: SiteMode) {
  if (mode !== "home" && mode !== "reading") {
    cachedPanelModes.add(mode);
  }
}

function isPanelCached(mode: CachedPanelMode) {
  return cachedPanelModes.has(mode);
}

function clearPendingBlogScrollRestore() {
  if (blogScrollRestoreFrame !== null) {
    cancelAnimationFrame(blogScrollRestoreFrame);
  }

  blogScrollRestoreFrame = null;
  blogScrollRestoreFrameCount = 0;
  pendingBlogScrollTop = null;
}

function finishBlogScrollRestore(container: HTMLElement, target: number) {
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  if (target > maxScrollTop + 1) {
    return false;
  }

  const expectedScrollTop = Math.min(target, maxScrollTop);
  if (Math.abs(container.scrollTop - expectedScrollTop) > 1) {
    return false;
  }

  clearPendingBlogScrollRestore();
  siteStore.setBlogScrollTop(container.scrollTop);
  return true;
}

function scheduleBlogScrollRestore(target: number) {
  if (
    blogScrollRestoreFrame !== null ||
    blogScrollRestoreFrameCount >= MAX_BLOG_SCROLL_RESTORE_FRAMES
  ) {
    return;
  }

  blogScrollRestoreFrame = requestAnimationFrame(() => {
    blogScrollRestoreFrame = null;
    blogScrollRestoreFrameCount += 1;
    attemptBlogScrollRestore(target);
  });
}

function attemptBlogScrollRestore(target: number) {
  if (pendingBlogScrollTop !== target || currentMode.value !== "blog") {
    return;
  }

  const container = blogScrollContainerRef.value;
  if (!container) {
    scheduleBlogScrollRestore(target);
    return;
  }

  container.scrollTo({ top: target, behavior: "auto" });
  if (!finishBlogScrollRestore(container, target)) {
    scheduleBlogScrollRestore(target);
  }
}

async function replayPendingBlogScrollPosition() {
  const target = pendingBlogScrollTop;
  if (target === null || currentMode.value !== "blog") {
    return;
  }

  await nextTick();

  attemptBlogScrollRestore(target);
}

function saveBlogScrollPosition() {
  const container = blogScrollContainerRef.value;
  if (container && pendingBlogScrollTop === null) {
    siteStore.setBlogScrollTop(container.scrollTop);
  }
}

function cancelPendingBlogScrollRestore() {
  clearPendingBlogScrollRestore();
  saveBlogScrollPosition();
}

function handleBlogScroll(event: Event) {
  const container = event.currentTarget as HTMLElement;
  if (pendingBlogScrollTop !== null) {
    finishBlogScrollRestore(container, pendingBlogScrollTop);
    return;
  }

  siteStore.setBlogScrollTop(container.scrollTop);
}

watch(
  currentMode,
  (mode) => {
    cachePanelMode(mode);
  },
  { immediate: true },
);

watch(
  currentMode,
  async (nextMode, previousMode) => {
    if (previousMode === "blog") {
      saveBlogScrollPosition();
    }

    if (nextMode === "blog") {
      clearPendingBlogScrollRestore();
      pendingBlogScrollTop = siteStore.blogScrollTop > 0 ? siteStore.blogScrollTop : null;
      await replayPendingBlogScrollPosition();
    } else {
      clearPendingBlogScrollRestore();
    }
  },
  { immediate: true },
);

watch(
  [() => posts.value.length, () => isPostsLoading.value],
  () => {
    if (currentMode.value === "blog" && pendingBlogScrollTop !== null) {
      void replayPendingBlogScrollPosition();
    }
  },
  { flush: "post" },
);

onMounted(() => {
  void hydrateVisitorCount();
});

onBeforeUnmount(() => {
  saveBlogScrollPosition();
  clearPendingBlogScrollRestore();
});
</script>

<template>
  <main data-home-stage class="relative h-dvh overflow-hidden text-[var(--stage-fg)]">
    <SiteNav />

    <SlideController :blog-scroll-container="blogScrollContainerRef">
      <div class="pointer-events-none fixed inset-0 z-10 flex h-full w-full">
        <Transition name="home-hint" mode="out-in">
          <div v-if="homeHint" class="pointer-events-auto absolute bottom-8 flex w-full justify-center">
            <div class="animate-bounce text-sm tracking-widest text-[var(--stage-hint)] opacity-70">
              点击{{ focusHintTarget }}进行探索
            </div>
          </div>
        </Transition>

        <Transition name="focus-hint" mode="out-in">
          <div v-if="focusHint" class="pointer-events-auto absolute bottom-8 flex w-full justify-center">
            <button
              class="animate-bounce cursor-pointer text-sm tracking-widest text-[var(--stage-hint)] transition-colors hover:text-[var(--stage-fg)]"
              type="button"
              @click="siteStore.exitFocus()"
            >
              沉浸模式（{{ focusHintTarget }}），点此返回
            </button>
          </div>
        </Transition>

        <div v-if="showVisitorCount" class="pointer-events-auto absolute bottom-6 left-6 z-20">
          <VisitorCountBadge
            :total="visitorCountTotal"
            :is-loading="visitorCountLoading"
            :has-error="visitorCountError"
          />
        </div>
        <div
          v-if="siteStore.mode === 'home'"
          data-panel-layer="home"
          data-panel-active="true"
          class="pointer-events-none absolute inset-0"
        />

        <div
          v-if="isPanelCached('blog')"
          ref="blogScrollContainer"
          data-blog-scroll-container
          data-panel-layer="blog"
          :data-panel-active="siteStore.mode === 'blog' ? 'true' : 'false'"
          :aria-hidden="siteStore.mode === 'blog' ? undefined : 'true'"
          data-testid="blog-panel-overlay"
          class="home-panel-cache stage-panel-gradient stage-panel-gradient--blog pointer-events-auto absolute inset-0 h-full w-full overflow-y-auto overscroll-contain p-4 pt-20 sm:p-6 sm:pt-24 md:p-8 md:pt-24 md:pl-16 lg:p-10 lg:pt-24 lg:pl-20"
          @pointerdown.capture="cancelPendingBlogScrollRestore"
          @scroll.passive="handleBlogScroll"
          @touchstart.capture.passive="cancelPendingBlogScrollRestore"
          @wheel.capture.passive="cancelPendingBlogScrollRestore"
        >
          <div class="flex min-h-full w-full flex-col justify-start">
            <PostPanel v-if="posts.length > 0" :posts="posts" />
            <div
              v-else
              class="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-6 py-7 text-[var(--stage-hint)]"
            >
              <div class="text-[11px] uppercase tracking-[0.36em] text-[var(--stage-hint)]">
                {{ isPostsLoading ? "Loading archive" : "Archive standby" }}
              </div>
              <p class="mt-4 w-full text-xs sm:text-sm max-w-md leading-7 text-[var(--stage-hint)]">
                {{
                  isPostsLoading
                    ? "正在按需装载文章目录，马上就能进入阅读。"
                    : "文章目录会在你进入 Blog 面板时即时载入。"
                }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="isPanelCached('author')"
          data-panel-layer="author"
          :data-panel-active="siteStore.mode === 'author' ? 'true' : 'false'"
          :aria-hidden="siteStore.mode === 'author' ? undefined : 'true'"
          class="home-panel-cache pointer-events-auto absolute inset-0"
        >
          <div class="flex h-full w-full items-center justify-center">
            <AuthorPanel v-if="author" :active="siteStore.mode === 'author'" :author="author" />
            <div
              v-else
              class="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-6 py-7 text-[var(--stage-hint)]"
            >
              <div class="text-[11px] uppercase tracking-[0.36em] text-[var(--stage-hint)]">
                {{ isAuthorLoading ? "Loading profile" : "Profile standby" }}
              </div>
              <p class="mt-4 max-w-md text-sm leading-7 text-[var(--stage-hint)]">
                {{
                  isAuthorLoading
                    ? "作者资料正在按需同步，面板即将展开。"
                    : "作者资料会在你进入 Author 面板时即时载入。"
                }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="isPanelCached('friend')"
          data-panel-layer="friend"
          :data-panel-active="siteStore.mode === 'friend' ? 'true' : 'false'"
          :aria-hidden="siteStore.mode === 'friend' ? undefined : 'true'"
          class="home-panel-cache stage-panel-gradient stage-panel-gradient--friend pointer-events-auto absolute inset-0 overflow-hidden"
        >
          <FriendPanel v-if="friendLinks.length > 0" :links="friendLinks" />
          <div
            v-else
            class="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-6 py-7 text-[var(--stage-hint)]"
          >
            <div class="text-[11px] uppercase tracking-[0.36em] text-[var(--stage-hint)]">
              {{ isFriendLinksLoading ? "Loading network" : "Network standby" }}
            </div>
            <p class="mt-4 max-w-md text-sm leading-7 text-[var(--stage-hint)]">
              {{
                isFriendLinksLoading
                  ? "友情链接正在按需接入，稍后会完整出现。"
                  : "友情链接会在你进入 Friend 面板时即时载入。"
              }}
            </p>
          </div>
        </div>

        <div
          v-if="isPanelCached('works')"
          data-panel-layer="works"
          :data-panel-active="siteStore.mode === 'works' ? 'true' : 'false'"
          :aria-hidden="siteStore.mode === 'works' ? undefined : 'true'"
          class="home-panel-cache stage-panel-gradient--works pointer-events-none absolute inset-0"
        >
          <WorksPanel :works="works" />
        </div>
      </div>

      <ReadingOverlay />
    </SlideController>
  </main>
</template>

<style scoped>
.home-panel-cache[data-panel-active="false"] {
  content-visibility: hidden;
  pointer-events: none;
  visibility: hidden;
}

/* liquid-gl draws in a body-level canvas, so panel visibility alone cannot suspend its lenses. */
.home-panel-cache[data-panel-active="false"] :deep([data-liquid-gl-target]) {
  display: none;
}
</style>

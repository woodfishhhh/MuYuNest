<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, shallowRef, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";

import FilmChapter from "@/components/home/film/FilmChapter.vue";
import FilmCollect from "@/components/home/film/FilmCollect.vue";
import FilmCredits from "@/components/home/film/FilmCredits.vue";
import FilmEnd from "@/components/home/film/FilmEnd.vue";
import FilmHud from "@/components/home/film/FilmHud.vue";
import FilmOpening from "@/components/home/film/FilmOpening.vue";
import FilmPoem from "@/components/home/film/FilmPoem.vue";
import FilmRoles, { type FilmRole } from "@/components/home/film/FilmRoles.vue";
import FilmSplash from "@/components/home/film/FilmSplash.vue";
import FilmTime from "@/components/home/film/FilmTime.vue";
import FilmTools from "@/components/home/film/FilmTools.vue";
import { filmFrameKey, type FilmChapterProgress, type FilmFrameListener } from "@/components/home/film/film-frame";
import {
  adaptShotToViewport,
  buildShotKeys,
  FILM_CHAPTERS,
  interpolateShot,
  seamStrength,
  type ChapterLayout,
  type ShotKey,
} from "@/components/home/film/film-script";
import {
  hasSplashPlayed,
  markSplashPlayed,
  publishHomeFilm,
  resetHomeFilm,
  setFilmIntroHold,
} from "@/components/scene/home-film-signal";
import { useDampedScroll } from "@/composables/useDampedScroll";
import { NETEASE_MUSIC_URL } from "@/content/contact-links";
import { useSiteStore } from "@/stores/site";
import type { AuthorProfileData, WorkProjectData } from "@/types/content";
import "@/components/home/film/film.css";

const props = defineProps<{
  author: AuthorProfileData;
  works: WorkProjectData[];
  visitorTotal: number | null;
  visitorLoading: boolean;
  visitorError: boolean;
}>();

// Scroll speed (px/s) at which a seam's star warp reaches full strength.
const WARP_FULL_SPEED = 1400;
const WARP_MAX = 0.5;
const GLITCH_MS = 650;
// Stages fade over this share of their own travel when entering and leaving.
const STAGE_FADE = 0.28;

const siteStore = useSiteStore();
const route = useRoute();
const rootRef = useTemplateRef<HTMLElement>("root");
const reducedMotion =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const showSplash = shallowRef(!hasSplashPlayed() && !reducedMotion);
const titleReady = shallowRef(!showSplash.value);
const activeIndex = shallowRef(0);

const roles = computed<FilmRole[]>(() => {
  const titles = props.author.title
    .replace(/^是一名\s*/, "")
    .split("/")
    .map((role) => role.trim())
    .filter(Boolean);
  const notes: Record<string, Omit<FilmRole, "title">> = {
    学生: {
      english: "STUDENT",
      line: `${props.author.oneself.university} · ${props.author.oneself.major} · ${props.author.tenyear.start.slice(0, 4)} 级`,
    },
    ACMer: { english: "ACMER", line: "在 Codeforces 上刷题，题解顺手写进笔记。" },
    全栈运维工程师: {
      english: "FULL-STACK & OPS",
      line: "这个站从页面到服务器都是自己搭的：Nuxt、Hono、Docker、nginx。",
    },
    电子音乐制作人: {
      english: "MUSIC PRODUCER",
      line: "用 FL Studio 写歌，作品放在网易云音乐。",
      link: { href: NETEASE_MUSIC_URL, label: "去听听" },
    },
  };
  return titles.map((title) => ({ title, ...(notes[title] ?? { english: title.toUpperCase(), line: "" }) }));
});

const frameListeners = new Set<FilmFrameListener>();
provide(filmFrameKey, (listener) => {
  frameListeners.add(listener);
  return () => frameListeners.delete(listener);
});

const damped = useDampedScroll({
  enabled: computed(() => !reducedMotion && !showSplash.value && !siteStore.isFocusing),
  // A held card in the falling-cards chapter uses the wheel to resize itself.
  shouldIgnore: () => !!document.querySelector("[data-home-card-dragging='true']"),
});

let sections: HTMLElement[] = [];
let layouts: ChapterLayout[] = [];
let keys: ShotKey[] = [];
let viewportHeight = 1;
let portrait = false;
let frameId: number | null = null;
let lastY = Number.NaN;
let lastTime = 0;
let lastWarp = 0;
let resizeObserver: ResizeObserver | null = null;
const glitchTimers = new Map<Element, number>();

function measure() {
  const root = rootRef.value;
  if (!root) return;
  viewportHeight = window.innerHeight;
  portrait = window.innerWidth < window.innerHeight * 0.9;
  sections = Array.from(root.querySelectorAll<HTMLElement>("[data-film-chapter]"));
  layouts = sections.map((section) => ({
    top: section.getBoundingClientRect().top + window.scrollY,
    height: section.offsetHeight,
  }));
  keys = buildShotKeys(layouts, viewportHeight);
  lastY = Number.NaN;
}

function glitchChapter(section: HTMLElement | undefined) {
  if (reducedMotion || !section) return;
  for (const element of section.querySelectorAll<HTMLElement>("[data-glitch]")) {
    window.clearTimeout(glitchTimers.get(element));
    element.classList.remove("is-glitching");
    void element.offsetWidth;
    element.classList.add("is-glitching");
    glitchTimers.set(element, window.setTimeout(() => element.classList.remove("is-glitching"), GLITCH_MS));
  }
}

function renderFrame(time: number) {
  frameId = requestAnimationFrame(renderFrame);
  const y = window.scrollY;
  if (y === lastY && lastWarp === 0) return;

  const elapsed = Math.max(1, time - lastTime);
  const velocity = Number.isNaN(lastY) ? 0 : ((y - lastY) / elapsed) * 1000;
  lastY = y;
  lastTime = time;

  const progress: FilmChapterProgress = {};
  const center = y + viewportHeight / 2;
  let current = 0;
  layouts.forEach((layout, index) => {
    const section = sections[index];
    const chapter = FILM_CHAPTERS[index];
    if (!section || !chapter) return;
    const travel = Math.max(1, layout.height - viewportHeight);
    const raw = (y - layout.top) / travel;
    const local = Math.min(1, Math.max(0, raw));
    const fadeIn = index === 0 ? 1 : Math.min(1, Math.max(0, (raw + STAGE_FADE) / STAGE_FADE));
    const fadeOut = Math.min(1, Math.max(0, (1 + STAGE_FADE - raw) / STAGE_FADE));
    section.style.setProperty("--t", local.toFixed(4));
    section.style.setProperty("--fade", Math.min(fadeIn, fadeOut).toFixed(3));
    progress[chapter.id] = local;
    if (center >= layout.top) current = index;
  });

  if (current !== activeIndex.value) {
    activeIndex.value = current;
    siteStore.setHomeFilmChapter(FILM_CHAPTERS[current]!.id);
    glitchChapter(sections[current]);
  }

  const scrollable = document.documentElement.scrollHeight - viewportHeight;
  rootRef.value?.style.setProperty("--film-progress", (scrollable > 0 ? y / scrollable : 0).toFixed(4));

  const speed = Math.min(1, Math.abs(velocity) / WARP_FULL_SPEED);
  lastWarp = reducedMotion ? 0 : seamStrength(layouts, y, viewportHeight) * speed * Math.sign(velocity) * WARP_MAX;
  publishHomeFilm({ shot: adaptShotToViewport(interpolateShot(keys, y), portrait), warp: lastWarp });
  for (const listener of frameListeners) listener(progress);
}

function jumpTo(index: number) {
  const layout = layouts[index];
  if (layout) damped.scrollTo(layout.top + (index === 0 ? 0 : viewportHeight * 0.05));
}

async function scrollToHash() {
  // Old /author links land on the roles chapter, the closest thing to the old profile.
  if (route.hash !== "#about") return;
  await nextTick();
  measure();
  jumpTo(1);
}

function handleSplashLift() {
  setFilmIntroHold(false);
  titleReady.value = true;
}

function handleSplashDone() {
  markSplashPlayed();
  showSplash.value = false;
  document.documentElement.style.removeProperty("overflow");
}

function handleResize() {
  measure();
}

watch(
  () => siteStore.isFocusing,
  async (focusing) => {
    // The geometry takes over the screen; the page must not scroll under it.
    if (focusing) window.scrollTo({ top: 0, behavior: "auto" });
    await nextTick();
    measure();
  },
);

watch(() => route.hash, () => void scrollToHash());

onMounted(() => {
  if (showSplash.value) {
    setFilmIntroHold(true);
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
  }

  measure();
  resizeObserver = new ResizeObserver(() => measure());
  if (rootRef.value) resizeObserver.observe(rootRef.value);
  window.addEventListener("resize", handleResize, { passive: true });
  frameId = requestAnimationFrame(renderFrame);
  void scrollToHash();
});

onBeforeUnmount(() => {
  if (frameId !== null) cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", handleResize);
  for (const timer of glitchTimers.values()) window.clearTimeout(timer);
  setFilmIntroHold(false);
  document.documentElement.style.removeProperty("overflow");
  resetHomeFilm();
  siteStore.setHomeFilmChapter("opening");
});
</script>

<template>
  <div ref="root" class="home-film" data-testid="home-film">
    <template v-if="!siteStore.isFocusing">
      <FilmChapter id="opening" label="片头">
        <FilmOpening
          :name="props.author.name"
          :roles="roles.map((role) => role.title)"
          :location="props.author.oneself.location"
          :ready="titleReady"
        />
      </FilmChapter>
      <FilmChapter id="roles" label="身份">
        <FilmRoles :roles="roles" />
      </FilmChapter>
      <FilmChapter id="time" label="时间">
        <FilmTime :tenyear="props.author.tenyear" />
      </FilmChapter>
      <FilmChapter id="tools" label="工具">
        <FilmTools :skills="props.author.skills" />
      </FilmChapter>
      <FilmChapter id="poem" label="诗">
        <FilmPoem :poem="props.author.poem" />
      </FilmChapter>
      <FilmChapter id="collect" label="拾光">
        <FilmCollect />
      </FilmChapter>
      <FilmChapter id="end" label="片尾">
        <FilmEnd :contacts="props.author.contacts" />
      </FilmChapter>
      <FilmCredits
        :author="props.author"
        :works="props.works"
        :visitor-total="props.visitorTotal"
        :visitor-loading="props.visitorLoading"
        :visitor-error="props.visitorError"
        @rewind="jumpTo(0)"
      />
      <FilmHud :active-index="activeIndex" @jump="jumpTo" />
    </template>

    <FilmSplash v-if="showSplash" @lift="handleSplashLift" @done="handleSplashDone" />
  </div>
</template>

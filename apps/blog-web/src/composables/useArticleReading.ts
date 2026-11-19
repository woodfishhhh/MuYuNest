import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from "vue";

import type { TocItem } from "@/types/content";

interface UseArticleReadingOptions {
  contentRoot: Ref<HTMLElement | null>;
  scrollContainer: Ref<HTMLElement | null | undefined>;
  tocItems: Ref<TocItem[]>;
}

const HEADING_SCROLL_OFFSET = 104;
const ACTIVE_HEADING_TOLERANCE = 6;
const MIN_PROGRAMMATIC_SCROLL_LOCK_MS = 120;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 1800;
const SCROLL_SETTLE_THRESHOLD_PX = 3;

export function useArticleReading(options: UseArticleReadingOptions) {
  const readProgress = shallowRef(0);
  const activeId = shallowRef("");

  let observer: IntersectionObserver | null = null;
  let boundScrollContainer: HTMLElement | null = null;
  let pendingJump: { id: string; startedAt: number; top: number | null } | null = null;
  let pendingJumpTimer: ReturnType<typeof setTimeout> | null = null;

  function updateReadProgress() {
    const container = options.scrollContainer.value;

    if (!container) {
      readProgress.value = 0;
      return;
    }

    const scrollHeight = container.scrollHeight - container.clientHeight;
    readProgress.value = scrollHeight > 0 ? (container.scrollTop / scrollHeight) * 100 : 0;
    settlePendingJump(container);
    updateActiveHeadingFromLayout();
  }

  function keepActiveIdIfValid(fallbackId: string, validIds: Set<string>) {
    if (pendingJump || validIds.has(activeId.value)) {
      return;
    }

    activeId.value = fallbackId;
  }

  function clearPendingJumpTimer() {
    if (!pendingJumpTimer) {
      return;
    }

    clearTimeout(pendingJumpTimer);
    pendingJumpTimer = null;
  }

  function finishPendingJump() {
    if (!pendingJump) {
      return;
    }

    activeId.value = pendingJump.id;
    pendingJump = null;
    clearPendingJumpTimer();
  }

  function startPendingJump(id: string, top: number | null) {
    pendingJump = { id, startedAt: getNow(), top };
    clearPendingJumpTimer();
    pendingJumpTimer = setTimeout(() => {
      finishPendingJump();
    }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
  }

  function settlePendingJump(container: HTMLElement) {
    if (!pendingJump || pendingJump.top === null) {
      return;
    }

    const elapsed = getNow() - pendingJump.startedAt;
    if (
      elapsed >= MIN_PROGRAMMATIC_SCROLL_LOCK_MS &&
      Math.abs(container.scrollTop - pendingJump.top) <= SCROLL_SETTLE_THRESHOLD_PX
    ) {
      finishPendingJump();
    }
  }

  function getNow() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
  }

  // Scroll fires every frame while reading; rescanning the whole article for
  // headings each time is wasted work while the same DOM stays mounted.
  let headingCache: {
    contentRoot: HTMLElement | null;
    headings: HTMLElement[];
    tocItems: TocItem[];
    validIds: Set<string>;
  } | null = null;

  function getObservedHeadings() {
    const contentRoot = options.contentRoot.value;
    const tocItems = options.tocItems.value;
    const fallbackId = tocItems[0]?.id ?? "";

    if (
      !headingCache ||
      headingCache.contentRoot !== contentRoot ||
      headingCache.tocItems !== tocItems ||
      // Empty or detached results mean the prose rendered later; scan again.
      !headingCache.headings[0]?.isConnected
    ) {
      const validIds = new Set(tocItems.map((item) => item.id));
      const headings =
        contentRoot && tocItems.length > 0
          ? Array.from(contentRoot.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]")).filter((heading) =>
              validIds.has(heading.id),
            )
          : [];
      headingCache = { contentRoot, headings, tocItems, validIds };
    }

    return { fallbackId, headings: headingCache.headings, validIds: headingCache.validIds };
  }

  function updateActiveHeadingFromLayout() {
    if (pendingJump) {
      return;
    }

    const { fallbackId, headings, validIds } = getObservedHeadings();
    if (headings.length === 0) {
      keepActiveIdIfValid(fallbackId, validIds);
      return;
    }

    const containerTop = options.scrollContainer.value?.getBoundingClientRect().top ?? 0;
    const activationTop = containerTop + HEADING_SCROLL_OFFSET + ACTIVE_HEADING_TOLERANCE;
    let currentHeading = headings[0];

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= activationTop) {
        currentHeading = heading;
      }
    }

    activeId.value = currentHeading.id;
  }

  function disconnectObserver() {
    observer?.disconnect();
    observer = null;
  }

  function bindScrollContainer(container: HTMLElement | null | undefined) {
    if (boundScrollContainer === container) {
      return;
    }

    boundScrollContainer?.removeEventListener("scroll", updateReadProgress);
    boundScrollContainer = container ?? null;
    boundScrollContainer?.addEventListener("scroll", updateReadProgress, { passive: true });

    updateReadProgress();
  }

  function setupHeadingObserver() {
    disconnectObserver();

    const { fallbackId, headings, validIds } = getObservedHeadings();
    const contentRoot = options.contentRoot.value;
    const tocItems = options.tocItems.value;

    if (!contentRoot || tocItems.length === 0 || typeof IntersectionObserver === "undefined") {
      keepActiveIdIfValid(fallbackId, validIds);
      return;
    }

    if (headings.length === 0) {
      keepActiveIdIfValid(fallbackId, validIds);
    } else {
      updateActiveHeadingFromLayout();
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (pendingJump) {
          return;
        }

        if (entries.some((entry) => entry.target instanceof HTMLElement)) {
          updateActiveHeadingFromLayout();
        }
      },
      {
        root: options.scrollContainer.value ?? null,
        rootMargin: `-${HEADING_SCROLL_OFFSET}px 0px -68% 0px`,
        threshold: [0.15, 0.45, 0.8],
      },
    );

    headings.forEach((heading) => observer?.observe(heading));
  }

  let appliedHash = "";
  let initialFrame = 0;
  // Cached article chunks can mount inside Nuxt's detached Suspense tree.
  // Wait for the real reading surface before measuring its initial anchor.
  onMounted(() => {
    let attempts = 0;
    const settle = () => {
      const root = options.contentRoot.value;
      const container = options.scrollContainer.value;
      if (root?.isConnected && root.getClientRects().length && (!container || container.isConnected)) {
        setupHeadingObserver();
        updateReadProgress();
        if (restoreHash()) return;
      }
      if (attempts++ < 120) initialFrame = requestAnimationFrame(settle);
    };
    initialFrame = requestAnimationFrame(settle);
  });
  function restoreHash(): boolean {
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return true;
    }
    if (!id || !options.tocItems.value.some((item) => item.id === id)) return true;
    const root = options.contentRoot.value;
    const target = document.getElementById(id);
    if (
      !root?.isConnected ||
      !target ||
      !root.contains(target) ||
      !target.getClientRects().length ||
      !options.scrollContainer.value?.isConnected
    )
      return false;
    jumpToHeading(id, false);
    appliedHash = id;
    return true;
  }
  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", restoreHash);
    window.addEventListener("popstate", restoreHash);
  }

  async function refresh() {
    await nextTick();
    headingCache = null;
    setupHeadingObserver();
    updateReadProgress();
    if (!appliedHash && typeof window !== "undefined" && options.contentRoot.value) restoreHash();
  }

  function jumpToHeading(id: string, updateHash = true) {
    const target = document.getElementById(id);
    if (!target) return;
    if (updateHash && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.replaceState(window.history.state, "", url);
    }

    activeId.value = id;

    const container = options.scrollContainer.value;
    if (!container) {
      startPendingJump(id, null);
      target.scrollIntoView({
        behavior: !updateHash || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      return;
    }

    const targetTop =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      HEADING_SCROLL_OFFSET;
    const nextTop = Math.max(0, targetTop);

    startPendingJump(id, nextTop);

    container.scrollTo({
      top: nextTop,
      behavior: !updateHash || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  watch(
    () => options.scrollContainer.value,
    (container) => {
      bindScrollContainer(container);
      void refresh();
    },
    { immediate: true },
  );

  watch(
    () => options.tocItems.value.map((item) => item.id).join("|"),
    () => {
      keepActiveIdIfValid(options.tocItems.value[0]?.id ?? "", new Set(options.tocItems.value.map((item) => item.id)));
      void refresh();
    },
    { flush: "post", immediate: true },
  );

  watch(
    () => options.contentRoot.value,
    () => {
      void refresh();
    },
    { flush: "post", immediate: true },
  );

  onBeforeUnmount(() => {
    cancelAnimationFrame(initialFrame);
    window.removeEventListener("hashchange", restoreHash);
    window.removeEventListener("popstate", restoreHash);
    boundScrollContainer?.removeEventListener("scroll", updateReadProgress);
    clearPendingJumpTimer();
    disconnectObserver();
  });

  return {
    activeId,
    jumpToHeading,
    readProgress,
  };
}

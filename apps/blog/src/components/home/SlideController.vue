<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";

import { getRouteLocationForSiteMode } from "@/utils/site-mode";
import { useSiteStore } from "@/stores/site";

const siteStore = useSiteStore();
const router = useRouter();
let touchStartY = 0;
let isAnimating = false;

function setModeWithLock(nextMode: "home" | "author") {
  if (isAnimating || siteStore.mode === nextMode) {
    return;
  }

  isAnimating = true;
  siteStore.exitFocus();
  void router.push(getRouteLocationForSiteMode(nextMode));

  window.setTimeout(() => {
    isAnimating = false;
  }, 1200);
}

function scrollElement(element: HTMLElement, top: number, behavior: ScrollBehavior = "smooth") {
  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  element.scrollBy({
    top,
    behavior: prefersReducedMotion ? "auto" : behavior,
  });
}

function handleWheel(event: WheelEvent) {
  if (siteStore.isFocusing || siteStore.mode === "reading") {
    return;
  }

  if (siteStore.mode === "friend") {
    return;
  }

  if (Math.abs(event.deltaY) <= 30) {
    return;
  }

  if (siteStore.mode === "blog") {
    const list = document.getElementById("post-list-container");
    if (list) {
      if (event.deltaY < 0 && list.scrollTop <= 0) {
        setModeWithLock("home");
      } else if (!event.composedPath().includes(list)) {
        scrollElement(list, event.deltaY);
      }
      return;
    }
  }

  if (siteStore.mode === "author") {
    return;
  }

  if (event.deltaY > 0 && siteStore.mode === "home") {
    setModeWithLock("author");
  }
}

function handleTouchStart(event: TouchEvent) {
  touchStartY = event.touches[0]?.clientY ?? 0;
}

function handleTouchMove(event: TouchEvent) {
  if (siteStore.isFocusing || siteStore.mode === "reading" || isAnimating) {
    return;
  }

  const touchEndY = event.touches[0]?.clientY ?? 0;
  const diff = touchStartY - touchEndY;

  if (siteStore.mode === "friend") {
    return;
  }

  if (Math.abs(diff) <= 40) {
    return;
  }

  if (siteStore.mode === "blog") {
    const list = document.getElementById("post-list-container");
    if (list) {
      if (diff < 0 && list.scrollTop <= 0) {
        setModeWithLock("home");
      } else if (!event.composedPath().includes(list)) {
        scrollElement(list, diff, "auto");
        touchStartY = touchEndY;
      }
      return;
    }
  }

  if (siteStore.mode === "author") {
    return;
  }

  if (diff > 0 && siteStore.mode === "home") {
    setModeWithLock("author");
  }
}

onMounted(() => {
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: false });
});

onBeforeUnmount(() => {
  window.removeEventListener("wheel", handleWheel);
  window.removeEventListener("touchstart", handleTouchStart);
  window.removeEventListener("touchmove", handleTouchMove);
});
</script>

<template>
  <slot />
</template>

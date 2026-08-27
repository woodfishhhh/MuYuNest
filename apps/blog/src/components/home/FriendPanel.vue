<script setup lang="ts">
import { computed, shallowRef } from "vue";

import FriendLinkApplicationForm from "@/components/home/friend/FriendLinkApplicationForm.vue";
import FriendLinkGrid from "@/components/home/friend/FriendLinkGrid.vue";
import type { FriendLinkData } from "@/types/content";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { TRAVELLINGS_TITLE, TRAVELLINGS_URL } from "@/utils/travellings";

const props = defineProps<{
  links: FriendLinkData[];
}>();

const isMobileApplicationOpen = shallowRef(false);
const mobileTriggerTilt = shallowRef(createMobileTriggerTiltState());
const availableLinks = computed(() => props.links.filter((link) => !link.offline));
const offlineLinks = computed(() => props.links.filter((link) => link.offline));

const mobileTriggerStyle = computed<Record<string, string>>(() => ({
  "--friend-trigger-rotate-x": mobileTriggerTilt.value.rotateX,
  "--friend-trigger-rotate-y": mobileTriggerTilt.value.rotateY,
  "--friend-trigger-glare-x": mobileTriggerTilt.value.glareX,
  "--friend-trigger-glare-y": mobileTriggerTilt.value.glareY,
  "--friend-trigger-glare-opacity": mobileTriggerTilt.value.glareOpacity,
  "--friend-trigger-lift": mobileTriggerTilt.value.lift,
  "--friend-trigger-shadow-y": mobileTriggerTilt.value.shadowY,
  "--friend-trigger-shadow-blur": mobileTriggerTilt.value.shadowBlur,
}));

function openMobileApplication() {
  isMobileApplicationOpen.value = true;
}

function closeMobileApplication() {
  isMobileApplicationOpen.value = false;
}

function createMobileTriggerTiltState() {
  return {
    rotateX: "0deg",
    rotateY: "0deg",
    glareX: "50%",
    glareY: "50%",
    glareOpacity: "0",
    lift: "0px",
    shadowY: "18px",
    shadowBlur: "42px",
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function handleMobileTriggerPointerMove(event: PointerEvent) {
  if (event.pointerType !== "mouse" || prefersReducedMotion()) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  const maxTilt = 13;

  mobileTriggerTilt.value = {
    rotateX: `${(-y * maxTilt).toFixed(2)}deg`,
    rotateY: `${(x * maxTilt).toFixed(2)}deg`,
    glareX: `${((x + 0.5) * 100).toFixed(1)}%`,
    glareY: `${((y + 0.5) * 100).toFixed(1)}%`,
    glareOpacity: "0.34",
    lift: "-7px",
    shadowY: "30px",
    shadowBlur: "70px",
  };
}

function handleMobileTriggerFocus() {
  if (prefersReducedMotion()) {
    return;
  }

  mobileTriggerTilt.value = {
    ...createMobileTriggerTiltState(),
    glareOpacity: "0.22",
    lift: "-4px",
    shadowY: "26px",
    shadowBlur: "60px",
  };
}

function resetMobileTriggerTilt() {
  mobileTriggerTilt.value = createMobileTriggerTiltState();
}

function visitRandomFriend() {
  if (availableLinks.value.length === 0) {
    return;
  }

  const target = availableLinks.value[Math.floor(Math.random() * availableLinks.value.length)];
  if (!target) {
    return;
  }

  trackAnalyticsEvent("friend-random", { site: target.name });
  window.open(target.link, "_blank", "noopener,noreferrer");
}
</script>

<template>
  <section
    data-testid="friend-panel-root"
    class="relative min-h-screen w-full text-[var(--stage-fg)]"
  >
    <section data-testid="friend-panel-application" class="friend-application-pane hidden lg:block">
      <FriendLinkApplicationForm />
    </section>

    <section id="friend-links-container" data-testid="friend-panel-grid" class="friend-links-pane">
      <header data-testid="friend-panel-hero" class="friend-links-pane__header">
        <div>
          <div class="text-[11px] tracking-[0.22em] text-[var(--stage-hint)]">邻居星球</div>
          <h2 class="mt-2 text-3xl sm:text-4xl font-light text-[var(--stage-fg)] md:text-5xl">
            友链
          </h2>
        </div>
        <div class="friend-links-pane__actions">
          <button
            data-testid="friend-random-visit"
            class="friend-links-pane__random"
            type="button"
            @click="visitRandomFriend"
          >
            随机前往
          </button>
          <a
            data-testid="friend-travellings"
            class="friend-links-pane__travellings"
            :href="TRAVELLINGS_URL"
            :aria-label="TRAVELLINGS_TITLE"
            :title="TRAVELLINGS_TITLE"
            target="_blank"
            rel="noopener noreferrer"
            data-analytics-event="travellings-outbound"
            data-analytics-event-location="friend"
          >
            开往
          </a>
          <span class="friend-links-pane__count">{{ availableLinks.length }} 个正常站点</span>
        </div>
      </header>

      <FriendLinkGrid v-if="availableLinks.length > 0" :links="availableLinks" />
      <p v-else data-testid="friend-online-empty" class="friend-links-pane__empty">
        暂时没有可用的友链。
      </p>

      <section
        v-if="offlineLinks.length > 0"
        data-testid="friend-offline-section"
        class="friend-offline-section"
        aria-labelledby="friend-offline-title"
      >
        <header class="friend-offline-section__header">
          <div>
            <div class="text-[11px] tracking-[0.22em] text-[var(--stage-hint)]">失联坐标</div>
            <h3 id="friend-offline-title" class="friend-offline-section__title">失联</h3>
          </div>
          <span class="friend-links-pane__count">{{ offlineLinks.length }} 个站点</span>
        </header>
        <p class="friend-offline-section__hint">
          这些站点最近一次每日连通性检查未通过；恢复后会自动回到上面的友链区域。
        </p>
        <FriendLinkGrid :links="offlineLinks" />
      </section>
    </section>

    <button
      data-testid="friend-mobile-drawer-toggle"
      class="friend-mobile-application-trigger lg:hidden"
      :style="mobileTriggerStyle"
      type="button"
      @blur="resetMobileTriggerTilt"
      @focus="handleMobileTriggerFocus"
      @click="openMobileApplication"
      @pointerleave="resetMobileTriggerTilt"
      @pointermove="handleMobileTriggerPointerMove"
    >
      提交友链
    </button>

    <Transition name="friend-drawer">
      <div
        v-show="isMobileApplicationOpen"
        :aria-hidden="!isMobileApplicationOpen"
        data-testid="friend-mobile-drawer"
        class="friend-mobile-drawer lg:hidden"
        :inert="!isMobileApplicationOpen"
      >
        <button
          class="friend-mobile-drawer__backdrop"
          type="button"
          aria-label="关闭提交友链抽屉"
          @click="closeMobileApplication"
        />
        <section class="friend-mobile-drawer__sheet" aria-label="提交友链">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div class="text-[11px] tracking-[0.18em] text-[var(--stage-hint)]">提交友链</div>
            <button
              data-testid="friend-mobile-drawer-close"
              class="friend-mobile-drawer__close"
              type="button"
              @click="closeMobileApplication"
            >
              关闭
            </button>
          </div>
          <FriendLinkApplicationForm />
        </section>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.friend-application-pane {
  position: fixed;
  top: 15vh;
  bottom: 12vh;
  left: 4vw;
  z-index: 22;
  width: min(28vw, 420px);
  min-width: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.friend-application-pane::-webkit-scrollbar {
  display: none;
}

.friend-links-pane {
  position: fixed;
  top: 5.25rem;
  right: 1rem;
  bottom: 6rem;
  left: 1rem;
  z-index: 21;
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 251, 241, 0.72), rgba(255, 255, 255, 0.48)),
    var(--surface-soft);
  box-shadow: 0 8px 32px rgba(37, 32, 22, 0.12);
  scrollbar-width: none;
}

.friend-links-pane::-webkit-scrollbar {
  display: none;
}

.friend-links-pane__header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-subtle);
  padding: 1.1rem 1.15rem 0.9rem;
}

.friend-links-pane__empty {
  margin: 1.1rem 0.9rem;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  padding: 1rem;
  color: var(--stage-hint);
  text-align: center;
}

.friend-offline-section {
  flex-shrink: 0;
  margin: 0.5rem 0.9rem 1.6rem;
  border-top: 1px solid var(--border-subtle);
  padding-top: 1.35rem;
}

.friend-offline-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-inline: 0.25rem;
}

.friend-offline-section__title {
  margin-top: 0.4rem;
  color: var(--stage-fg);
  font-size: clamp(1.5rem, 2.5vw, 2.25rem);
  font-weight: 300;
  line-height: 1.1;
}

.friend-offline-section__hint {
  max-width: 42rem;
  padding: 0.8rem 0.25rem 0;
  color: var(--stage-hint);
  font-size: 0.78rem;
  line-height: 1.8;
}

.friend-links-pane__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
}

.friend-links-pane__random,
.friend-links-pane__travellings,
.friend-links-pane__count {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 0.45rem 0.7rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--stage-hint-strong);
}

.friend-links-pane__random {
  background: rgba(255, 255, 255, 0.14);
  transition:
    border-color 180ms ease,
    color 180ms ease,
    background 180ms ease;
}

.friend-links-pane__random:hover {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.2);
  color: var(--stage-fg);
}

.friend-links-pane__travellings {
  background: rgba(255, 255, 255, 0.14);
  transition:
    border-color 180ms ease,
    color 180ms ease,
    background 180ms ease;
  text-decoration: none;
}

.friend-links-pane__travellings:hover {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.2);
  color: var(--stage-fg);
}

.friend-mobile-application-trigger {
  position: fixed;
  right: 1rem;
  bottom: 1.2rem;
  z-index: 30;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--stage-fg);
  padding: 0.78rem 1.1rem;
  color: var(--stage-bg);
  box-shadow: 0 var(--friend-trigger-shadow-y) var(--friend-trigger-shadow-blur) rgba(0, 0, 0, 0.2);
  transform: perspective(720px) translateY(var(--friend-trigger-lift))
    rotateX(var(--friend-trigger-rotate-x)) rotateY(var(--friend-trigger-rotate-y));
  transform-style: preserve-3d;
  transition:
    border-color 220ms ease,
    box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}

.friend-mobile-application-trigger::before {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(
      circle at var(--friend-trigger-glare-x) var(--friend-trigger-glare-y),
      rgba(255, 255, 255, 0.58),
      rgba(255, 255, 255, 0.18) 30%,
      transparent 62%
    );
  content: "";
  opacity: var(--friend-trigger-glare-opacity);
  pointer-events: none;
  transition: opacity 180ms ease;
}

.friend-mobile-application-trigger:hover,
.friend-mobile-application-trigger:focus-visible {
  border-color: var(--stage-fg);
}

.friend-mobile-drawer {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.friend-mobile-drawer__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.34);
}

.friend-mobile-drawer__sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  max-height: 86vh;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px 8px 0 0;
  background: var(--stage-bg);
  padding: 1rem;
  box-shadow: 0 -24px 70px rgba(0, 0, 0, 0.32);
}

.friend-mobile-drawer__close {
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 0.42rem 0.75rem;
  color: var(--stage-hint-strong);
}

.friend-drawer-enter-active,
.friend-drawer-leave-active {
  transition: opacity 220ms ease;
}

.friend-drawer-enter-active .friend-mobile-drawer__sheet,
.friend-drawer-leave-active .friend-mobile-drawer__sheet {
  transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.friend-drawer-enter-from,
.friend-drawer-leave-to {
  opacity: 0;
}

.friend-drawer-enter-from .friend-mobile-drawer__sheet,
.friend-drawer-leave-to .friend-mobile-drawer__sheet {
  transform: translateY(100%);
}

:root[data-theme="night"] .friend-links-pane {
  background:
    linear-gradient(135deg, rgba(12, 16, 32, 0.58), rgba(8, 12, 24, 0.42)), var(--surface-soft);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
}

:root[data-theme="night"] .friend-links-pane__random,
:root[data-theme="night"] .friend-links-pane__travellings {
  background: rgba(8, 12, 24, 0.28);
}

@media (max-width: 639px) {
  .friend-links-pane__header {
    flex-direction: column;
    align-items: stretch;
  }

  .friend-links-pane__actions {
    justify-content: flex-start;
  }
}

@media (min-width: 1024px) {
  .friend-mobile-application-trigger {
    display: none;
  }

  .friend-links-pane {
    top: 12vh;
    right: 4vw;
    bottom: 8vh;
    left: auto;
    width: 64vw;
  }

  .friend-links-pane__header {
    padding: 1.25rem 1.45rem 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .friend-mobile-application-trigger,
  .friend-drawer-enter-active,
  .friend-drawer-leave-active,
  .friend-drawer-enter-active .friend-mobile-drawer__sheet,
  .friend-drawer-leave-active .friend-mobile-drawer__sheet {
    transition: none;
  }

  .friend-mobile-application-trigger {
    transform: none;
    will-change: auto;
  }

  .friend-mobile-application-trigger::before {
    opacity: 0;
  }
}
</style>

import { nextTick } from "vue";
import gsap from "gsap";

import {
  playBladeAccent,
  playFocusPush,
  playScrim,
  type PresetName,
} from "@/motion/route-transition-presets";

export type TransitionKind =
  | "panelTransition"
  | "pageToPost"
  | "postToPage"
  | "overlayOpen"
  | "overlayClose";

function getReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getShell() {
  const shell = document.querySelector<HTMLElement>("[data-route-shell]");
  if (!shell) return null;

  return {
    shell,
    stage: shell.querySelector<HTMLElement>("[data-route-stage]"),
    scrim: shell.querySelector<HTMLElement>("[data-transition-scrim]"),
    blade: shell.querySelector<HTMLElement>("[data-transition-blade]"),
  };
}

function getPrimaryTarget(kind: TransitionKind) {
  switch (kind) {
    case "overlayOpen":
    case "overlayClose":
      return document.querySelector<HTMLElement>("[data-reading-surface]");
    case "pageToPost":
    case "postToPage":
      return document.querySelector<HTMLElement>("[data-post-surface]");
    case "panelTransition":
    default:
      return document.querySelector<HTMLElement>("[data-panel-active='true']");
  }
}

let activeTimeline: gsap.core.Timeline | null = null;
let transitioning = false;

export function getTransitionPresetName(kind: TransitionKind): PresetName {
  if (kind === "panelTransition") return "panelShift";
  if (kind === "postToPage") return "softReturn";
  return "focusPush";
}

function killActiveTimeline() {
  if (!activeTimeline) return;
  activeTimeline.kill();
  activeTimeline = null;
}

export function isTransitioning() {
  return transitioning;
}

export async function playRouteTransition(options: {
  kind: TransitionKind;
  directEntry?: boolean;
}) {
  const shellRefs = getShell();
  const reducedMotion = getReducedMotionPreference();
  await nextTick();

  const target = getPrimaryTarget(options.kind);
  if (!shellRefs || !target) {
    transitioning = false;
    return;
  }

  transitioning = true;
  killActiveTimeline();

  const { scrim, blade } = shellRefs;
  const useSoftReturn = options.kind === "postToPage";
  const needsBlade = options.kind === "pageToPost" || options.kind === "overlayOpen";

  activeTimeline = gsap.timeline({
    onComplete: () => {
      if (scrim) gsap.set(scrim, { clearProps: "all" });
      if (blade) gsap.set(blade, { clearProps: "all" });
      gsap.set(target, { clearProps: "all" });
      transitioning = false;
      activeTimeline = null;
    },
    onInterrupt: () => {
      transitioning = false;
      activeTimeline = null;
    },
  });

  if (scrim) {
    activeTimeline.add(playScrim(scrim, { reducedMotion, subtle: useSoftReturn }), 0);
  }

  if (blade) {
    const bladeTween = playBladeAccent(blade, {
      reducedMotion,
      skip: !!options.directEntry || !needsBlade,
    });
    if (bladeTween) activeTimeline.add(bladeTween, 0);
  }

  activeTimeline.add(
    playFocusPush(target, {
      reducedMotion,
      preset: getTransitionPresetName(options.kind),
    }),
    options.kind === "pageToPost" && !options.directEntry ? 0.08 : 0,
  );
}

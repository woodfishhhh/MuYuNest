<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import gsap from "gsap";
import * as THREE from "three";

import {
  clearSceneMagneticPointerTarget,
  projectNdcBoundsToPointerTarget,
  setSceneMagneticPointerTarget,
} from "@/utils/magnetic-pointer";
import type { HomeCardFlight } from "@/components/scene/home-card-flight";
import { getHomeGeometryAnchor, blendDockAnchors } from "@/components/scene/home-card-flight/layout";
import { createCircleTexture } from "@/components/scene/circle-texture";
import { getBlogDockTransform, type DockRect } from "@/components/scene/blog-dock";
import {
  getGeometryTransformTarget,
  hasEquivalentGeometryTransformMode,
} from "@/components/scene/geometry-transform";
// import {
//   createHomeBackdropGlyph,
//   loadHomeBackdropTexture,
//   type HomeBackdropGlyph,
// } from "@/components/scene/home-backdrop-glyph";
import {
  normalizeRotationForTween,
  shouldTweenRotation,
} from "@/components/scene/hypercube-rotation";
import {
  resolveScenePointerDownAction,
  shouldRunSceneHoverRaycast,
  shouldRaycastSceneGeometry,
  supportsWorksOrbitViewport,
} from "@/components/scene/scene-interaction";
import {
  CALM_SCENE_FRAME_INTERVAL,
  createAdaptivePixelRatio,
  getScenePixelRatioCap,
  shouldSkipSceneFrame,
  type AdaptivePixelRatio,
} from "@/components/scene/scene-frame-budget";
import { getSceneThemeActivity } from "@/components/scene/scene-theme-activity";
import {
  resolveSceneWarpPulse,
  sampleSceneWarpPulse,
  type SceneWarpPulse,
} from "@/components/scene/scene-warp-pulse";
import {
  createWorksOrbitCards,
  getWorksCenterMagnetStrength,
  WORKS_ORBIT_CARD_RENDER_LAYER,
  type WorksOrbitCards,
} from "@/components/scene/works-orbit-cards";
import { useHypercube, type Hypercube } from "@/composables/useHypercube";
import { useMobiusStrip, type MobiusStrip } from "@/composables/useMobiusStrip";
import { supportsContentLayout } from "@/utils/responsive";
import { useStarField, type StarField } from "@/composables/useStarField";
import { useTheme, type ThemeMode } from "@/composables/useTheme";
import { useThreeScene, type ThreeScene } from "@/composables/useThreeScene";
import { getWorkProjects } from "@/content/works";
import { getRouteLocationForSiteMode } from "@/utils/site-mode";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { useSiteStore } from "@/stores/site";
import type { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

interface ActiveGeometry {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  lerpColor: (target: THREE.Color, factor: number) => void;
  setOpacity: (alpha: number) => void;
}

const container = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const store = useSiteStore();
const route = useRoute();
const router = useRouter();
const { theme } = useTheme();
// The library and articles cover the scene with reading UI; behind it the sky
// only drifts, so it does not need the display's full frame rate.
const isCalmRoute = computed(() => route.name === "blog" || route.name === "post");

const homeFlightVisible = computed(() => store.mode === "home" && !store.isFocusing && store.homeExperience === "collect");
const homeFlightReady = ref(false);
const homeStarVisible = ref(false);
const homeCardHovered = ref(false);
const homeCardGrabActive = ref(false);
const homeCardScale = ref(1);
const isDragging = ref(false);
const cardHovered = ref(false);
const cardActionHovered = ref(false);
const cardGrabActive = ref(false);
const geometryHovered = ref(false);
const isMobile = ref(false);
const supportsWorksOrbit = ref(false);
const hasWorkActionHover = computed(
  () => cardActionHovered.value && !cardGrabActive.value,
);
const hasWorkCardGrabHover = computed(
  () =>
    store.mode === "works" &&
    store.worksViewMode === "orbit" &&
    cardHovered.value &&
    !cardActionHovered.value &&
    !cardGrabActive.value,
);

const onPointerDown = () => {
  if (store.isFocusing) isDragging.value = true;
};
const onPointerUp = () => {
  isDragging.value = false;
};
const onPointerLeave = () => {
  isDragging.value = false;
  pointerInsideCanvas = false;
  lensPointerActive = false;
  clearSceneMagneticPointerTarget();
  if (!worksOrbitCards?.isInteracting() && !homeCardFlight?.isInteracting()) pointer.set(0, 0);
};
const onClickBackground = (event: MouseEvent) => {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    event.stopPropagation();
    return;
  }

  if (event.target === canvasRef.value && !homeFlightVisible.value) {
    store.triggerStep();
  }
};

const CAMERA_INTRO_DURATION = 1.8;
const CAMERA_INTRO_START_POSITION = new THREE.Vector3(0, 1.5, 92);
const CAMERA_INTRO_START_LOOK = new THREE.Vector3(0, 0, 0);
const NIGHT_CLEAR_COLOR = new THREE.Color("#050510");
const DAY_CLEAR_COLOR = new THREE.Color("#FAFAF7");
const DAY_GEOMETRY_IDLE_COLOR = new THREE.Color("#151922");
const DAY_GEOMETRY_HOVER_COLOR = new THREE.Color("#3558cc");
const NIGHT_GEOMETRY_IDLE_COLOR = new THREE.Color("#ffffff");
const NIGHT_GEOMETRY_HOVER_COLOR = new THREE.Color("#7ea8ff");
const CLEAR_ALPHA = 0;
const WORKS_CASE_GEOMETRY_OPACITY = 0.32;
const WORKS_CASE_MOBILE_GEOMETRY_OPACITY = 0.14;
const HYPERCUBE_SCENE_SCALE = 1;
const MOBIUS_SCENE_SCALE = 1.7;
const INACTIVE_SCALE = 0.001;
// Let the camera and dock settle before dropping to the calm frame rate.
const CALM_ROUTE_SETTLE_SECONDS = 1.2;
const DOCK_REMEASURE_INTERVAL = 0.5;
const MAX_WARP_PULSES = 3;
const LENS_FADE_IN_RATE = 5;
const LENS_FADE_OUT_RATE = 8;
const LENS_FOLLOW_RATE = 14;

const defaultRotations = {
  night: { x: 0.5, y: 0.5, z: 0 },
  day: { x: 0.3, y: 0.36, z: 0 },
} as const;
const savedFocusRotations = {
  night: new THREE.Euler(defaultRotations.night.x, defaultRotations.night.y, defaultRotations.night.z),
  day: new THREE.Euler(defaultRotations.day.x, defaultRotations.day.y, defaultRotations.day.z),
};

let threeScene: ThreeScene | null = null;
let starField: StarField | null = null;
const sceneViewport = { width: 1, height: 1 };
let hypercube: Hypercube | null = null;
let mobius: MobiusStrip | null = null;
// let homeBackdropGlyph: HomeBackdropGlyph | null = null;
let worksOrbitCards: WorksOrbitCards | null = null;
let homeCardFlight: HomeCardFlight | null = null;
let homeFlightLoading = false;
const homeDock = { progress: 0 };
let controls: TrackballControls | null = null;
let animationFrameId: number | null = null;
let sceneTimer: THREE.Timer | null = null;
let circleTexture: THREE.CanvasTexture | null = null;
let reducedMotionQuery: MediaQueryList | null = null;
let prefersReducedMotion = false;
let geometryRoot: THREE.Group | null = null;
let blogDockAnchor: DockRect | null = null;
let blogDockViewport: DockRect | null = null;
const blogDock = { progress: 0 };
const isBlogDocking = ref(false);
// The container is fixed and full-screen, so its rect only changes on resize.
let sceneRect: DockRect | null = null;
let lastDockMeasureAt = Number.NEGATIVE_INFINITY;
let pointerInsideCanvas = false;
let homeWheelListening = false;
let lensPointerActive = false;
let lensStrength = 0;
let suppressNextCanvasClick = false;
let sceneDisposed = false;
let adaptivePixelRatio: AdaptivePixelRatio | null = null;
let lastRenderedAt: number | null = null;
let lastFrameWasCapped = false;
let calmRouteSince = 0;
let worksRitualIntensity = 0;
let warpPulses: { pulse: SceneWarpPulse; startedAt: number }[] = [];

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const smoothedPointer = new THREE.Vector2();
const geometryWorldCenter = new THREE.Vector3();
const cameraTargetPosition = new THREE.Vector3();
const cameraTargetLook = new THREE.Vector3();
const cameraLookDirection = new THREE.Vector3();
const lensCenter = new THREE.Vector2();
const worksViewport = { height: 0, width: 0 };

let introStartTime: number | null = null;
let introCompleted = false;
let lastGeometryHoverRaycastAt = Number.NEGATIVE_INFINITY;

let rotationTweenNight: gsap.core.Tween | null = null;
let rotationTweenDay: gsap.core.Tween | null = null;

function getActiveGeometry() {
  if (theme.value === "day") return mobius;
  return hypercube;
}

function measureSceneRect() {
  if (!container.value) return null;
  sceneRect = container.value.getBoundingClientRect();
  return sceneRect;
}

function measureBlogDock() {
  const anchor = document.querySelector<HTMLElement>("[data-scene-blog-dock]");
  if (!anchor || !container.value) return;
  blogDockAnchor = anchor.getBoundingClientRect();
  blogDockViewport = measureSceneRect();
}

function isDockTweening(progress: number) {
  return progress > 0 && progress < 1;
}

function updateBlogDock(immediate = false) {
  lastDockMeasureAt = Number.NEGATIVE_INFINITY;
  measureBlogDock();
  gsap.killTweensOf(blogDock);
  gsap.killTweensOf(homeDock);
  const homeProgress = homeFlightVisible.value ? 1 : 0;
  if (immediate || prefersReducedMotion) homeDock.progress = homeProgress;
  else gsap.to(homeDock, { progress: homeProgress, duration: 0.8, ease: "power2.inOut" });
  isBlogDocking.value = false;
  const progress = store.mode === "blog" && !store.isFocusing ? 1 : 0;
  if (immediate || prefersReducedMotion) {
    blogDock.progress = progress;
  } else if (blogDock.progress !== progress) {
    isBlogDocking.value = progress === 1;
    gsap.to(blogDock, {
      progress,
      duration: 0.85,
      ease: "power2.inOut",
      onComplete: () => { isBlogDocking.value = false; },
    });
  }
}

function applyBlogDock(elapsed: number) {
  if (!geometryRoot || !threeScene) return;
  const progress = Math.min(1, blogDock.progress + homeDock.progress);
  if (progress === 0) {
    geometryRoot.matrixAutoUpdate = true;
    geometryRoot.position.set(0, 0, 0);
    geometryRoot.rotation.set(0, 0, 0);
    geometryRoot.scale.setScalar(1);
    hypercube?.setPointScale(hypercube.group.scale.x);
    return;
  }
  // While the dock tweens, the nav may still be mounting, so look for it every
  // frame. At rest a missing anchor is retried twice a second: a full-document
  // query per frame is most expensive on long article pages.
  const docking = isDockTweening(blogDock.progress) || isDockTweening(homeDock.progress);
  if (
    (!blogDockAnchor || !blogDockViewport) &&
    (docking || elapsed - lastDockMeasureAt > DOCK_REMEASURE_INTERVAL)
  ) {
    lastDockMeasureAt = elapsed;
    measureBlogDock();
  }
  // Reading layout every frame would force a synchronous reflow whenever Vue
  // or GSAP touched the DOM earlier in the frame.
  const viewport = sceneRect ?? measureSceneRect();
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return;
  const homeAnchor = getHomeGeometryAnchor(viewport);
  const anchor = blendDockAnchors(homeAnchor, blogDockAnchor ?? homeAnchor, homeDock.progress, blogDock.progress);
  const geometry = getActiveGeometry();
  if (!geometry) return;
  threeScene.camera.updateMatrixWorld();
  const diameter = (theme.value === "day" ? 6 : 10) * geometry.group.scale.x;
  const target = getBlogDockTransform(threeScene.camera, viewport, anchor, diameter, progress);
  geometryRoot.position.copy(target.position).multiplyScalar(progress);
  geometryRoot.scale.setScalar(1 + (target.scale - 1) * progress);
  geometryRoot.quaternion.identity().slerp(threeScene.camera.quaternion, progress);
  // A uniform scale/rotation alone cannot undo the perspective skew at a
  // screen corner. Keep the correction in the matrix instead of decomposing it.
  geometryRoot.matrixAutoUpdate = false;
  geometryRoot.updateMatrix();
  geometryRoot.matrix.multiply(target.projectionCorrection);
  if (hypercube) hypercube.setPointScale(geometryRoot.scale.x * hypercube.group.scale.x);
}

function getGeometryByTheme(nextTheme: ThemeMode): ActiveGeometry | null {
  if (nextTheme === "day") {
    return mobius;
  }
  return hypercube;
}

function applyThemeGeometryState(nextTheme: ThemeMode) {
  if (!hypercube || !mobius) return;

  const activity = getSceneThemeActivity(nextTheme);
  const isDay = nextTheme === "day";
  const usesCaseLayout =
    store.mode === "works" && (store.worksViewMode === "case" || !supportsWorksOrbit.value);
  const activeOpacity =
    usesCaseLayout && !store.isFocusing
      ? isMobile.value
        ? WORKS_CASE_MOBILE_GEOMETRY_OPACITY
        : WORKS_CASE_GEOMETRY_OPACITY
      : 1;

  hypercube.setOpacity(isDay ? 0 : activeOpacity);
  mobius.setOpacity(isDay ? activeOpacity : 0);
  hypercube.group.visible = activity.hypercube;
  mobius.group.visible = activity.mobius;
}

function applyGroupTransform(
  group: THREE.Group,
  rotationTweenRef: "night" | "day",
  options: {
    position: THREE.Vector3;
    scale: number;
    rotation: { x: number; y: number; z: number };
    immediate: boolean;
  },
) {
  const activeRotationTween = rotationTweenRef === "night" ? rotationTweenNight : rotationTweenDay;
  if (activeRotationTween) {
    activeRotationTween.kill();
    if (rotationTweenRef === "night") rotationTweenNight = null;
    else rotationTweenDay = null;
  }

  if (options.immediate) {
    gsap.killTweensOf(group.position);
    gsap.killTweensOf(group.rotation);
    gsap.killTweensOf(group.scale);
    group.position.copy(options.position);
    group.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z);
    group.scale.setScalar(options.scale);
    return;
  }

  const normalizedRotation = normalizeRotationForTween(
    {
      x: group.rotation.x,
      y: group.rotation.y,
      z: group.rotation.z,
    },
    options.rotation,
  );
  group.rotation.set(normalizedRotation.x, normalizedRotation.y, normalizedRotation.z);

  gsap.to(group.position, {
    x: options.position.x,
    y: options.position.y,
    z: options.position.z,
    duration: 0.8,
    ease: "power2.out",
    overwrite: "auto",
  });

  if (shouldTweenRotation(normalizedRotation, options.rotation)) {
    const nextTween = gsap.to(group.rotation, {
      x: options.rotation.x,
      y: options.rotation.y,
      z: options.rotation.z,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => {
        if (rotationTweenRef === "night") rotationTweenNight = null;
        else rotationTweenDay = null;
      },
    });
    if (rotationTweenRef === "night") rotationTweenNight = nextTween;
    else rotationTweenDay = nextTween;
  } else {
    group.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z);
  }

  gsap.to(group.scale, {
    x: options.scale,
    y: options.scale,
    z: options.scale,
    ease: "power2.out",
    duration: 0.8,
    overwrite: "auto",
  });
}

function applyThemeImmediate(nextTheme: ThemeMode) {
  if (!threeScene || !hypercube || !mobius || !starField) return;
  const isDay = nextTheme === "day";
  applyThemeGeometryState(nextTheme);
  starField.setColor(
    isDay ? 0x111111 : 0xfcfcfc,
    isDay ? THREE.NormalBlending : THREE.AdditiveBlending,
  );
  starField.setOpacity(1);
  hypercube.group.scale.setScalar(isDay ? INACTIVE_SCALE : HYPERCUBE_SCENE_SCALE);
  mobius.group.scale.setScalar(isDay ? MOBIUS_SCENE_SCALE : INACTIVE_SCALE);
  threeScene.scene.background = null;
  threeScene.renderer.setClearColor(isDay ? DAY_CLEAR_COLOR : NIGHT_CLEAR_COLOR, CLEAR_ALPHA);
}

function updateGeometryTransform(immediate = false) {
  if (!threeScene || !hypercube || !mobius || !container.value) return;
  immediate ||= prefersReducedMotion;

  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  let splitCenterOffset = 0;

  if (supportsContentLayout(width)) {
    const aspect = width / Math.max(height, 1);
    const distance = 12;
    // For author view, panel is exactly 50vw wide, so left side bounds are 50vw. Center of that is 0.5.
    const halfScreenCenterNdc = 0.5;
    const halfFovRad = THREE.MathUtils.degToRad(threeScene.camera.fov / 2);
    splitCenterOffset = halfScreenCenterNdc * distance * Math.tan(halfFovRad) * aspect;
  }
  const inwardOffset = splitCenterOffset * 0.9;
  const target = getGeometryTransformTarget({
    mode: store.mode,
    isFocusing: store.isFocusing,
    isMobile: isMobile.value,
    inwardOffset,
  });

  const targetPosition = new THREE.Vector3(target.x, target.y, target.z);
  const activeTheme: ThemeMode = theme.value;
  const hypercubeScale = target.baseScale * HYPERCUBE_SCENE_SCALE;
  const mobiusScale = target.baseScale * MOBIUS_SCENE_SCALE;
  const inactiveScale = target.baseScale * INACTIVE_SCALE;

  const nightRotation =
    store.isFocusing && activeTheme === "night"
      ? {
          x: savedFocusRotations.night.x,
          y: savedFocusRotations.night.y,
          z: savedFocusRotations.night.z,
        }
      : immediate
        ? defaultRotations.night
        : {
            x: hypercube.group.rotation.x,
            y: hypercube.group.rotation.y,
            z: hypercube.group.rotation.z,
          };
  const dayRotation =
    store.isFocusing && activeTheme === "day"
      ? {
          x: savedFocusRotations.day.x,
          y: savedFocusRotations.day.y,
          z: savedFocusRotations.day.z,
        }
      : immediate
        ? defaultRotations.day
        : {
            x: mobius.group.rotation.x,
            y: mobius.group.rotation.y,
            z: mobius.group.rotation.z,
          };

  applyGroupTransform(hypercube.group, "night", {
    position: targetPosition,
    scale: activeTheme === "night" ? hypercubeScale : inactiveScale,
    rotation: nightRotation,
    immediate,
  });
  applyGroupTransform(mobius.group, "day", {
    position: targetPosition,
    scale: activeTheme === "day" ? mobiusScale : inactiveScale,
    rotation: dayRotation,
    immediate,
  });
}

function handleResize() {
  if (!container.value || !threeScene) return;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  worksViewport.width = width;
  worksViewport.height = height;
  sceneViewport.width = width;
  sceneViewport.height = height;
  store.syncHomeExperience(width);
  isMobile.value = !supportsContentLayout(width);
  measureSceneRect();
  measureBlogDock();
  homeCardFlight?.resize(width, height);
  supportsWorksOrbit.value = supportsWorksOrbitViewport(width);
  applyThemeGeometryState(theme.value);

  // Keep the adapted resolution across ordinary resizes; a new screen density restarts it.
  const pixelRatioCap = getScenePixelRatioCap(window.devicePixelRatio);
  adaptivePixelRatio?.setMax(pixelRatioCap);
  threeScene.renderer.setPixelRatio(adaptivePixelRatio?.value ?? pixelRatioCap);
  threeScene.resize(width, height);
  controls?.handleResize();
  // homeBackdropGlyph?.updateViewport({ height, width });
  updateGeometryTransform();
  updateWorksOrbitCards();
}

function handleReducedMotionChange(event: MediaQueryListEvent) {
  prefersReducedMotion = event.matches;
  if (prefersReducedMotion) {
    // Stop decorative motion now rather than letting it play out.
    warpPulses = [];
    lensStrength = 0;
    starField?.setLens(lensCenter, 0, 1);
  }
  updateBlogDock(true);
  updateGeometryTransform(true);
  updateWorksOrbitCards();
}

function updateWorksOrbitCards(elapsed = 0, delta = 0) {
  if (!container.value || !threeScene) return;
  const activeGeometry = getActiveGeometry();
  const visible =
    store.mode === "works" &&
    blogDock.progress === 0 &&
    supportsWorksOrbit.value &&
    !store.isFocusing &&
    !!activeGeometry;

  // Cards belong to the Works orbit, not the geometry's journey into the navbar.
  if (!worksOrbitCards) {
    if (!visible) return;
    worksOrbitCards = createWorksOrbitCards({ theme: theme.value, works: getWorkProjects() });
    threeScene.scene.add(worksOrbitCards.group);
  }

  if (!visible && !worksOrbitCards.group.visible) return;

  if (activeGeometry) {
    activeGeometry.group.getWorldPosition(geometryWorldCenter);
  } else {
    geometryWorldCenter.set(0, 0, 0);
  }

  worksOrbitCards.update({
    camera: threeScene.camera,
    center: geometryWorldCenter,
    delta,
    elapsed,
    layout: store.worksViewMode,
    pointerNdc: pointer,
    reducedMotion: prefersReducedMotion,
    viewport: worksViewport,
    visible,
  });

  if (!visible) {
    worksOrbitCards.setHovered(null);
    worksOrbitCards.clearInteraction();
    cardHovered.value = false;
    cardActionHovered.value = false;
    cardGrabActive.value = false;
  }

  const ritualIntensity =
    visible && worksOrbitCards.isInteracting() ? getWorksCenterMagnetStrength(pointer, prefersReducedMotion) : 0;
  hypercube?.setInteractionIntensity(theme.value === "night" ? ritualIntensity : 0);
  mobius?.setInteractionIntensity(theme.value === "day" ? ritualIntensity : 0);
  // Mixed with navigation warp pulses in the frame loop.
  worksRitualIntensity = ritualIntensity;
}

function handleRouteWarp(fromRouteName: string | null, toRouteName: string | null) {
  // The intro flight already moves through the stars; reduced motion keeps them still.
  if (prefersReducedMotion || !introCompleted || !sceneTimer) return;
  const pulse = resolveSceneWarpPulse(fromRouteName, toRouteName);
  if (!pulse) return;
  // Pulses add up, so a quick second navigation blends into the first one
  // instead of stopping and reversing the stars within a frame.
  warpPulses = [
    ...warpPulses.slice(1 - MAX_WARP_PULSES),
    { pulse, startedAt: sceneTimer.getElapsed() },
  ];
}

function getStarWarpIntensity(elapsed: number) {
  let pulseIntensity = 0;
  if (warpPulses.length > 0) {
    warpPulses = warpPulses.filter(({ pulse, startedAt }) => elapsed - startedAt < pulse.duration);
    for (const { pulse, startedAt } of warpPulses) {
      pulseIntensity += sampleSceneWarpPulse(pulse, elapsed - startedAt);
    }
  }
  return Math.abs(pulseIntensity) > worksRitualIntensity ? pulseIntensity : worksRitualIntensity;
}

function updateStarLens(delta: number) {
  if (!starField) return;
  const target =
    lensPointerActive &&
    !prefersReducedMotion &&
    !isCalmRoute.value &&
    !store.isFocusing &&
    !worksOrbitCards?.isInteracting() &&
    !homeCardFlight?.isInteracting()
      ? 1
      : 0;
  if (target === 0 && lensStrength === 0) return;

  // Appear under the pointer instead of sliding in from the last exit point.
  if (lensStrength === 0) lensCenter.copy(pointer);
  else if (target > 0) lensCenter.lerp(pointer, 1 - Math.exp(-delta * LENS_FOLLOW_RATE));
  const rate = target > lensStrength ? LENS_FADE_IN_RATE : LENS_FADE_OUT_RATE;
  lensStrength += (target - lensStrength) * (1 - Math.exp(-delta * rate));
  if (target === 0 && lensStrength < 0.002) lensStrength = 0;
  starField.setLens(lensCenter, lensStrength, sceneViewport.width / Math.max(sceneViewport.height, 1));
}

function getSceneFrameInterval(now: number) {
  if (!isCalmRoute.value || !introCompleted || warpPulses.length > 0) return 0;
  return now - calmRouteSince >= CALM_ROUTE_SETTLE_SECONDS ? CALM_SCENE_FRAME_INTERVAL : 0;
}

async function ensureHomeCardFlight() {
  if (homeCardFlight || homeFlightLoading || !threeScene || !container.value || !homeFlightVisible.value) return;
  homeFlightLoading = true;
  const mountedScene = threeScene;
  try {
    const { createHomeCardFlight } = await import("@/components/scene/home-card-flight");
    if (sceneDisposed || threeScene !== mountedScene || !container.value || !homeFlightVisible.value) return;
    homeCardFlight = createHomeCardFlight({
      renderer: mountedScene.renderer,
      width: Math.max(container.value.clientWidth, 1),
      height: Math.max(container.value.clientHeight, 1),
      theme: theme.value,
      onReady: () => {
        if (sceneDisposed) return;
        homeCardFlight?.update(0, homeFlightVisible.value, prefersReducedMotion);
        homeFlightReady.value = true;
      },
      onError: (error) => { console.error("Home card assets failed to load", error); },
    });
  } finally { homeFlightLoading = false; }
}

function handleHomeTouchMove(event: TouchEvent) {
  if (homeCardFlight?.isInteracting()) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function renderSceneFrame() {
  if (!threeScene) return;

  const { camera, renderer, scene } = threeScene;
  if (!worksOrbitCards?.group.visible) {
    camera.layers.set(0);
    threeScene.render();
    homeCardFlight?.render();
    return;
  }

  const previousAutoClear = renderer.autoClear;
  const previousBackground = scene.background;

  try {
    renderer.autoClear = false;
    renderer.clear(true, true, true);
    camera.layers.set(0);
    renderer.render(scene, camera);
    worksOrbitCards.captureBackdrop(renderer);
    camera.layers.set(WORKS_ORBIT_CARD_RENDER_LAYER);
    scene.background = null;
    renderer.render(scene, camera);
  } finally {
    scene.background = previousBackground;
    camera.layers.set(0);
    renderer.autoClear = previousAutoClear;
  }
}

function updatePointerFromEvent(event: PointerEvent | MouseEvent) {
  const rect = sceneRect ?? measureSceneRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function handlePointerMove(event: PointerEvent) {
  pointerInsideCanvas = true;
  // Touch has no hover; a lens stuck under a lifted finger would read as a glitch.
  lensPointerActive = event.pointerType === "mouse";
  updatePointerFromEvent(event);
  if (homeFlightVisible.value && homeCardFlight) {
    if (homeCardFlight.isInteracting()) {
      event.stopPropagation();
      homeCardFlight.drag(pointer);
    }
    homeCardHovered.value = !!homeCardFlight.pick(pointer);
  }
  if (worksOrbitCards?.isInteracting()) {
    event.stopPropagation();
    worksOrbitCards.drag(pointer);
  }
}

function syncWorksMagneticPointerTarget(hit: ReturnType<WorksOrbitCards["pick"]>) {
  if (!pointerInsideCanvas || !hit || !worksOrbitCards || !container.value) {
    clearSceneMagneticPointerTarget();
    return;
  }

  const screenBounds = worksOrbitCards.getActionScreenBounds(hit);
  if (!screenBounds) {
    clearSceneMagneticPointerTarget();
    return;
  }

  // Runs every Works frame; the cached rect avoids a forced layout per frame.
  const viewport = sceneRect ?? measureSceneRect();
  if (!viewport) return;
  setSceneMagneticPointerTarget(
    projectNdcBoundsToPointerTarget(
      `works-action:${hit.slug}:${hit.action}`,
      screenBounds,
      viewport,
      4,
    ),
  );
}

function releaseCardInteraction(event?: PointerEvent) {
  if (homeCardFlight?.isInteracting()) {
    event?.stopPropagation();
    suppressNextCanvasClick = true;
    homeCardFlight.release();
    homeCardGrabActive.value = false;
    setHomeWheelListening(false);
    if (event?.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    return;
  }
  if (!worksOrbitCards?.isInteracting()) return;

  if (event) {
    updatePointerFromEvent(event);
    worksOrbitCards.drag(pointer);
  }
  event?.stopPropagation();
  suppressNextCanvasClick = true;
  const result = worksOrbitCards.release(sceneTimer?.getElapsed() ?? 0);
  if (result?.action === "launch") {
    const project = getWorkProjects().find((work) => work.liveUrl === result.url);
    trackAnalyticsEvent("works-drag-launch", { project: project?.slug ?? "unknown" });
    window.open(result.url, "_blank", "noopener,noreferrer");
  }
  cardGrabActive.value = worksOrbitCards.isInteracting();

  if (event?.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

// Only a held card consumes the wheel. Listening for the whole session would
// make every article and panel scroll wait on the main thread.
function setHomeWheelListening(listening: boolean) {
  if (listening === homeWheelListening) return;
  homeWheelListening = listening;
  if (listening) window.addEventListener("wheel", handleHomeWheel, { passive: false });
  else window.removeEventListener("wheel", handleHomeWheel);
}

function handleHomeWheel(event: WheelEvent) {
  if (!homeFlightVisible.value || !homeCardFlight?.isInteracting() || event.ctrlKey) return;
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? (container.value?.clientHeight ?? window.innerHeight) : 1;
  const scale = homeCardFlight.zoomHeld(event.deltaY * unit);
  if (scale === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  homeCardScale.value = Number(scale.toFixed(3));
}

function handleCanvasPointerDown(event: PointerEvent) {
  if (store.isFocusing || !threeScene) return;
  updatePointerFromEvent(event);
  if (homeFlightVisible.value && event.button === 0 && homeCardFlight?.beginDrag(pointer)) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextCanvasClick = true;
    homeCardGrabActive.value = true;
    homeCardScale.value = 1;
    setHomeWheelListening(true);
    if (event.currentTarget instanceof HTMLCanvasElement) event.currentTarget.setPointerCapture(event.pointerId);
    return;
  }
  raycaster.setFromCamera(pointer, threeScene.camera);

  if (store.mode === "works" && supportsWorksOrbit.value) {
    const worksActionHit = worksOrbitCards?.pick(raycaster, pointer);
    const worksCardHit = worksOrbitCards?.pickHover(raycaster, pointer);
    const action = resolveScenePointerDownAction({
      mode: store.mode,
      worksViewMode: store.worksViewMode,
      isFocusing: store.isFocusing,
      isMobile: !supportsWorksOrbit.value,
      hasWorksActionHit: !!worksActionHit,
      hasWorksCardHit: !!worksCardHit,
      hasGeometryHit: false,
    });

    if (action === "grab-card" && worksCardHit) {
      event.stopPropagation();
      suppressNextCanvasClick = true;
      if (event.currentTarget instanceof HTMLCanvasElement) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      worksOrbitCards?.beginDrag(worksCardHit, pointer);
      cardHovered.value = true;
      cardGrabActive.value = true;
    }
    if (action === "activate-card" && worksActionHit) {
      event.stopPropagation();
      suppressNextCanvasClick = true;
      trackAnalyticsEvent("works-outbound", {
        action: worksActionHit.action,
        project: worksActionHit.slug,
      });
      window.open(worksActionHit.url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  if (!shouldRaycastSceneGeometry(store.mode, store.worksViewMode, store.isFocusing, isMobile.value, store.homeExperience)) {
    return;
  }

  const activeGeometry = getActiveGeometry();
  if (!activeGeometry) return;

  const intersects = raycaster.intersectObject(activeGeometry.hitMesh);
  const action = resolveScenePointerDownAction({
    mode: store.mode,
    worksViewMode: store.worksViewMode,
    isFocusing: store.isFocusing,
    isMobile: isMobile.value,
    hasWorksActionHit: false,
    hasWorksCardHit: false,
    hasGeometryHit: intersects.length > 0,
    homeExperience: store.homeExperience,
  });

  if (action !== "focus-geometry") return;

  event.stopPropagation();

  const targetRotation = theme.value === "day" ? savedFocusRotations.day : savedFocusRotations.night;
  targetRotation.copy(activeGeometry.group.rotation);

  store.goHome();
  store.enterFocus();
  void router.push(getRouteLocationForSiteMode("home"));
}

onMounted(async () => {
  if (!container.value || !canvasRef.value) return;
  sceneDisposed = false;

  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  sceneViewport.width = width;
  sceneViewport.height = height;
  store.syncHomeExperience(width);
  isMobile.value = !supportsContentLayout(width);
  supportsWorksOrbit.value = supportsWorksOrbitViewport(width);
  worksViewport.width = width;
  worksViewport.height = height;

  threeScene = useThreeScene({
    canvas: canvasRef.value,
    height,
    transparentBackground: true,
    width,
  });
  adaptivePixelRatio = createAdaptivePixelRatio(getScenePixelRatioCap(window.devicePixelRatio));
  calmRouteSince = performance.now() / 1000;
  measureSceneRect();
  threeScene.camera.position.copy(CAMERA_INTRO_START_POSITION);
  threeScene.camera.lookAt(CAMERA_INTRO_START_LOOK);

  // void loadHomeBackdropTexture()
  //   .then((texture) => {
  //     if (!threeScene || sceneDisposed || !container.value) {
  //       texture.dispose();
  //       return;
  //     }
  //
  //     const nextGlyph = createHomeBackdropGlyph({ texture, theme: theme.value });
  //     nextGlyph.updateViewport({
  //       height: container.value.clientHeight,
  //       width: container.value.clientWidth,
  //     });
  //     homeBackdropGlyph = nextGlyph;
  //     threeScene.scene.add(nextGlyph.group);
  //   })
  //   .catch(() => {});

  circleTexture = createCircleTexture();
  starField = useStarField(circleTexture);
  threeScene.scene.add(starField.group);

  hypercube = useHypercube(circleTexture);
  mobius = useMobiusStrip();
  geometryRoot = new THREE.Group();
  geometryRoot.add(hypercube.group, mobius.group);
  threeScene.scene.add(geometryRoot);

  const mountedScene = threeScene;
  const { TrackballControls } = await import("three/examples/jsm/controls/TrackballControls.js");
  if (sceneDisposed || threeScene !== mountedScene || !container.value || !canvasRef.value) {
    return;
  }

  const nextControls = new TrackballControls(mountedScene.camera, mountedScene.renderer.domElement);
  if (sceneDisposed || threeScene !== mountedScene || !container.value || !canvasRef.value) {
    nextControls.dispose();
    return;
  }

  controls = nextControls;
  controls.noZoom = false;
  controls.noPan = true;
  controls.rotateSpeed = 2;
  controls.zoomSpeed = 0.9;
  controls.staticMoving = false;
  controls.dynamicDampingFactor = 0.08;
  controls.maxDistance = 15;
  controls.enabled = store.isFocusing;

  applyThemeImmediate(theme.value);
  updateGeometryTransform(true);

  window.addEventListener("resize", handleResize);
  container.value.addEventListener("pointermove", handlePointerMove);
  canvasRef.value.addEventListener("pointerdown", handleCanvasPointerDown);
  canvasRef.value.addEventListener("pointerup", releaseCardInteraction);
  canvasRef.value.addEventListener("pointercancel", releaseCardInteraction);
  canvasRef.value.addEventListener("lostpointercapture", releaseCardInteraction);
  canvasRef.value.addEventListener("touchmove", handleHomeTouchMove, { passive: false });
  void ensureHomeCardFlight();

  if (typeof window.matchMedia === "function") {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = reducedMotionQuery.matches;

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    } else {
      reducedMotionQuery.addListener(handleReducedMotionChange);
    }
  }

  updateBlogDock(true);
  void document.fonts?.ready.then(() => {
    if (!sceneDisposed) measureBlogDock();
  });
  sceneTimer = new THREE.Timer();
  sceneTimer.connect(document);

  function tick(timestamp?: number) {
    if (!threeScene || !starField || !hypercube || !mobius || !sceneTimer) return;

    const now = (timestamp ?? performance.now()) / 1000;
    const frameInterval = getSceneFrameInterval(now);
    if (shouldSkipSceneFrame(now, lastRenderedAt, frameInterval)) {
      animationFrameId = requestAnimationFrame(tick);
      return;
    }
    lastRenderedAt = now;

    sceneTimer.update(timestamp);
    const delta = sceneTimer.getDelta();
    const elapsed = sceneTimer.getElapsed();

    // Capped frames say nothing about GPU headroom, and neither does the first
    // uncapped frame after them.
    const frameCapped = frameInterval > 0;
    const nextPixelRatio =
      frameCapped || lastFrameWasCapped ? null : adaptivePixelRatio?.sample(delta) ?? null;
    lastFrameWasCapped = frameCapped;
    if (nextPixelRatio !== null) threeScene.renderer.setPixelRatio(nextPixelRatio);

    const activeGeometry = getActiveGeometry();
    hypercube.setDockProgress(blogDock.progress);
    activeGeometry?.update(prefersReducedMotion ? 0 : delta);

    if (
      activeGeometry &&
      !store.isFocusing &&
      !prefersReducedMotion &&
      !worksOrbitCards?.isInteracting() &&
      !rotationTweenNight &&
      !rotationTweenDay
    ) {
      activeGeometry.group.rotation.y += delta * 0.1;
      activeGeometry.group.rotation.x += delta * 0.05;
    }

    if (store.isFocusing) {
      controls?.update();
    } else {
      if (introStartTime === null) {
        introStartTime = elapsed;
      }

      cameraTargetPosition.set(0, 0, 10);
      cameraTargetLook.set(0, 0, 0);

      if (store.mode === "blog" || store.mode === "author" || store.mode === "friend" || store.mode === "works") {
        cameraTargetPosition.set(0, 0, 12);
      } else if (store.mode === "reading") {
        cameraTargetPosition.set(0, 0, 15);
      }

      if (prefersReducedMotion) {
        introCompleted = true;
        threeScene.camera.position.copy(cameraTargetPosition);
        threeScene.camera.lookAt(cameraTargetLook);
      } else if (!introCompleted && introStartTime !== null) {
        const introProgress = (elapsed - introStartTime) / CAMERA_INTRO_DURATION;
        const normalizedProgress = Math.min(Math.max(introProgress, 0), 1);
        const easedProgress = 1 - Math.pow(1 - normalizedProgress, 4);

        threeScene.camera.position.lerpVectors(CAMERA_INTRO_START_POSITION, cameraTargetPosition, easedProgress);
        threeScene.camera.lookAt(cameraTargetLook);

        if (normalizedProgress >= 1) introCompleted = true;
      } else {
        smoothedPointer.lerp(pointer, 2.2 * delta);
        cameraTargetPosition.x += smoothedPointer.x * 0.45;
        cameraTargetPosition.y += smoothedPointer.y * 0.25;
        cameraTargetLook.x += smoothedPointer.x * 0.65;
        cameraTargetLook.y += smoothedPointer.y * 0.35;

        threeScene.camera.getWorldDirection(cameraLookDirection);
        cameraLookDirection.add(threeScene.camera.position);
        cameraLookDirection.lerp(cameraTargetLook, 2 * delta);
        threeScene.camera.lookAt(cameraLookDirection);
        threeScene.camera.position.lerp(cameraTargetPosition, 2 * delta);
      }
    }

    starField.setCollectMode(homeFlightVisible.value, prefersReducedMotion);
    starField.setWarpIntensity(getStarWarpIntensity(elapsed));
    updateStarLens(delta);
    starField.update(prefersReducedMotion ? 0 : delta, { camera: threeScene.camera, ...sceneViewport, pointer: smoothedPointer });
    applyBlogDock(elapsed);
    homeCardFlight?.update(delta, homeFlightVisible.value, prefersReducedMotion);
    homeStarVisible.value = homeFlightVisible.value && !!homeCardFlight?.isStarVisible();
    if (!homeFlightVisible.value) {
      homeCardHovered.value = false;
      homeCardGrabActive.value = false;
    }
    // The flight can drop a held card on its own (hidden panel, mode switch).
    if (homeWheelListening && !homeCardFlight?.isInteracting()) setHomeWheelListening(false);
    updateWorksOrbitCards(elapsed, delta);

    const activeRaycastGeometry = getActiveGeometry();
    let worksHit: ReturnType<WorksOrbitCards["pick"]> = null;
    if (
      !store.isFocusing &&
      store.mode === "works" &&
      supportsWorksOrbit.value &&
      worksOrbitCards?.group.visible
    ) {
      raycaster.setFromCamera(pointer, threeScene.camera);
      worksHit = worksOrbitCards.pick(raycaster, pointer);
      const worksHoverHit = worksOrbitCards.pickHover(raycaster, pointer);
      worksOrbitCards.setHovered(worksHoverHit);
      syncWorksMagneticPointerTarget(worksHit);
      cardHovered.value = !!worksHoverHit || worksOrbitCards.isInteracting();
      cardActionHovered.value = !!worksHit;
      cardGrabActive.value = worksOrbitCards.isInteracting();
    } else {
      worksOrbitCards?.setHovered(null);
      clearSceneMagneticPointerTarget();
      cardHovered.value = false;
      cardActionHovered.value = false;
      cardGrabActive.value = false;
    }

    const canRaycastSceneGeometry =
      activeRaycastGeometry &&
      shouldRaycastSceneGeometry(store.mode, store.worksViewMode, store.isFocusing, isMobile.value, store.homeExperience);
    if (
      canRaycastSceneGeometry &&
      shouldRunSceneHoverRaycast(elapsed, lastGeometryHoverRaycastAt)
    ) {
      lastGeometryHoverRaycastAt = elapsed;
      raycaster.setFromCamera(pointer, threeScene.camera);
      const intersects = raycaster.intersectObject(activeRaycastGeometry.hitMesh);
      geometryHovered.value = intersects.length > 0;
    } else if (!canRaycastSceneGeometry && geometryHovered.value) {
      geometryHovered.value = false;
    }

    const activeColorGeometry = getActiveGeometry();
    if (activeColorGeometry) {
      const targetColor =
        theme.value === "day"
          ? geometryHovered.value
            ? DAY_GEOMETRY_HOVER_COLOR
            : DAY_GEOMETRY_IDLE_COLOR
          : geometryHovered.value
            ? NIGHT_GEOMETRY_HOVER_COLOR
            : NIGHT_GEOMETRY_IDLE_COLOR;
      activeColorGeometry.lerpColor(targetColor, 0.1);
    }

    renderSceneFrame();
    animationFrameId = requestAnimationFrame(tick);
  }

  tick();
});

watch(
  () => store.mode,
  (mode, previousMode) => {
    // Panels differ in GPU cost (Works copies the framebuffer for its glass).
    adaptivePixelRatio?.noteContextChange();
    updateBlogDock();
    void ensureHomeCardFlight();
    homeCardFlight?.update(0, homeFlightVisible.value, prefersReducedMotion);
    clearSceneMagneticPointerTarget();
    geometryHovered.value = false;
    lastGeometryHoverRaycastAt = Number.NEGATIVE_INFINITY;
    if (!hasEquivalentGeometryTransformMode(mode, previousMode)) {
      updateGeometryTransform();
    }
    applyThemeGeometryState(theme.value);
    updateWorksOrbitCards();
  },
);
watch(
  () => (typeof route.name === "string" ? route.name : null),
  (toRouteName, fromRouteName) => {
    if (isCalmRoute.value) calmRouteSince = performance.now() / 1000;
    adaptivePixelRatio?.noteContextChange();
    handleRouteWarp(fromRouteName, toRouteName);
  },
);
watch(
  () => store.homeExperience,
  () => {
    updateBlogDock();
    void ensureHomeCardFlight();
    homeCardFlight?.update(0, homeFlightVisible.value, prefersReducedMotion);
    homeCardHovered.value = false;
    homeCardGrabActive.value = false;
    geometryHovered.value = false;
    clearSceneMagneticPointerTarget();
  },
);
watch(
  () => store.worksViewMode,
  () => {
    clearSceneMagneticPointerTarget();
    cardHovered.value = false;
    cardActionHovered.value = false;
    cardGrabActive.value = false;
    worksOrbitCards?.clearInteraction();
    worksOrbitCards?.setHovered(null);
    applyThemeGeometryState(theme.value);
    updateWorksOrbitCards();
  },
);
watch(
  () => store.isFocusing,
  (focusing) => {
    updateBlogDock();
    void ensureHomeCardFlight();
    homeCardFlight?.update(0, homeFlightVisible.value, prefersReducedMotion);
    if (controls) controls.enabled = focusing;
    lastGeometryHoverRaycastAt = Number.NEGATIVE_INFINITY;
    applyThemeGeometryState(theme.value);
    updateGeometryTransform();
    updateWorksOrbitCards();
  },
);
watch(theme, (nextTheme) => {
  homeCardFlight?.setTheme(nextTheme);
  // homeBackdropGlyph?.setTheme(nextTheme);
  const geometry = getGeometryByTheme(nextTheme);
  if (store.isFocusing && geometry) {
    const targetRotation = nextTheme === "day" ? savedFocusRotations.day : savedFocusRotations.night;
    targetRotation.copy(geometry.group.rotation);
  }
  cardHovered.value = false;
  cardActionHovered.value = false;
  cardGrabActive.value = false;
  geometryHovered.value = false;
  lastGeometryHoverRaycastAt = Number.NEGATIVE_INFINITY;
  applyThemeImmediate(nextTheme);
  worksOrbitCards?.setTheme(nextTheme);
  updateGeometryTransform(true);
  updateWorksOrbitCards();
});

onBeforeUnmount(() => {
  sceneDisposed = true;
  gsap.killTweensOf(blogDock);
  gsap.killTweensOf(homeDock);
  homeCardFlight?.dispose();
  homeCardFlight = null;
  warpPulses = [];
  clearSceneMagneticPointerTarget();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener("resize", handleResize);
  setHomeWheelListening(false);
  if (container.value) container.value.removeEventListener("pointermove", handlePointerMove);
  if (canvasRef.value) canvasRef.value.removeEventListener("pointerdown", handleCanvasPointerDown);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener("pointerup", releaseCardInteraction);
    canvasRef.value.removeEventListener("pointercancel", releaseCardInteraction);
    canvasRef.value.removeEventListener("lostpointercapture", releaseCardInteraction);
    canvasRef.value.removeEventListener("touchmove", handleHomeTouchMove);
  }
  if (reducedMotionQuery) {
    if (typeof reducedMotionQuery.removeEventListener === "function") {
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    } else {
      reducedMotionQuery.removeListener(handleReducedMotionChange);
    }
  }

  if (rotationTweenNight) {
    rotationTweenNight.kill();
    rotationTweenNight = null;
  }
  if (rotationTweenDay) {
    rotationTweenDay.kill();
    rotationTweenDay = null;
  }

  if (hypercube) {
    gsap.killTweensOf(hypercube.group.position);
    gsap.killTweensOf(hypercube.group.rotation);
    gsap.killTweensOf(hypercube.group.scale);
  }
  if (mobius) {
    gsap.killTweensOf(mobius.group.position);
    gsap.killTweensOf(mobius.group.rotation);
    gsap.killTweensOf(mobius.group.scale);
  }

  starField?.dispose();
  hypercube?.dispose();
  mobius?.dispose();
  // homeBackdropGlyph?.dispose();
  worksOrbitCards?.dispose();
  circleTexture?.dispose();
  controls?.dispose();
  sceneTimer?.dispose();
  threeScene?.dispose();

  starField = null;
  hypercube = null;
  mobius = null;
  geometryRoot = null;
  // homeBackdropGlyph = null;
  worksOrbitCards = null;
  circleTexture = null;
  controls = null;
  sceneTimer = null;
  threeScene = null;
  reducedMotionQuery = null;
  adaptivePixelRatio = null;
  lastRenderedAt = null;
});
</script>

<template>
  <div
    ref="container"
    :data-blog-entry="isBlogDocking ? 'shrinking' : 'idle'"
    :data-home-experience="store.homeExperience"
    :data-star-clock="homeFlightVisible ? 'collect' : 'roam'"
    :data-home-flight="homeFlightVisible ? 'active' : 'inactive'"
    :data-home-flight-ready="homeFlightReady"
    :data-home-falling-star="homeStarVisible"
    :data-home-card-dragging="homeCardGrabActive"
    :data-home-card-scale="homeCardScale"
    class="absolute inset-0 z-0 h-[100dvh]"
    :class="{
      'pointer-events-none': isBlogDocking,
      'cursor-grab': (store.isFocusing && !isDragging) || hasWorkCardGrabHover || homeCardHovered,
      'cursor-grabbing': (store.isFocusing && isDragging) || cardGrabActive || homeCardGrabActive,
      'cursor-pointer': (geometryHovered && !store.isFocusing) || hasWorkActionHover,
    }"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerLeave"
    @click="onClickBackground"
  >
    <canvas
      ref="canvasRef"
      class="relative h-full w-full outline-none"
      :style="{ touchAction: homeFlightVisible ? 'none' : undefined }"
      data-liquid-gl-snapshot
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import gsap from "gsap";
import * as THREE from "three";

import {
  clearSceneMagneticPointerTarget,
  projectNdcBoundsToPointerTarget,
  setSceneMagneticPointerTarget,
} from "@/utils/magnetic-pointer";
import { createCircleTexture } from "@/components/scene/circle-texture";
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
import { getSceneThemeActivity } from "@/components/scene/scene-theme-activity";
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
const router = useRouter();
const { theme } = useTheme();

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
  clearSceneMagneticPointerTarget();
  if (!worksOrbitCards?.isInteracting()) pointer.set(0, 0);
};
const onClickBackground = (event: MouseEvent) => {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    event.stopPropagation();
    return;
  }

  if (event.target === canvasRef.value) {
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
let hypercube: Hypercube | null = null;
let mobius: MobiusStrip | null = null;
// let homeBackdropGlyph: HomeBackdropGlyph | null = null;
let worksOrbitCards: WorksOrbitCards | null = null;
let controls: TrackballControls | null = null;
let animationFrameId: number | null = null;
let sceneTimer: THREE.Timer | null = null;
let circleTexture: THREE.CanvasTexture | null = null;
let reducedMotionQuery: MediaQueryList | null = null;
let prefersReducedMotion = false;
let pointerInsideCanvas = false;
let suppressNextCanvasClick = false;
let sceneDisposed = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const smoothedPointer = new THREE.Vector2();
const geometryWorldCenter = new THREE.Vector3();
const cameraTargetPosition = new THREE.Vector3();
const cameraTargetLook = new THREE.Vector3();
const cameraLookDirection = new THREE.Vector3();
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
  isMobile.value = !supportsContentLayout(width);
  supportsWorksOrbit.value = supportsWorksOrbitViewport(width);
  applyThemeGeometryState(theme.value);

  threeScene.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeScene.resize(width, height);
  controls?.handleResize();
  // homeBackdropGlyph?.updateViewport({ height, width });
  updateGeometryTransform();
  updateWorksOrbitCards();
}

function handleReducedMotionChange(event: MediaQueryListEvent) {
  prefersReducedMotion = event.matches;
  updateWorksOrbitCards();
}

function updateWorksOrbitCards(elapsed = 0, delta = 0) {
  if (!container.value || !threeScene || !worksOrbitCards) return;
  const activeGeometry = getActiveGeometry();
  const visible =
    store.mode === "works" &&
    supportsWorksOrbit.value &&
    !store.isFocusing &&
    !!activeGeometry;

  if (!visible && !worksOrbitCards.group.visible) return;

  worksViewport.width = container.value.clientWidth;
  worksViewport.height = container.value.clientHeight;

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
  starField?.setWarpIntensity(ritualIntensity);
}

function renderSceneFrame() {
  if (!threeScene) return;

  const { camera, renderer, scene } = threeScene;
  if (!worksOrbitCards?.group.visible) {
    camera.layers.set(0);
    threeScene.render();
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
  if (!container.value) return;
  const rect = container.value.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function handlePointerMove(event: PointerEvent) {
  pointerInsideCanvas = true;
  updatePointerFromEvent(event);
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

  const viewport = container.value.getBoundingClientRect();
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

function handleCanvasPointerDown(event: PointerEvent) {
  if (store.isFocusing || !threeScene) return;
  updatePointerFromEvent(event);
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

  if (!shouldRaycastSceneGeometry(store.mode, store.worksViewMode, store.isFocusing, isMobile.value)) {
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
  isMobile.value = !supportsContentLayout(width);
  supportsWorksOrbit.value = supportsWorksOrbitViewport(width);

  threeScene = useThreeScene({
    canvas: canvasRef.value,
    height,
    transparentBackground: true,
    width,
  });
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
  threeScene.scene.add(hypercube.group);

  mobius = useMobiusStrip();
  threeScene.scene.add(mobius.group);

  worksOrbitCards = createWorksOrbitCards({
    theme: theme.value,
    works: getWorkProjects(),
  });
  threeScene.scene.add(worksOrbitCards.group);

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

  if (typeof window.matchMedia === "function") {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = reducedMotionQuery.matches;

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    } else {
      reducedMotionQuery.addListener(handleReducedMotionChange);
    }
  }

  sceneTimer = new THREE.Timer();
  sceneTimer.connect(document);

  function tick(timestamp?: number) {
    if (!threeScene || !starField || !hypercube || !mobius || !sceneTimer) return;

    sceneTimer.update(timestamp);
    const delta = sceneTimer.getDelta();
    const elapsed = sceneTimer.getElapsed();

    starField.update(delta);
    const activeGeometry = getActiveGeometry();
    activeGeometry?.update(delta);

    if (
      activeGeometry &&
      !store.isFocusing &&
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

      if (!introCompleted && introStartTime !== null) {
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

    updateWorksOrbitCards(elapsed, delta);

    const activeRaycastGeometry = getActiveGeometry();
    let worksHit: ReturnType<WorksOrbitCards["pick"]> = null;
    if (
      !store.isFocusing &&
      store.mode === "works" &&
      supportsWorksOrbit.value &&
      worksOrbitCards
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
      shouldRaycastSceneGeometry(store.mode, store.worksViewMode, store.isFocusing, isMobile.value);
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
    if (controls) controls.enabled = focusing;
    lastGeometryHoverRaycastAt = Number.NEGATIVE_INFINITY;
    applyThemeGeometryState(theme.value);
    updateGeometryTransform();
    updateWorksOrbitCards();
  },
);
watch(theme, (nextTheme) => {
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
  clearSceneMagneticPointerTarget();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener("resize", handleResize);
  if (container.value) container.value.removeEventListener("pointermove", handlePointerMove);
  if (canvasRef.value) canvasRef.value.removeEventListener("pointerdown", handleCanvasPointerDown);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener("pointerup", releaseCardInteraction);
    canvasRef.value.removeEventListener("pointercancel", releaseCardInteraction);
    canvasRef.value.removeEventListener("lostpointercapture", releaseCardInteraction);
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
  // homeBackdropGlyph = null;
  worksOrbitCards = null;
  circleTexture = null;
  controls = null;
  sceneTimer = null;
  threeScene = null;
  reducedMotionQuery = null;
});
</script>

<template>
  <div
    ref="container"
    class="absolute inset-0 z-0 h-[100dvh]"
    :class="{
      'cursor-grab': (store.isFocusing && !isDragging) || hasWorkCardGrabHover,
      'cursor-grabbing': (store.isFocusing && isDragging) || cardGrabActive,
      'cursor-pointer': (geometryHovered && !store.isFocusing) || hasWorkActionHover,
    }"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerLeave"
    @click="onClickBackground"
  >
    <canvas
      ref="canvasRef"
      class="h-full w-full outline-none"
      data-liquid-gl-snapshot
    ></canvas>
  </div>
</template>

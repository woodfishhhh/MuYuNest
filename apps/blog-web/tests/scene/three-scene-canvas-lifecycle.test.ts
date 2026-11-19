import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick, reactive, shallowRef } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const sceneState = {
  createWorksCards: vi.fn(),
  controlDispose: vi.fn(),
  hypercubeGroup: null as ReturnType<typeof createTransformGroup> | null,
  hypercubeSetOpacity: null as ReturnType<typeof vi.fn> | null,
  mobiusGroup: null as ReturnType<typeof createTransformGroup> | null,
  mobiusSetOpacity: null as ReturnType<typeof vi.fn> | null,
  onControlConstruct: null as (() => void) | null,
  sceneDispose: vi.fn(),
  // Frame loop controls for tests that drive `tick` by hand.
  delta: 0,
  elapsed: 0,
  render: vi.fn(),
  setWarpIntensity: vi.fn(),
};

function createTransformGroup() {
  return {
    getWorldPosition: vi.fn(),
    position: {
      copy: vi.fn(),
    },
    rotation: {
      set: vi.fn(),
      x: 0,
      y: 0,
      z: 0,
    },
    scale: {
      setScalar: vi.fn(),
    },
    visible: true,
  };
}

function installSceneMocks(
  controlsModule: Deferred<{ TrackballControls: typeof MockTrackballControls }>,
) {
  class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    add() {
      return this;
    }

    copy(other: Vector3) {
      this.x = other.x;
      this.y = other.y;
      this.z = other.z;
      return this;
    }

    lerp() {
      return this;
    }

    lerpVectors() {
      return this;
    }

    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class Vector2 {
    x = 0;
    y = 0;

    lerp() {
      return this;
    }
  }

  class Euler extends Vector3 {}

  vi.doMock("three", () => ({
    AdditiveBlending: 1,
    Color: class Color {
      constructor(readonly value: string) {}
    },
    Euler,
    Group: class Group {
      position = { set: vi.fn() };
      rotation = { set: vi.fn() };
      scale = { setScalar: vi.fn() };
      add() {}
    },
    MathUtils: { degToRad: (value: number) => value },
    NormalBlending: 2,
    Raycaster: class Raycaster {
      intersectObject() {
        return [];
      }
      setFromCamera() {}
    },
    Timer: class Timer {
      connect() {}
      dispose() {}
      getDelta() {
        return sceneState.delta;
      }
      getElapsed() {
        return sceneState.elapsed;
      }
      update() {}
    },
    Vector2,
    Vector3,
  }));

  vi.doMock("gsap", () => ({
    default: {
      killTweensOf: vi.fn(),
      to: vi.fn(() => ({ kill: vi.fn() })),
    },
  }));

  const route = reactive({ name: "home" });
  vi.doMock("vue-router", () => ({
    useRoute: () => route,
    useRouter: () => ({ push: vi.fn() }),
  }));

  const store = reactive({
    isFocusing: false,
    mode: "home",
    worksViewMode: "orbit",
    homeExperience: "roam",
    syncHomeExperience: vi.fn(),
    enterFocus: vi.fn(),
    goHome: vi.fn(),
    triggerStep: vi.fn(),
  });
  const theme = shallowRef<"day" | "night">("night");
  vi.doMock("@/stores/site", () => ({ useSiteStore: () => store }));
  vi.doMock("@/composables/useTheme", () => ({
    useTheme: () => ({ theme }),
  }));

  const scene = {
    add: vi.fn(),
    background: null,
  };
  const camera = {
    fov: 75,
    getWorldDirection: vi.fn(),
    layers: { set: vi.fn() },
    lookAt: vi.fn(),
    position: new Vector3(),
  };
  const renderer = {
    autoClear: true,
    clear: vi.fn(),
    domElement: document.createElement("canvas"),
    render: vi.fn(),
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
  };
  vi.doMock("@/composables/useThreeScene", () => ({
    useThreeScene: () => ({
      camera,
      dispose: sceneState.sceneDispose,
      render: sceneState.render,
      renderer,
      resize: vi.fn(),
      scene,
    }),
  }));

  const disposableGeometry = (kind: "hypercube" | "mobius") => {
    const setOpacity = vi.fn();
    const geometry = {
      dispose: vi.fn(),
      group: createTransformGroup(),
      hitMesh: {},
      lerpColor: vi.fn(),
      setInteractionIntensity: vi.fn(),
      setPointScale: vi.fn(),
      setDockProgress: vi.fn(),
      setOpacity,
      update: vi.fn(),
    };
    if (kind === "hypercube") {
      sceneState.hypercubeGroup = geometry.group;
      sceneState.hypercubeSetOpacity = setOpacity;
    } else {
      sceneState.mobiusGroup = geometry.group;
      sceneState.mobiusSetOpacity = setOpacity;
    }
    return geometry;
  };
  vi.doMock("@/composables/useHypercube", () => ({
    useHypercube: () => disposableGeometry("hypercube"),
  }));
  vi.doMock("@/composables/useMobiusStrip", () => ({
    useMobiusStrip: () => disposableGeometry("mobius"),
  }));
  vi.doMock("@/composables/useStarField", () => ({
    useStarField: () => ({
      dispose: vi.fn(),
      group: createTransformGroup(),
      setColor: vi.fn(),
      setOpacity: vi.fn(),
      setWarpIntensity: sceneState.setWarpIntensity,
      setLens: vi.fn(),
      setCollectMode: vi.fn(),
      update: vi.fn(),
    }),
  }));
  vi.doMock("@/components/scene/circle-texture", () => ({
    createCircleTexture: () => ({ dispose: vi.fn() }),
  }));
  vi.doMock("@/components/scene/works-orbit-cards", () => ({
    WORKS_ORBIT_CARD_RENDER_LAYER: 1,
    createWorksOrbitCards: sceneState.createWorksCards.mockImplementation(() => ({
      beginDrag: vi.fn(),
      clearInteraction: vi.fn(),
      dispose: vi.fn(),
      drag: vi.fn(),
      getScreenBounds: () => null,
      group: { visible: false },
      isInteracting: () => false,
      pick: () => null,
      pickHover: () => null,
      release: () => null,
      setHovered: vi.fn(),
      setTheme: vi.fn(),
      update: vi.fn(),
    })),
    getWorksCenterMagnetStrength: () => 0,
  }));
  vi.doMock("@/components/scene/geometry-transform", () => ({
    getGeometryTransformTarget: () => ({ baseScale: 1, x: 0, y: 0, z: 0 }),
    hasEquivalentGeometryTransformMode: () => false,
  }));
  vi.doMock("@/components/scene/hypercube-rotation", () => ({
    normalizeRotationForTween: (_current: unknown, target: unknown) => target,
    shouldTweenRotation: () => false,
  }));
  vi.doMock("@/components/scene/scene-interaction", () => ({
    isDesktopWorksOrbitMode: () => false,
    resolveScenePointerDownAction: () => "none",
    shouldRunSceneHoverRaycast: () => false,
    shouldRaycastSceneGeometry: () => false,
    supportsWorksOrbitViewport: () => true,
  }));
  vi.doMock("@/content/works", () => ({ getWorkProjects: () => [] }));
  vi.doMock("@/utils/site-mode", () => ({ getRouteLocationForSiteMode: () => ({}) }));
  vi.doMock("three/examples/jsm/controls/TrackballControls.js", () => controlsModule.promise);

  return { route, store, theme };
}

/** Replaces requestAnimationFrame so each test decides when frames run. */
function installFrameQueue() {
  const pending: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => pending.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    step(timestampMs: number) {
      pending.splice(0).forEach((callback) => callback(timestampMs));
    },
  };
}

class MockTrackballControls {
  dispose = sceneState.controlDispose;
  dynamicDampingFactor = 0;
  enabled = false;
  maxDistance = 0;
  noPan = false;
  noZoom = false;
  rotateSpeed = 0;
  staticMoving = false;
  zoomSpeed = 0;

  constructor() {
    sceneState.onControlConstruct?.();
  }

  handleResize() {}
  update() {}
}

describe("ThreeSceneCanvas lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sceneState.hypercubeGroup = null;
    sceneState.hypercubeSetOpacity = null;
    sceneState.mobiusGroup = null;
    sceneState.mobiusSetOpacity = null;
    sceneState.onControlConstruct = null;
    sceneState.delta = 0;
    sceneState.elapsed = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides Works cards when Blog opens and restores them only after undocking", async () => {
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    const { store } = installSceneMocks(controlsModule);
    store.mode = "works";
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    const { default: gsap } = await import("gsap");
    const wrapper = mount(ThreeSceneCanvas);
    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();
    const cards = sceneState.createWorksCards.mock.results[0].value;
    cards.group.visible = true;
    cards.update.mockImplementation(({ visible }: { visible: boolean }) => { cards.group.visible = visible; });
    store.mode = "blog";
    await nextTick();
    expect(cards.update).toHaveBeenLastCalledWith(expect.objectContaining({ visible: false }));
    expect(cards.clearInteraction).toHaveBeenCalled();
    const dockTween = vi.mocked(gsap.to).mock.calls.find(([, vars]) => vars.progress === 1)!;
    const dock = dockTween[0] as { progress: number };
    dock.progress = 0.5;
    store.mode = "works";
    await nextTick();
    expect(cards.group.visible).toBe(false);
    dock.progress = 0;
    window.dispatchEvent(new Event("resize"));
    expect(cards.update).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true }));
    expect(sceneState.createWorksCards).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("allocates Works textures only on the first Works visit and reuses them", async () => {
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    const { store } = installSceneMocks(controlsModule);
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    const wrapper = mount(ThreeSceneCanvas);
    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();
    expect(sceneState.createWorksCards).not.toHaveBeenCalled();
    store.mode = "works";
    await nextTick();
    expect(sceneState.createWorksCards).toHaveBeenCalledTimes(1);
    store.mode = "home";
    await nextTick();
    store.mode = "works";
    await nextTick();
    expect(sceneState.createWorksCards).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("keeps the themed geometry visible behind the Works Case layout", async () => {
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    const { store, theme } = installSceneMocks(controlsModule);
    store.mode = "works";
    store.worksViewMode = "case";
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    const wrapper = mount(ThreeSceneCanvas);

    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();

    expect(sceneState.hypercubeGroup?.visible).toBe(true);
    expect(sceneState.mobiusGroup?.visible).toBe(false);
    expect(sceneState.hypercubeSetOpacity).toHaveBeenLastCalledWith(0.14);
    expect(sceneState.mobiusSetOpacity).toHaveBeenLastCalledWith(0);

    theme.value = "day";
    await nextTick();

    expect(sceneState.hypercubeGroup?.visible).toBe(false);
    expect(sceneState.mobiusGroup?.visible).toBe(true);
    expect(sceneState.hypercubeSetOpacity).toHaveBeenLastCalledWith(0);
    expect(sceneState.mobiusSetOpacity).toHaveBeenLastCalledWith(0.14);

    wrapper.unmount();
  }, 15_000);

  it("does not resume scene setup when unmounted while controls are loading", async () => {
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    installSceneMocks(controlsModule);
    const errorHandler = vi.fn();
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    const wrapper = mount(ThreeSceneCanvas, {
      global: { config: { errorHandler } },
    });
    await nextTick();

    wrapper.unmount();
    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();

    expect(sceneState.sceneDispose).toHaveBeenCalledTimes(1);
    expect(errorHandler).not.toHaveBeenCalled();
  }, 15_000);

  it("plays a navigation warp pulse through the star field", async () => {
    const frames = installFrameQueue();
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    const { route } = installSceneMocks(controlsModule);
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    const wrapper = mount(ThreeSceneCanvas);
    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();

    // Let the camera intro finish; pulses wait for it.
    sceneState.delta = 1 / 60;
    sceneState.elapsed = 2;
    frames.step(performance.now());

    route.name = "post";
    await nextTick();
    sceneState.elapsed = 2.25;
    frames.step(performance.now());
    expect(sceneState.setWarpIntensity).toHaveBeenLastCalledWith(expect.closeTo(0.62, 2));

    sceneState.elapsed = 4;
    frames.step(performance.now());
    expect(sceneState.setWarpIntensity).toHaveBeenLastCalledWith(0);

    wrapper.unmount();
  }, 15_000);

  it("drops the reading backdrop to the calm frame rate once it settles", async () => {
    const frames = installFrameQueue();
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    const { route } = installSceneMocks(controlsModule);
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    const wrapper = mount(ThreeSceneCanvas);
    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();
    sceneState.delta = 1 / 60;
    sceneState.elapsed = 2;
    frames.step(performance.now());

    route.name = "blog";
    await nextTick();
    // Wait out the library's own warp pulse before measuring the cap.
    sceneState.elapsed = 5;
    const base = performance.now();
    const frameMs = 1000 / 60;

    sceneState.render.mockClear();
    for (let frame = 0; frame < 30; frame++) frames.step(base + frame * frameMs);
    // The dock and camera are still settling: every frame renders.
    expect(sceneState.render).toHaveBeenCalledTimes(30);

    sceneState.render.mockClear();
    for (let frame = 0; frame < 60; frame++) frames.step(base + 1300 + frame * frameMs);
    expect(sceneState.render.mock.calls.length).toBeGreaterThanOrEqual(29);
    expect(sceneState.render.mock.calls.length).toBeLessThanOrEqual(31);

    route.name = "works";
    await nextTick();
    sceneState.elapsed = 8;
    sceneState.render.mockClear();
    for (let frame = 0; frame < 30; frame++) frames.step(base + 3000 + frame * frameMs);
    expect(sceneState.render).toHaveBeenCalledTimes(30);

    wrapper.unmount();
  }, 15_000);

  it("disposes controls created during an unmount triggered by their constructor", async () => {
    const controlsModule = deferred<{ TrackballControls: typeof MockTrackballControls }>();
    installSceneMocks(controlsModule);
    const errorHandler = vi.fn();
    const ThreeSceneCanvas = (await import("@/components/scene/ThreeSceneCanvas.vue")).default;
    let wrapper: VueWrapper;
    wrapper = mount(ThreeSceneCanvas, {
      global: { config: { errorHandler } },
    });
    await nextTick();
    sceneState.onControlConstruct = () => wrapper.unmount();

    controlsModule.resolve({ TrackballControls: MockTrackballControls });
    await flushPromises();

    expect(sceneState.controlDispose).toHaveBeenCalledTimes(1);
    expect(errorHandler).not.toHaveBeenCalled();
  }, 15_000);
});

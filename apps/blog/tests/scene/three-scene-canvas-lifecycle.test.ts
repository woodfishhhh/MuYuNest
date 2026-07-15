import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick, reactive, shallowRef } from "vue";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
  controlDispose: vi.fn(),
  onControlConstruct: null as (() => void) | null,
  sceneDispose: vi.fn(),
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
    Color: class Color {
      constructor(readonly value: string) {}
    },
    Euler,
    MathUtils: { degToRad: (value: number) => value },
    Raycaster: class Raycaster {
      intersectObject() {
        return [];
      }
      setFromCamera() {}
    },
    Timer: class Timer {},
    Vector2,
    Vector3,
  }));

  vi.doMock("gsap", () => ({
    default: {
      killTweensOf: vi.fn(),
      to: vi.fn(() => ({ kill: vi.fn() })),
    },
  }));

  vi.doMock("vue-router", () => ({
    useRouter: () => ({ push: vi.fn() }),
  }));

  const store = reactive({
    isFocusing: false,
    mode: "home",
    worksViewMode: "orbit",
    enterFocus: vi.fn(),
    goHome: vi.fn(),
    triggerStep: vi.fn(),
  });
  vi.doMock("@/stores/site", () => ({ useSiteStore: () => store }));
  vi.doMock("@/composables/useTheme", () => ({
    useTheme: () => ({ theme: shallowRef("night") }),
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
      render: vi.fn(),
      renderer,
      resize: vi.fn(),
      scene,
    }),
  }));

  const disposableGeometry = () => ({
    dispose: vi.fn(),
    group: createTransformGroup(),
    hitMesh: {},
    lerpColor: vi.fn(),
    setInteractionIntensity: vi.fn(),
    setOpacity: vi.fn(),
    update: vi.fn(),
  });
  vi.doMock("@/composables/useHypercube", () => ({ useHypercube: disposableGeometry }));
  vi.doMock("@/composables/useMobiusStrip", () => ({ useMobiusStrip: disposableGeometry }));
  vi.doMock("@/composables/useStarField", () => ({
    useStarField: () => ({
      dispose: vi.fn(),
      group: createTransformGroup(),
      setColor: vi.fn(),
      setOpacity: vi.fn(),
      setWarpIntensity: vi.fn(),
      update: vi.fn(),
    }),
  }));
  vi.doMock("@/components/scene/circle-texture", () => ({
    createCircleTexture: () => ({ dispose: vi.fn() }),
  }));
  vi.doMock("@/components/scene/works-orbit-cards", () => ({
    WORKS_ORBIT_CARD_RENDER_LAYER: 1,
    createWorksOrbitCards: () => ({
      beginDrag: vi.fn(),
      clearInteraction: vi.fn(),
      dispose: vi.fn(),
      drag: vi.fn(),
      group: { visible: false },
      isInteracting: () => false,
      pick: () => null,
      release: () => null,
      setHovered: vi.fn(),
      setTheme: vi.fn(),
      update: vi.fn(),
    }),
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
    sceneState.onControlConstruct = null;
  });

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

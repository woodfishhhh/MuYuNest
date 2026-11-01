import { describe, expect, it, vi } from "vitest";

const threeMock = vi.hoisted(() => {
  class MockWebGLRenderer {
    readonly options: Record<string, unknown>;
    clearColorAlpha: number | undefined;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      rendererInstances.push(this);
    }

    dispose() {}
    forceContextLoss() {}
    render() {}
    setClearColor(_color: unknown, alpha?: number) {
      this.clearColorAlpha = alpha;
    }
    setPixelRatio() {}
    setSize() {}
  }

  class MockScene {
    background: unknown = undefined;
    add() {}
    clear() {}
  }

  class MockPerspectiveCamera {
    aspect: number;

    constructor(_fov: number, aspect: number) {
      this.aspect = aspect;
    }

    updateProjectionMatrix() {}
  }

  class MockLight {
    readonly position = { set() {} };
  }

  const rendererInstances: MockWebGLRenderer[] = [];

  return {
    MockLight,
    MockPerspectiveCamera,
    MockScene,
    MockWebGLRenderer,
    rendererInstances,
  };
});

vi.mock("three", () => ({
  AmbientLight: threeMock.MockLight,
  Color: class MockColor {
    readonly value: string;

    constructor(value: string) {
      this.value = value;
    }
  },
  PerspectiveCamera: threeMock.MockPerspectiveCamera,
  PointLight: threeMock.MockLight,
  Scene: threeMock.MockScene,
  SpotLight: threeMock.MockLight,
  WebGLRenderer: threeMock.MockWebGLRenderer,
}));

describe("useThreeScene", () => {
  it("can create a transparent renderer for DOM-backed scene layers", async () => {
    const { useThreeScene } = await import("@/composables/useThreeScene");

    const scene = useThreeScene({
      canvas: document.createElement("canvas"),
      height: 600,
      transparentBackground: true,
      width: 800,
    });

    expect(threeMock.rendererInstances.at(-1)?.options.alpha).toBe(true);
    expect(threeMock.rendererInstances.at(-1)?.clearColorAlpha).toBe(0);
    expect(scene.scene.background).toBeNull();
  });
});

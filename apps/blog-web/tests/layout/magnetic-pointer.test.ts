import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MagneticPointer from "@/components/layout/MagneticPointer.vue";
import {
  clearSceneMagneticPointerTarget,
  getSceneMagneticPointerTarget,
  projectNdcBoundsToPointerTarget,
  resolveMagneticPointerFrame,
  setSceneMagneticPointerTarget,
} from "@/utils/magnetic-pointer";

describe("magnetic pointer geometry", () => {
  afterEach(() => clearSceneMagneticPointerTarget());

  it("morphs the pointer dot into a padded frame pulled toward the card center", () => {
    const dot = resolveMagneticPointerFrame({ x: 120, y: 80 }, null);
    expect(dot).toMatchObject({ height: 7, width: 7, x: 120, y: 80 });

    const frame = resolveMagneticPointerFrame(
      { x: 300, y: 180 },
      { height: 100, key: "card", left: 100, radius: 8, top: 60, width: 200 },
    );
    expect(frame).toEqual({
      height: 112,
      radius: 14,
      width: 212,
      x: 210,
      y: 117,
    });
  });

  it("projects Three.js NDC bounds into viewport card bounds", () => {
    expect(
      projectNdcBoundsToPointerTarget(
        "work:one",
        { halfHeight: 0.2, halfWidth: 0.25, x: 0, y: 0 },
        { height: 800, left: 10, top: 20, width: 1200 },
      ),
    ).toEqual({
      height: 160,
      key: "work:one",
      left: 460,
      radius: 8,
      top: 340,
      width: 300,
    });
  });

  it("preserves a projected action quad so the pointer outline follows card tilt", () => {
    const target = projectNdcBoundsToPointerTarget(
      "work:action",
      {
        corners: [
          { x: -0.3, y: 0.18 },
          { x: 0.2, y: 0.12 },
          { x: 0.18, y: -0.04 },
          { x: -0.28, y: 0.01 },
        ],
        halfHeight: 0.11,
        halfWidth: 0.25,
        x: -0.05,
        y: 0.07,
      },
      { height: 800, left: 10, top: 20, width: 1200 },
    );
    const frame = resolveMagneticPointerFrame({ x: 500, y: 400 }, target);

    expect(target.corners).toEqual([
      { x: 430, y: 348 },
      { x: 730, y: 372 },
      { x: 718, y: 436 },
      { x: 442, y: 416 },
    ]);
    expect(frame.corners).toHaveLength(4);
    expect(frame.x).toBeCloseTo(580);
    expect(frame.y).toBeCloseTo(392);
    expect(frame.corners?.[0]?.y).toBeLessThan(frame.corners?.[1]?.y ?? 0);
  });

  it("does not let one scene owner clear a newer target", () => {
    const target = { height: 100, key: "new-card", left: 20, top: 30, width: 200 };
    setSceneMagneticPointerTarget(target);
    clearSceneMagneticPointerTarget("old-card");
    expect(getSceneMagneticPointerTarget()).toBe(target);
    clearSceneMagneticPointerTarget("new-card");
    expect(getSceneMagneticPointerTarget()).toBeNull();
  });
});

describe("MagneticPointer", () => {
  let frameCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    frameCallback = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("hover: hover") || query.includes("pointer: fine"),
        media: query,
      })),
    );
  });

  afterEach(() => {
    clearSceneMagneticPointerTarget();
    window.localStorage.clear();
    delete document.documentElement.dataset.magneticPointerStyle;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("expands over an opted-in DOM card and keeps the overlay click-through", () => {
    const wrapper = mount(MagneticPointer, { attachTo: document.body });
    const card = document.createElement("article");
    card.dataset.magneticPointer = "test-card";
    card.style.borderRadius = "8px";
    document.body.append(card);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      bottom: 140,
      height: 100,
      left: 40,
      right: 240,
      top: 40,
      width: 200,
      x: 40,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect);

    const move = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 180,
      clientY: 80,
    });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    card.dispatchEvent(move);
    frameCallback?.(16);

    const overlay = wrapper.get<HTMLElement>("[data-magnetic-pointer-overlay]");
    expect(overlay.attributes("data-visible")).toBe("true");
    expect(overlay.attributes("data-magnetic")).toBe("true");
    expect(overlay.element.style.width).toBe("212px");
    expect(overlay.element.style.height).toBe("112px");
    expect(overlay.attributes("aria-hidden")).toBe("true");

    wrapper.unmount();
  });

  it("follows the transformed quadrilateral of a tilted DOM card", () => {
    class TestDOMMatrixReadOnly {
      transformPoint(point: DOMPointInit) {
        const angle = Math.PI / 6;
        return {
          w: 1,
          x: (point.x ?? 0) * Math.cos(angle) - (point.y ?? 0) * Math.sin(angle),
          y: (point.x ?? 0) * Math.sin(angle) + (point.y ?? 0) * Math.cos(angle),
          z: 0,
        };
      }
    }
    vi.stubGlobal("DOMMatrixReadOnly", TestDOMMatrixReadOnly);

    const wrapper = mount(MagneticPointer, { attachTo: document.body });
    const card = document.createElement("a");
    card.dataset.magneticPointer = "tilted-friend-card";
    card.style.boxSizing = "border-box";
    card.style.width = "200px";
    card.style.height = "100px";
    card.style.borderRadius = "8px";
    card.style.transform = "rotate(30deg)";
    card.style.transformOrigin = "100px 50px";
    document.body.append(card);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      bottom: 246.603,
      height: 186.603,
      left: 40,
      right: 213.205,
      top: 60,
      width: 173.205,
      x: 40,
      y: 60,
      toJSON: () => ({}),
    } as DOMRect);

    const move = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 120,
      clientY: 130,
    });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    card.dispatchEvent(move);
    frameCallback?.(16);

    const shapePoints = wrapper
      .get<SVGPolygonElement>("[data-magnetic-pointer-shape]")
      .attributes("points")
      .split(" ")
      .map((point) => point.split(",").map(Number));
    expect(shapePoints).toHaveLength(4);
    expect(shapePoints[0]?.[1]).not.toBeCloseTo(shapePoints[1]?.[1] ?? 0);
    expect(shapePoints[1]?.[0]).not.toBeCloseTo(shapePoints[2]?.[0] ?? 0);

    wrapper.unmount();
  });
});

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LiquidGlassCard from "@/components/home/works/LiquidGlassCard.vue";

const liquidGLMock = vi.hoisted(() => {
  const mock = vi.fn();
  return Object.assign(mock, { registerDynamic: vi.fn() });
});

vi.mock("liquid-gl", () => ({ default: liquidGLMock }));

describe("LiquidGlassCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    liquidGLMock.mockClear();
    liquidGLMock.registerDynamic.mockClear();
    document.body.innerHTML = '<canvas data-liquid-gl-snapshot></canvas>';
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 236,
      height: 236,
      left: 0,
      right: 352,
      toJSON: () => ({}),
      top: 0,
      width: 352,
      x: 0,
      y: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("keeps DOM content above an empty lens and initializes the compact skill profile", async () => {
    const wrapper = mount(LiquidGlassCard, {
      slots: { default: "Readable content" },
    });

    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    const target = wrapper.find<HTMLElement>("[data-liquid-gl-target]");
    expect(wrapper.attributes("data-magnetic-pointer")).toBeUndefined();
    expect(target.element.children).toHaveLength(0);
    expect(wrapper.find(".webgl-liquid-glass__content").text()).toBe("Readable content");
    expect(liquidGLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        aberration: 0.03,
        bevelDepth: 0.075,
        bevelWidth: 0.12,
        frost: 2.2,
        magnify: 1.006,
        refraction: 0.007,
        resolution: 1.5,
        reveal: "none",
        shadow: false,
        snapshot: "[data-liquid-gl-snapshot]",
        specular: true,
        target: `#${target.attributes("id")}`,
        tilt: false,
      }),
    );
    expect(liquidGLMock.registerDynamic).toHaveBeenCalledWith("[data-liquid-gl-snapshot]");
  });

  it("supports compact action surfaces without changing the liquid-gl preset", () => {
    const wrapper = mount(LiquidGlassCard, {
      props: {
        cornerRadius: 22,
        padding: "0",
        variant: "action",
      },
      slots: { default: '<button type="button">Glass action</button>' },
    });

    expect(wrapper.attributes("data-glass-preset")).toBe("webgl-liquid-gl");
    expect(wrapper.attributes("data-glass-variant")).toBe("action");
    expect(wrapper.classes()).toContain("webgl-liquid-glass--action");
    expect(wrapper.attributes("style")).toContain("--glass-radius: 22px");
    expect(wrapper.get("button").text()).toBe("Glass action");
  });

  it("exposes the Works Case surface as a shared liquid-gl variant", () => {
    const wrapper = mount(LiquidGlassCard, {
      props: {
        padding: "clamp(1.125rem, 5vw, 2rem)",
        variant: "case",
      },
      slots: { default: "Case content" },
    });

    expect(wrapper.attributes("data-glass-variant")).toBe("case");
    expect(wrapper.classes()).toContain("webgl-liquid-glass--case");
    expect(wrapper.attributes("style")).toContain(
      "--glass-padding: clamp(1.125rem, 5vw, 2rem)",
    );
  });

  it("can leave WebGL rendering to a shared scene layer", async () => {
    const wrapper = mount(LiquidGlassCard, {
      props: {
        variant: "case",
        webglEnabled: false,
      },
    });

    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(wrapper.attributes("data-liquid-gl-state")).toBe("fallback");
    expect(liquidGLMock).not.toHaveBeenCalled();
  });
});

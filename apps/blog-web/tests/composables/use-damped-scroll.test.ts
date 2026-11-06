import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h, shallowRef } from "vue";

import { useDampedScroll } from "@/composables/useDampedScroll";

function mountDamped(enabled = shallowRef(true), shouldIgnore?: (event: WheelEvent) => boolean) {
  return mount(
    defineComponent({
      setup() {
        useDampedScroll({ enabled, shouldIgnore });
        return () => h("div");
      },
    }),
  );
}

describe("useDampedScroll", () => {
  let scrollY = 0;
  const frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    scrollY = 0;
    frames.length = 0;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    vi.spyOn(window, "scrollTo").mockImplementation(((x: number, y: number) => {
      scrollY = y;
    }) as typeof window.scrollTo);
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 5000 });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function runFrames(count: number) {
    for (let index = 0; index < count; index += 1) {
      const frame = frames.shift();
      frame?.(index * 16);
    }
  }

  it("eases toward the wheel target instead of jumping", () => {
    const wrapper = mountDamped();
    const wheel = new WheelEvent("wheel", { deltaY: 400, cancelable: true });
    window.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(true);
    runFrames(2);
    expect(scrollY).toBeGreaterThan(0);
    expect(scrollY).toBeLessThan(400);
    runFrames(200);
    expect(scrollY).toBe(400);
    wrapper.unmount();
  });

  it("leaves the wheel alone when disabled or when someone else claims it", () => {
    const enabled = shallowRef(false);
    const wrapper = mountDamped(enabled, () => true);
    const idle = new WheelEvent("wheel", { deltaY: 400, cancelable: true });
    window.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);

    enabled.value = true;
    return Promise.resolve().then(() => {
      const claimed = new WheelEvent("wheel", { deltaY: 400, cancelable: true });
      window.dispatchEvent(claimed);
      expect(claimed.defaultPrevented).toBe(false);
      wrapper.unmount();
    });
  });
});

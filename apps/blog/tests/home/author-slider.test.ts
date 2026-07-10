import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, nextTick, shallowRef } from "vue";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { stepAuthorSlideIndex, useAuthorSlider } from "@/composables/useAuthorSlider";

const mountedWrappers: VueWrapper[] = [];

function mountSliderHarness() {
  const wrapper = mount(
    defineComponent({
      setup() {
        const viewportRef = shallowRef<HTMLElement | null>(null);
        const trackRef = shallowRef<HTMLElement | null>(null);
        const { activeIndex } = useAuthorSlider({ viewportRef, trackRef });

        return { activeIndex, trackRef, viewportRef };
      },
      template: `
        <div ref="viewportRef">
          <div ref="trackRef">
            <section data-author-screen>
              <div data-scroll-region style="height: 200px; overflow-y: auto">
                <button type="button">Scrollable content</button>
              </div>
            </section>
            <section data-author-screen>Second screen</section>
          </div>
          <output data-active-index>{{ activeIndex }}</output>
        </div>
      `,
    }),
    { attachTo: document.body },
  );

  mountedWrappers.push(wrapper);
  return wrapper;
}

function makeScrollable(element: HTMLElement) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 200 },
    scrollHeight: { configurable: true, value: 600 },
  });
}

function dispatchTouch(element: HTMLElement, type: "touchstart" | "touchend", clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, type === "touchstart" ? "touches" : "changedTouches", {
    configurable: true,
    value: [{ clientY }],
  });
  element.dispatchEvent(event);
}

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) {
    wrapper.unmount();
  }
});

describe("stepAuthorSlideIndex", () => {
  it("moves exactly one slide and clamps to the available range", () => {
    expect(stepAuthorSlideIndex(0, 1, 4)).toBe(1);
    expect(stepAuthorSlideIndex(1, 1, 4)).toBe(2);
    expect(stepAuthorSlideIndex(3, 1, 4)).toBe(3);
    expect(stepAuthorSlideIndex(2, -1, 4)).toBe(1);
    expect(stepAuthorSlideIndex(0, -1, 4)).toBe(0);
  });

  it("lets an internal scroll region consume wheel input before changing slides", async () => {
    const wrapper = mountSliderHarness();
    await nextTick();
    await nextTick();

    const scrollRegion = wrapper.get<HTMLElement>("[data-scroll-region]");
    makeScrollable(scrollRegion.element);
    scrollRegion.element.scrollTop = 120;

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    scrollRegion.element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(wrapper.get("[data-active-index]").text()).toBe("0");
  });

  it("lets a touch gesture that starts inside scrollable content finish without changing slides", async () => {
    const wrapper = mountSliderHarness();
    await nextTick();
    await nextTick();

    const scrollRegion = wrapper.get<HTMLElement>("[data-scroll-region]");
    makeScrollable(scrollRegion.element);
    scrollRegion.element.scrollTop = 0;

    dispatchTouch(scrollRegion.element, "touchstart", 360);
    scrollRegion.element.scrollTop = 120;
    dispatchTouch(scrollRegion.element, "touchend", 240);
    await nextTick();

    expect(wrapper.get("[data-active-index]").text()).toBe("0");
  });
});

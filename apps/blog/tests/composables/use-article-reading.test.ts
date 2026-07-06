import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, shallowRef } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useArticleReading } from "@/composables/useArticleReading";
import type { TocItem } from "@/types/content";

const originalIntersectionObserver = globalThis.IntersectionObserver;

function makeRect(top: number, height = 40): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 800,
    toJSON: () => ({}),
    top,
    width: 800,
    x: 0,
    y: top,
  } as DOMRect;
}

describe("useArticleReading", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps a clicked heading active while intermediate observer entries arrive", async () => {
    vi.useFakeTimers();
    let observerCallback: IntersectionObserverCallback | null = null;

    class ControlledIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      disconnect() {}
      observe() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    }

    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: ControlledIntersectionObserver,
    });

    const Harness = defineComponent({
      setup() {
        const contentRoot = shallowRef<HTMLElement | null>(null);
        const scrollContainer = shallowRef<HTMLElement | null>(null);
        const tocItems = shallowRef<TocItem[]>([
          { id: "intro", level: 2, text: "Intro" },
          { id: "target", level: 2, text: "Target" },
          { id: "next", level: 2, text: "Next" },
        ]);
        const { activeId, jumpToHeading } = useArticleReading({
          contentRoot,
          scrollContainer,
          tocItems,
        });

        return {
          activeId,
          contentRoot,
          jumpToHeading,
          scrollContainer,
        };
      },
      template: `
        <div ref="scrollContainer" data-testid="scroll-container">
          <div ref="contentRoot">
            <h2 id="intro">Intro</h2>
            <h2 id="target">Target</h2>
            <h2 id="next">Next</h2>
          </div>
          <button data-testid="jump-target" type="button" @click="jumpToHeading('target')">
            Jump
          </button>
          <output data-testid="active-id">{{ activeId }}</output>
        </div>
      `,
    });

    const wrapper = mount(Harness, { attachTo: document.body });
    await nextTick();

    const scrollContainer = wrapper.get("[data-testid='scroll-container']").element as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 1600,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      configurable: true,
      value: 700,
    });
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(makeRect(0, 700));
    vi.spyOn(document.getElementById("intro")!, "getBoundingClientRect").mockImplementation(() =>
      makeRect(120 - scrollContainer.scrollTop),
    );
    vi.spyOn(document.getElementById("target")!, "getBoundingClientRect").mockImplementation(() =>
      makeRect(520 - scrollContainer.scrollTop),
    );
    vi.spyOn(document.getElementById("next")!, "getBoundingClientRect").mockImplementation(() =>
      makeRect(620 - scrollContainer.scrollTop),
    );

    await wrapper.get("[data-testid='jump-target']").trigger("click");

    expect(wrapper.get("[data-testid='active-id']").text()).toBe("target");
    observerCallback?.(
      [
        {
          boundingClientRect: makeRect(180),
          intersectionRatio: 1,
          intersectionRect: makeRect(180),
          isIntersecting: true,
          rootBounds: makeRect(0, 700),
          target: document.getElementById("next")!,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
    await nextTick();

    expect(wrapper.get("[data-testid='active-id']").text()).toBe("target");
    await vi.advanceTimersByTimeAsync(1850);
    observerCallback?.(
      [
        {
          boundingClientRect: makeRect(180),
          intersectionRatio: 1,
          intersectionRect: makeRect(180),
          isIntersecting: true,
          rootBounds: makeRect(0, 700),
          target: document.getElementById("next")!,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
    await nextTick();

    expect(wrapper.get("[data-testid='active-id']").text()).toBe("target");

    wrapper.unmount();
  });
});

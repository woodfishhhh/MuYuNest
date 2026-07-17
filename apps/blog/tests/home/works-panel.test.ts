import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import WorksPanel from "@/components/home/WorksPanel.vue";
import { useSiteStore } from "@/stores/site";

const works = [
  {
    slug: "blog",
    name: "WoodFishNest",
    description: "Three.js powered immersive blog hub.",
    kind: "Blog",
    liveUrl: "http://36.151.148.198/newBlog/",
    githubUrl: "https://github.com/woodfishhhh/VueThreeBlog",
  },
  {
    slug: "weather",
    name: "WeatherDemo",
    description: "Monochrome weather workspace and forecast explorer.",
    kind: "App",
    liveUrl: "https://woodfish.site/weather/",
    githubUrl: "https://github.com/woodfishhhh/WeatherDemo",
  },
  {
    slug: "pretext",
    name: "Pretext",
    description: "Interactive pretext geometry experiment.",
    kind: "Lab",
    liveUrl: "https://woodfish.site/pretext/",
    githubUrl: "https://github.com/woodfishhhh/Pretext-cube",
  },
];

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
    writable: true,
  });
}

describe("WorksPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults desktop works to orbit mode with a Case toggle", () => {
    installMatchMedia(true);

    const wrapper = mount(WorksPanel, {
      props: {
        works,
      },
    });

    expect(wrapper.find("[data-testid='works-view-toggle']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='works-view-toggle-orbit']").attributes("aria-pressed")).toBe(
      "true",
    );
    expect(wrapper.find("[data-testid='works-view-orbit']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='works-view-case']").exists()).toBe(true);
    expect(wrapper.find(".works-panel__body").isVisible()).toBe(false);
    expect(wrapper.find(".works-panel__body").attributes("aria-hidden")).toBe("true");
    expect(wrapper.find(".works-panel__body").attributes()).toHaveProperty("inert");
    expect(wrapper.findAll("[data-testid='works-item']")).toHaveLength(3);
    expect(wrapper.findAll(".works-panel__a11y-links a")).toHaveLength(6);
    expect(wrapper.findAll(".works-panel__a11y-links a").every((link) => !link.attributes("tabindex"))).toBe(
      true,
    );
    expect(wrapper.find(".works-panel__title p").text().length).toBeGreaterThan(0);
  });

  it("switches desktop works to Case mode with Live and GitHub entries", async () => {
    installMatchMedia(true);
    const store = useSiteStore();

    const wrapper = mount(WorksPanel, {
      props: {
        works,
      },
    });
    const mountedCaseElement = wrapper.find("[data-testid='works-view-case']").element;

    await wrapper.find("[data-testid='works-view-toggle-case']").trigger("click");

    expect(store.worksViewMode).toBe("case");
    expect(wrapper.find("[data-testid='works-view-case']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='works-view-case']").element).toBe(mountedCaseElement);
    expect(wrapper.find(".works-panel__body").isVisible()).toBe(true);
    expect(wrapper.find(".works-panel__body").attributes("aria-hidden")).toBeUndefined();
    expect(wrapper.find(".works-panel__body").attributes("inert")).toBeUndefined();
    expect(wrapper.findAll("[data-testid='works-item']")).toHaveLength(3);
    expect(wrapper.find("[data-layout='card-example-grid']").exists()).toBe(true);
    expect(wrapper.findAll("[data-glass='liquid']")).toHaveLength(3);
    expect(wrapper.findAll("[data-glass-preset='card-example']")).toHaveLength(3);
    expect(wrapper.find(".works-case__backdrop").exists()).toBe(false);
    expect(wrapper.find("img").exists()).toBe(false);
    const filterIds = wrapper.findAll("filter").map((filter) => filter.attributes("id"));
    expect(new Set(filterIds).size).toBe(3);
    expect(wrapper.findAll(".liquid-glass__warp")).toHaveLength(3);
    expect(wrapper.findAll(".liquid-glass__rim--screen")).toHaveLength(3);
    expect(wrapper.findAll(".liquid-glass__rim--overlay")).toHaveLength(3);
    expect(wrapper.find("feColorMatrix[result='EDGE_INTENSITY']").attributes("values")).toContain(
      "0.3 0.3 0.3 0 0",
    );
    expect(wrapper.find("feColorMatrix[result='EDGE_INTENSITY']").attributes("values")).toContain(
      "0 0 0 1 0",
    );
    expect(wrapper.find("feDisplacementMap[result='RED_DISPLACED']").attributes("scale")).toBe(
      "-100",
    );
    expect(
      Number(wrapper.find("feDisplacementMap[result='GREEN_DISPLACED']").attributes("scale")),
    ).toBeCloseTo(-110);
    expect(
      Number(wrapper.find("feDisplacementMap[result='BLUE_DISPLACED']").attributes("scale")),
    ).toBeCloseTo(-120);
    expect(wrapper.find("feGaussianBlur[result='ABERRATED_BLURRED']").attributes("stdDeviation")).toBe(
      "0.3",
    );
    expect(wrapper.find(".liquid-glass__warp").attributes("style")).toContain("blur(20px)");
    expect(wrapper.find(".liquid-glass__warp").attributes("style")).toContain("saturate(140%)");

    const firstCard = wrapper.find<HTMLElement>("[data-testid='works-item']");
    expect(firstCard.attributes("style")).toContain("scale(1)");
    expect(wrapper.findAll("a[data-kind='live']")).toHaveLength(3);
    expect(wrapper.findAll("a[data-kind='github']")).toHaveLength(3);

    await wrapper.find("[data-testid='works-view-toggle-orbit']").trigger("click");

    expect(wrapper.find("[data-testid='works-view-case']").element).toBe(mountedCaseElement);
    expect(wrapper.find(".works-panel__body").attributes("aria-hidden")).toBe("true");
    expect(wrapper.find(".works-panel__body").attributes()).toHaveProperty("inert");
  });

  it("uses case mode on mobile-sized screens", () => {
    installMatchMedia(false);

    const wrapper = mount(WorksPanel, {
      props: {
        works,
      },
    });

    expect(wrapper.find("[data-testid='works-view-toggle']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='works-view-orbit']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='works-view-case']").exists()).toBe(true);
    expect(wrapper.findAll("[data-testid='works-item']")).toHaveLength(3);
    expect(wrapper.findAll("a[data-kind='live']")).toHaveLength(3);
    expect(wrapper.findAll("a[data-kind='github']")).toHaveLength(3);
  });
});

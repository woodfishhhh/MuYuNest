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
    avatarUrl: "/site-icons/woodfish.svg",
    liveUrl: "https://blog.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/VueThreeBlog",
  },
  {
    slug: "weather",
    name: "WeatherDemo",
    description: "Monochrome weather workspace and forecast explorer.",
    kind: "App",
    avatarUrl: "/site-icons/weather.svg",
    liveUrl: "https://weather.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/WeatherDemo",
  },
  {
    slug: "pretext",
    name: "Pretext",
    description: "Interactive pretext geometry experiment.",
    kind: "Lab",
    avatarUrl: "/site-icons/pretext.svg",
    liveUrl: "https://pretext.woodfish.site/",
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
    expect(wrapper.find("[data-testid='works-view-case']").exists()).toBe(false);
    expect(wrapper.find(".works-panel__body").exists()).toBe(false);
    expect(wrapper.findAll(".works-panel__a11y-links a")).toHaveLength(6);
    expect(wrapper.findAll(".works-panel__a11y-links a").every((link) => !link.attributes("tabindex"))).toBe(
      true,
    );
    expect(wrapper.find(".works-panel__title p").text()).toBe(
      "把卡片拖向屏幕中心进入项目",
    );
  });

  it("keeps desktop Case on the same Three card surface", async () => {
    installMatchMedia(true);
    const store = useSiteStore();

    const wrapper = mount(WorksPanel, {
      props: {
        works,
      },
    });
    await wrapper.find("[data-testid='works-view-toggle-case']").trigger("click");

    expect(store.worksViewMode).toBe("case");
    expect(wrapper.find("[data-testid='works-view-case']").exists()).toBe(false);
    expect(wrapper.find(".works-panel__body").exists()).toBe(false);
    expect(wrapper.findAll(".works-panel__a11y-links a")).toHaveLength(6);

    await wrapper.find("[data-testid='works-view-toggle-orbit']").trigger("click");

    expect(wrapper.find("[data-testid='works-view-case']").exists()).toBe(false);
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
    expect(wrapper.findAll(".works-case__avatar img").map((image) => image.attributes("src"))).toEqual([
      "/site-icons/woodfish.svg",
      "/site-icons/weather.svg",
      "/site-icons/pretext.svg",
    ]);
    expect(
      wrapper
        .findAll("[data-testid='works-item']")
        .every((card) => card.attributes("data-glass-variant") === "case"),
    ).toBe(true);
    expect(wrapper.findAll("a[data-kind='live']")).toHaveLength(3);
    expect(wrapper.findAll("a[data-kind='github']")).toHaveLength(3);
    expect(wrapper.findAll("[data-magnetic-pointer='work-action-live']")).toHaveLength(3);
    expect(wrapper.findAll("[data-magnetic-pointer='work-action-github']")).toHaveLength(3);
    expect(
      wrapper
        .findAll("[data-testid='works-item']")
        .every((card) => !card.attributes("data-magnetic-pointer")),
    ).toBe(true);
  });
});

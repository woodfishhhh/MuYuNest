import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomeView from "@/views/HomeView.vue";
import { useSiteStore } from "@/stores/site";

const visitorMock = vi.hoisted(() => ({
  hasError: { __v_isRef: true, value: false },
  hydrateMock: vi.fn(),
  isLoading: { __v_isRef: true, value: false },
  theme: { __v_isRef: true, value: "night" as "night" | "day" },
  total: { __v_isRef: true, value: 32 as number | null },
}));

vi.mock("@/composables/useVisitorCount", () => ({
  useVisitorCount: () => ({
    total: visitorMock.total,
    isLoading: visitorMock.isLoading,
    hasError: visitorMock.hasError,
    hydrate: visitorMock.hydrateMock,
  }),
}));

vi.mock("@/composables/useTheme", () => ({
  useTheme: () => ({
    theme: visitorMock.theme,
  }),
}));

vi.mock("@/composables/useHomePanels", () => ({
  useHomePanels: () => ({
    posts: [],
    author: null,
    friendLinks: [],
    works: [],
    isPostsLoading: false,
    isAuthorLoading: false,
    isFriendLinksLoading: false,
  }),
}));

const SiteNavStub = defineComponent({
  name: "SiteNav",
  template: "<div data-testid='site-nav-stub' />",
});

const SlideControllerStub = defineComponent({
  name: "SlideController",
  template: "<div data-testid='slide-controller-stub'><slot /></div>",
});

const ReadingOverlayStub = defineComponent({
  name: "ReadingOverlay",
  template: "<div data-testid='reading-overlay-stub' />",
});

describe("HomeView", () => {
  beforeEach(() => {
    visitorMock.hydrateMock.mockReset();
    visitorMock.total.value = 32;
    visitorMock.isLoading.value = false;
    visitorMock.hasError.value = false;
    visitorMock.theme.value = "night";
    setActivePinia(createPinia());
  });

  function mountHomeView() {
    return mount(HomeView, {
      global: {
        stubs: {
          SiteNav: SiteNavStub,
          SlideController: SlideControllerStub,
          ReadingOverlay: ReadingOverlayStub,
          Transition: false,
        },
      },
    });
  }

  it("hydrates the visitor count on mount and shows the badge on home mode", async () => {
    const wrapper = mountHomeView();
    await flushPromises();

    expect(visitorMock.hydrateMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get("[data-testid='visitor-count-badge']").text()).toContain("32");
  });

  it("does not contain a home-backdrop element (scene is hosted in RouteTransitionShell)", () => {
    const wrapper = mountHomeView();

    expect(wrapper.find("[data-testid='home-scene-layer']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='home-backdrop']").exists()).toBe(false);
  });

  it("hides the visitor badge outside home mode", async () => {
    const siteStore = useSiteStore();
    siteStore.goBlog();

    const wrapper = mountHomeView();
    await flushPromises();

    expect(wrapper.find("[data-testid='visitor-count-badge']").exists()).toBe(false);
  });
});

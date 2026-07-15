import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RouteTransitionShell from "@/components/layout/RouteTransitionShell.vue";

const routeState = reactive({
  name: "post",
  fullPath: "/posts/orbiting-interfaces",
});

vi.stubGlobal("useRoute", () => routeState);

vi.mock("@/composables/useRouteTransitionOrchestrator", () => ({
  playRouteTransition: vi.fn(),
}));

vi.mock("@/motion/route-transition-intent", () => ({
  resolveTransitionIntent: () => ({ type: "none" }),
}));

vi.mock("@/components/scene/ThreeSceneCanvas.vue", () => ({
  __esModule: true,
  default: defineComponent({
    name: "ThreeSceneCanvas",
    template: '<div data-testid="three-scene-canvas-stub" />',
  }),
}));

vi.mock("@/views/HomeView.vue", () => ({
  __esModule: true,
  default: defineComponent({
    name: "HomeView",
    template: '<div data-testid="home-view-stub" />',
  }),
}));

const PageStub = defineComponent({
  name: "PageStub",
  template: '<div data-testid="page-stub" />',
});

const NuxtPageStub = defineComponent({
  name: "NuxtPage",
  components: { PageStub },
  setup() {
    return { PageStub, routeState };
  },
  template:
    '<div data-testid="nuxt-page-stub"><slot :Component="PageStub" :route="routeState" /></div>',
});

describe("RouteTransitionShell", () => {
  beforeEach(() => {
    routeState.name = "post";
    routeState.fullPath = "/posts/orbiting-interfaces";
    setActivePinia(createPinia());
  });

  it("keeps the Three.js scene mounted behind article routes", async () => {
    const wrapper = mount(RouteTransitionShell, {
      global: {
        stubs: {
          NuxtPage: NuxtPageStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get("[data-scene-layer]")).toBeTruthy();
    expect(wrapper.get("[data-testid='three-scene-canvas-stub']")).toBeTruthy();
    expect(wrapper.get("[data-testid='page-stub']")).toBeTruthy();
  });

  it("keeps one HomeView instance mounted across home-family routes", async () => {
    routeState.name = "blog";
    routeState.fullPath = "/blog";
    const wrapper = mount(RouteTransitionShell, {
      global: {
        stubs: {
          NuxtPage: NuxtPageStub,
        },
      },
    });

    await flushPromises();
    const homeView = wrapper.get<HTMLElement>("[data-testid='home-view-stub']").element;
    homeView.dataset.instanceMarker = "preserved";
    expect(wrapper.find("[data-testid='page-stub']").exists()).toBe(false);

    routeState.name = "friend";
    routeState.fullPath = "/friend";
    await flushPromises();

    expect(wrapper.get<HTMLElement>("[data-testid='home-view-stub']").element).toBe(homeView);
    expect(wrapper.get<HTMLElement>("[data-testid='home-view-stub']").element.dataset.instanceMarker).toBe(
      "preserved",
    );
  });
});

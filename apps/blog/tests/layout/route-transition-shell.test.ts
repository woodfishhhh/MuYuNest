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

const NuxtPageStub = defineComponent({
  name: "NuxtPage",
  template: '<div data-testid="nuxt-page-stub" />',
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
  });
});

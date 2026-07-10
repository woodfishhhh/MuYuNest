import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomeView from "@/views/HomeView.vue";
import { useSiteStore } from "@/stores/site";
import type { PostSummary } from "@/types/content";

interface MutableRef<T> {
  value: T;
}

const visitorMock = vi.hoisted(() => ({
  hasError: { __v_isRef: true, value: false },
  hydrateMock: vi.fn(),
  isLoading: { __v_isRef: true, value: false },
  theme: { __v_isRef: true, value: "night" as "night" | "day" },
  total: { __v_isRef: true, value: 32 as number | null },
}));

const homePanelsMock = vi.hoisted(() => ({
  isPostsLoading: null as MutableRef<boolean> | null,
  posts: null as MutableRef<PostSummary[]> | null,
}));
const mountedHomeViews: VueWrapper[] = [];

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

vi.mock("@/composables/useHomePanels", async () => {
  const { shallowRef } = await import("vue");
  const posts = shallowRef<PostSummary[]>([]);
  const isPostsLoading = shallowRef(false);
  homePanelsMock.posts = posts;
  homePanelsMock.isPostsLoading = isPostsLoading;

  return {
    useHomePanels: () => ({
      posts,
      author: shallowRef(null),
      friendLinks: shallowRef([]),
      works: shallowRef([]),
      isPostsLoading,
      isAuthorLoading: shallowRef(false),
      isFriendLinksLoading: shallowRef(false),
    }),
  };
});

const SiteNavStub = defineComponent({
  name: "SiteNav",
  template: "<div data-testid='site-nav-stub' />",
});

const SlideControllerStub = defineComponent({
  name: "SlideController",
  props: {
    blogScrollContainer: {
      default: null,
    },
  },
  template: "<div data-testid='slide-controller-stub'><slot /></div>",
});

const ReadingOverlayStub = defineComponent({
  name: "ReadingOverlay",
  template: "<div data-testid='reading-overlay-stub' />",
});

const PostPanelStub = defineComponent({
  name: "PostPanel",
  template: "<div data-testid='post-panel-stub' />",
});

describe("HomeView", () => {
  beforeEach(() => {
    visitorMock.hydrateMock.mockReset();
    visitorMock.total.value = 32;
    visitorMock.isLoading.value = false;
    visitorMock.hasError.value = false;
    visitorMock.theme.value = "night";
    homePanelsMock.posts!.value = [];
    homePanelsMock.isPostsLoading!.value = false;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    for (const wrapper of mountedHomeViews.splice(0)) {
      wrapper.unmount();
    }
    vi.restoreAllMocks();
  });

  function mountHomeView() {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          SiteNav: SiteNavStub,
          SlideController: SlideControllerStub,
          ReadingOverlay: ReadingOverlayStub,
          PostPanel: PostPanelStub,
          Transition: false,
        },
      },
    });
    mountedHomeViews.push(wrapper);
    return wrapper;
  }

  function unmountHomeView(wrapper: VueWrapper) {
    const index = mountedHomeViews.indexOf(wrapper);
    if (index >= 0) {
      mountedHomeViews.splice(index, 1);
    }
    wrapper.unmount();
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

  it("restores Blog scrollTop after switching to another panel and back", async () => {
    const siteStore = useSiteStore();
    siteStore.goBlog();

    const wrapper = mountHomeView();
    await flushPromises();

    const blogPanel = wrapper.get<HTMLElement>("[data-blog-scroll-container]");
    blogPanel.element.scrollTop = 640;
    await blogPanel.trigger("scroll");

    siteStore.goAuthor();
    await nextTick();
    expect(wrapper.find("[data-blog-scroll-container]").exists()).toBe(false);

    siteStore.goBlog();
    await nextTick();
    await flushPromises();

    expect(wrapper.get<HTMLElement>("[data-blog-scroll-container]").element.scrollTop).toBe(640);
  });

  it("restores Blog scrollTop after HomeView is remounted", async () => {
    const siteStore = useSiteStore();
    siteStore.goBlog();

    const firstWrapper = mountHomeView();
    await flushPromises();

    const blogPanel = firstWrapper.get<HTMLElement>("[data-blog-scroll-container]");
    blogPanel.element.scrollTop = 720;
    await blogPanel.trigger("scroll");
    unmountHomeView(firstWrapper);

    const secondWrapper = mountHomeView();
    await nextTick();
    await flushPromises();

    expect(secondWrapper.get<HTMLElement>("[data-blog-scroll-container]").element.scrollTop).toBe(720);
  });

  it("replays the saved Blog scrollTop after delayed posts make the panel scrollable", async () => {
    homePanelsMock.isPostsLoading!.value = true;
    const scrollToSpy = vi
      .spyOn(HTMLElement.prototype, "scrollTo")
      .mockImplementation(function (options: ScrollToOptions | number, top?: number) {
        const requestedTop = typeof options === "number" ? (top ?? options) : (options.top ?? 0);
        this.scrollTop = homePanelsMock.posts!.value.length > 0 ? requestedTop : 0;
      });

    const siteStore = useSiteStore();
    siteStore.setBlogScrollTop(900);
    siteStore.goBlog();

    const wrapper = mountHomeView();
    await flushPromises();

    const blogPanel = wrapper.get<HTMLElement>("[data-blog-scroll-container]");
    expect(blogPanel.element.scrollTop).toBe(0);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    homePanelsMock.posts!.value = [{} as PostSummary];
    homePanelsMock.isPostsLoading!.value = false;
    await nextTick();
    await flushPromises();

    expect(scrollToSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 900, behavior: "auto" });
    expect(blogPanel.element.scrollTop).toBe(900);
  });

  it("retries a saved Blog scrollTop when an async panel becomes scrollable on a later frame", async () => {
    homePanelsMock.posts!.value = [{} as PostSummary];
    homePanelsMock.isPostsLoading!.value = false;

    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    let maxScrollTop = 0;
    const scrollToSpy = vi
      .spyOn(HTMLElement.prototype, "scrollTo")
      .mockImplementation(function (options: ScrollToOptions | number, top?: number) {
        const requestedTop = typeof options === "number" ? (top ?? options) : (options.top ?? 0);
        this.scrollTop = Math.min(requestedTop, maxScrollTop);
      });

    const siteStore = useSiteStore();
    siteStore.setBlogScrollTop(900);
    siteStore.goBlog();

    const wrapper = mountHomeView();
    const blogPanel = wrapper.get<HTMLElement>("[data-blog-scroll-container]");
    Object.defineProperties(blogPanel.element, {
      clientHeight: { configurable: true, get: () => 600 },
      scrollHeight: { configurable: true, get: () => 600 + maxScrollTop },
    });
    await flushPromises();

    expect(blogPanel.element.scrollTop).toBe(0);
    expect(siteStore.blogScrollTop).toBe(900);
    expect(frameCallbacks).toHaveLength(1);

    maxScrollTop = 400;
    frameCallbacks.shift()!(16);
    await nextTick();

    expect(blogPanel.element.scrollTop).toBe(400);
    expect(siteStore.blogScrollTop).toBe(900);
    expect(frameCallbacks).toHaveLength(1);

    maxScrollTop = 1600;
    frameCallbacks.shift()!(32);
    await nextTick();

    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 900, behavior: "auto" });
    expect(blogPanel.element.scrollTop).toBe(900);

    blogPanel.element.scrollTop = 940;
    await blogPanel.trigger("scroll");
    expect(siteStore.blogScrollTop).toBe(940);
    expect(frameCallbacks).toHaveLength(0);
  });
});

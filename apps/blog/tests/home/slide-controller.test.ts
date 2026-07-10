import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SlideController from "@/components/home/SlideController.vue";
import { useSiteStore } from "@/stores/site";

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div />" } },
      { path: "/blog", name: "blog", component: { template: "<div />" } },
      { path: "/author", name: "author", component: { template: "<div />" } },
      { path: "/friend", name: "friend", component: { template: "<div />" } },
    ],
  });
}

describe("SlideController", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
  });

  it("does not hijack author wheel scrolling once GSAP owns the author surface", async () => {
    const router = createTestRouter();
    await router.push({ name: "author" });
    await router.isReady();

    const siteStore = useSiteStore();
    siteStore.goAuthor();

    const authorScroll = document.createElement("div");
    authorScroll.id = "author-scroll-container";
    const scrollBy = vi.fn();
    authorScroll.scrollBy = scrollBy;
    document.body.appendChild(authorScroll);

    mount(SlideController, {
      slots: {
        default: "<div />",
      },
      global: {
        plugins: [router],
      },
    });

    const event = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(scrollBy).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("author");
  });

  it("does not hijack friend wheel scrolling so the native panel scroll stays responsive", async () => {
    const router = createTestRouter();
    await router.push({ name: "friend" });
    await router.isReady();

    const siteStore = useSiteStore();
    siteStore.goFriend();

    const friendScroll = document.createElement("section");
    friendScroll.id = "friend-links-container";
    const scrollBy = vi.fn();
    friendScroll.scrollBy = scrollBy;
    document.body.appendChild(friendScroll);

    mount(SlideController, {
      slots: {
        default: "<div />",
      },
      global: {
        plugins: [router],
      },
    });

    const event = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("friend");
  });

  it("uses the provided Blog scroll container to return Home from the top", async () => {
    const router = createTestRouter();
    await router.push({ name: "blog" });
    await router.isReady();

    const siteStore = useSiteStore();
    siteStore.goBlog();

    const blogScroll = document.createElement("div");
    blogScroll.scrollTop = 0;
    document.body.appendChild(blogScroll);

    mount(SlideController, {
      props: {
        blogScrollContainer: blogScroll,
      },
      slots: {
        default: "<div />",
      },
      global: {
        plugins: [router],
      },
    });

    blogScroll.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -120,
        bubbles: true,
        cancelable: true,
      }),
    );

    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe("home");
    });
  });
});

import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";

import { useSiteStore } from "@/stores/site";

describe("site store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("enters works mode and resets transient reading state", () => {
    const store = useSiteStore();

    store.setWorksViewMode("case");
    store.enterReading("hello-world");
    store.enterFocus();

    store.goWorks();

    expect(store.mode).toBe("works");
    expect(store.activePostSlug).toBeNull();
    expect(store.isFocusing).toBe(false);
    expect(store.worksViewMode).toBe("orbit");
  });

  it("tracks the works view mode explicitly", () => {
    const store = useSiteStore();

    expect(store.worksViewMode).toBe("orbit");

    store.setWorksViewMode("case");

    expect(store.worksViewMode).toBe("case");
  });

  it("defaults to collection on desktop and roaming on phones", () => {
    const store = useSiteStore();
    store.syncHomeExperience(390);
    expect(store.homeExperience).toBe("roam");
    store.syncHomeExperience(1280);
    expect(store.homeExperience).toBe("collect");
    store.syncHomeExperience(767);
    expect(store.homeExperience).toBe("roam");
  });

  it("keeps a manual Home choice across navigation and resizing", () => {
    const store = useSiteStore();
    store.syncHomeExperience(1440);
    store.setHomeExperience("roam");
    store.goBlog();
    store.goHome();
    store.syncHomeExperience(1440);
    expect(store.homeExperience).toBe("roam");
    store.setHomeExperience("collect");
    store.syncHomeExperience(390);
    expect(store.homeExperience).toBe("collect");
  });

  it("keeps the Blog scroll position while navigating through other modes", () => {
    const store = useSiteStore();

    store.setBlogScrollTop(640);
    store.goAuthor();
    store.goBlog();

    expect(store.blogScrollTop).toBe(640);
  });
});

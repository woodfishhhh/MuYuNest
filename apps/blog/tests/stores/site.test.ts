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

  it("keeps the Blog scroll position while navigating through other modes", () => {
    const store = useSiteStore();

    store.setBlogScrollTop(640);
    store.goAuthor();
    store.goBlog();

    expect(store.blogScrollTop).toBe(640);
  });
});

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";

import ArticleToc from "@/components/article/ArticleToc.vue";

describe("ArticleToc", () => {
  it("renders controlled toc items and emits jump requests", async () => {
    const wrapper = mount(ArticleToc, {
      props: {
        activeId: "core-concepts",
        items: [
          { id: "overview", level: 2, text: "Overview" },
          { id: "core-concepts", level: 3, text: "Core Concepts" },
        ],
      },
    });

    const items = wrapper.findAll("[data-testid='article-toc-item']");

    expect(wrapper.get("[data-testid='article-toc']")).toBeTruthy();
    expect(wrapper.get("[data-testid='article-toc']").classes()).toContain("article-toc--desktop");
    expect(wrapper.get("[data-testid='article-toc-header']").text()).toContain("本页目录");
    expect(wrapper.get("[data-testid='article-toc-scroll']")).toBeTruthy();
    expect(items).toHaveLength(2);
    expect(wrapper.get("[data-toc-id='core-concepts']").attributes("aria-current")).toBe("location");

    await wrapper.get("[data-toc-id='overview']").trigger("click");

    expect(wrapper.emitted("jump")?.[0]).toEqual(["overview"]);
  });

  it("supports a collapsed mobile outline", async () => {
    const wrapper = mount(ArticleToc, {
      props: {
        activeId: "core-concepts",
        variant: "mobile",
        items: [
          { id: "overview", level: 2, text: "Overview" },
          { id: "core-concepts", level: 3, text: "Core Concepts" },
        ],
      },
    });

    expect(wrapper.get("[data-testid='article-toc']").classes()).toContain("article-toc--mobile");
    expect(wrapper.get("[data-testid='article-toc-mobile-toggle']").attributes("aria-expanded")).toBe("false");
    expect(wrapper.find("[data-testid='article-toc-scroll']").exists()).toBe(false);

    await wrapper.get("[data-testid='article-toc-mobile-toggle']").trigger("click");

    expect(wrapper.get("[data-testid='article-toc-mobile-toggle']").attributes("aria-expanded")).toBe("true");
    expect(wrapper.get("[data-testid='article-toc-scroll']")).toBeTruthy();

    await wrapper.get("[data-toc-id='overview']").trigger("click");

    expect(wrapper.emitted("jump")?.[0]).toEqual(["overview"]);
    expect(wrapper.get("[data-testid='article-toc-mobile-toggle']").attributes("aria-expanded")).toBe("false");
  });

  it("renders nothing when no headings are available", () => {
    const wrapper = mount(ArticleToc, {
      props: {
        activeId: "",
        items: [],
      },
    });

    expect(wrapper.find("[data-testid='article-toc']").exists()).toBe(false);
  });
});

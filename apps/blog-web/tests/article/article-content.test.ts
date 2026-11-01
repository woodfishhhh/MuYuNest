import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vite-plus/test";

import ArticleContent from "@/components/article/ArticleContent.vue";
import type { PostArticle } from "@/types/content";

const article: PostArticle = {
  canonicalSlug: "orbiting-interfaces",
  aliases: ["orbiting-interfaces"],
  title: "Orbiting Interfaces",
  publishedAt: "2026-04-08T00:00:00.000Z",
  publishedLabel: "Apr 08, 2026",
  excerpt: "A premium reading surface should feel calm, precise, and slightly theatrical.",
  type: "Essay",
  searchText: "Orbiting Interfaces Vue Motion Editorial premium reading surface",
  readingMinutes: 6,
  coverImage: "/newBlog/remote-assets/cover.png",
  categories: ["Design Systems"],
  tags: ["Vue", "Motion", "Editorial"],
  html: [
    '<h2 id="overview">Overview</h2>',
    "<p>Paragraph one.</p>",
    '<h3 id="constellation">Constellation</h3>',
    "<p>Paragraph two.</p>",
  ].join(""),
  toc: [
    { id: "overview", level: 2, text: "Overview" },
    { id: "constellation", level: 3, text: "Constellation" },
  ],
};

describe("ArticleContent", () => {
  it("renders hero, prose, toc, and reading progress for the article shell", async () => {
    const scrollContainer = document.createElement("div");

    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 1400,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      configurable: true,
      value: 800,
    });

    document.body.appendChild(scrollContainer);

    const wrapper = mount(ArticleContent, {
      attachTo: document.body,
      props: {
        article,
        overlay: true,
        scrollContainer,
      },
    });

    scrollContainer.scrollTop = 300;
    scrollContainer.dispatchEvent(new Event("scroll"));
    await nextTick();

    expect(wrapper.get("[data-testid='article-hero']").text()).toContain("Orbiting Interfaces");
    expect(wrapper.text()).toContain("6 min read");
    expect(wrapper.get("[data-testid='article-cover']").attributes("src")).toBe(article.coverImage);
    expect(wrapper.get("[data-testid='article-prose']").html()).toContain('id="overview"');
    expect(wrapper.get("[data-testid='article-toc-rail']")).toBeTruthy();
    expect(wrapper.get("[data-testid='article-toc-mobile']")).toBeTruthy();
    expect(wrapper.get("[data-testid='article-toc-scroll']")).toBeTruthy();
    expect(wrapper.findAll("[data-testid='article-toc-item']")).toHaveLength(2);
    expect(wrapper.get("[data-testid='article-progress-bar']").attributes("style")).toContain("transform: scaleX(0.5)");

    wrapper.unmount();
    scrollContainer.remove();
  });

  it("falls back to the nearest article page scroll container", async () => {
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "article-page";

    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 1400,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      configurable: true,
      value: 800,
    });

    document.body.appendChild(scrollContainer);

    const wrapper = mount(ArticleContent, {
      attachTo: scrollContainer,
      props: {
        article,
      },
    });

    scrollContainer.scrollTop = 300;
    scrollContainer.dispatchEvent(new Event("scroll"));
    await nextTick();

    expect(wrapper.get("[data-testid='article-progress-bar']").attributes("style")).toContain("transform: scaleX(0.5)");

    wrapper.unmount();
    scrollContainer.remove();
  });
});

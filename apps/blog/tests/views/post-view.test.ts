import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getPostSummaries: vi.fn(),
  loadPostArticle: vi.fn(),
  resolvePostSlug: vi.fn(),
  routeState: {
    slug: "orbiting-interfaces",
    query: {} as Record<string, string>,
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: {
      slug: mocks.routeState.slug,
    },
    query: mocks.routeState.query,
  }),
}));

vi.mock("@/content/posts", () => ({
  getPostSummaries: mocks.getPostSummaries,
  loadPostArticle: mocks.loadPostArticle,
  resolvePostSlug: mocks.resolvePostSlug,
}));

import PostView from "@/views/PostView.vue";

const RouterLinkStub = defineComponent({
  name: "RouterLink",
  props: {
    to: {
      type: [String, Object],
      default: "/",
    },
  },
  template: `<a :href="to" v-bind="$attrs"><slot /></a>`,
});

const ArticleContentStub = defineComponent({
  name: "ArticleContent",
  props: {
    article: {
      type: Object,
      required: true,
    },
  },
  template: `<div data-testid="article-content-stub">{{ article.title }}</div>`,
});

const article = {
  canonicalSlug: "orbiting-interfaces",
  aliases: ["orbiting-interfaces"],
  title: "Orbiting Interfaces",
  publishedAt: "2026-04-08T00:00:00.000Z",
  publishedLabel: "Apr 08, 2026",
  excerpt: "A premium reading surface should feel calm, precise, and slightly theatrical.",
  readingMinutes: 6,
  coverImage: null,
  categories: ["Design Systems"],
  tags: ["Vue", "Motion", "Editorial"],
  html: '<h2 id="overview">Overview</h2><p>Paragraph.</p>',
  toc: [{ id: "overview", level: 2, text: "Overview" }],
};

const postSummaries = [
  {
    canonicalSlug: "vector-notes",
    aliases: ["vector-notes"],
    title: "Vector Notes",
    publishedAt: "2026-04-10T00:00:00.000Z",
    publishedLabel: "Apr 10, 2026",
    excerpt: "Previous post excerpt.",
    type: "Essay",
    searchText: "Vector Notes",
    readingMinutes: 4,
    coverImage: null,
    categories: ["Design Systems"],
    tags: ["Math"],
  },
  {
    canonicalSlug: "orbiting-interfaces",
    aliases: ["orbiting-interfaces"],
    title: "Orbiting Interfaces",
    publishedAt: "2026-04-08T00:00:00.000Z",
    publishedLabel: "Apr 08, 2026",
    excerpt: "Current post excerpt.",
    type: "Essay",
    searchText: "Orbiting Interfaces",
    readingMinutes: 6,
    coverImage: null,
    categories: ["Design Systems"],
    tags: ["Vue", "Motion", "Editorial"],
  },
  {
    canonicalSlug: "signal-objects",
    aliases: ["signal-objects"],
    title: "Signal Objects",
    publishedAt: "2026-04-06T00:00:00.000Z",
    publishedLabel: "Apr 06, 2026",
    excerpt: "Next post excerpt.",
    type: "Essay",
    searchText: "Signal Objects",
    readingMinutes: 5,
    coverImage: null,
    categories: ["Design Systems"],
    tags: ["Vue"],
  },
];

describe("PostView", () => {
  beforeEach(() => {
    mocks.routeState.slug = "orbiting-interfaces";
    mocks.routeState.query = {};
    mocks.getPostSummaries.mockReset();
    mocks.loadPostArticle.mockReset();
    mocks.resolvePostSlug.mockReset();
    mocks.getPostSummaries.mockResolvedValue(postSummaries);
    mocks.resolvePostSlug.mockImplementation(async (slug: string) => slug);
    document.title = "WOODFISH";
  });

  it("shows a loading state while the article request is still pending", async () => {
    let resolveArticle: ((value: typeof article | null) => void) | undefined;

    mocks.loadPostArticle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveArticle = resolve;
        }),
    );

    const wrapper = mount(PostView, {
      global: {
        stubs: {
          ArticleContent: ArticleContentStub,
          RouterLink: RouterLinkStub,
        },
      },
    });

    expect(wrapper.get("[data-testid='post-view-loading']")).toBeTruthy();

    if (resolveArticle) {
      resolveArticle(article);
    }
    await flushPromises();

    expect(wrapper.get("[data-testid='post-view-article']")).toBeTruthy();
  });

  it("renders a premium empty state when the article cannot be found", async () => {
    mocks.loadPostArticle.mockResolvedValue(null);

    const wrapper = mount(PostView, {
      global: {
        stubs: {
          ArticleContent: ArticleContentStub,
          RouterLink: RouterLinkStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get("[data-testid='post-view-not-found']").text()).toContain(
      "Article not found",
    );
    expect(document.title).toBe("Article not found | WOODFISH");
  });

  it("renders the article shell and resolved slug metadata after loading succeeds", async () => {
    mocks.loadPostArticle.mockResolvedValue(article);

    const wrapper = mount(PostView, {
      global: {
        stubs: {
          ArticleContent: ArticleContentStub,
          RouterLink: RouterLinkStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get("[data-testid='post-view-article']")).toBeTruthy();
    expect(wrapper.get("[data-testid='article-content-stub']").text()).toContain(
      "Orbiting Interfaces",
    );
    expect(wrapper.text()).toContain("/ posts / orbiting-interfaces");
    expect(wrapper.get("[data-testid='post-view-back-link']").attributes("aria-label")).toBe(
      "Back Home",
    );
    expect(wrapper.get("[data-testid='post-view-back-link']").find("span").exists()).toBe(false);
    expect(wrapper.get("[data-testid='post-view-previous-link']").text()).toContain("Vector Notes");
    expect(wrapper.get("[data-testid='post-view-next-link']").text()).toContain("Signal Objects");
    expect(document.title).toBe("Orbiting Interfaces | WOODFISH");
  });

  it("keeps the post scroll surface interactive inside the route transition stage", () => {
    const css = readFileSync("src/assets/main.css", "utf8");

    expect(css).toMatch(/\.article-page\s*{[^}]*pointer-events:\s*auto;/s);
  });

  it("keeps article reading locked to vertical page scrolling on narrow screens", () => {
    const css = readFileSync("src/assets/main.css", "utf8");

    expect(css).toMatch(/\.article-page\s*{[^}]*overflow-x:\s*hidden;/s);
  });

  it("reuses the friend page low-opacity background without an opaque article override", () => {
    mocks.loadPostArticle.mockResolvedValue(article);

    const wrapper = mount(PostView, {
      global: {
        stubs: {
          ArticleContent: ArticleContentStub,
          RouterLink: RouterLinkStub,
        },
      },
    });
    const page = wrapper.get("[data-post-page]");
    const css = readFileSync("src/assets/main.css", "utf8");
    const articlePageRule = css.match(/\.article-page\s*{([^}]*)}/s)?.[1] ?? "";

    expect(page.classes()).toEqual(
      expect.arrayContaining(["stage-panel-gradient", "stage-panel-gradient--friend"]),
    );
    expect(articlePageRule).not.toMatch(/\bbackground(?:-color|-image)?\s*:/);
    expect(css).not.toMatch(/:root\[data-theme="day"\]\s+\.article-page\s*{/);
  });

  it("keeps the article shell translucent enough for the Three.js geometry to remain visible", () => {
    const css = readFileSync("src/assets/main.css", "utf8");
    const nightShellRule = css.match(/\.article-view\s*{([^}]*)}/s)?.[1] ?? "";
    const dayShellRule =
      css.match(/:root\[data-theme="day"\]\s+\.article-view\s*{([^}]*)}/s)?.[1] ?? "";

    expect(nightShellRule).toContain("rgba(12, 16, 32, 0.58)");
    expect(nightShellRule).toContain("rgba(8, 12, 24, 0.42)");
    expect(dayShellRule).toContain("rgba(255, 251, 241, 0.72)");
    expect(dayShellRule).toContain("rgba(255, 255, 255, 0.48)");
  });

  it("preserves the originating blog query in the back link", async () => {
    mocks.routeState.query = {
      q: "ajax",
      type: "Tutorial",
    };
    mocks.loadPostArticle.mockResolvedValue(article);

    const wrapper = mount(PostView, {
      global: {
        stubs: {
          ArticleContent: ArticleContentStub,
          RouterLink: RouterLinkStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.getComponent(RouterLinkStub).props("to")).toEqual({
      name: "blog",
      query: {
        q: "ajax",
        type: "Tutorial",
      },
    });
    expect(wrapper.get("[data-testid='post-view-back-link']").attributes("aria-label")).toBe(
      "Back to Blog",
    );
    expect(wrapper.get("[data-testid='post-view-back-link']").find("span").exists()).toBe(false);
  });
});

import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  useRouter: () => ({ push: vi.fn() }),
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

const DocsLayoutStub = defineComponent({
  name: "DocsLayout",
  props: ["topics", "currentSlug"],
  template: '<main><slot :scroll-container="null" /></main>',
});
function render() {
  return mount(PostView, {
    global: { stubs: { DocsLayout: DocsLayoutStub, ArticleContent: ArticleContentStub, RouterLink: RouterLinkStub } },
  });
}
describe("PostView documentation reader", () => {
  beforeEach(() => {
    mocks.routeState.slug = "orbiting-interfaces";
    mocks.routeState.query = {};
    mocks.getPostSummaries.mockReset().mockResolvedValue(postSummaries);
    mocks.loadPostArticle.mockReset().mockResolvedValue(article);
    mocks.resolvePostSlug.mockReset().mockImplementation(async (slug: string) => slug);
  });
  it("shows loading while an article is pending", async () => {
    let finish: (value: typeof article) => void = () => {};
    mocks.loadPostArticle.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = render();
    expect(wrapper.find('[data-testid="post-view-loading"]').exists()).toBe(true);
    finish(article);
    await flushPromises();
    expect(wrapper.find('[data-testid="post-view-article"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it("renders the article and neighbors inside its topic", async () => {
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[data-testid="article-content-stub"]').text()).toBe(article.title);
    expect(wrapper.get('[data-testid="post-view-previous-link"]').text()).toContain("Vector Notes");
    expect(wrapper.get('[data-testid="post-view-next-link"]').text()).toContain("Signal Objects");
    expect(document.title).toBe("Orbiting Interfaces | WOODFISH");
    wrapper.unmount();
  });
  it("returns to the knowledge base with search and series context", async () => {
    mocks.routeState.query = { q: "ajax", type: "Tutorial", topic: "frontend", series: "javascript" };
    const wrapper = render();
    await flushPromises();
    expect(wrapper.findComponent(RouterLinkStub).props("to")).toEqual({ name: "blog", query: mocks.routeState.query });
    expect(wrapper.get('[data-testid="post-view-back-link"]').text()).toBe("← 返回知识库");
    wrapper.unmount();
  });
  it("offers navigation for an unknown article", async () => {
    mocks.loadPostArticle.mockResolvedValue(null);
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[data-testid="post-view-not-found"]').text()).toContain("文章不存在");
    expect(wrapper.find('[data-testid="post-view-back-link"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it("distinguishes a failed request from a missing article and retries", async () => {
    mocks.loadPostArticle.mockRejectedValueOnce(new Error("offline"));
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("暂时无法加载");
    expect(wrapper.find('[data-testid="post-view-not-found"]').exists()).toBe(false);
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="post-view-article"]').exists()).toBe(true);
    wrapper.unmount();
  });
});

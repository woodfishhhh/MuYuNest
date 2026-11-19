import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { PostArticle, PostSummary } from "@/types/content";
import seriesConfig from "@/content/docs-series.json";

vi.mock("@/utils/base-url", () => ({ getBaseUrl: () => "/newBlog/" }));
const summary = {
  canonicalSlug: "first-post", aliases: ["中文别名"], title: "First", publishedAt: "2026-01-01",
  publishedLabel: "Jan 1", excerpt: "Text", type: "Notes", searchText: "search",
  readingMinutes: 1, categories: [], tags: [],
} satisfies PostSummary;
const article: PostArticle = { ...summary, html: "<p>Article</p>", toc: [] };
const fetchMock = vi.fn();
const json = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { "content-type": "application/json" },
});

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("post content requests", () => {
  it("hides guides from discovery while preserving their article and alias URLs", async () => {
    const hiddenSlug = seriesConfig.find(series => series.hidden)!.slugs[0];
    const hidden = { ...summary, canonicalSlug: hiddenSlug, aliases: ["hidden-alias"] };
    const hiddenArticle = { ...article, ...hidden };
    fetchMock.mockResolvedValueOnce(json([summary, hidden])).mockResolvedValueOnce(json(hiddenArticle));
    const { getPostSummaries, loadPostArticle } = await import("@/content/posts");
    const [first, second, loaded] = await Promise.all([
      getPostSummaries(), getPostSummaries(), loadPostArticle("hidden-alias"),
    ]);
    expect(first).toEqual([summary]);
    expect(second).toBe(first);
    expect(loaded).toEqual(hiddenArticle);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid JSON and retries the index for discovery", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>SPA fallback</html>"))
      .mockResolvedValueOnce(json([summary]));
    const { getPostSummaries } = await import("@/content/posts");
    await expect(getPostSummaries()).rejects.toThrow();
    await expect(getPostSummaries()).resolves.toEqual([summary]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates index and article requests across aliases and canonical URLs", async () => {
    fetchMock.mockResolvedValueOnce(json([summary])).mockResolvedValueOnce(json(article));
    const { loadPostArticle } = await import("@/content/posts");
    const results = await Promise.all([loadPostArticle("first-post"), loadPostArticle(encodeURIComponent("中文别名"))]);
    expect(results).toEqual([article, article]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/newBlog/post-index.json", "/newBlog/articles/first-post.json",
    ]);
  });

  it("rejects a failed index without loading articles and allows an explicit retry", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(json([summary]));
    const { resolvePostSlug } = await import("@/content/posts");
    await expect(resolvePostSlug("first-post")).rejects.toThrow("503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(resolvePostSlug("first-post")).resolves.toBe("first-post");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not request articles for unknown slugs", async () => {
    fetchMock.mockResolvedValueOnce(json([summary]));
    const { loadPostArticle } = await import("@/content/posts");
    await expect(loadPostArticle("unknown")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a failed article without reloading the index", async () => {
    fetchMock.mockResolvedValueOnce(json([summary]))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(json(article));
    const { loadPostArticle } = await import("@/content/posts");
    await expect(loadPostArticle("first-post")).rejects.toThrow("503");
    await expect(loadPostArticle("first-post")).resolves.toEqual(article);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/newBlog/post-index.json", "/newBlog/articles/first-post.json", "/newBlog/articles/first-post.json",
    ]);
  });

  it("gives canonical slugs priority over colliding aliases", async () => {
    fetchMock.mockResolvedValueOnce(json([{ ...summary, aliases: ["second-post"] }, { ...summary, canonicalSlug: "second-post", aliases: [] }]));
    const { resolvePostSlug } = await import("@/content/posts");
    await expect(resolvePostSlug("second-post")).resolves.toBe("second-post");
  });
});

import { describe, expect, it } from "vite-plus/test";

import type { PostSummary } from "../../src/types/content";
import { buildBlogFacets, filterBlogPosts, sortBlogPosts } from "../../src/content/blog-hub";

const posts: PostSummary[] = [
  {
    canonicalSlug: "ajax-basics-intro",
    aliases: ["AJAX 基础入门教程"],
    title: "AJAX 基础入门教程",
    publishedAt: "2025-12-20T12:00:04.000Z",
    publishedLabel: "Dec 20, 2025",
    excerpt: "理解 AJAX 请求生命周期和异步界面。",
    type: "Tutorial",
    searchText: "AJAX 请求 生命周期 异步 界面 fetch retry circuit breaker",
    readingMinutes: 6,
    coverImage: null,
    categories: ["前端开发"],
    tags: ["AJAX基础", "axios"],
  },
  {
    canonicalSlug: "notes-observability",
    aliases: ["Node 观测性随记"],
    title: "Node 观测性随记",
    publishedAt: "2025-12-18T08:30:00.000Z",
    publishedLabel: "Dec 18, 2025",
    excerpt: "日志、指标、追踪是线上排障基础。",
    type: "Notes",
    searchText: "日志 指标 追踪 observability telemetry",
    readingMinutes: 3,
    coverImage: null,
    categories: ["工程化"],
    tags: ["Node.js", "日志"],
  },
];

describe("blog-hub", () => {
  it("uses fresh search data when a generated summary is replaced", () => {
    const before = { ...posts[0], title: "Old heading", searchText: "old corpus" };
    expect(filterBlogPosts([before], { query: "old corpus" })).toEqual([before]);
    const after = { ...before, title: "New heading", searchText: "new corpus" };
    expect(filterBlogPosts([after], { query: "old corpus" })).toEqual([]);
    expect(filterBlogPosts([after], { query: "NEW   CORPUS" })).toEqual([after]);
  });

  it("keeps short queries on summary metadata instead of scanning the full search corpus", () => {
    expect(filterBlogPosts(posts, { query: "retry" })).toEqual([]);
    expect(filterBlogPosts(posts, { query: "AJAX" }).map((post) => post.canonicalSlug)).toEqual([
      "ajax-basics-intro",
    ]);
  });

  it("uses searchText when the query is long enough", () => {
    expect(
      filterBlogPosts(posts, { query: "circuit breaker" }).map((post) => post.canonicalSlug),
    ).toEqual(["ajax-basics-intro"]);
  });

  it("supports type, category, and tag filters together", () => {
    expect(
      filterBlogPosts(posts, {
        type: "Tutorial",
        category: "前端开发",
        tag: "axios",
      }).map((post) => post.canonicalSlug),
    ).toEqual(["ajax-basics-intro"]);
  });

  it("builds facets with descending counts", () => {
    expect(buildBlogFacets(posts)).toEqual({
      categories: [
        { count: 1, value: "前端开发" },
        { count: 1, value: "工程化" },
      ],
      tags: [
        { count: 1, value: "AJAX基础" },
        { count: 1, value: "axios" },
        { count: 1, value: "Node.js" },
        { count: 1, value: "日志" },
      ],
      types: [
        { count: 1, value: "Tutorial" },
        { count: 1, value: "Notes" },
      ],
    });
  });

  it("sorts posts by latest and reading time", () => {
    expect(sortBlogPosts(posts, "latest").map((post) => post.canonicalSlug)).toEqual([
      "ajax-basics-intro",
      "notes-observability",
    ]);
    expect(sortBlogPosts(posts, "reading-time").map((post) => post.canonicalSlug)).toEqual([
      "ajax-basics-intro",
      "notes-observability",
    ]);
  });
});

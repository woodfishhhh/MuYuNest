import { describe, expect, it } from "vite-plus/test";

import type { PostSummary } from "../../src/types/content";
import { resolvePostSlugFromIndex } from "../../src/content/post-helpers";

const posts: PostSummary[] = [
  {
    canonicalSlug: "ajax-basics-intro",
    aliases: ["AJAX 基础入门教程", "ajax-intro"],
    title: "AJAX 基础入门教程",
    publishedAt: "2025-12-20T12:00:04.000Z",
    publishedLabel: "Dec 20, 2025",
    excerpt: "摘要",
    type: "Tutorial",
    searchText: "AJAX 基础入门教程 AJAX基础 前端开发 摘要",
    readingMinutes: 3,
    coverImage: null,
    categories: ["前端开发"],
    tags: ["AJAX基础"],
  },
];

describe("post-helpers", () => {
  it("returns the canonical slug when the incoming slug is already canonical", () => {
    expect(resolvePostSlugFromIndex(posts, "ajax-basics-intro")).toBe("ajax-basics-intro");
  });

  it("maps aliases to the canonical slug", () => {
    expect(resolvePostSlugFromIndex(posts, "AJAX 基础入门教程")).toBe("ajax-basics-intro");
    expect(resolvePostSlugFromIndex(posts, "ajax-intro")).toBe("ajax-basics-intro");
  });

  it("returns null for unknown slugs", () => {
    expect(resolvePostSlugFromIndex(posts, "unknown-post")).toBeNull();
  });
});

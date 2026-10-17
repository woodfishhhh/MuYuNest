import { describe, expect, it } from "vitest";
import { normalizeDocsLinks } from "@/content/docs-links";
import { buildDocsNavigation } from "@/content/docs-navigation";
import type { PostSummary } from "@/types/content";
const post = (canonicalSlug: string, alias: string, categories: string[] = []): PostSummary => ({
  canonicalSlug,
  aliases: [alias],
  title: canonicalSlug,
  categories,
  tags: [],
  type: "",
  publishedAt: "",
  publishedLabel: "",
  excerpt: "",
  searchText: "",
  readingMinutes: 1,
});
it("resolves relative Markdown aliases and preserves heading anchors", () => {
  const topics = buildDocsNavigation([
    post("go-basics", "README"),
    post("go-basics-01-environment", "01-环境搭建"),
    post("another", "README", ["前端开发"]),
  ]);
  const html = normalizeDocsLinks(
    '<a href="./01-%E7%8E%AF%E5%A2%83%E6%90%AD%E5%BB%BA.md#install">first</a><a href="./README.md">overview</a>',
    "go-basics-01-environment",
    topics,
  );
  expect(html).toContain("/posts/go-basics-01-environment#install");
  expect(html).toContain('href="/posts/go-basics"');
});
it("localizes site links but never rewrites external or ambiguous Markdown URLs", () => {
  const html = normalizeDocsLinks(
    '<a href="https://blog.woodfish.site/posts/go-basics">course</a><a href="https://example.com/README.md">external</a><a href="./unknown.md">unknown</a>',
    "",
    [],
  );
  expect(html).toContain('href="/posts/go-basics"');
  expect(html).toContain("https://example.com/README.md");
  expect(html).toContain("./unknown.md");
});

import { describe, expect, it } from "vitest";
import { buildDocsNavigation, findDocsPlacement, getDocsNeighbors } from "@/content/docs-navigation";
import seriesConfig from "@/content/docs-series.json";
import { visiblePostSummaries } from "@/content/post-visibility";
import type { PostSummary } from "@/types/content";
import { readFileSync, existsSync } from "node:fs";
const post = (canonicalSlug: string, categories: string[] = []): PostSummary => ({
  canonicalSlug,
  title: canonicalSlug,
  categories,
  aliases: [],
  publishedAt: "2026-01-01",
  publishedLabel: "",
  excerpt: "",
  type: "Notes",
  searchText: "",
  readingMinutes: 1,
  tags: [],
});
describe("documentation navigation", () => {
  it("orders a series by curriculum, not publication or incoming index order", () => {
    const posts = [post("go-basics-02-input-output"), post("go-basics"), post("go-basics-01-environment")];
    const topics = buildDocsNavigation(posts);
    const place = findDocsPlacement(topics, "go-basics-01-environment");
    expect(place?.topic.id).toBe("languages");
    expect(place?.group.posts.map((p) => p.canonicalSlug)).toEqual([
      "go-basics",
      "go-basics-01-environment",
      "go-basics-02-input-output",
    ]);
    expect(getDocsNeighbors(place).next?.canonicalSlug).toBe("go-basics-02-input-output");
    expect(getDocsNeighbors(findDocsPlacement(topics, "go-basics-02-input-output")).next).toBeNull();
  });
  it("normalizes Go categories and keeps loose notes separate from courses", () => {
    const topics = buildDocsNavigation([
      post("go-new", ["Go"]),
      post("go-old", ["Go语言"]),
      post("go-basics"),
      post("unknown"),
    ]);
    expect(findDocsPlacement(topics, "go-new")?.topic.id).toBe("languages");
    expect(findDocsPlacement(topics, "go-old")?.group.id).toBe("languages-notes");
    expect(findDocsPlacement(topics, "unknown")?.topic.id).toBe("other");
    expect(getDocsNeighbors(findDocsPlacement(topics, "go-basics")).next).toBeNull();
  });
  it("covers every loadable current article exactly once and never adds missing configured slugs", () => {
    const posts = JSON.parse(readFileSync("public/post-index.json", "utf8")) as PostSummary[];
    const available = visiblePostSummaries(posts).filter((p) => existsSync(`src/generated/posts/${p.canonicalSlug}.json`));
    const flat = buildDocsNavigation(available).flatMap((t) =>
      t.groups.flatMap((g) => g.posts.map((p) => p.canonicalSlug)),
    );
    expect(flat.length).toBe(available.length);
    expect(new Set(flat).size).toBe(flat.length);
    expect(new Set(flat)).toEqual(new Set(available.map((p) => p.canonicalSlug)));
    expect(buildDocsNavigation([])).toEqual([]);
  });
  it("does not assign a canonical article to two series", () => {
    const slugs = seriesConfig.flatMap((series) => series.slugs);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("hides only the requested guides from discovery without turning them into loose notes", () => {
    const hidden = seriesConfig.filter(s => s.id === "nestjs-guide" || s.id === "react19").flatMap(s => s.slugs);
    const retained = seriesConfig.filter(s => s.id === "nestjs" || s.id === "react-notes").flatMap(s => s.slugs);
    const all = [...hidden, ...retained].map(slug => post(slug));
    expect(visiblePostSummaries(all).map(p => p.canonicalSlug)).toEqual(retained);
    const navigation = buildDocsNavigation(all);
    for (const slug of hidden) expect(findDocsPlacement(navigation, slug)).toBeUndefined();
    for (const slug of retained) expect(findDocsPlacement(navigation, slug)).toBeDefined();
  });
});

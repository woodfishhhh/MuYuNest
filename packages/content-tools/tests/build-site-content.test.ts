import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildSiteContent } from "../src/content/build-site-content.js";

let tempRoot = "";

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { force: true, recursive: true });
    tempRoot = "";
  }
});

describe("buildSiteContent frontmatter aliases", () => {
  it("merges valid frontmatter aliases, deduplicates them, filters invalid slugs, and prevents canonical slug collisions", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "content-tools-aliases-"));
    const sourceRoot = path.join(tempRoot, "blog");
    const jsDir = path.join(sourceRoot, "content", "source", "myblog", "javascript");
    const dbDir = path.join(sourceRoot, "content", "source", "myblog", "database-theory");
    await mkdir(jsDir, { recursive: true });
    await mkdir(dbDir, { recursive: true });

    await writeFile(
      path.join(jsDir, "web-http-fetch-and-axios.md"),
      [
        "---",
        'title: "浏览器异步请求实战"',
        "slug: web-http-fetch-and-axios",
        "date: 2026-04-01",
        "aliases:",
        "  - ajax-basics-intro",
        "  - AJAX-BASICS-INTRO",
        "  - web-http-fetch-and-axios",
        "  - sql-standard-ddl-dml-and-views",
        "  - 'invalid slug!'",
        "  - '../escape'",
        "  - 123",
        "  - legacy-ajax-v1",
        "categories:",
        "  - 前端开发",
        "tags:",
        "  - AJAX",
        "---",
        "",
        "正文内容。",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(dbDir, "sql-standard-ddl-dml-and-views.md"),
      [
        "---",
        'title: "标准 SQL 精要"',
        "slug: sql-standard-ddl-dml-and-views",
        "date: 2026-04-02",
        "aliases:",
        "  - sql-advanced-updates-views",
        "  - sql-ddl-query-basics",
        "categories:",
        "  - 数据库",
        "tags:",
        "  - SQL",
        "---",
        "",
        "标准 SQL 正文。",
      ].join("\n"),
      "utf8",
    );

    const result = await buildSiteContent({
      sourceProjectRoot: sourceRoot,
      targetPublicDir: path.join(tempRoot, "public"),
    });

    const httpIndex = result.postIndex.find((item) => item.canonicalSlug === "web-http-fetch-and-axios");
    const httpArticle = result.postsBySlug["web-http-fetch-and-axios"];
    const sqlIndex = result.postIndex.find((item) => item.canonicalSlug === "sql-standard-ddl-dml-and-views");

    expect(httpIndex?.aliases).toEqual(["ajax-basics-intro", "legacy-ajax-v1"]);
    expect(httpArticle?.aliases).toEqual(["ajax-basics-intro", "legacy-ajax-v1"]);
    expect(httpIndex?.aliases).not.toContain("sql-standard-ddl-dml-and-views");
    expect(httpIndex?.aliases).not.toContain("web-http-fetch-and-axios");
    expect(httpIndex?.aliases).not.toContain("123");
    expect(sqlIndex?.aliases).toEqual(["sql-advanced-updates-views", "sql-ddl-query-basics"]);

    // Verify generated index and article entries match without alias/canonical collisions
    expect(result.postIndex.map((entry) => entry.canonicalSlug)).toEqual([
      "sql-standard-ddl-dml-and-views",
      "web-http-fetch-and-axios",
    ]);
    expect(result.postsBySlug["sql-standard-ddl-dml-and-views"]?.aliases).toEqual([
      "sql-advanced-updates-views",
      "sql-ddl-query-basics",
    ]);
  });

  it("throws when two different canonical posts declare the same alias", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "content-tools-alias-conflict-"));
    const sourceRoot = path.join(tempRoot, "blog");
    const postDir = path.join(sourceRoot, "content", "source", "myblog", "go");
    await mkdir(postDir, { recursive: true });

    await writeFile(
      path.join(postDir, "first-post.md"),
      [
        "---",
        'title: "First Post"',
        "slug: first-post",
        "date: 2026-04-01",
        "aliases:",
        "  - shared-legacy-slug",
        "---",
        "",
        "First body.",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(postDir, "second-post.md"),
      [
        "---",
        'title: "Second Post"',
        "slug: second-post",
        "date: 2026-04-02",
        "aliases:",
        "  - shared-legacy-slug",
        "---",
        "",
        "Second body.",
      ].join("\n"),
      "utf8",
    );

    await expect(
      buildSiteContent({
        sourceProjectRoot: sourceRoot,
        targetPublicDir: path.join(tempRoot, "public"),
      }),
    ).rejects.toThrow(/Duplicate post alias "shared-legacy-slug".*first-post.*second-post/);
  });
});

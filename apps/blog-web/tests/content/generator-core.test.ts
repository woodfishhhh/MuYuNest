import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { describe, expect, it } from "vite-plus/test";

import {
  buildLegacySlugIndex,
  normalizeMarkdownBody,
  resolveCanonicalSlug,
  rewriteMarkdownAssetPaths,
} from "../../../../packages/content-tools/src/content/generator-core.js";

describe("generator-core", () => {
  it("reuses a legacy English slug when title, date, and normalized body match", () => {
    const rawMarkdown = `---\ntitle: "AJAX 基础入门教程"\ndate: 2025-12-20 12:00:04\n---\n\n# AJAX 基础入门教程\n\n## 核心概念\n\n内容段落。`;
    const legacyIndex = buildLegacySlugIndex([
      {
        slug: "ajax-basics-intro",
        title: "AJAX 基础入门教程",
        date: "2025-12-20 12:00:04",
        rawMarkdown,
      },
    ]);

    const result = resolveCanonicalSlug({
      title: "AJAX 基础入门教程",
      date: "2025-12-20 12:00:04",
      rawMarkdown,
      sourceRelativePath: "前端/AJAX 基础入门教程.md",
      legacyIndex,
    });

    expect(result.canonicalSlug).toBe("ajax-basics-intro");
    expect(result.aliases).toContain("AJAX 基础入门教程");
  });

  it("falls back to an ASCII stem plus short hash when there is no legacy slug", () => {
    const result = resolveCanonicalSlug({
      title: "全中文标题",
      date: "2026-01-01 08:00:00",
      rawMarkdown: "---\ntitle: 全中文标题\n---\n\n# 全中文标题\n\n正文",
      sourceRelativePath: "题解/全中文标题.md",
      legacyIndex: new Map(),
    });

    expect(result.canonicalSlug).toMatch(/^post-[a-f0-9]{8}$/);
    expect(result.aliases).toContain("全中文标题");
  });

  it("keeps an explicit canonical slug when the article body changes", () => {
    const result = resolveCanonicalSlug({
      title: "AJAX 基础入门教程",
      date: "2025-12-20 12:00:04",
      rawMarkdown: "---\ntitle: AJAX 基础入门教程\nslug: ajax-basics-intro\n---\n\n改写后的正文",
      sourceRelativePath: "前端/AJAX 基础入门教程.md",
      preferredSlug: "ajax-basics-intro",
      legacyIndex: new Map(),
    });

    expect(result.canonicalSlug).toBe("ajax-basics-intro");
    expect(result.aliases).toContain("AJAX 基础入门教程");
  });

  it("rejects an explicit canonical slug that is not URL-safe", () => {
    expect(() =>
      resolveCanonicalSlug({
        title: "不安全 slug",
        date: "2026-01-01 08:00:00",
        rawMarkdown: "---\ntitle: 不安全 slug\n---\n\n正文",
        sourceRelativePath: "前端/不安全 slug.md",
        preferredSlug: "../outside",
        legacyIndex: new Map(),
      }),
    ).toThrow("Invalid preferred slug");
  });

  it("removes a duplicated first-level title heading from the markdown body", () => {
    const rawMarkdown = "# C++ STL 到 JavaScript：常用数据结构映射速查\n\n## 小节\n\n正文内容";

    expect(normalizeMarkdownBody(rawMarkdown, "C++ STL 到 JavaScript：常用数据结构映射速查")).toBe(
      "## 小节\n\n正文内容",
    );
  });

  it("copies relative and absolute local assets into static folders and rewrites the markdown", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-"));
    const sourceDir = path.join(tempRoot, "source", "前端");
    const publicDir = path.join(tempRoot, "public");
    const localAssetDir = path.join(sourceDir, "images");
    const absoluteAssetDir = path.join(
      path.parse(tempRoot).root,
      "tmp",
      path.basename(tempRoot),
      "absolute",
    );
    const absoluteAssetPath = path.join(absoluteAssetDir, "system.png");
    const absoluteMarkdownPath = path.posix.join(
      "/tmp",
      path.basename(tempRoot),
      "absolute",
      "system.png",
    );

    await mkdir(localAssetDir, { recursive: true });
    await mkdir(absoluteAssetDir, { recursive: true });
    await writeFile(path.join(localAssetDir, "demo.png"), "relative-image");
    await writeFile(absoluteAssetPath, "absolute-image");

    const sourceFilePath = path.join(sourceDir, "AJAX 学习笔记（Day 01）：入门.md");
    const markdown = ["![relative](images/demo.png)", `![absolute](${absoluteMarkdownPath})`].join(
      "\n\n",
    );

    const result = await rewriteMarkdownAssetPaths(markdown, {
      sourceFilePath,
      canonicalSlug: "ajax-day-01",
      publicDir,
      siteBasePath: "/newBlog/",
    });

    expect(result.markdown).toContain("/newBlog/content-assets/ajax-day-01/images/demo.png");
    expect(result.markdown).toMatch(/\/newBlog\/imported-assets\/[a-f0-9]{40}\.png/);
    expect(result.warnings).toHaveLength(0);

    expect(
      await readFile(
        path.join(publicDir, "content-assets", "ajax-day-01", "images", "demo.png"),
        "utf8",
      ),
    ).toBe("relative-image");

    const importedAssetMatch = result.markdown.match(/\/imported-assets\/([a-f0-9]{40}\.png)/);
    expect(importedAssetMatch).not.toBeNull();
    expect(
      await readFile(path.join(publicDir, "imported-assets", importedAssetMatch![1]), "utf8"),
    ).toBe("absolute-image");
  });

  it("can reuse existing generated assets without overwriting optimized files", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-reuse-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const imageDir = path.join(sourceDir, "images");
    const existingTarget = path.join(
      publicDir,
      "content-assets",
      "reuse-assets",
      "images",
      "demo.png",
    );
    const sourceFilePath = path.join(sourceDir, "Reuse 图片测试.md");

    await mkdir(imageDir, { recursive: true });
    await mkdir(path.dirname(existingTarget), { recursive: true });
    await writeFile(path.join(imageDir, "demo.png"), "source-image");
    await writeFile(existingTarget, "optimized-image");

    const result = await rewriteMarkdownAssetPaths("![demo](images/demo.png)", {
      sourceFilePath,
      canonicalSlug: "reuse-assets",
      publicDir,
      reuseGeneratedAssets: true,
    });

    expect(result.markdown).toContain("/content-assets/reuse-assets/images/demo.png");
    expect(await readFile(existingTarget, "utf8")).toBe("optimized-image");
  });

  it("can reuse an existing generated asset when an old post source image is missing", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-missing-reuse-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const existingTarget = path.join(
      publicDir,
      "content-assets",
      "legacy-slug",
      "assets",
      "missing.png",
    );
    const sourceFilePath = path.join(sourceDir, "Missing Reuse.md");

    await mkdir(sourceDir, { recursive: true });
    await mkdir(path.dirname(existingTarget), { recursive: true });
    await writeFile(existingTarget, "optimized-image");

    const result = await rewriteMarkdownAssetPaths("![demo](assets/missing.png)", {
      sourceFilePath,
      canonicalSlug: "new-slug",
      publicDir,
      reuseGeneratedAssets: true,
    });

    expect(result.markdown).toContain("/content-assets/legacy-slug/assets/missing.png");
    expect(await readFile(existingTarget, "utf8")).toBe("optimized-image");
  });

  it("downloads remote markdown images into local static assets", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-remote-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(sourceDir, "Remote 图片测试.md");
    const remoteBytes = Buffer.from("remote-image-bytes");

    await mkdir(sourceDir, { recursive: true });

    const server = createServer((req, res) => {
      if (req.url?.startsWith("/avatar.png")) {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(remoteBytes);
        return;
      }

      res.writeHead(404);
      res.end("not-found");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const remoteUrl = `http://127.0.0.1:${port}/avatar.png`;

    try {
      const result = await rewriteMarkdownAssetPaths(`![remote](${remoteUrl})`, {
        sourceFilePath,
        canonicalSlug: "remote-image-test",
        publicDir,
      });

      expect(result.warnings).toHaveLength(0);
      const match = result.markdown.match(/\/remote-assets\/([a-f0-9]{40}\.[a-z0-9]+)/i);
      expect(match).not.toBeNull();

      const savedAsset = await readFile(path.join(publicDir, "remote-assets", match![1]));
      expect(Buffer.compare(savedAsset, remoteBytes)).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it("falls back to local mirror assets for blocked remote hosts", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-mirror-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const mirrorDir = path.join(tempRoot, "mirror-images");
    const sourceFilePath = path.join(sourceDir, "Mirror 图片测试.md");
    const mirrorFileName = "fallback-avatar.png";
    const mirrorBytes = Buffer.from("mirror-avatar-bytes");
    const remoteUrl = `https://www.woodfishhhh.xyz/images/${mirrorFileName}?_t=1`;
    const originalMirrorEnv = process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS;

    await mkdir(sourceDir, { recursive: true });
    await mkdir(mirrorDir, { recursive: true });
    await writeFile(path.join(mirrorDir, mirrorFileName), mirrorBytes);
    process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS = mirrorDir;

    try {
      const result = await rewriteMarkdownAssetPaths(`![remote](${remoteUrl})`, {
        sourceFilePath,
        canonicalSlug: "mirror-image-test",
        publicDir,
      });

      expect(result.warnings).toHaveLength(0);
      const match = result.markdown.match(/\/remote-assets\/([a-f0-9]{40}\.[a-z0-9]+)/i);
      expect(match).not.toBeNull();

      const localizedBytes = await readFile(path.join(publicDir, "remote-assets", match![1]));
      expect(Buffer.compare(localizedBytes, mirrorBytes)).toBe(0);
    } finally {
      if (typeof originalMirrorEnv === "string") {
        process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS = originalMirrorEnv;
      } else {
        delete process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS;
      }
    }
  });

  it("does not localize image references inside fenced code blocks", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-code-images-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(sourceDir, "Code 图片测试.md");

    await mkdir(sourceDir, { recursive: true });

    const markdown = [
      "```html",
      '<img src="./logo.png" alt="Logo">',
      "```",
      "",
      "```md",
      "![example](./example.png)",
      "```",
    ].join("\n");

    const result = await rewriteMarkdownAssetPaths(markdown, {
      sourceFilePath,
      canonicalSlug: "code-image-examples",
      publicDir,
    });

    expect(result.markdown).toBe(markdown);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not localize image references inside indented code blocks", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "vuecubeblog-generator-indented-code-images-"),
    );
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(sourceDir, "Indented Code 图片测试.md");
    const markdown = [
      '    const html = `<img src="${wObj.weatherImg}" alt="">`',
      "    ![example](./example.png)",
    ].join("\n");

    await mkdir(sourceDir, { recursive: true });

    const result = await rewriteMarkdownAssetPaths(markdown, {
      sourceFilePath,
      canonicalSlug: "indented-code-image-examples",
      publicDir,
    });

    expect(result.markdown).toBe(markdown);
    expect(result.warnings).toHaveLength(0);
  });

  it("localizes list-nested markdown images instead of treating them as indented code", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-list-images-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const imageDir = path.join(sourceDir, "images");
    const sourceFilePath = path.join(sourceDir, "List 图片测试.md");

    await mkdir(imageDir, { recursive: true });
    await writeFile(path.join(imageDir, "diagram.png"), "diagram");

    const markdown = ["1. 示例条目", "", "   ![diagram](images/diagram.png)"].join("\n");

    const result = await rewriteMarkdownAssetPaths(markdown, {
      sourceFilePath,
      canonicalSlug: "list-nested-images",
      publicDir,
    });

    expect(result.markdown).toContain("/content-assets/list-nested-images/images/diagram.png");
    expect(
      await readFile(
        path.join(publicDir, "content-assets", "list-nested-images", "images", "diagram.png"),
        "utf8",
      ),
    ).toBe("diagram");
  });

  it("falls back to local mirror files when relative post images are missing from the source folder", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-local-mirror-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const mirrorDir = path.join(tempRoot, "mirror");
    const mirrorAssetPath = path.join(
      mirrorDir,
      "content",
      "typescript-practical-foundations",
      "notebook-image",
      "course-outline.png",
    );
    const sourceFilePath = path.join(sourceDir, "TypeScript.md");
    const originalMirrorEnv = process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS;

    await mkdir(sourceDir, { recursive: true });
    await mkdir(path.dirname(mirrorAssetPath), { recursive: true });
    await writeFile(mirrorAssetPath, "course-outline");
    process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS = mirrorDir;

    try {
      const result = await rewriteMarkdownAssetPaths(
        "![course](notebook-image/course-outline.png)",
        {
          sourceFilePath,
          canonicalSlug: "typescript-foundations",
          publicDir,
        },
      );

      expect(result.markdown).toContain(
        "/content-assets/typescript-foundations/notebook-image/course-outline.png",
      );
      expect(
        await readFile(
          path.join(
            publicDir,
            "content-assets",
            "typescript-foundations",
            "notebook-image",
            "course-outline.png",
          ),
          "utf8",
        ),
      ).toBe("course-outline");
    } finally {
      if (typeof originalMirrorEnv === "string") {
        process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS = originalMirrorEnv;
      } else {
        delete process.env.VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS;
      }
    }
  });

  it("resolves relative images from the shared myblog asset folder", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-shared-assets-"));
    const sourceRoot = path.join(tempRoot, "project");
    const sourceDir = path.join(sourceRoot, "content", "source", "myblog", "前端");
    const sharedAssetDir = path.join(sourceRoot, "content", "source", "myblog", "assets");
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(sourceDir, "Header.md");

    await mkdir(sourceDir, { recursive: true });
    await mkdir(sharedAssetDir, { recursive: true });
    await writeFile(path.join(sharedAssetDir, "1680336645218.png"), "header-image");

    const result = await rewriteMarkdownAssetPaths("![header](assets/1680336645218.png)", {
      sourceFilePath,
      canonicalSlug: "header-demo",
      publicDir,
      sourceProjectRoot: sourceRoot,
    });

    expect(result.markdown).toContain("/content-assets/header-demo/assets/1680336645218.png");
    expect(
      await readFile(
        path.join(publicDir, "content-assets", "header-demo", "assets", "1680336645218.png"),
        "utf8",
      ),
    ).toBe("header-image");
  });

  it("creates a placeholder asset for unrecoverable legacy absolute image paths", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "vuecubeblog-generator-absolute-placeholder-"),
    );
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(sourceDir, "Absolute 图片测试.md");
    const legacyPath = "D:\\BaiduNetdiskDownload\\day09\\assets\\1680342815532.png";

    await mkdir(sourceDir, { recursive: true });

    const result = await rewriteMarkdownAssetPaths(`![legacy](${legacyPath})`, {
      sourceFilePath,
      canonicalSlug: "legacy-absolute-image",
      publicDir,
    });

    const match = result.markdown.match(/\/imported-assets\/([a-f0-9]{40}\.svg)/);
    expect(match).not.toBeNull();
    expect(await readFile(path.join(publicDir, "imported-assets", match![1]), "utf8")).toContain(
      "Image unavailable",
    );
  });

  it("creates a placeholder asset for unrecoverable relative local image paths", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vuecubeblog-generator-broken-local-"));
    const sourceDir = path.join(tempRoot, "source");
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(sourceDir, "Broken 图片测试.md");

    await mkdir(sourceDir, { recursive: true });

    const result = await rewriteMarkdownAssetPaths("![broken-relative](assets/1680342815532.png)", {
      sourceFilePath,
      canonicalSlug: "broken-local-images",
      publicDir,
      siteBasePath: "/newBlog/",
    });

    const match = result.markdown.match(/\/newBlog\/imported-assets\/([a-f0-9]{40}\.svg)/);
    expect(match).not.toBeNull();
    expect(await readFile(path.join(publicDir, "imported-assets", match![1]), "utf8")).toContain(
      "Image unavailable",
    );
  });
});

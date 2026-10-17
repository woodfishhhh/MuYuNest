import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  resolveAssetReference,
  resolveCanonicalSlug,
} from "../src/content/generator-core.js";

describe("portable canonical article URLs", () => {
  it.each([
    ["React/1.md", "1-849fada0", "1-cc97fa54"],
    ["Vue3完全开发指南/07-数据可视化实战.md", "07-7c60a570", "07-de757c2c"],
    [
      "数据库/2关系模型基础：基本概念、完整性与关系代数.md",
      "2-fab0b7c6",
      "2-e25c70a2",
    ],
  ])(
    "preserves Windows and Linux links for %s",
    (source, canonical, linuxAlias) => {
      const options = {
        title: "Title",
        date: "2026-01-01",
        rawMarkdown: "body",
        legacyIndex: new Map<string, string>(),
      };
      const linux = resolveCanonicalSlug({
        ...options,
        sourceRelativePath: source,
      });
      const windows = resolveCanonicalSlug({
        ...options,
        sourceRelativePath: source.replace(/\//g, "\\"),
      });
      expect(linux).toEqual(windows);
      expect(linux.canonicalSlug).toBe(canonical);
      expect(linux.aliases).toContain(linuxAlias);
      expect(linux.aliases).toContain(path.posix.basename(source, ".md"));
    },
  );
});

let tempRoot = "";

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { force: true, recursive: true });
    tempRoot = "";
  }
});

describe("generator core asset resolution", () => {
  it("copies relative metadata avatars without an article slug", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "generator-core-"));
    const publicDir = path.join(tempRoot, "public");
    await mkdir(path.join(tempRoot, "avatars"));
    await writeFile(path.join(tempRoot, "avatars", "logo.png"), "image-bytes");
    const resolved = await resolveAssetReference("avatars/logo.png", {
      publicDir,
      sourceFilePath: path.join(tempRoot, "link.yml"),
      reuseGeneratedAssets: true,
      siteBasePath: "/notes/",
    });
    expect(resolved).toMatch(/^\/notes\/imported-assets\/.+\.png$/);
    expect(
      await readFile(
        path.join(publicDir, resolved!.replace("/notes/", "")),
        "utf8",
      ),
    ).toBe("image-bytes");
  });
  it("keeps missing remote asset URLs in reuse mode without downloading them", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "generator-core-"));
    const publicDir = path.join(tempRoot, "public");
    const sourceFilePath = path.join(tempRoot, "post.md");
    const remoteUrl = "http://127.0.0.1:9/avatar.png";

    await mkdir(publicDir, { recursive: true });
    await writeFile(sourceFilePath, "", "utf8");

    const startedAt = Date.now();
    const resolved = await resolveAssetReference(remoteUrl, {
      publicDir,
      reuseGeneratedAssets: true,
      sourceFilePath,
    });

    expect(resolved).toBe(remoteUrl);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});

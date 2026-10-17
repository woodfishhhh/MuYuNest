import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveAssetReference } from "../src/content/generator-core.js";

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

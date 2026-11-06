import { describe, expect, it } from "vite-plus/test";

import {
  normalizeDeployBasePath,
  verifyIndexHtmlPaths,
} from "../../../../packages/content-tools/src/verify-dist.js";

describe("verifyIndexHtmlPaths", () => {
  it("accepts subpath-scoped Vite asset and manifest refs", () => {
    const result = verifyIndexHtmlPaths(
      [
        '<script type="module" src="/newBlog/assets/index.js"></script>',
        '<link rel="stylesheet" href="/newBlog/assets/index.css">',
        '<link rel="manifest" href="/newBlog/manifest.webmanifest">',
      ].join(""),
      "/newBlog/",
    );

    expect(result.assetRefs).toEqual(["/newBlog/assets/index.js", "/newBlog/assets/index.css"]);
  });

  it("rejects root-scoped asset refs for the /newBlog deploy", () => {
    expect(() =>
      verifyIndexHtmlPaths(
        [
          '<script type="module" src="/assets/index.js"></script>',
          '<link rel="manifest" href="/manifest.webmanifest">',
        ].join(""),
        "/newBlog/",
      ),
    ).toThrow("root-scoped refs");
  });
});

describe("normalizeDeployBasePath", () => {
  it("normalizes deploy base paths", () => {
    expect(normalizeDeployBasePath("newBlog")).toBe("/newBlog/");
    expect(normalizeDeployBasePath("/newBlog")).toBe("/newBlog/");
    expect(normalizeDeployBasePath("/")).toBe("/");
    expect(normalizeDeployBasePath(undefined)).toBe("/");
  });
});

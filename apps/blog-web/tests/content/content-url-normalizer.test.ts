import { describe, expect, it } from "vite-plus/test";

import { normalizeContentPayload } from "@/content/content-url-normalizer";

describe("content-url-normalizer", () => {
  it("prefixes root-relative content paths with the active base path", () => {
    const normalized = normalizeContentPayload(
      {
        avatar: "/remote-assets/friend.png",
        cover: "/imported-assets/cover.png",
        route: "/friend",
        external: "https://example.com/avatar.png",
      },
      "/newBlog/",
    );

    expect(normalized.avatar).toBe("/newBlog/remote-assets/friend.png");
    expect(normalized.cover).toBe("/newBlog/imported-assets/cover.png");
    expect(normalized.route).toBe("/newBlog/friend");
    expect(normalized.external).toBe("https://example.com/avatar.png");
  });

  it("rewrites root-relative urls inside generated html fragments and keeps already-prefixed paths stable", () => {
    const normalized = normalizeContentPayload(
      {
        html: [
          '<img src="/remote-assets/friend.png" alt="friend">',
          '<a href="/friend">Friend</a>',
          '<img src="/newBlog/remote-assets/already-good.png" alt="ok">',
        ].join(""),
      },
      "/newBlog/",
    );

    expect(normalized.html).toContain('src="/newBlog/remote-assets/friend.png"');
    expect(normalized.html).toContain('href="/newBlog/friend"');
    expect(normalized.html).toContain('src="/newBlog/remote-assets/already-good.png"');
  });
});

import { describe, expect, it } from "vitest";

import { getWorkProjects } from "../../src/content/works";

describe("works content", () => {
  it("includes the MuYu image bed project", () => {
    expect(getWorkProjects()).toContainEqual({
      slug: "image-bed",
      name: "木鱼图库",
      description: "自托管图片管理与上传后台，为博客写作流提供图床、CDN 和 Typora 上传链路。",
      kind: "Image Bed",
      avatarUrl: "/site-icons/image-bed.svg",
      liveUrl: "https://img.woodfish.site/admin/",
      githubUrl: "https://github.com/woodfishhhh/MuYuNest",
    });
  });
});

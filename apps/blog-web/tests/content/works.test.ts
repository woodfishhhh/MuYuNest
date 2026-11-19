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

  it("includes the JUFE Offer community project", () => {
    expect(getWorkProjects()).toContainEqual({
      slug: "jufe-offer",
      name: "江财OFFER",
      description: "由江西财经大学学生共同维护的资源导航，汇总实习校招、编程学习、竞赛活动与校内常用入口。",
      kind: "Community",
      avatarUrl: "/site-icons/jufe-offer.webp",
      liveUrl: "https://jufe.woodfish.site/",
      githubUrl: "https://github.com/woodfishhhh/jufe-offer",
    });
  });
});

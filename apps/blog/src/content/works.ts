import type { WorkProjectData } from "@/types/content";

const workProjects: WorkProjectData[] = [
  {
    slug: "blog",
    name: "WoodFishNest",
    description: "三维博客主站，用超立方体把文章、作者和作品入口组织在同一个空间里。",
    kind: "Blog",
    avatarUrl: "/site-icons/woodfish.svg",
    liveUrl: "https://blog.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/VueThreeBlog",
  },
  {
    slug: "weather",
    name: "WeatherDemo",
    description: "以黑白留白和克制动效构建的天气探索工作台，兼顾信息密度与阅读节奏。",
    kind: "App",
    avatarUrl: "/site-icons/weather.svg",
    liveUrl: "https://weather.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/WeatherDemo",
  },
  {
    slug: "pretext",
    name: "Pretext",
    description: "围绕几何与空间感展开的交互实验，把叙事感放进可触摸的立体结构里。",
    kind: "Lab",
    avatarUrl: "/site-icons/pretext.svg",
    liveUrl: "https://pretext.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/Pretext-cube",
  },
  {
    slug: "image-bed",
    name: "木鱼图库",
    description: "自托管图片管理与上传后台，为博客写作流提供图床、CDN 和 Typora 上传链路。",
    kind: "Image Bed",
    avatarUrl: "/site-icons/image-bed.svg",
    liveUrl: "https://img.woodfish.site/admin/",
    githubUrl: "https://github.com/woodfishhhh/MuYuNest",
  },
  {
    slug: "jufe-offer",
    name: "江财OFFER",
    description: "由江西财经大学学生共同维护的资源导航，汇总实习校招、编程学习、竞赛活动与校内常用入口。",
    kind: "Community",
    avatarUrl:
      "https://img.woodfish.site/o/webp/2026/08/1afa9bc27dcfe503c0e0f9eb3c4c5bb29c39a193143023d815c53bd2e989dff2.webp",
    liveUrl: "https://jufe.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/jufe-offer",
  },
];

export function getWorkProjects() {
  return workProjects;
}

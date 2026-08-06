import type { WorkProjectData } from "@/types/content";

const workProjects: WorkProjectData[] = [
  {
    slug: "blog",
    name: "WoodFishNest",
    description: "三维博客主站，用超立方体把文章、作者和作品入口组织在同一个空间里。",
    kind: "Blog",
    liveUrl: "https://blog.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/VueThreeBlog",
  },
  {
    slug: "weather",
    name: "WeatherDemo",
    description: "以黑白留白和克制动效构建的天气探索工作台，兼顾信息密度与阅读节奏。",
    kind: "App",
    liveUrl: "https://weather.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/WeatherDemo",
  },
  {
    slug: "pretext",
    name: "Pretext",
    description: "围绕几何与空间感展开的交互实验，把叙事感放进可触摸的立体结构里。",
    kind: "Lab",
    liveUrl: "https://pretext.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/Pretext-cube",
  },
  {
    slug: "image-bed",
    name: "木鱼图库",
    description: "自托管图片管理与上传后台，为博客写作流提供图床、CDN 和 Typora 上传链路。",
    kind: "Image Bed",
    liveUrl: "https://img.woodfish.site/admin/",
    githubUrl: "https://github.com/woodfishhhh/MuYuNest",
  },
];

export function getWorkProjects() {
  return workProjects;
}

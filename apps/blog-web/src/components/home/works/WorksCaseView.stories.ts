import type { Meta, StoryObj } from "@storybook/vue3";

import WorksCaseView from "./WorksCaseView.vue";
import type { WorkProjectData } from "@/types/content";

const works: WorkProjectData[] = [
  {
    slug: "woodfish-nest",
    name: "WoodFishNest",
    description: "个人博客 + 图床基础设施，基于 Nuxt 5 + Three.js + Hono 构建的 Monorepo 全栈项目。",
    kind: "Web App",
    avatarUrl: "/site-icons/woodfish.svg",
    liveUrl: "https://blog.woodfish.site/",
    githubUrl: "https://github.com/woodfishhhh/MuYuNest",
  },
  {
    slug: "vr-classroom",
    name: "VR Classroom",
    description: "基于 WebXR 和 Three.js 的虚拟现实教室系统，支持多人协同学习与空间白板展示。",
    kind: "WebXR",
    avatarUrl: "/site-icons/pretext.svg",
    liveUrl: "https://example.com/vr-classroom",
    githubUrl: "https://github.com/woodfishhhh/vr-classroom",
  },
  {
    slug: "data-dashboard",
    name: "Data Dashboard",
    description: "实时数据大屏，基于 D3.js + ECharts 的可视化平台，支持自定义图表布局与主题切换。",
    kind: "Dashboard",
    avatarUrl: "/site-icons/weather.svg",
    liveUrl: "https://example.com/dashboard",
    githubUrl: "https://github.com/woodfishhhh/data-dashboard",
  },
];

const meta: Meta<typeof WorksCaseView> = {
  title: "Home/Works/WorksCaseView",
  component: WorksCaseView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
};

export default meta;
type Story = StoryObj<typeof WorksCaseView>;

export const Default: Story = {
  args: { works },
};

export const SingleItem: Story = {
  args: { works: [works[0]] },
};

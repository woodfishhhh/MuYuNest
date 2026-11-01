import type { Meta, StoryObj } from "@storybook/vue3";

import FriendLinkGrid from "./FriendLinkGrid.vue";
import type { FriendLinkData } from "@/types/content";

const links: FriendLinkData[] = [
  {
    name: "WoodFish",
    link: "https://blog.woodfish.site/",
    avatar: "https://avatars.githubusercontent.com/u/1?v=4",
    descr: "用代码记录生活，用文字表达思考。",
  },
  {
    name: "TypeScript 中文手册",
    link: "https://www.typescriptlang.org/zh/",
    avatar: "https://avatars.githubusercontent.com/u/55999?v=4",
    descr: "TypeScript 官方文档中文翻译站。",
  },
  {
    name: "Vue.js",
    link: "https://cn.vuejs.org/",
    avatar: "https://vuejs.org/images/logo.png",
    descr: "渐进式 JavaScript 框架，用于构建用户界面。",
  },
  {
    name: "Vite",
    link: "https://cn.vite.dev/",
    avatar: "https://vitejs.dev/logo.svg",
    descr: "下一代前端工具链，极速启动。",
  },
  {
    name: "No Description Blog",
    link: "https://example.com/no-desc",
    avatar: "https://avatars.githubusercontent.com/u/99?v=4",
  },
];

const meta: Meta<typeof FriendLinkGrid> = {
  title: "Home/Friend/FriendLinkGrid",
  component: FriendLinkGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
};

export default meta;
type Story = StoryObj<typeof FriendLinkGrid>;

export const Default: Story = {
  args: { links },
};

export const Single: Story = {
  args: { links: [links[0]] },
};

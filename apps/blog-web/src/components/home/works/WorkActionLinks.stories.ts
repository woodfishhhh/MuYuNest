import type { Meta, StoryObj } from "@storybook/vue3";

import WorkActionLinks from "./WorkActionLinks.vue";
import type { WorkProjectData } from "@/types/content";

const sampleWork: WorkProjectData = {
  slug: "woodfish-nest",
  name: "WoodFishNest",
  description: "个人博客 + 图床基础设施，基于 Nuxt 5 + Three.js + Hono 构建的 Monorepo 全栈项目。",
  kind: "Web App",
  avatarUrl: "/site-icons/woodfish.svg",
  liveUrl: "https://blog.woodfish.site/",
  githubUrl: "https://github.com/woodfishhhh/MuYuNest",
};

const meta: Meta<typeof WorkActionLinks> = {
  title: "Home/Works/WorkActionLinks",
  component: WorkActionLinks,
  tags: ["autodocs"],
  argTypes: {
    compact: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof WorkActionLinks>;

export const Default: Story = {
  args: { work: sampleWork },
};

export const Compact: Story = {
  args: { work: sampleWork, compact: true },
};

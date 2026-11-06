import type { Meta, StoryObj } from "@storybook/vue3";

import ArticleToc from "./ArticleToc.vue";
import type { TocItem } from "@/types/content";

const tocItems: TocItem[] = [
  { id: "introduction", level: 2, text: "Introduction" },
  { id: "setup", level: 2, text: "项目搭建" },
  { id: "scene", level: 3, text: "创建场景" },
  { id: "camera", level: 3, text: "配置相机" },
  { id: "renderer", level: 3, text: "初始化渲染器" },
  { id: "geometry", level: 2, text: "几何体与材质" },
  { id: "lights", level: 3, text: "光源设置" },
  { id: "animation", level: 2, text: "动画循环" },
  { id: "controls", level: 3, text: "轨道控制器" },
  { id: "conclusion", level: 2, text: "总结" },
];

const meta: Meta<typeof ArticleToc> = {
  title: "Article/ArticleToc",
  component: ArticleToc,
  tags: ["autodocs"],
  parameters: {
    backgrounds: { default: "dark" },
  },
  argTypes: {
    activeId: { control: "text" },
    variant: {
      control: "radio",
      options: ["desktop", "mobile"],
    },
    onJump: { action: "jump" },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleToc>;

export const Desktop: Story = {
  args: { items: tocItems, activeId: "setup", variant: "desktop" },
};

export const Mobile: Story = {
  args: { items: tocItems, activeId: "camera", variant: "mobile" },
};

export const NoActive: Story = {
  args: { items: tocItems, activeId: "", variant: "desktop" },
};

export const Empty: Story = {
  args: { items: [], activeId: "", variant: "desktop" },
  parameters: {
    docs: { description: { story: "items 为空时组件不渲染（v-if items.length > 0）" } },
  },
};

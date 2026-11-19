import type { Meta, StoryObj } from "@storybook/vue3";

import BlogResultCard from "./BlogResultCard.vue";
import type { PostSummary } from "@/types/content";

const samplePost: PostSummary = {
  canonicalSlug: "hello-three-js",
  aliases: [],
  title: "Three.js 入门：从零构建 3D 场景",
  publishedAt: "2024-11-15",
  publishedLabel: "Nov 2024",
  excerpt:
    "本文手把手带你用 Three.js 搭建第一个 WebGL 3D 场景，涵盖 Camera、Renderer、Geometry 和 Material 核心概念。",
  type: "Tutorial",
  searchText: "",
  readingMinutes: 8,
  coverImage: null,
  categories: ["Three.js", "WebGL"],
  tags: ["three.js", "webgl", "canvas"],
};

const meta: Meta<typeof BlogResultCard> = {
  title: "Home/Blog/BlogResultCard",
  component: BlogResultCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    index: { control: { type: "number", min: 0, max: 20 } },
  },
};

export default meta;
type Story = StoryObj<typeof BlogResultCard>;

export const Default: Story = {
  args: { post: samplePost, index: 0, blogQuery: {} },
};

export const WithDelay: Story = {
  args: { post: { ...samplePost, title: "第二篇文章（入场延迟）" }, index: 3, blogQuery: {} },
};

export const WithCover: Story = {
  args: {
    post: {
      ...samplePost,
      title: "带封面图的博文",
      coverImage: "https://picsum.photos/seed/cover/480/270",
    },
    index: 0,
    blogQuery: { q: "three.js" },
  },
};

export const LongTitle: Story = {
  args: {
    post: {
      ...samplePost,
      title: "这是一篇非常非常长标题的博文，用来测试多行截断与布局响应效果——Three.js 进阶：PBR 材质与光照模型深度解析",
      excerpt:
        "在上一篇入门文章的基础上，我们进一步探讨 PBR（基于物理的渲染）材质体系，包括 MeshStandardMaterial 的参数解析、roughness/metalness 工作流，以及 HDR 环境贴图与实时光照的协同效果。",
    },
    index: 0,
    blogQuery: {},
  },
};

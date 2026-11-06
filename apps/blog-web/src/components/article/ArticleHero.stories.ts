import type { Meta, StoryObj } from "@storybook/vue3";

import ArticleHero from "./ArticleHero.vue";
import type { PostArticle } from "@/types/content";

const sampleArticle: PostArticle = {
  canonicalSlug: "hello-three-js",
  aliases: [],
  title: "Three.js 入门：从零构建 3D 场景",
  publishedAt: "2024-11-15",
  publishedLabel: "Nov 15, 2024",
  excerpt:
    "本文手把手带你用 Three.js 搭建第一个 WebGL 3D 场景，涵盖 Camera、Renderer、Geometry 和 Material 核心概念。",
  type: "Tutorial",
  searchText: "",
  readingMinutes: 8,
  coverImage: null,
  categories: ["Three.js", "WebGL"],
  tags: ["three.js", "webgl", "canvas"],
  html: "<p>正文内容占位</p>",
  toc: [],
};

const meta: Meta<typeof ArticleHero> = {
  title: "Article/ArticleHero",
  component: ArticleHero,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    overlay: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleHero>;

export const Default: Story = {
  args: { article: sampleArticle, overlay: false },
};

export const OverlayMode: Story = {
  args: { article: sampleArticle, overlay: true },
};

export const WithCover: Story = {
  args: {
    article: { ...sampleArticle, coverImage: "https://picsum.photos/seed/hero/800/400" },
    overlay: false,
  },
};

export const LongTitle: Story = {
  args: {
    article: {
      ...sampleArticle,
      title:
        "深入解析 Three.js PBR 材质体系——MeshStandardMaterial、MeshPhysicalMaterial 与 HDR 环境贴图的完整工作流",
      tags: ["three.js", "pbr", "lighting", "hdr", "shader"],
    },
    overlay: false,
  },
};

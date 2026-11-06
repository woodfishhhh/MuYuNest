import type { Meta, StoryObj } from "@storybook/vue3";

import ArticleProse from "./ArticleProse.vue";
import type { PostArticle } from "@/types/content";

const sampleHtml = `
<h2 id="introduction">Introduction</h2>
<p>Three.js 是一个跨浏览器的 JavaScript 库，用于在 Web 浏览器中使用 WebGL 创建和显示动画 3D 计算机图形。</p>
<h2 id="setup">项目搭建</h2>
<p>首先安装 Three.js：</p>
<pre><code class="language-bash">npm install three</code></pre>
<h3 id="scene">创建场景</h3>
<p>Three.js 场景由 Scene、Camera 和 Renderer 三个核心对象组成。</p>
<pre><code class="language-typescript">
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
</code></pre>
<h2 id="geometry">几何体与材质</h2>
<p>Three.js 提供了丰富的几何体类型，如 BoxGeometry、SphereGeometry、TorusGeometry 等。</p>
<blockquote><p>PBR 材质（MeshStandardMaterial）提供了更真实的光照效果，推荐在生产项目中使用。</p></blockquote>
<h2 id="conclusion">总结</h2>
<p>通过本文，你已经掌握了 Three.js 的基础用法，可以开始构建自己的 3D Web 场景了。</p>
`;

const article: PostArticle = {
  canonicalSlug: "hello-three-js",
  aliases: [],
  title: "Three.js 入门",
  publishedAt: "2024-11-15",
  publishedLabel: "Nov 15, 2024",
  excerpt: "Three.js 入门教程",
  type: "Tutorial",
  searchText: "",
  readingMinutes: 8,
  coverImage: null,
  categories: ["Three.js"],
  tags: ["three.js"],
  html: sampleHtml,
  toc: [],
};

const meta: Meta<typeof ArticleProse> = {
  title: "Article/ArticleProse",
  component: ArticleProse,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component:
          "文章正文渲染区域，使用 v-html 将预生成 HTML 插入页面。Storybook 中不包含高亮脚本，代码块可能无高亮色彩，属预期行为。",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleProse>;

export const Default: Story = {
  args: { article },
};

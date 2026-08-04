---
title: Next.js 项目结构与路由
date: 2026-08-04
updated: 2026-08-04
tags:
  - Next.js 16
  - App Router
  - Routing
  - Layout
  - shadcn/ui
source:
  - https://www.bilibili.com/video/BV14L9jBRE3e/
bvid: BV14L9jBRE3e
slug: nextjs16-project-routing
categories:
  - 前端开发
  - Next.js
pages: P1 00:00-01:03
draft: false
---

# Next.js 项目结构与路由

## 1. 先把项目跑起来

新项目直接使用 App Router：

```bash
pnpm create next-app@latest nextjs16-blog
cd nextjs16-blog
pnpm dev
```

脚手架默认会把 TypeScript、ESLint、Tailwind CSS 和 App Router 配好。`package.json` 中的 `dev` 脚本最终执行 Next.js 开发服务器，默认地址是 `http://localhost:3000`。

几个根目录文件的职责很固定：

```text
app/
├─ layout.tsx       根布局，包住所有页面
├─ page.tsx         / 路由
└─ globals.css      全局样式
public/             不经过模块导入的静态资源
next.config.ts      Next.js 配置
package.json        脚本与依赖
pnpm-lock.yaml      依赖解析结果
```

`app` 目录不只是页面目录。页面、布局、加载状态、错误边界、Route Handler 和业务代码都可以按路由边界放在这里，但不应该把所有逻辑堆进一个 `page.tsx`。

## 2. 文件夹就是路由

最小页面：

```tsx
// app/page.tsx
export default function HomePage() {
  return <h1>博客首页</h1>;
}
```

增加 `/about`：

```text
app/
└─ about/
   └─ page.tsx
```

```tsx
// app/about/page.tsx
export default function AboutPage() {
  return <h1>关于本站</h1>;
}
```

`page.tsx` 是页面约定文件，文件名写成 `about.tsx` 或 `index.tsx` 都不会自动成为 App Router 页面。

## 3. Layout 解决什么问题

如果每个页面都重新渲染导航栏，页面之间切换时就会重复创建相同结构。`layout.tsx` 用 `children` 接住当前路由的页面：

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next.js 博客',
  description: '一个使用 App Router 的博客应用',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header>共享导航栏</header>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

布局是嵌套的。`app/blog/layout.tsx` 只会包住 `/blog` 下面的页面，`app/layout.tsx` 仍然是最外层布局：

```text
/blog/hello
RootLayout
  └─ BlogLayout
      └─ app/blog/hello/page.tsx
```

这样可以把营销站、登录页、后台分别放进不同布局，而不是在一个导航栏组件里根据 URL 写大量 `if`。

## 4. Link 是默认导航方式

普通 `<a>` 会触发完整页面导航，浏览器需要重新加载整个文档。应用内部跳转优先用 `next/link`：

```tsx
import Link from 'next/link';

export function BlogNav() {
  return (
    <nav>
      <Link href="/">首页</Link>
      <Link href="/blog">文章</Link>
      <Link href="/blog/new">写文章</Link>
    </nav>
  );
}
```

`Link` 提供客户端导航和预取能力。共享布局可以保持在页面上，只有需要变化的路由内容更新，导航不会出现整页白屏。

外部地址或必须触发完整文档跳转的场景仍然使用 `<a>`。不要为了“统一”把所有链接都改成 `Link`。

## 5. 动态路由

博客文章的 ID 不是固定字符串，目录名用方括号：

```text
app/blog/[postId]/page.tsx
```

Next.js 16 中，动态路由的 `params` 按 Promise 接收：

```tsx
type PostPageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { postId } = await params;

  return <h1>文章：{postId}</h1>;
}
```

这是一个容易被旧教程带偏的地方。旧代码经常直接写 `params.postId`，在当前版本应先 `await params`。

动态参数来自 URL，不能因为 TypeScript 写成某种 ID 类型就认为它已经通过了运行时校验。真正查询数据库时，仍要让后端函数用 Convex validator 校验参数，并处理文章不存在的情况。

## 6. Route Group 不占用 URL

圆括号目录是路由组，只用于组织文件：

```text
app/
├─ (shared)/
│  ├─ layout.tsx
│  ├─ page.tsx              # 仍然是 /
│  └─ blog/page.tsx         # 仍然是 /blog
└─ auth/
   ├─ login/page.tsx        # /auth/login
   └─ signup/page.tsx       # /auth/signup
```

`(shared)` 不会出现在 URL 中，但其中的 `layout.tsx` 会包住组内页面。登录和注册页面如果不应该显示博客导航栏，就不要把 `auth` 放进 `(shared)`：

```text
app/
├─ (shared)/
│  ├─ layout.tsx            # 导航栏只在这里
│  └─ blog/page.tsx
└─ auth/
   └─ login/page.tsx        # 不继承博客布局
```

这个边界比“在 Navbar 里检查 pathname 再隐藏自己”清晰得多。

## 7. UI 组件安装与客户端边界

教程使用 shadcn/ui 组合表单、卡片、输入框、分隔线和按钮：

```bash
pnpm dlx shadcn@latest add button card field input textarea separator
```

这些组件的源码会进入项目，业务代码从项目自己的 `components/ui` 导入，而不是直接从底层 Radix 包导入。这样主题、样式和组件变体由项目统一管理。

主题切换需要浏览器状态和 `localStorage`，因此把交互集中到一个小 Client Component：

```tsx
// components/theme-toggle.tsx
'use client';

import { useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  return (
    <button type="button" onClick={() => setDark((value) => !value)}>
      {dark ? '浅色' : '深色'}
    </button>
  );
}
```

不要因为一个主题按钮就把根布局变成大 Client Component。服务器布局继续负责静态结构，只有需要状态、事件、浏览器 API 或自定义 Hook 的叶子组件标记 `'use client'`。

使用基于 class 的主题方案时，服务端首屏和客户端读取本地主题可能不一致，可以在根 `<html>` 上使用 `suppressHydrationWarning`。它只是消除已知的 hydration 警告，不是修复任意服务端与客户端输出不一致的通用开关。

## 8. 这一章的判断标准

- 共享导航、字体和全局元数据放在布局，不复制到每个页面。
- 应用内跳转默认用 `Link`，外部跳转用 `<a>`。
- 动态页面放在 `[param]` 目录，Next.js 16 先 `await params`。
- 只想组织文件而不想改变 URL 时，用 `(group)`。
- 交互组件尽量小，服务器组件不要被一个按钮拖成整棵 Client Tree。

---
title: Next.js 16 App Router 与路由系统
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - App Router
  - Layout
  - Dynamic Routes
  - Parallel Routes
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P3-P6
slug: nextjs16-app-router
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 App Router 与路由系统

App Router 的核心不是“多了几个文件名”，而是把 URL、布局、加载状态、错误边界和组件生命周期绑定到文件系统。理解这些约定后，页面之间的共享结构不需要再靠一个巨大组件读取 pathname 来判断。

## 1. 文件夹就是 URL，文件名决定能力

```text
src/app/
├─ page.tsx                    # /
├─ about/page.tsx              # /about
├─ about/me/page.tsx           # /about/me
├─ layout.tsx                  # 根布局
├─ loading.tsx                 # 当前路由的加载 UI
├─ error.tsx                   # 当前路由的错误边界
└─ not-found.tsx               # 当前路由的 404 UI
```

`about` 文件夹本身不会产生页面；只有其中存在 `page.tsx` 时，`/about` 才是可访问路由。`layout.tsx`、`loading.tsx` 和 `error.tsx` 是约定文件，名字不能随意改。

页面和布局的嵌套关系：

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

// src/app/about/layout.tsx
export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <AboutHeader />
      {children}
      <AboutFooter />
    </section>
  );
}
```

访问 `/about/me` 时，页面会被根布局和 `about/layout.tsx` 依次包住。布局适合放不会随子页面切换而消失的导航、字体、Provider 和共享数据。

## 2. `layout` 和 `template` 的区别

二者都可以共享 UI，但生命周期不同：

| 文件 | 切换子路由时 | 状态 | `useEffect` |
| --- | --- | --- | --- |
| `layout.tsx` | 保持挂载 | 保留 | 通常只初始化一次 |
| `template.tsx` | 重新挂载 | 重置 | 每次进入都重新执行 |

```tsx
// src/app/docs/template.tsx
'use client';

import { useEffect } from 'react';

export default function DocsTemplate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log('每次进入 docs 子路由都会执行');
  }, []);

  return <div>{children}</div>;
}
```

需要持久化的导航状态、Provider 和页面外壳放 `layout`；需要每次切换都重置的表单、动画或埋点边界放 `template`。带 Hook 的布局或模板必须声明 `'use client'`，但这不意味着父级所有页面都要客户端化。

## 3. 加载、错误和 404

异步页面可以配同级 `loading.tsx`：

```tsx
// src/app/about/loading.tsx
export default function Loading() {
  return <div aria-busy="true">正在加载...</div>;
}
```

页面抛出异常时，同级 `error.tsx` 接管显示。错误边界本身需要客户端能力：

```tsx
// src/app/about/error.tsx
'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section>
      <p>页面加载失败</p>
      <button onClick={() => reset()}>重试</button>
    </section>
  );
}
```

全局 404 可以放在 `src/app/not-found.tsx`：

```tsx
export default function NotFound() {
  return <h1>页面不存在</h1>;
}
```

数据查询发现资源不存在时，在服务器组件中调用 `notFound()`，不要返回一个标题为空的“成功页面”：

```tsx
import { notFound } from 'next/navigation';

const article = await getArticle(id);
if (!article) notFound();
```

## 4. 动态、分组和平行路由

动态段用方括号：

```text
src/app/blog/[slug]/page.tsx       # /blog/hello
src/app/docs/[...slug]/page.tsx    # /docs/a/b/c
src/app/shop/[[...slug]]/page.tsx  # /shop 和 /shop/a/b 都匹配
```

Next.js 16 中 `params` 按 Promise 接收：

```tsx
type Props = { params: Promise<{ slug: string }> };

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  return <article>{slug}</article>;
}
```

路由组使用圆括号，不会进入 URL：

```text
src/app/
├─ (marketing)/page.tsx
├─ (auth)/login/page.tsx       # URL 仍然是 /login
└─ (dashboard)/settings/page.tsx
```

平行路由用 `@slot` 把多个页面区域交给同一个布局：

```text
app/dashboard/
├─ layout.tsx
├─ page.tsx
├─ @analytics/page.tsx
└─ @activity/page.tsx
```

它适合仪表盘、侧栏和弹窗等可以独立加载或独立切换的区域。不要为了“目录看起来高级”滥用平行路由；如果两个区域没有独立生命周期，普通组件组合更清楚。

## 5. 导航方式

应用内跳转优先使用 `Link`：

```tsx
import Link from 'next/link';

<Link href={`/blog/${post.slug}`}>{post.title}</Link>;
```

需要事件中跳转时使用客户端 Hook：

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';

const router = useRouter();
const pathname = usePathname();

function openSettings() {
  router.push('/settings');
}
```

服务器端完成条件判断时使用 `redirect()`：

```tsx
import { redirect } from 'next/navigation';

if (!user) redirect('/login');
```

不要把 `router.push` 当成权限控制。它只是导航；资源权限仍要在 Route Handler、Server Action 或数据库查询边界重新验证。

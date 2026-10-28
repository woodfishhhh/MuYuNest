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

App Router 就是用文件夹管路由：URL、布局、loading、报错页全靠文件约定，不用再在一个大组件里读 pathname 判断。

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

`about/` 里没有 `page.tsx`，访问 `/about` 就是 404。`layout.tsx`、`loading.tsx`、`error.tsx` 这几个文件名是固定的，不能改。

页面和布局的嵌套：

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

访问 `/about/me` 时，页面外面先套 `about/layout.tsx`，再套根布局。切页面时不该消失的东西放布局里：导航、字体、Provider、共享数据。

## 2. `layout` 和 `template` 的区别

两个都能共享 UI，区别在生命周期：

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

- 要保留状态的放 `layout`：导航状态、Provider、页面外壳
- 每次切换都要重置的放 `template`：表单、动画、埋点

用了 Hook 的 layout 或 template 要写 `'use client'`，但别的页面不用因此都变成客户端组件。

## 3. 加载、错误和 404

异步页面旁边放一个 `loading.tsx`：

```tsx
// src/app/about/loading.tsx
export default function Loading() {
  return <div aria-busy="true">正在加载...</div>;
}
```

页面抛异常时，显示同级的 `error.tsx`。它需要客户端能力：

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

全局 404 放 `src/app/not-found.tsx`：

```tsx
export default function NotFound() {
  return <h1>页面不存在</h1>;
}
```

查数据发现资源不存在，就在服务器组件里调 `notFound()`，别返回一个空标题的“正常页面”：

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

Next.js 16 里 `params` 是 Promise：

```tsx
type Props = { params: Promise<{ slug: string }> };

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  return <article>{slug}</article>;
}
```

路由组用圆括号，不出现在 URL 里：

```text
src/app/
├─ (marketing)/page.tsx
├─ (auth)/login/page.tsx       # URL 仍然是 /login
└─ (dashboard)/settings/page.tsx
```

平行路由用 `@slot`，把几块页面区域交给同一个布局：

```text
app/dashboard/
├─ layout.tsx
├─ page.tsx
├─ @analytics/page.tsx
└─ @activity/page.tsx
```

适合仪表盘、侧栏、弹窗这种能各自加载、各自切换的区域。两块区域没有独立的生命周期，就直接用普通组件组合，别为了目录好看硬上。

## 5. 导航方式

站内跳转用 `Link`：

```tsx
import Link from 'next/link';

<Link href={`/blog/${post.slug}`}>{post.title}</Link>;
```

在事件里跳转用客户端 Hook：

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';

const router = useRouter();
const pathname = usePathname();

function openSettings() {
  router.push('/settings');
}
```

服务器端判断完条件再跳，用 `redirect()`：

```tsx
import { redirect } from 'next/navigation';

if (!user) redirect('/login');
```

`router.push` 只是跳转，不是权限控制。权限还是要在 Route Handler、Server Action 或查数据库的地方再校验一次。

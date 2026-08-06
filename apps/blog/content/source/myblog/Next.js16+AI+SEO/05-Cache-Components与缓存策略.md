---
title: Next.js 16 Cache Components 与缓存策略
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - Cache Components
  - PPR
  - Suspense
  - Revalidation
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P14-P15
slug: nextjs16-cache-components
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 Cache Components 与缓存策略

“刷新后数据没变”不一定是 Bug，可能是 Next.js 把页面推导成了静态内容。缓存组件的价值，是把静态外壳、可缓存数据和每次请求都要变化的动态数据放进同一条路由，同时让开发者明确控制缓存边界。

## 1. 三种内容

```text
静态内容       -> 构建时就能确定
动态内容       -> 依赖请求、Cookie、Header、URL 或实时接口
缓存内容       -> 动态数据被缓存，再嵌入静态外壳
```

静态内容包括本地 JSON、模块导入和纯计算。动态内容包括 `fetch`、`cookies()`、`headers()`、URL 参数和数据库查询。缓存内容的本质是：动态数据不必每次从源头重新读取，但也不必永久静态化。

## 2. 开启 Cache Components

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
```

开启后，动态内容不能无边界地直接出现在静态树中，应放入 `Suspense`：

```tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>加载实时数据...</p>}>
        <RandomProfile />
      </Suspense>
    </main>
  );
}

async function RandomProfile() {
  const response = await fetch('https://example.com/profile');
  const profile = await response.json();
  return <p>{profile.name}</p>;
}
```

服务端先返回标题和骨架，动态区域稍后通过流式响应填入。这就是 static shell：页面外壳先出来，慢数据不再阻塞整个路由。

## 3. `use cache` 明确缓存函数

```tsx
import { cacheLife, cacheTag } from 'next/cache';

export async function getPopularPosts() {
  'use cache';
  cacheLife('hours');
  cacheTag('popular-posts');

  return db.post.findMany({
    orderBy: { views: 'desc' },
    take: 10,
  });
}
```

缓存的键会受到函数参数和闭包变量影响。用户私有数据必须包含用户维度，不能把所有用户的结果塞进同一个共享缓存函数。缓存函数还要避免读取不可序列化的隐式全局状态。

## 4. 旧缓存策略要能读懂

未启用 Cache Components 时，常见控制方式包括：

```ts
export const revalidate = 60;        // 路由级时间再验证
export const dynamic = 'force-dynamic';
```

```ts
const response = await fetch(url, { cache: 'no-store' });
```

```ts
export const revalidate = 0;          // 不缓存
```

读取 `cookies()`、`headers()` 等请求上下文也会让页面进入动态路径。它们不是“关缓存的魔法开关”，而是在逻辑上说明页面依赖当前请求。

启用 Cache Components 后，控制权更明确：动态内容仍然需要 `Suspense`，需要缓存的函数再用 `'use cache'`、`cacheLife` 和 `cacheTag` 标注。不要把旧的 route segment 配置和新的缓存模型无规则叠加。

## 5. `revalidate`、`expire` 与失效

缓存生命周期需要区分两个动作：

- 后台再验证：缓存到期后后台更新，当前用户可以继续读旧值。
- 立即失效：缓存被清掉，下一次读取必须回源。

不同 Next.js 版本和缓存组件 API 对应的具体参数名可能不同，使用前要对照当前版本文档。业务上应先回答三个问题：数据最多能旧多久、谁触发更新、更新失败时是否允许继续使用旧值。

## 6. 缓存排错顺序

```bash
pnpm build
pnpm start
```

开发模式中的结果不能直接代表生产缓存。生产排查按这个顺序：

1. 看构建输出里页面是 Static 还是 Dynamic。
2. 列出页面读取的请求上下文和数据源。
3. 暂时移除缓存，确认数据源本身是否正常。
4. 恢复缓存并给动态区域补上 `Suspense`。
5. 用明确的生命周期和 tag 重新上线。

不要为了让数据“每次都变”就永久关闭缓存。先找出静态推导和动态依赖的真实边界。

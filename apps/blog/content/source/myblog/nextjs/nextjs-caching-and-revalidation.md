---
title: Next.js 16 缓存体系：Cache Components、use cache 与失效策略
slug: nextjs-caching-and-revalidation
date: 2026-08-06
categories:
  - 前端开发
tags:
  - Next.js 16
  - Cache Components
  - use cache
  - Suspense
  - 缓存失效
---

线上经常遇到“明明后台改了文章标题，前端刷新好几次还是旧数据”或者“加了一句 `cookies()` 整页突然变成每次请求都慢吞吞回源”。在 Next.js 16 之前，隐式的自动缓存规则常常让人摸不着头脑；Next.js 16 推出了显式可控的 **Cache Components** 与 `'use cache'` 模型，把“静态外壳、可缓存动态片段、每次请求实时计算”三者的边界彻底交还给开发者自己声明。

## 静态、动态与可缓存的三层内容模型

进入一条 Next.js 16 路由，页面里的数据天然分成三种生命周期：

```text
静态内容（Static）     -> 构建期即可确定（本地模块导入、纯静态文案）
可缓存内容（Cached）   -> 原本属于动态查询，但允许按 TTL 或 Tag 缓存并复用进静态外壳
动态内容（Dynamic）    -> 每次请求必须现算（读取 cookies()、headers()、实时库存或未缓存 fetch）
```

在 `next.config.ts` 中启用 `cacheComponents: true` 后，框架默认采用“动态内容按请求执行、静态外壳优先直出”的显式模型（对应部分预渲染 PPR 的工作方式）：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

**开启 `cacheComponents: true` 后，任何未标记缓存的动态数据查询绝不能裸露在静态页面树中，必须被包裹在 `<Suspense>` 边界内（或者显式移入 `'use cache'` 函数），否则构建阶段就会直接报错拦截。**

```tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      {/* 静态外壳先直出，实时用户区域通过流式响应填充 */}
      <Suspense fallback={<p>加载实时数据...</p>}>
        <LiveUserProfile />
      </Suspense>
    </main>
  )
}

async function LiveUserProfile() {
  const response = await fetch('https://api.example.com/profile')
  const profile = (await response.json()) as { name: string }
  return <p>{profile.name}</p>
}
```

这样的结构让服务端可以先瞬间吐出 Static Shell（静态导航、标题和骨架屏），慢接口随后在同一条 HTTP 流里填进来，既保住了 TTFB 首字节速度，又不牺牲实时性。

## `'use cache'` 指令与 `cacheLife` / `cacheTag` 实践

对于“数据库热门文章榜单”、“全站分类树”这类不需要每次请求都重算、但又不能死等下次重新部署才更新的数据，在服务端数据函数或组件顶部写上 `'use cache'` 指令即可显式纳入缓存：

```tsx
import { cacheLife, cacheTag } from 'next/cache'

export async function getPopularPosts(limit: number) {
  'use cache'
  cacheLife('hours')
  cacheTag('popular-posts')

  return db.post.findMany({
    where: { published: true },
    orderBy: { views: 'desc' },
    take: limit,
  })
}
```

编写 `'use cache'` 函数时有两项硬性约束：

1. **所有传入参数与捕获的外部变量都会自动成为缓存 Key 的一部分**。如果把整个复杂的请求上下文对象传进去，缓存命中率会暴跌；反过来，**涉及用户私有数据时（如个人订单列表），必须把 `userId` 作为参数传入（且函数内不能直接读 `cookies()`/`headers()`），否则不同用户会互相读到同一个缓存结果造成严重越权泄露。**
2. **用 `cacheLife` 声明明确的新鲜度窗口**：可以使用内置预设（如 `'seconds'`、`'minutes'`、`'hours'`、`'days'`、`'max'`）或自定义 `{ stale, revalidate, expire }` 对象，精准控制客户端缓存多久、服务端后台多久再验证以及最长过期丢弃时间。

### 对照早期 Route Segment 缓存写法

接手未启用 `cacheComponents` 的存量项目时，还会看到路由段导出配置：

```ts
export const revalidate = 60          // 路由级 ISR 60 秒后台再验证
export const dynamic = 'force-dynamic' // 强制整条路由每次请求动态渲染
```

以及 `fetch(url, { cache: 'no-store' })`。当项目开启 `cacheComponents: true` 后，应统一用 `<Suspense>` 划定动态边界、用 `'use cache'` + `cacheLife` / `cacheTag` 划定缓存边界，不要再把旧版 `dynamic` / `revalidate` 路由段配置和新模型混搭叠加。

## 按需失效：`revalidateTag` vs `updateTag` vs `revalidatePath`

给缓存挂上 `cacheTag('post:123')` 或 `cacheTag('popular-posts')` 后，后台修改数据或用户发布新评论时就可以主动清掉对应缓存。Next.js 16 针对不同一致性要求区分了精确失效语义：

| 失效 API | 使用位置 | 生效语义 | 适用场景 |
| --- | --- | --- | --- |
| `revalidateTag(tag, profile)` | Server Actions / Route Handlers | 标记标签过期并触发**后台再验证（Stale-While-Revalidate）**——当前请求可能先读旧值、后台异步刷新 | 热门榜、文章列表等允许短暂最终一致性的公共内容 |
| `updateTag(tag)` | Server Actions | **立即失效（Read-Your-Own-Writes）**——同一次提交后的跳转或刷新立刻拿到最新数据 | 用户刚创建文章、改完个人资料或发完评论后的即时回显 |
| `revalidatePath(path)` | Server Actions / Route Handlers | 按路由路径精确使该路径下的缓存失效 | 表单提交后直接刷新特定页面（如 `/todos`） |

```ts
'use server'

import { revalidateTag, updateTag } from 'next/cache'

export async function publishPost(postId: string) {
  await db.post.update({ where: { id: postId }, data: { published: true } })

  // 作者本人希望立刻看到这篇文章已发布
  updateTag(`post:${postId}`)
  // 全站热门列表允许按标准缓存策略后台更新
  revalidateTag('popular-posts', 'max')
}
```

## 缓存行为线上排错顺序

**`pnpm dev` 开发模式为了热更新体验会跳过或弱化大部分缓存行为，验证缓存是否真正生效、有没有把动态页错推导成静态页，必须本地跑通 `pnpm build && pnpm start` 后实测。**

线上遇到缓存异常，按这五步逐一排除：

1. 查看 `next build` 终端构建产物表，核对目标路由究竟被编译成了 Static（`○`）、Partial Prerender / Cacheable 还是 Dynamic（`ƒ`）。
2. 排查页面和它导入的公共函数里有没有不小心读取 `cookies()`、`headers()` 或未缓存 `fetch` 却忘记包 `<Suspense>`。
3. 临时剥离缓存指令确认底层数据库或接口本身返回是否正确。
4. 补齐 `<Suspense>` 动态边界，并检查 `'use cache'` 函数的参数是否把用户维度和序列化边界隔干净。
5. 确认写操作（Server Action / Route Handler）里触发的 Tag 名称与查询时 `cacheTag()` 声明的完全一致。

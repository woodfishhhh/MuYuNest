---
title: Next.js 16 全栈实战：Proxy、缓存组件与全局搜索
date: 2026-08-04
updated: 2026-08-04
tags:
  - Next.js 16
  - Proxy
  - Cache Components
  - PPR
  - Search
  - Convex
source: https://www.bilibili.com/video/BV14L9jBRE3e/
bvid: BV14L9jBRE3e
slug: nextjs16-proxy-search
categories:
  - 前端开发
  - Next.js
pages: P1 07:20-08:26
draft: false
---

# Proxy、缓存组件与全局搜索

这一章处理三个容易互相干扰的问题：请求进入应用时如何做快速拦截，页面如何把静态、缓存和动态内容混在一起，以及如何让搜索输入只触发有限的数据库查询。

## 1. Proxy 负责请求级拦截，不负责最终授权

Next.js 16 将过去的 Middleware 入口更名为 Proxy。项目根目录可以放置 `proxy.ts`：

```ts
// proxy.ts
import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get('better-auth.session_token'));

  if (!hasSessionCookie && request.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

Cookie 是否存在只能作为快速的用户体验检查，不能当作安全边界。伪造 cookie、过期会话和权限变化都可能绕过这一步，因此页面、Server Action 和 Convex Query/Mutation 仍要重新验证会话和资源权限。

Proxy 的 matcher 应尽量窄，避免每个静态资源和公开页面都经过认证逻辑。重定向时保留安全的回跳路径，并过滤外部 URL，防止形成开放重定向。

## 2. Cache Components 与 PPR 思路

启用 Cache Components 的配置形态为：

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
};
```

它允许同一条路由中同时存在：

- 静态内容，例如站点标题和导航。
- 可复用的缓存内容，例如文章列表。
- 依赖请求或用户会话的动态内容，例如在线状态。

缓存函数可以使用 `use cache`，再配合生命周期和标签：

```tsx
import { cacheLife, cacheTag } from 'next/cache';

async function CachedPostList() {
  'use cache';
  cacheLife('hours');
  cacheTag('posts');

  const posts = await fetchQuery(api.posts.list);
  return <PostList posts={posts} />;
}
```

写入文章后，可以用 `revalidateTag` 或 `updateTag` 让这类缓存失效。缓存键会受到函数参数以及闭包变量影响，所以不要把用户私有数据放进一个没有用户维度的共享缓存函数。

动态内容应该有明确的 `Suspense` 边界：

```tsx
<CachedPostList />
<Suspense fallback={<PresenceSkeleton />}>
  <PostPresence postId={postId} />
</Suspense>
```

启用 Cache Components 后，未缓存的异步请求、请求 API 和用户数据不能随意在静态树中执行；要么放进 `Suspense`，要么把函数明确标记为缓存。否则构建阶段或运行时会提示无法确定动态内容边界。

## 3. Convex 搜索索引

搜索不能每次都把所有文章取回客户端再过滤。先为需要检索的字段建立搜索索引：

```ts
posts: defineTable({
  title: v.string(),
  body: v.string(),
  // ...
})
  .searchIndex('search_title', { searchField: 'title' })
  .searchIndex('search_body', { searchField: 'body' });
```

查询函数接收搜索词和上限：

```ts
export const search = query({
  args: { term: v.string(), limit: v.number() },
  handler: async (ctx, { term, limit }) => {
    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const titleHits = await ctx.db
      .query('posts')
      .withSearchIndex('search_title', (q) => q.search('title', term))
      .take(safeLimit);

    if (titleHits.length >= safeLimit) return titleHits;

    const bodyHits = await ctx.db
      .query('posts')
      .withSearchIndex('search_body', (q) => q.search('body', term))
      .take(safeLimit);

    const seen = new Set(titleHits.map((post) => post._id));
    return titleHits.concat(
      bodyHits.filter((post) => !seen.has(post._id)),
    ).slice(0, safeLimit);
  },
});
```

优先标题再补正文是一种简单的相关性策略。更重要的是服务端强制上限、去重，并根据权限过滤结果；客户端传入的 `limit` 不能让查询无限扩大。

## 4. 搜索框的交互边界

```tsx
const [term, setTerm] = useState('');
const normalizedTerm = term.trim();
const results = useQuery(
  api.posts.search,
  normalizedTerm.length >= 2
    ? { term: normalizedTerm, limit: 5 }
    : 'skip',
);
```

输入不足两个字符时跳过查询，避免每次按键都访问后端。界面至少应区分以下状态：

- 输入为空：不显示结果面板。
- 正在查询：显示稳定尺寸的 loading 状态。
- 没有结果：显示清晰的空状态。
- 有结果：展示标题、摘要和指向 `/blog/[postId]` 的链接。
- 点击结果：关闭面板并清空或保留搜索词，行为要一致。

结果弹层要有明确的层级、键盘焦点和点击外部关闭逻辑，避免被导航栏或文章图片遮住。搜索本身不应改变 URL，除非产品需要可分享的搜索结果页。

## 5. 本章检查清单

- Proxy 只做快速拦截，真正鉴权仍在服务端数据边界完成。
- matcher 不覆盖无关的公开路由和静态资源。
- Cache Components 中动态内容有明确的 `Suspense` 边界。
- 私有数据不会进入跨用户共享缓存。
- 搜索使用数据库索引，服务端限制数量并去重。
- 客户端输入有最小长度和 `skip` 分支，结果面板处理完整状态。

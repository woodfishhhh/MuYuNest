---
title: Next.js 16 全栈实战：实时评论、Presence 与动态元数据
date: 2026-08-04
updated: 2026-08-04
tags:
  - Next.js 16
  - Convex
  - Realtime
  - Comments
  - Presence
  - Metadata
  - SEO
source: https://www.bilibili.com/video/BV14L9jBRE3e/
bvid: BV14L9jBRE3e
slug: nextjs16-realtime-metadata
categories:
  - 全栈开发
  - Next.js
pages: P1 06:20-07:20
draft: false
---

# 实时评论、Presence 与动态元数据

实时评论和在线状态看起来是两个 UI 功能，底层却共享同一个原则：服务器保存事实，客户端订阅查询，数据库变化自动推动界面更新。SEO 元数据则走另一条路径，在服务器生成，不应该依赖客户端 hydration。

## 1. 评论表和查询

评论至少要关联文章和作者：

```ts
// convex/schema.ts
comments: defineTable({
  postId: v.id('posts'),
  authorId: v.string(),
  authorName: v.string(),
  body: v.string(),
}).index('by_post', ['postId']),
```

查询函数可以按文章 ID 返回评论：

```ts
export const getCommentsByPostId = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, { postId }) => {
    return ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .order('desc')
      .collect();
  },
});
```

写入时不要相信客户端提交的 `authorId` 和 `authorName`：

```ts
export const create = mutation({
  args: {
    postId: v.id('posts'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError('Not authenticated');

    return ctx.db.insert('comments', {
      postId: args.postId,
      body: args.body,
      authorId: user._id,
      authorName: user.name,
    });
  },
});
```

还应限制正文长度、过滤空白内容，并在删除评论时检查操作者是否是作者或管理员。

## 2. SSR 初始评论 + WebSocket 实时更新

纯客户端查询很简单：

```tsx
'use client';

const comments = useQuery(api.comments.getCommentsByPostId, { postId });
```

如果评论区是文章详情页的重要首屏内容，可以在服务器端预加载文章和评论，再交给客户端订阅：

```tsx
const [preloadedPost, preloadedComments] = await Promise.all([
  preloadQuery(api.posts.getById, { postId }),
  preloadQuery(api.comments.getCommentsByPostId, { postId }),
]);

return (
  <PostScreen
    preloadedPost={preloadedPost}
    preloadedComments={preloadedComments}
  />
);
```

客户端使用 `usePreloadedQuery` 读取初始值并继续保持订阅。`Promise.all` 能并行获取彼此独立的文章和评论，避免不必要的瀑布请求。

Convex 会跟踪查询读取了哪些数据。当 Mutation 改变相关记录时，服务端推送更新，客户端重新计算订阅查询并刷新评论列表。这样不需要手写“提交成功后重新拉取”的同步代码，但仍要处理连接断开、提交失败和乐观 UI 回滚。

## 3. Presence：在线状态不是登录状态

Presence 表示“某个用户最近仍在一个页面或房间里活动”，它和 Better Auth 的登录状态不同。一个可靠的实现需要：

1. 客户端进入文章页后开始心跳或定期更新。
2. 服务端保存用户、文章和最后活动时间。
3. 查询时只显示阈值内仍活跃的用户。
4. 页面卸载、超时或连接断开后让状态自然过期。

Convex Presence 组件或对应集成包可以处理心跳和订阅。具体包的函数名会随版本变化，接入时以当前包 API 为准；无论使用现成组件还是自建表，都要在服务端确认用户身份，并用会话中的 ID 覆盖客户端传入的 ID。

```tsx
function PostPresence({ postId }: { postId: Id<'posts'> }) {
  const onlineUsers = usePostPresence(postId);

  return (
    <span aria-live="polite">
      {onlineUsers.length} 人正在阅读
    </span>
  );
}
```

在线人数是易变数据，不应被长时间缓存。展示“最后在线”时也要明确时间阈值，避免把几分钟前的心跳误报为当前在线。

## 4. 静态和动态 metadata

固定页面可以导出静态 metadata：

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '博客文章',
  description: '分享工程实践与学习笔记',
};
```

文章详情页需要根据文章内容生成标题和描述：

```tsx
import type { Metadata } from 'next';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const post = await fetchQuery(api.posts.getById, { postId });

  if (!post) {
    return { title: '文章不存在' };
  }

  return {
    title: post.title,
    description: post.body.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.body.slice(0, 160),
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  };
}
```

`generateMetadata` 在服务器侧运行，既可以读取动态参数，也能避免把 SEO 关键内容留给客户端。标题、描述和 Open Graph 图片都应有缺省值，不能因为一篇数据不完整的文章让整个页面生成失败。

## 5. 本章检查清单

- 评论表按文章建立索引，查询不扫描无关数据。
- 评论创建只接受 `postId` 和正文，作者信息来自服务端会话。
- 首屏需要速度时预加载，后续变化交给实时订阅。
- Presence 有心跳、过期阈值和断线处理，不等同于登录态。
- 在线状态不进入长时间缓存。
- 动态 metadata 在服务器生成，并处理文章不存在和空字段。

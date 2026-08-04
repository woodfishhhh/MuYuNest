---
title: Next.js 16 全栈实战：Convex 数据模型与 Server Actions
date: 2026-08-04
updated: 2026-08-04
tags:
  - Next.js 16
  - Convex
  - Schema
  - Server Actions
  - Better Auth
source: https://www.bilibili.com/video/BV14L9jBRE3e/
bvid: BV14L9jBRE3e
slug: nextjs16-convex-server-actions
categories:
  - 全栈开发
  - Next.js
pages: P1 02:40-03:50
draft: false
---

# Convex 数据模型与 Server Actions

这一章把博客从“能渲染页面”推进到“能保存真实数据”：先定义数据库 schema，再把查询、写入和鉴权放到服务端，最后根据交互方式选择客户端 Mutation 或 Server Action。

## 1. Convex 的职责边界

Convex 同时提供数据库、类型安全的函数调用和实时查询。典型项目结构如下：

```text
convex/
  schema.ts
  posts.ts
  comments.ts
  auth.config.ts
```

开发环境启动 Convex：

```bash
pnpm add convex
pnpm dlx convex dev
```

前端通过 `ConvexProvider` 和 `ConvexReactClient` 连接公开的 Convex deployment URL。URL 可以放在 `NEXT_PUBLIC_CONVEX_URL`，但部署密钥、Better Auth secret 等服务端凭据不能暴露给浏览器。

Convex 函数大致分成三类：

| 类型 | 用途 | 是否应该产生副作用 |
| --- | --- | --- |
| Query | 读取数据 | 否 |
| Mutation | 原子地读写数据库 | 是，适合常规业务写入 |
| Action | 调用外部 API、文件系统等非数据库能力 | 可以，必要时再调用 Query/Mutation |

把数据库读写集中在 `convex/` 中，页面只关心输入、加载状态和结果，能让权限检查不会散落在多个客户端组件里。

## 2. 先定义 schema，再写业务函数

一个最小的文章表可以这样定义：

```ts
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  posts: defineTable({
    authorId: v.string(),
    title: v.string(),
    body: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
  }).index('by_author', ['authorId']),
});
```

schema 不只是数据库文档，它还会参与函数参数和返回值的类型检查。生成的 `api` 对象会让前端调用 `api.posts.list`、`api.posts.create` 时保留函数路径的类型信息。文章的存储文件应保存为 `Id<'_storage'>`，而不是把临时图片 URL 当成业务数据。

## 3. Mutation 必须在服务端完成鉴权

创建文章的函数至少需要校验三件事：输入是否合法、用户是否登录、写入的作者是否来自当前会话。

```ts
// convex/posts.ts
import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (!user) {
      throw new ConvexError('Not authenticated');
    }

    return ctx.db.insert('posts', {
      ...args,
      authorId: user._id,
    });
  },
});
```

上面的 `authComponent` 代表项目当前 Better Auth + Convex 集成暴露的认证组件；不同版本的包可能把它命名为 `getAuthUser`、`getAuthSession` 或其他 API，调用前应以生成的项目类型为准。不能直接相信客户端传来的 `authorId`，否则用户可以冒充其他作者。

客户端调用 Mutation：

```tsx
'use client';

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function CreatePostButton({ title, body }: Props) {
  const createPost = useMutation(api.posts.create);

  async function handleCreate() {
    await createPost({ title, body });
  }

  return <button onClick={handleCreate}>发布文章</button>;
}
```

真实表单还应配合 `useTransition` 或本地 pending 状态，防止重复提交；成功后可以清空表单、提示用户并刷新或跳转到文章详情页。

## 4. Server Action 适合表单提交

Server Action 是由 Next.js 服务器执行的异步函数。文件级或函数级的 `'use server'` 指令是边界标记：没有它，函数不会自动成为可从表单调用的 Server Action。

```ts
// app/actions.ts
'use server';

import { redirect } from 'next/navigation';

export async function createPostAction(formData: FormData) {
  const title = String(formData.get('title') ?? '');
  const body = String(formData.get('body') ?? '');

  const parsed = createPostSchema.safeParse({ title, body });
  if (!parsed.success) {
    return { error: '标题和正文不符合要求' };
  }

  // 在服务端读取当前用户，并通过 fetchMutation 写入 Convex。
  await fetchMutation(api.posts.create, parsed.data);
  redirect('/blog');
}
```

可以直接把 Action 交给表单：

```tsx
<form action={createPostAction}>
  <input name="title" required />
  <textarea name="body" required />
  <button type="submit">发布</button>
</form>
```

客户端 Mutation 和 Server Action 的选择：

| 场景 | 更合适的入口 |
| --- | --- |
| 输入变化就需要实时反馈、页面已经是客户端组件 | `useMutation` |
| 原生表单提交、希望把凭据和转换逻辑留在服务器 | Server Action |
| 需要调用外部服务或非数据库 API | Action，再由 Action 调用 Mutation |

无论入口是哪一种，鉴权和参数校验都不能只放在 UI。Server Action 本质上也是一个可被调用的服务器边界，必须重新解析 `FormData`，并在服务端取得用户身份。

`redirect()` 在 Next.js 内部通过抛出特殊控制流错误结束渲染，因此不要把它放进会吞掉异常的 `try/catch` 中。需要捕获真正的业务错误时，先返回错误状态，再在成功分支执行重定向。

## 5. 本章检查清单

- schema 中的字段、索引和存储 ID 与业务查询一致。
- Query 只读，Mutation 负责数据库写入，Action 负责服务器侧编排。
- `authorId`、用户角色、资源归属都由服务端会话决定。
- 客户端表单使用 Zod 做输入校验，服务端再次校验。
- pending、失败和重复提交状态都有处理。
- `redirect()` 不被宽泛的 `try/catch` 吞掉。
- 公开环境变量和服务端 secret 分开管理。

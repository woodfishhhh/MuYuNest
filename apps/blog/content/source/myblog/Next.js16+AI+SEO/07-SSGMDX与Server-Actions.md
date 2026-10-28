---
title: Next.js 16 SSG、MDX 与 Server Actions
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - SSG
  - MDX
  - Server Actions
  - React 19
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P19-P21
slug: nextjs16-ssg-mdx-server-actions
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 SSG、MDX 与 Server Actions

三样东西各管一件事：静态导出是"构建一次、部署静态文件"，MDX 是"内容和组件写在一起"，Server Actions 是把表单提交直接连到服务端函数。适用的边界不一样，别因为都能写页面就混为一谈。

## 1. 静态导出：把页面编译成文件

在 `next.config.ts` 里开静态导出：

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

执行 `next build` 后默认生成 `out/` 目录，可以直接交给 Nginx、对象存储、CDN 或其他静态服务器。`trailingSlash: true` 让路由更容易对应到 `about/index.html` 这种静态目录结构；托管平台有自己的路由规则的话，也要按平台的行为验证一下。

静态导出的取舍很明确：

| 适合 | 不适合 |
| --- | --- |
| 官网、文档、博客、帮助中心 | 依赖请求时 Cookie 的页面 |
| 构建时就能确定的数据 | 必须运行在 Node.js 上的 Route Handler |
| 低成本 CDN 分发 | 实时个性化内容和服务端交互 |
| 不需要服务器运行时的项目 | 依赖动态 API、数据库或身份状态的页面 |

静态页面里的客户端交互照样能跑，但交互逻辑得在浏览器里完成；服务端的动态能力装不成静态的。

## 2. 动态路由必须在构建时枚举

动态路由要通过 `generateStaticParams` 告诉构建过程要生成哪些路径：

```tsx
type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return [{ slug: 'intro' }, { slug: 'routing' }];
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  return <article>文章：{slug}</article>;
}
```

路径来自数据库或远程 CMS 的话，`generateStaticParams` 在构建阶段必须访问得到它们。数据变了，已经生成的 HTML 不会自动刷新，一般要重新构建、重新部署。

`next/image` 默认的图片优化依赖 Next.js 的服务端运行时，纯静态导出没有这个运行时。可以这样处理：

```ts
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

也可以用原生的 `<img>`，或者配置自己的图片 loader。静态导出前要把图片、动态路由、重写和 API 依赖都查一遍，免得本地构建成功，上线后页面却少了功能。

## 3. MDX：Markdown 中组合 React 组件

MDX 是 Markdown 和 JSX 混在一起的语法，适合文章、文档和教程：正文保持 Markdown 的可读性，要交互时再引入 React 组件。

安装并配置：

```bash
npm install @next/mdx @mdx-js/loader
npm install -D @types/mdx
```

```ts
// next.config.mdx.ts
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
};

export default withMDX(nextConfig);
```

```tsx
// app/docs/intro/page.tsx
import Intro from '@/content/intro.mdx';

export default function Page() {
  return <Intro />;
}
```

`mdx-components.tsx` 能给所有 MDX 文件提供统一的组件映射：

```tsx
import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <h2 className="doc-heading" {...props} />,
    ...components,
  };
}
```

### 远程 MDX 的边界

远程 Markdown 可以当成文本取回来，交给受控的 Markdown/MDX 编译链处理。别把不可信的内容直接当成任意 React 代码执行；MDX 能调用组件和表达式，远程内容的作者、依赖和编译环境都得可信。文章系统只需要 Markdown 的话，用一个安全的 Markdown renderer 往往更简单。

## 4. Server Actions：表单直接调用服务端函数

最小的 Server Action：

```ts
// app/todos/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createTodo(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();

  if (!title) {
    return { ok: false, message: '标题不能为空' };
  }

  await db.todo.create({ data: { title } });
  revalidatePath('/todos');
  return { ok: true, message: '已创建' };
}
```

```tsx
import { createTodo } from './actions';

export default function TodoForm() {
  return (
    <form action={createTodo}>
      <label>
        标题
        <input name="title" required />
      </label>
      <button type="submit">创建</button>
    </form>
  );
}
```

表单字段必须有 `name`，不然不会出现在 `FormData` 里。服务端函数照样要做鉴权、校验和权限判断，`'use server'` 不负责授权。

## 5. 固定参数用 `bind`，用户输入用校验

编辑某条记录时，固定的记录 ID 可以用 `bind` 传进去，别依赖一个用户能改的隐藏字段：

```tsx
const updateTodoForId = updateTodo.bind(null, todo.id);

<form action={updateTodoForId}>
  <input name="title" defaultValue={todo.title} />
  <button type="submit">保存</button>
</form>;
```

```ts
'use server';

export async function updateTodo(id: string, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();

  if (!/^[^<>]{1,120}$/.test(title)) {
    return { ok: false, message: '标题格式不正确' };
  }

  const session = await requireSession();
  const todo = await db.todo.findFirst({ where: { id, userId: session.userId } });
  if (!todo) return { ok: false, message: '无权修改' };

  await db.todo.update({ where: { id }, data: { title } });
  revalidatePath('/todos');
  return { ok: true, message: '已保存' };
}
```

真实项目更适合用 Zod 这类 schema validator，把类型转换、长度限制和业务规则集中在一起。`Object.fromEntries(formData)` 只是读起来方便，代替不了白名单校验。

## 6. 给用户反馈：`useActionState` 与 pending 状态

要显示服务端返回的错误或成功消息，就在 Client Component 里用 React 的 `useActionState`：

```tsx
'use client';

import { useActionState } from 'react';
import { createTodo } from './actions';

const initialState = { ok: false, message: '' };

export function TodoForm() {
  const [state, formAction, pending] = useActionState(createTodo, initialState);

  return (
    <form action={formAction}>
      <input name="title" required />
      <button type="submit" disabled={pending}>
        {pending ? '保存中...' : '创建'}
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  );
}
```

也可以在提交按钮组件里用 `useFormStatus`，把 pending 状态限制在表单内部。Action 放进单独的服务端模块，Client Component 只管交互状态，边界会更清楚。

## 7. 一套可迁移的判断表

| 需求 | 合适的能力 |
| --- | --- |
| 构建后无需服务器运行 | `output: 'export'` |
| 文档内容需要组件 | MDX |
| 浏览器提交表单并改数据库 | Server Action |
| 给表单返回校验结果 | `useActionState` |
| 提交期间禁用按钮 | `useFormStatus` |
| 固定资源 ID | `Function.prototype.bind` |
| 内容更新后刷新缓存 | `revalidatePath` 或 tag 失效 |

先看页面在运行时需要什么，再决定用静态导出、动态渲染还是 Server Action。选型要看数据的生命周期和安全边界，别看 API 名字。

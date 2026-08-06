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

静态导出解决的是“构建一次、部署静态文件”的问题，MDX 解决的是“内容和组件一起写”的问题，Server Actions 则把表单提交直接连接到服务端函数。三者适合不同边界，不能因为都能写页面就混为一谈。

## 1. 静态导出：把页面编译成文件

在 `next.config.ts` 中开启静态导出：

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

执行 `next build` 后，默认会生成 `out/` 目录。`out/` 可以直接交给 Nginx、对象存储、CDN 或其他静态服务器。`trailingSlash: true` 会让路由更容易映射到 `about/index.html` 这种静态目录结构；如果托管平台已经有自己的路由规则，也应按平台行为验证。

静态导出的取舍很明确：

| 适合 | 不适合 |
| --- | --- |
| 官网、文档、博客、帮助中心 | 依赖请求时 Cookie 的页面 |
| 构建时就能确定的数据 | 必须运行在 Node.js 上的 Route Handler |
| 低成本 CDN 分发 | 实时个性化内容和服务端交互 |
| 不需要服务器运行时的项目 | 依赖动态 API、数据库或身份状态的页面 |

静态页面中的客户端交互仍然可以运行，但交互逻辑必须在浏览器中完成；不能把服务端动态能力伪装成静态能力。

## 2. 动态路由必须在构建时枚举

动态路由需要通过 `generateStaticParams` 告诉构建过程需要生成哪些路径：

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

如果路径来自数据库或远程 CMS，`generateStaticParams` 必须在构建阶段能访问它。数据变更后不会自动刷新已经生成的 HTML，通常需要重新构建并重新部署。

`next/image` 的默认图片优化依赖 Next.js 服务端运行时，而纯静态导出没有这个运行时。可选方案是：

```ts
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

也可以使用原生 `<img>`，或配置自己的图片 loader。静态导出前必须检查图片、动态路由、重写和 API 依赖，避免本地构建成功、上线后页面却缺能力。

## 3. MDX：Markdown 中组合 React 组件

MDX 是 Markdown 和 JSX 的混合语法。它适合文章、文档和教程：正文保持 Markdown 的可读性，需要交互时再引入 React 组件。

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

`mdx-components.tsx` 可以为所有 MDX 文件提供统一的组件映射：

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

远程 Markdown 可以当作文本获取，交给受控的 Markdown/MDX 编译链处理。不要把不可信内容直接当成任意 React 代码执行；MDX 能调用组件和表达式，远程内容的作者、依赖和编译环境必须可信。文章系统如果只需要 Markdown，使用安全的 Markdown renderer 往往更简单。

## 4. Server Actions：表单直接调用服务端函数

一个最小的 Server Action：

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

表单字段必须有 `name`，否则不会出现在 `FormData` 中。服务端函数仍然必须做鉴权、校验和权限判断；`'use server'` 不是授权机制。

## 5. 固定参数用 `bind`，用户输入用校验

编辑某条记录时，固定的记录 ID 可以通过 `bind` 传入，而不是依赖一个可被用户修改的隐藏字段：

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

真实项目更适合使用 Zod 等 schema validator，将类型转换、长度限制和业务规则集中起来。`Object.fromEntries(formData)` 只是方便读取，不能替代白名单校验。

## 6. 给用户反馈：`useActionState` 与 pending 状态

需要显示服务端返回的错误或成功消息时，在 Client Component 中使用 React 的 `useActionState`：

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

也可以在提交按钮组件中使用 `useFormStatus`，把 pending 状态限制在表单内部。把 Action 放在独立的服务端模块中，Client Component 只负责交互状态，边界会更清楚。

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

先判断页面的运行时需求，再决定采用静态导出、动态渲染还是 Server Action。技术选型应该由数据生命周期和安全边界驱动，而不是由 API 名字驱动。

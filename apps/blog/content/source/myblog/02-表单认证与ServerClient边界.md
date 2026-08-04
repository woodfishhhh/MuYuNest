---
title: 表单认证与 Server Client 边界
date: 2026-08-04
updated: 2026-08-04
tags:
  - React Hook Form
  - Zod
  - Better Auth
  - Server Component
  - Client Component
source:
  - https://www.bilibili.com/video/BV14L9jBRE3e/
bvid: BV14L9jBRE3e
slug: nextjs16-auth-boundaries
categories:
  - 前端开发
  - Next.js
pages: P1 01:03-02:40
draft: false
---

# 表单认证与 Server Client 边界

## 1. 表单先定义数据契约

注册表单至少要同时解决三件事：输入状态、运行时校验、提交后的类型。只写 TypeScript 接口不够，因为浏览器发来的 JSON 和 `FormData` 在运行时没有类型保障。

用 Zod 把规则写成一个可以执行的 Schema：

```ts
// app/schemas/auth.ts
import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(30),
});

export type SignupInput = z.infer<typeof signupSchema>;
```

Schema 同时是校验规则和类型来源。改了字段名以后，`z.infer` 派生的类型会让表单提交代码一起暴露错误，不必维护一份容易漂移的手写接口。

## 2. React Hook Form 接住表单状态

安装表单库、Schema 库和两者之间的 resolver：

```bash
pnpm add react-hook-form zod @hookform/resolvers
```

`react-hook-form` 负责表单状态和提交时机，Zod 负责规则，`zodResolver` 负责把 Zod 接入 `useForm`：

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@/app/schemas/auth';

const form = useForm<SignupInput>({
  resolver: zodResolver(signupSchema),
  defaultValues: {
    name: '',
    email: '',
    password: '',
  },
});
```

`defaultValues` 不是装饰品。它让受控输入在首次渲染时就有稳定的值，避免输入框在 `undefined` 和字符串之间切换。

接入输入组件时，`Controller` 把 `value`、`onChange`、`onBlur` 等字段能力传给 UI：

```tsx
import { Controller } from 'react-hook-form';

<Controller
  name="email"
  control={form.control}
  render={({ field, fieldState }) => (
    <label>
      邮箱
      <input type="email" placeholder="you@example.com" {...field} />
      {fieldState.invalid && <p>{fieldState.error?.message}</p>}
    </label>
  )}
/>
```

这里的 `{...field}` 至少把当前值和变更处理器接入了输入框。文件输入是例外，后面会手动处理 `event.target.files?.[0]`，不能盲目把 `FileList` 当成普通字符串字段。

提交时只在校验成功后进入业务函数：

```tsx
const onSubmit = (data: SignupInput) => {
  // data 已经通过 signupSchema
  console.log(data.email);
};

<form onSubmit={form.handleSubmit(onSubmit)}>
  {/* Controller ... */}
  <button type="submit">注册</button>
</form>;
```

这条链路要记住：

```text
用户输入
  -> React Hook Form 收集字段
  -> zodResolver 执行 Schema
  -> 校验成功才调用 onSubmit
  -> onSubmit 调用认证客户端或 Server Action
```

## 3. Server Component 和 Client Component

App Router 中页面和布局默认是 Server Component。它们可以在服务器上取数据库数据、读取服务端环境变量、生成 HTML，并且不会因为静态展示而向浏览器发送一份组件 JavaScript。

需要下面这些能力时，才把文件或组件标成 Client Component：

- `useState`、`useEffect` 等 Hook。
- 点击、输入、提交等事件处理器。
- `window`、`localStorage` 等浏览器 API。
- 需要客户端订阅或实时更新的 Hook。

```tsx
// components/theme-toggle.tsx
'use client';

import { useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  return (
    <button
      type="button"
      onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
    >
      当前：{theme}
    </button>
  );
}
```

`'use client'` 的含义不是“组件完全不在服务器渲染”。首屏 HTML 仍然可以由服务器生成；它真正建立的是一条需要下载 JavaScript 并在浏览器中 hydration 的边界。Server Component 不需要这份交互 JavaScript，Client Component 在 hydration 后才接上事件和状态。

所以推荐这样拆：

```text
RootLayout (Server)
├─ Logo (Server)
├─ Link navigation (Server)
└─ ThemeToggle (Client)
```

一个带交互搜索框的导航栏，不等于整个根布局都必须是客户端组件。把搜索框、主题按钮和实时状态显示拆成小组件，既保留服务器渲染，也限制客户端包体积。

## 4. Better Auth 接入 Convex

课程选择 Better Auth 作为认证层，Convex 作为数据和函数层。集成时需要把几条边界接起来：

```text
浏览器 auth client
  -> Better Auth 登录 / 注册
  -> 会话 Cookie / JWT
  -> Convex Better Auth 组件
  -> Convex Query / Mutation 中读取当前用户
```

接入步骤按当时教程中的集成文档大致是：

1. 安装 Convex 的 Better Auth 集成组件和 `better-auth`。
2. 在 `convex/convex.config.ts` 注册 Better Auth 组件。
3. 在 `convex/auth.config.ts` 配置 `siteUrl`、应用 ID 和 Provider。
4. 在 `convex/auth.ts` 创建服务端 Better Auth 实例。
5. 在 `convex/http.ts` 挂载认证处理器。
6. 在 `app/api/auth/[...all]/route.ts` 把请求转发到 Convex。
7. 在客户端创建 `authClient`，调用 `signUp.email`、登录和退出。
8. 在根布局用 Convex Auth Provider 包住需要认证状态的客户端区域。

配置文件名可能会随集成包版本变化，原则不变：认证实例在服务器，登录按钮在客户端，Convex 的后端函数永远不能只相信前端页面已经隐藏了按钮。

客户端注册调用的形状类似：

```tsx
const result = await authClient.signUp.email({
  name: data.name,
  email: data.email,
  password: data.password,
});

if (result.error) {
  // 把服务端错误转成表单可读的提示
  return;
}
```

表单校验成功不代表注册成功。网络错误、邮箱已存在、密码策略和服务端配置都可能失败，提交按钮应该在请求期间进入 pending 状态，并在失败时保留可理解的错误。

## 5. 环境变量的两个边界

教程中特别强调了 Convex 的两个 URL：

```env
# 浏览器可以访问，用于 Convex 客户端
NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud

# 认证 HTTP 处理器使用的站点地址，通常是 .site
NEXT_PUBLIC_CONVEX_SITE_URL=https://example.convex.site
```

`NEXT_PUBLIC_` 前缀意味着变量可能进入浏览器包，因此不能把密钥放在这里。Better Auth secret、Convex deploy key、数据库凭据必须是服务端变量：

```env
BETTER_AUTH_SECRET=replace-with-a-real-secret
CONVEX_DEPLOY_KEY=replace-in-hosting-dashboard
```

只把真正需要暴露给客户端的地址放进 `NEXT_PUBLIC_`。变量名本身不是安全边界，构建工具会按前缀把值内联进客户端代码。

## 6. 认证页面的布局边界

登录、注册页往往不应该显示博客导航。用路由组和局部布局表达：

```text
app/
├─ (blog)/
│  ├─ layout.tsx        # Navbar + children
│  └─ blog/page.tsx
└─ auth/
   ├─ layout.tsx        # 居中表单卡片
   ├─ login/page.tsx
   └─ signup/page.tsx
```

不要在 `Navbar` 里根据路径不断增加隐藏条件。布局树本身就是权限和界面的分区。

## 7. 常见误区

### 把类型当成运行时校验

```ts
function createUser(input: SignupInput) {}
```

这只约束 TypeScript 调用者，不会验证来自网络的真实数据。边界处必须执行 `signupSchema.safeParse` 或由 resolver / 服务端 Schema 执行校验。

### 认证只做在按钮上

隐藏“创建文章”按钮只是体验优化，不是授权。真正创建文章的 Convex Mutation 和 Server Action 都必须重新检查当前会话。

### 把页面整棵树标成客户端

表单需要客户端交互，但博客列表、文章内容和静态布局不一定需要。越靠近叶子的 `'use client'`，越容易保留服务端渲染和较小的客户端包。

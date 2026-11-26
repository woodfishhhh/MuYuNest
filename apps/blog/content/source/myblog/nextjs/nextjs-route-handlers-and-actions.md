---
title: Next.js 16 接口与提交：Route Handler、Cookie 会话与 Server Actions
slug: nextjs-route-handlers-and-actions
date: 2026-08-06
categories:
  - 前端开发
tags:
  - Next.js 16
  - Route Handler
  - Server Actions
  - Cookie
  - SSG
---

在 Next.js 16 里把数据往服务端送有两条正道：**Route Handler（`route.ts`）** 和 **Server Actions（`'use server'`）**。新手最常犯的错要么是把所有表单提交也绕一大圈写 REST 接口再手写 `fetch`，要么反过来拿 Server Action 去接第三方 Webhook 回调。划清两者的协议边界，再把 Cookie 安全属性、静态导出限制与 MDX 接入理顺，前后端接口层就稳了。

## Route Handler vs Server Actions 怎么选

两套机制都在服务端安全执行，但面向的调用方和 HTTP 语义完全不同：

| 对比维度 | Route Handler（`route.ts`） | Server Actions（`'use server'`） |
| --- | --- | --- |
| 本质协议 | 标准 HTTP 端点（`GET` / `POST` / `PUT` / `DELETE`） | 框架托管的 RPC 式表单提交与变更动作 |
| 适用场景 | 第三方 Webhook、OAuth 回调、流式 AI、文件上传下载、对外开放 API | 应用内表单提交、按钮触发数据变更、联动缓存刷新 |
| 响应与缓存联动 | 显式控制状态码、Header、Cookie 与二进制流 | 内置配合 `revalidatePath` / tag 刷新并衔接 React `useActionState` |
| 渐进增强 | 依赖客户端 `fetch` 调用 | 原生 `<form action={fn}>` 在 JS 加载完成前也可工作 |

**对外暴露或需要明确 HTTP 方法、自定义状态码和流式输出的入口一律用 Route Handler；站内表单写入且希望顺带刷新页面缓存的数据变更优先用 Server Actions。**

## Route Handler 实战与 Cookie 会话安全

在 `src/app/api/` 下创建 `route.ts` 并导出大写的 HTTP 方法函数（导出小写或自定义名称框架不会识别）。读取查询参数直接用 `request.nextUrl.searchParams`，创建资源返回 `201`，缺参或校验失败返回 `400`/`422`，不要所有异常都敷衍一个 `200`。

**与页面路由一样，Next.js 16 动态 API 路由中的 `params` 也是 `Promise`，必须 `await params` 后再读取，不能沿用旧版的同步解构写法。**

```ts
// src/app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params
  const post = await getPostById(id)

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(post)
}
```

### Cookie 会话的正确写法

Cookie 只能存放短小且服务端可验证的会话标识（Session ID 或签名令牌），绝不能直接把密码、完整用户资料或未签名的权限字段明文塞进 Cookie。在 Next.js 16 中，`cookies()` 同样是异步函数，必须 `await cookies()`：

```ts
// src/app/api/session/route.ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const input = (await request.json()) as { email?: string; password?: string }
  const user = await verifyCredentials(input)

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const sessionToken = await createSession(user.id)
  const cookieStore = await cookies()
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
```

`httpOnly` 阻止客户端脚本读取 Cookie 窃取会话，`secure` 强制生产环境仅通过 HTTPS 传输，`sameSite: 'lax'` 拦截大部分跨站伪造请求。客户端即便通过 `/api/me` 拉取用户信息来切换导航显示，也只是用于 UI 展示——每个受保护页面与 API 入口仍必须在服务端独立校验会话与资源归属。

## Server Actions：参数绑定、校验鉴权与表单反馈

在独立模块顶部（或服务端组件函数体首行）声明 `'use server'` 即可把函数暴露给客户端表单调用。编写 Server Action 有三条铁律：

1. **表单输入控件必须带 `name` 属性**，否则不会进入提交的 `FormData`。
2. **记录 ID 等固定上下文通过 `action.bind(null, todo.id)` 传递**，不要放进 `<input type="hidden">` 让用户可以在浏览器里随意篡改。
3. **`'use server'` 本身不提供授权保护**——每一个 Server Action 本质上都是一个公开的 HTTP POST 端点，函数第一行必须像写后端接口一样校验当前用户会话、资源所有权与字段白名单（生产推荐 Zod Schema 校验）。

```ts
// app/todos/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createTodo(
  _prevState: { ok: boolean; message: string },
  formData: FormData,
) {
  const session = await requireSession()
  if (!session) {
    return { ok: false, message: '请先登录' }
  }

  const title = String(formData.get('title') ?? '').trim()
  if (!title || title.length > 120) {
    return { ok: false, message: '标题不能为空且不超过 120 字' }
  }

  await db.todo.create({ data: { title, userId: session.userId } })
  revalidatePath('/todos')
  return { ok: true, message: '已创建' }
}
```

客户端表单直接接入 React 19 的 `useActionState`，就能拿到提交返回的校验提示和自动管理的 `pending` 加载状态（需要把禁用状态单独抽到子按钮组件里时，可配合 `react-dom` 的 `useFormStatus`）：

```tsx
'use client'

import { useActionState } from 'react'
import { createTodo } from './actions'

const initialState = { ok: false, message: '' }

export function TodoForm() {
  const [state, formAction, pending] = useActionState(createTodo, initialState)

  return (
    <form action={formAction}>
      <label>
        标题
        <input name="title" required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? '保存中...' : '创建'}
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  )
}
```

## SSG 静态导出与 MDX 内容集成

如果项目是纯文档站、官网或博客，不需要服务端运行时，可以在 `next.config.ts` 开启静态导出（执行 `next build` 生成 `out/` 静态目录）：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
```

**开启 `output: 'export'` 后，App Router 中所有动态路由段必须导出 `generateStaticParams()` 在构建期枚举完整路径清单，且依赖 Node 运行时的 Route Handler、Server Actions、请求时 `cookies()` 以及默认的 `next/image` 图片服务端优化均不可用。**

若需要直接在文档里混写 Markdown 与交互式 React 组件，可以安装 `@next/mdx` 与 `@mdx-js/loader`，并在根目录配置 `mdx-components.tsx`（`useMDXComponents`）统一映射自定义标题、提示框与代码块样式。

需要划清安全边界的是 **MDX 的可执行性**：MDX 会把内容编译成真正的 React 组件与 JS 表达式，**绝对不要把不可信用户的输入或未经审查的远端内容直接丢进 MDX 运行**；纯文章系统如果不需在正文里嵌动态交互组件，使用纯 Markdown 渲染配合 HTML 消毒往往更安全轻量。

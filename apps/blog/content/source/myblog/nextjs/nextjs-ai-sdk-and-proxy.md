---
title: Next.js 16 集成 AI SDK 流式对话与 Proxy 网关拦截
slug: nextjs-ai-sdk-and-proxy
date: 2026-08-06
categories:
  - 前端开发
tags:
  - Next.js 16
  - AI SDK
  - Streaming
  - Proxy
  - Hydration
---

在 Next.js 里接大模型对话应用，最关键的架构边界是把模型鉴权与配额控制牢牢锁在服务端，同时让生成的文本流式增量推送到前端客户端组件中，而不把整个应用树拖成重度客户端渲染（CSR）。Next.js 16 的 Route Handler、Vercel AI SDK 以及更名后的 `proxy.ts` 网关层，正好分别守住这条链路的三道关口。

## 服务端 AI Proxy 与 Vercel AI SDK 流式输出

**模型 API Key（如 `DEEPSEEK_API_KEY`）绝对不允许加 `NEXT_PUBLIC_` 前缀，也不能在浏览器端直接发请求给模型供应商；所有模型调用必须经由服务端 Route Handler 代理转发。**

安装核心包与模型适配器后（`pnpm add ai @ai-sdk/openai @ai-sdk/react`），先在带有 `import 'server-only'` 保护的服务端模块初始化 Provider（借助 `server-only` 保证客户端误导入时在构建期直接报错阻断）：

```ts
// src/lib/ai.ts
import 'server-only'
import { createOpenAI } from '@ai-sdk/openai'

export const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})
```

接着在 `src/app/api/chat/route.ts` 创建流式对话接口。用 `convertToModelMessages` 把前端 UI 消息转换成模型输入格式，再通过 `streamText` 返回标准的 UI 消息流响应：

```ts
// src/app/api/chat/route.ts
import { convertToModelMessages, streamText } from 'ai'
import { deepseek } from '@/lib/ai'

export async function POST(request: Request) {
  const { messages } = await request.json()

  // 生产环境在此补充会话鉴权、消息条数/单条长度限制与速率限制
  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: '你是一个简洁、可靠的 Next.js 技术助手。',
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
```

### 客户端消费流式消息与自动滚动

客户端组件使用 `@ai-sdk/react` 提供的 `useChat()` 默认向 `/api/chat` 发起流式对话。渲染消息时，按 `message.parts` 里的 `part.type` 分支展示（后续扩展工具调用或图片附件时无需重构结构）；列表自动滚底只需在消息列表底部放一个空占位节点调用 `scrollIntoView({ behavior: 'smooth' })`，比频繁手改 `scrollTop` 更不容易和流式重渲染打架：

```tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'

export function Chat() {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, status } = useChat()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <section>
      <div>
        {messages.map((message) => (
          <div key={message.id} data-role={message.role}>
            {message.parts.map((part, index) =>
              part.type === 'text' ? <p key={index}>{part.text}</p> : null,
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!input.trim()) return
          void sendMessage({ text: input })
          setInput('')
        }}
      >
        <input value={input} onChange={(e) => setInput(e.currentTarget.value)} />
        <button type="submit" disabled={status === 'streaming'}>
          发送
        </button>
      </form>
    </section>
  )
}
```

## Next.js 16 `proxy.ts` 网关拦截边界

**Next.js 16 将沿用多年的请求拦截入口 `middleware.ts` 正式更名为 `proxy.ts`（导出函数名同步改为 `proxy`），明确其“轻量网络边界代理”的定位，而不是全能后端鉴权层。**

```ts
// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
```

`proxy.ts` 适合做以下四件事：

1. 按 `matcher` 拦截特定路径执行快速入口分流（如 i18n 语言重定向或 A/B 测试分桶）。
2. 为接口响应统一补充 CORS 或安全响应头。
3. 将遗留路径（如 `/api/legacy/*`）透明改写转发到另一个后端服务。
4. 基于 Cookie 存在性做第一道未登录快速跳转门禁。

**切勿在 `proxy.ts` 里做复杂的数据库查表鉴权：Cookie 存在并不代表会话合法，更不代表用户有权访问某个资源，真正的会话有效性检验和资源级权限控制必须下沉到 Route Handler、Server Action 或服务端数据查询函数内部。**

## CSR / SSR / SSG 对比与 Hydration 不一致排查

梳理清楚不同渲染模式的生成时机，能省掉大量“为什么本地没报错、上线就 Hydration mismatch”的排查时间：

| 渲染模式 | HTML 生成位置 | 首屏直出速度 | SEO 表现 | 典型适用场景 |
| --- | --- | --- | --- | --- |
| CSR | 浏览器 JS 运行后 | 较慢 | 较弱 | 强交互后台管理系统 |
| SSR | 每次请求时在服务器生成 | 较快 | 好 | 电商商品页、个性化动态信息流 |
| SSG | 构建阶段提前生成 | 极快 | 好 | 营销页、技术博客、文档站 |

服务端渲染（SSR / RSC）先把完整 HTML 发给浏览器展示首屏内容，随后浏览器下载客户端 JS Bundle，对照服务端 DOM 结构绑上事件监听器，这个过程称为 **Hydration（水合）**。页面已经能看到按钮但前几百毫秒暂时点不动，正是 JS 正在完成 Hydration 的正常过程。

### 常见 Hydration Mismatch 根因与修复

Hydration 报错的核心原因只有一个：**服务端首次渲染产出的 HTML 文本或属性，和浏览器端第一次执行组件算出来的结果对不上。** 高发雷区包括：

- 在组件渲染体直接读取 `Date.now()`、`new Date().toLocaleString()` 或 `Math.random()`，服务端与客户端时区/时间不同步。
- 渲染分支依赖 `typeof window !== 'undefined'`、`window.innerWidth` 或 `localStorage`，导致服务端吐出空标签、客户端首帧立刻切出另一套 DOM。
- 非法 HTML 嵌套（如 `<p>` 里面套 `<div>` 或 `<a>` 里面套 `<a>`），浏览器解析 HTML 时自动纠正了 DOM 树结构，导致 React 客户端水合节点错位。

修复方式很简单：保持服务端和客户端首帧渲染输出完全一致；确实依赖浏览器环境变量的局部 UI，放到 `useEffect` 挂载后再切换状态更新（或利用 `useSyncExternalStore` 提供明确的 `getServerSnapshot`）。

最后，由于 RSC 序列化协议与 Server Actions 直接跨越网络与服务端执行边界，一旦框架发布高危安全公告，必须第一时间升级 `next`、`react`、`react-dom` 并跑通 `pnpm audit` 与全量 `pnpm build` 及认证回归测试，不要拖延依赖安全补丁。

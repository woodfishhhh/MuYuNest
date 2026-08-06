---
title: Next.js 16 AI SDK、Proxy 与渲染模式
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - AI SDK
  - Streaming
  - Proxy
  - RSC
  - SSR
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P9-P13
slug: nextjs16-ai-proxy-rendering
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 AI SDK、Proxy 与渲染模式

AI 聊天页的难点不在于调用一次模型，而在于把密钥留在服务器、把回复流式传回浏览器、保存上下文，并且不让一个小交互把整个页面拖进客户端。Proxy、RSC 和三种渲染模式解决的是同一条链路上的不同问题。

## 1. AI 请求必须停在服务器

安装 Vercel AI SDK 和模型适配器：

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/react
```

如果使用 DeepSeek 等 OpenAI 兼容服务，只需要替换 provider 和 base URL：

```ts
// src/lib/ai.ts
import { createOpenAI } from '@ai-sdk/openai';

export const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});
```

`DEEPSEEK_API_KEY` 只能在服务器模块读取。不能把它写进 `NEXT_PUBLIC_*`，也不能从客户端直接请求模型供应商。

## 2. Route Handler 返回流

把 AI 入口放在约定目录后，`useChat` 可以使用默认 API 路径：

```text
src/app/api/chat/route.ts
```

```ts
// src/app/api/chat/route.ts
import { convertToModelMessages, streamText } from 'ai';
import { deepseek } from '@/lib/ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: '你是一个简洁、可靠的 Next.js 助手。',
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

这里有三个边界：

1. `request.json()` 读取客户端上下文。
2. `convertToModelMessages` 把 UI 消息转换成模型需要的消息格式。
3. `streamText` 生成增量结果，响应使用流式格式而不是等待完整字符串。

不要把客户端提交的消息无限制地直接转发给模型。生产代码还应限制消息数量和单条长度，校验 role/content，设置超时、错误响应和用量上限。

## 3. 客户端消费上下文

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';

export function Chat() {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status } = useChat();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          event.preventDefault();
          if (!input.trim()) return;
          void sendMessage({ text: input });
          setInput('');
        }}
      >
        <input value={input} onChange={(event) => setInput(event.target.value)} />
        <button disabled={status === 'streaming'}>发送</button>
      </form>
    </section>
  );
}
```

消息结构包含 `role`、`id` 和 `parts`。不要假定所有 part 都是文本，未来加入图片、工具调用或文件时要按 `part.type` 分支。底部空节点配合 `scrollIntoView` 是简单可靠的自动滚动边界，比不断修改 `scrollTop` 更不容易和流式渲染打架。

## 4. Proxy：拦截、转发和快速门禁

Next.js 16 把原来的 Middleware 文件名改成了 `proxy.ts`，功能没有因此变成新的鉴权系统：

```ts
// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

Proxy 可以做：

- 根据 matcher 只拦截需要的路径。
- 添加 CORS 响应头。
- 把 `/api/legacy` 转发给另一个后端。
- 根据 Header、Cookie、Query 做简单匹配。
- 做限流或登录态的快速门禁。

但 Cookie 存在不等于会话有效，Proxy 也不应该承担复杂的数据库权限查询。真正的资源授权仍需要在 Route Handler、Server Action 或服务端数据函数中完成。

## 5. CSR、SSR、SSG 和 hydration

| 模式 | HTML 主要在哪里生成 | 首屏 | SEO | 适合场景 |
| --- | --- | --- | --- | --- |
| CSR | 浏览器 | 较慢 | 较弱 | 后台和强交互应用 |
| SSR | 每次请求的服务器 | 较快 | 好 | 电商、动态博客 |
| SSG | 构建阶段 | 很快 | 好 | 文档、营销页、稳定内容 |

SSR 返回 HTML 后，浏览器还要下载 JavaScript，对比服务端生成的结构并绑定事件，这一步叫 hydration。HTML 先出现但按钮暂时不能点击，是正常的 hydration 过程，不是页面没有渲染。

RSC 在 SSR 上进一步拆分：

- Server Component 默认在服务器执行，可以读取数据库和私有模块，不进入客户端 bundle。
- Client Component 用 `'use client'` 标记，需要状态、事件或浏览器 API 时才使用。
- 服务端组件可以包住客户端组件，客户端组件不能直接在内部 import 服务器组件。

```tsx
// Server Component
import { LikeButton } from './LikeButton';

export default async function Article() {
  const article = await loadArticle();
  return (
    <article>
      <h1>{article.title}</h1>
      <LikeButton articleId={article.id} />
    </article>
  );
}
```

如果一个模块只能被服务器使用，安装并声明 `server-only`：

```ts
// src/lib/private-db.ts
import 'server-only';

export async function loadPrivateData() {
  return db.secretTable.findMany();
}
```

这样当客户端模块误导入它时，构建阶段就会失败，而不是把私有实现悄悄打进浏览器。

## 6. RSC 漏洞和升级纪律

RSC、Server Actions 和相关解析器属于高权限边界。发现框架安全公告后，不要只改一个依赖字符串就结束：

```bash
pnpm update next react react-dom
pnpm audit
pnpm build
```

升级后至少检查：生产构建、Route Handler、Server Action、登录回调和缓存行为。课程演示了受影响版本升级到修复版本的过程，但具体安全版本会变化，生产项目必须以当前官方公告和锁文件为准。

---
title: Next.js 16 Route Handler 与 Cookie 会话
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - Route Handler
  - HTTP
  - Cookie
  - Session
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P7-P8
slug: nextjs16-route-handlers-cookies
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 Route Handler 与 Cookie 会话

Route Handler 是 App Router 中的后端入口。它适合处理 Webhook、上传、登录、第三方回调和需要明确 HTTP 方法的接口。页面跳转解决不了这些问题，必须把请求解析、响应状态、Cookie 属性和服务端鉴权写在同一条边界上。

## 1. 最小 Route Handler

文件名固定为 `route.ts`，路径直接映射 URL：

```text
src/app/api/health/route.ts  ->  GET /api/health
```

```ts
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, service: 'web' });
}
```

可以直接返回 Web 标准 `Response`，需要 JSON、重定向或设置 Cookie 时使用 `NextResponse` 更方便。

## 2. 查询参数、JSON 和状态码

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const name = request.nextUrl.searchParams.get('name');

  if (!id) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 },
    );
  }

  return NextResponse.json({ id, name });
}

export async function POST(request: Request) {
  const body = await request.json() as { title?: string };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: 'title is required' },
      { status: 422 },
    );
  }

  const created = await createRecord({ title: body.title });
  return NextResponse.json(created, { status: 201 });
}
```

几个容易忽略的点：

- 查询参数从 `request.nextUrl.searchParams` 读取，不要手写字符串切割。
- `request.json()` 是异步操作，只能消费一次请求体。
- 创建资源使用 `201`，参数缺失用 `400` 或 `422`，不要所有失败都返回 `200`。
- `POST` 的请求头必须有 `Content-Type: application/json`。

同一个文件可以导出 `GET`、`POST`、`PUT`、`PATCH`、`DELETE` 等方法。方法名必须是大写导出函数，不能导出一个自定义名称期待框架自动识别。

## 3. 动态 API 路由

```text
src/app/api/posts/[id]/route.ts  ->  /api/posts/123
```

```ts
import { NextResponse } from 'next/server';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const post = await getPostById(id);

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(post);
}
```

Next.js 16 的动态 `params` 需要 `await`。这和页面动态路由一致；不能把旧版本的同步写法复制到新项目里。

## 4. Cookie 的正确用途

Cookie 适合保存一个短小的、可校验的会话标识，不适合直接保存密码、完整用户对象或未经保护的权限信息。Route Handler 中读写 Cookie：

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const input = await request.json() as {
    email?: string;
    password?: string;
  };
  const user = await verifyCredentials(input);

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const sessionToken = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return NextResponse.json({ ok: true });
}
```

读取登录态：

```ts
export async function GET() {
  const token = (await cookies()).get('session')?.value;
  const user = token ? await getSessionUser(token) : null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ user });
}
```

`httpOnly` 防止客户端 JavaScript 直接读取会话 Cookie，`secure` 保证生产环境只走 HTTPS，`sameSite` 降低跨站请求伪造风险。真正的 session 还要服务端存储或签名校验；把固定字符串写入 Cookie 只能演示 API 链路，不能作为生产认证方案。

## 5. 前端检查登录态

客户端可以请求 `/api/me` 来更新界面，但不能把客户端状态当成授权结论：

```tsx
'use client';

import { useEffect, useState } from 'react';

export function SessionGate() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setUser(data?.user ?? null));
  }, []);

  return user ? <span>{user.email}</span> : <a href="/login">登录</a>;
}
```

页面和 API 都必须独立检查会话。否则用户可以绕过页面按钮，直接调用接口。

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

Route Handler 是 App Router 里的后端入口，适合做 Webhook、上传、登录、第三方回调，以及需要明确 HTTP 方法的接口。这些事页面跳转办不了，请求解析、响应状态、Cookie 属性和服务端鉴权得在同一个地方写清楚。

## 1. 最小 Route Handler

文件名固定是 `route.ts`，路径直接映射成 URL：

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

可以直接返回 Web 标准的 `Response`；要返回 JSON、重定向或设置 Cookie 时，用 `NextResponse` 更方便。

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

几个容易漏的点：

- 查询参数从 `request.nextUrl.searchParams` 读，别手动切字符串。
- `request.json()` 是异步的，请求体只能读一次。
- 创建资源用 `201`，缺参数用 `400` 或 `422`，别所有失败都返回 `200`。
- `POST` 的请求头要带 `Content-Type: application/json`。

一个文件可以导出 `GET`、`POST`、`PUT`、`PATCH`、`DELETE` 等方法。方法名必须是大写的导出函数，导出个自定义名字，框架是不会自动识别的。

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

Next.js 16 的动态 `params` 要 `await`，和页面的动态路由一样；旧版本的同步写法别照搬到新项目里。

## 4. Cookie 的正确用途

Cookie 适合存一个短小、能校验的会话标识，不适合直接存密码、完整的用户对象或者没有保护的权限信息。在 Route Handler 里读写 Cookie：

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

`httpOnly` 让客户端 JavaScript 读不到会话 Cookie，`secure` 保证生产环境只走 HTTPS，`sameSite` 降低跨站请求伪造的风险。真正的 session 还需要服务端存储或签名校验；往 Cookie 里写个固定字符串只能演示 API 链路，不能当生产环境的认证方案。

## 5. 前端检查登录态

客户端可以请求 `/api/me` 来更新界面，但客户端的状态不能当成授权结论：

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

页面和 API 都要各自检查会话，不然用户可以绕开页面按钮，直接调接口。

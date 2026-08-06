---
title: Next.js 16 Prisma、Better Auth 与 Vercel
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - Prisma
  - Better Auth
  - PostgreSQL
  - Vercel
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P34-P36
slug: nextjs16-prisma-better-auth-vercel
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 Prisma、Better Auth 与 Vercel

数据库、身份验证和部署是一个完整应用的闭环：Prisma 负责把 schema 变成可使用的数据库客户端，Better Auth 负责会话和登录流程，Vercel 负责把应用、环境变量和生产数据库连接起来。每个环节都必须区分开发配置和生产配置。

## 1. Prisma 的职责

Prisma 常见工作流：

1. 在 `prisma/schema.prisma` 中描述数据模型。
2. 使用迁移命令把模型变化同步到数据库。
3. 生成类型安全的 Prisma Client。
4. 在服务端模块中通过 Client 读写数据。

初始化和安装版本应以当前项目的 Prisma 文档为准：

```bash
npm install prisma @prisma/client
npx prisma init
```

典型 schema：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id        String   @id @default(cuid())
  title     String
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}
```

`DATABASE_URL` 放在 `.env` 或部署平台环境变量中。使用 Prisma 7 时，具体生成器、配置文件和 adapter API 可能随版本变化，不能把课程中的版本号当作今天项目的永恒接口；以项目实际安装版本的迁移结果和官方文档为准。

```bash
npx prisma migrate dev --name init
npx prisma generate
```

开发迁移用于建立和演进本地数据库；生产环境要使用经过审查的迁移链，不要把 `migrate dev` 当成生产部署命令。

## 2. 在 Next.js 中复用 Prisma Client

开发环境的热更新会反复执行模块代码，如果每次都创建一个新的 Client，可能耗尽数据库连接。用全局变量保存开发实例：

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

查询只能在服务端模块或服务端函数中执行：

```ts
import 'server-only';
import { prisma } from '@/src/lib/prisma';

export async function getPublishedPosts() {
  return prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true } } },
  });
}
```

不要把 Prisma Client、数据库 URL 或查询结果中不必要的字段传给 Client Component。服务端边界既是性能边界，也是秘密和权限边界。

## 3. Better Auth：把登录流程放在服务端

安装 Better Auth 及其 Prisma adapter。实际包名和 adapter API 要锁定在项目使用的版本：

```bash
npm install better-auth @better-auth/prisma-adapter
```

一个常见的配置骨架：

```ts
// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
```

认证配置使用服务端环境变量：

```dotenv
BETTER_AUTH_SECRET="a-long-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
DATABASE_URL="postgresql://..."
```

生产环境要为每个部署环境生成合适的随机 secret，不能提交到仓库，也不能使用用户可控的短字符串。`BETTER_AUTH_URL` 必须和部署后的站点 URL 一致，否则回调和 Cookie 域可能出现问题。

## 4. 暴露认证 Route Handler

Better Auth 的请求处理器可以挂到 catch-all 路由：

```ts
// app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/src/lib/auth';

export const { GET, POST } = toNextJsHandler(auth);
```

这类 Route Handler 只是 HTTP 入口，不是权限判断的替代品。业务页面和写操作仍然要读取当前 session，并对资源归属进行检查：

```ts
const session = await auth.api.getSession({ headers: await headers() });

if (!session) {
  redirect('/login');
}
```

在服务端获取 session 时要使用当前请求 headers。客户端 session hook 适合更新导航和交互状态，不能作为服务端数据访问的唯一授权依据。

## 5. 登录和注册交互

客户端可以调用 Better Auth 生成的 client：

```ts
'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
```

```tsx
'use client';

import { authClient } from '@/src/lib/auth-client';

export function LoginForm() {
  async function submit(formData: FormData) {
    const result = await authClient.signIn.email({
      email: String(formData.get('email')),
      password: String(formData.get('password')),
    });

    if (result.error) {
      // 显示通用错误，不泄露账户是否存在
      console.error(result.error);
    }
  }

  return (
    <form action={submit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">登录</button>
    </form>
  );
}
```

生产登录流程至少要考虑密码策略、速率限制、CSRF/Origin 校验、会话过期、退出登录、密码重置、邮箱验证和错误信息的枚举风险。演示用的固定账号、明文密码和前端硬编码密钥不能直接上线。

## 6. OAuth 回调必须与部署地址一致

启用 GitHub 等社交登录时，需要在供应商后台配置精确的回调 URL，并把 client ID、client secret 放在环境变量中：

```ts
export const auth = betterAuth({
  // ...
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

本地、预览和生产域名通常不同，三套回调配置不要混用。部署后出现“登录后跳回错误地址”，优先检查 `BETTER_AUTH_URL`、OAuth provider callback、Cookie 的 `secure` 属性和代理转发的协议头。

## 7. Vercel 部署的配置顺序

一个可复现的部署流程：

1. 将项目连接到 Git 仓库，确认构建分支和 Node.js 版本。
2. 在 Vercel 为 Development、Preview、Production 分别填写环境变量。
3. 配置生产 `DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、OAuth 密钥和必要的公开变量。
4. 在构建阶段生成 Prisma Client，并在部署流程中执行经过审核的生产迁移。
5. 部署后检查公开页面、数据库读写、登录、退出、OAuth 回调和静态资源。

构建脚本可以集中管理：

```json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}
```

数据库迁移通常由独立的 release job 执行，而不是让每个应用实例启动时竞争迁移锁。若必须在部署命令中执行，也要保证迁移是幂等的、可审查的，并且生产数据库备份和回滚方案已经准备好。

## 8. Vercel CLI 与自建部署的区别

CLI 可以用于预览和发布：

```bash
vercel env pull .env.local
vercel build
vercel deploy --prebuilt
```

这些命令不等于所有项目都应该采用的生产流程。Vercel 的托管运行时、环境变量和域名配置是一套体系；`output: 'standalone'` 更适合自建 Node.js 容器，两者不要混成同一部署假设。静态导出则是另一条路线，不能依赖 Vercel 的服务端能力。

部署后的验收清单：

- 页面能在无登录状态下正常访问。
- 受保护页面在服务端拒绝未授权请求。
- 注册、登录、退出和 session 刷新都能完成。
- 数据库迁移版本与生产 schema 一致。
- `NEXT_PUBLIC_` 变量中没有秘密。
- 图片远程域名、字体、favicon 和 Open Graph 资源可访问。
- Preview 和 Production 使用正确的域名、数据库与认证回调。
- 失败部署不会留下半完成迁移或错误的 Cookie 域。

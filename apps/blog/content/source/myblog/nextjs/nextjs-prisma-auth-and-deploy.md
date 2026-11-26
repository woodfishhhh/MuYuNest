---
title: Next.js 16 全栈落地：Prisma ORM、Better Auth 与 Vercel 部署
slug: nextjs-prisma-auth-and-deploy
date: 2026-08-06
categories:
  - 前端开发
tags:
  - Next.js 16
  - Prisma
  - Better Auth
  - PostgreSQL
  - Vercel
---

把全栈应用真正推向生产，最后一段路卡在数据库、认证会话和平台部署的联动上：开发环境下热更新反复新建 Prisma Client 把本地连接池打爆、Better Auth 上线后回调域名跳回 `localhost`、或者部署阶段多实例并发启动抢着执行数据库迁移锁死数据库。把持久化单例、服务端鉴权入口和 Vercel / 容器两套发布路径分开配置清楚，全栈应用才算真正落地。

## Prisma Schema、迁移纪律与开发环境单例

Prisma 的标准工作流包含四步：在 `prisma/schema.prisma` 定义模型 -> 执行迁移同步表结构 -> 生成类型安全的 Client -> 在 `server-only` 模块内执行查询。

```prisma
// prisma/schema.prisma
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

本地开发用 `npx prisma migrate dev --name init` 生成迁移文件并同步本地库，但**生产部署严禁运行 `migrate dev`**——生产发布只能跑不可交互、严格按版本历史重放的 `npx prisma migrate deploy`（配合提前备份与向后兼容的 Schema 变更）。

### 解决 Next.js 开发热更新连接池耗尽

在 `next dev` 模式下，每次保存代码触发模块热重载（HMR）都会重新执行模块顶层代码。如果直接 `export const prisma = new PrismaClient()`，改几十次代码就会在内存里挂出几十个连接池，很快把 PostgreSQL 的 `max_connections` 占满。必须将实例缓存到全局 `globalThis`：

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

所有数据库查询统一收拢到带 `import 'server-only'` 的服务端数据访问层，且返回给前端或 Client Component 时必须显式使用 `select` 裁剪字段（绝不能把 `passwordHash`、内部审计字段或 Prisma 实例本身泄露到客户端）。

## Better Auth 服务端认证与 Route Handler 集成

Better Auth 将用户表、会话管理、邮箱密码和 OAuth 登录整合进应用内部，搭配 Prisma Adapter 即可把认证状态直接落进自己的 PostgreSQL 数据库：

```ts
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
})
```

接着在 App Router 挂载 catch-all Route Handler 暴露全部认证端点（`/api/auth/*`）：

```ts
// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth)
```

客户端登录组件使用 `createAuthClient` 发起请求，并在提示层坚持**通用错误文案**（例如统一提示“邮箱或密码错误”），不要向未认证客户端暴露“该邮箱尚未注册”，防止被恶意脚本撞库枚举账号：

```tsx
'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})

export function LoginForm() {
  async function submit(formData: FormData) {
    const result = await authClient.signIn.email({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    })
    if (result.error) {
      // 展示通用登录失败提示，避免泄露账户是否存在
      console.error(result.error.message)
    }
  }

  return (
    <form action={submit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">登录</button>
    </form>
  )
}
```

**服务端页面和 Server Actions 获取当前用户会话时，必须显式传入当前请求的 `await headers()` 调用 `auth.api.getSession({ headers: await headers() })`；客户端的 Session Hook 仅能用来刷新导航栏头像，绝不能充当数据接口的授权依据。**

```ts
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')
  return session
}
```

### 生产环境的 OAuth 回调与密钥红线

开发、预览（Preview）和生产（Production）三个环境拥有各自独立的域名与数据库：

- 每个环境必须配置独立的高强度随机 `BETTER_AUTH_SECRET`，绝不可硬编码提交进仓库。
- `BETTER_AUTH_URL` 以及 GitHub/Google OAuth 后台填写的 Callback URL 必须与当前部署环境的真实公网域名和协议（HTTPS）严格对齐。上线后若遇到“第三方登录完跳回 `localhost` 或 Cookie 写入失效”，第一反应就去查 `BETTER_AUTH_URL`、OAuth 回调地址、Cookie 的 `secure` 标志以及反向代理转发的 `X-Forwarded-Proto`。

## Vercel 发布流程与部署模式对比

接入 Vercel 托管发布时，按稳定顺序打通部署流水线：

1. 关联 Git 仓库并锁定 Node.js 版本（`>= 20.9`）。
2. 在平台控制台为 **Development、Preview、Production** 三套环境分别配置独立的 `DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL` 和 OAuth Client 凭据（防止 Preview 分支测试数据写坏生产库）。
3. 将构建脚本设为 `"build": "prisma generate && next build"`，确保每次构建都产出与当前 Schema 匹配的 Prisma Client。
4. **数据库迁移应放在独立的 CI / Release Job（`npx prisma migrate deploy`）中单次执行，绝不要放到容器启动命令或业务代码里，以免多实例并发启动抢夺迁移锁引发故障。**

### 不同部署路线的边界区分

| 部署方案 | 适用前提 | 注意事项 |
| --- | --- | --- |
| Vercel 托管（或 `vercel deploy --prebuilt`） | 原生使用全部 SSR、RSC、Cache Components 与 Server Actions | 关注函数冷启动与数据库连接池代理（如 Accelerate / PgBouncer） |
| 自建容器（`output: 'standalone'`） | 自管 VPS、Kubernetes 与本地 Node 进程 | 需自行配置 Nginx HTTPS 代理、进程守护与静态资源缓存 |
| 纯静态导出（`output: 'export'`） | 无后端运行时的 CDN 静态托管 | 无法使用 Prisma 查询、Route Handler 与 Better Auth 服务端接口 |

### 上线前验收清单

- 未登录用户可正常浏览公开页面，受保护页面与 API 在服务端严格拦截未授权请求（返回 401/403 或重定向登录）。
- 注册、登录、登出、会话刷新与 OAuth 回调在生产域名下全部走通，无混用 Preview/Local 回调地址。
- 生产数据库 Schema 与仓库最新迁移版本一致，无手改表结构漂移。
- `NEXT_PUBLIC_*` 变量中不含任何私钥，远程图片域名、自定义字体与 Open Graph 分享图在公网正常加载。

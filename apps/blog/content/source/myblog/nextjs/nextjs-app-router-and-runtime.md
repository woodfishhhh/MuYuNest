---
title: Next.js 16 工程结构、App Router 与服务端组件边界
slug: nextjs-app-router-and-runtime
aliases:
  - nextjs16-ai-seo
  - nextjs16-project-runtime
  - nextjs16-app-router
date: 2026-08-06
categories:
  - 前端开发
tags:
  - Next.js 16
  - App Router
  - Turbopack
  - Server Components
  - 路由系统
---

刚上手 Next.js 16 App Router 时，最容易在运行边界上栽跟头：在默认的服务端组件里直接写 `useState` 报编译错、把根布局标成 `'use client'` 拖垮整页包体积，或者忽略 Next.js 16 里 `params` 已经变成异步 Promise 的改动。先把工程骨架、文件路由约定与 Server/Client 序列化边界立清楚，后面的接口、缓存和鉴权才有安放的位置。

## 脚手架初始化与工具链分工

Next.js 16 要求 Node.js 至少 `20.9`。团队初始化项目时，建议把关键参数直接写进命令里固化下来，避免多人各自交互勾选出不同目录结构：

```bash
pnpm create next-app@latest next-ai-seo \
  --ts \
  --eslint \
  --tailwind \
  --src-dir \
  --app \
  --turbopack \
  --import-alias "@/*"

cd next-ai-seo
pnpm dev
```

有两个容易混淆的编译概念需要先拆开：**Turbopack 负责开发服务器和模块打包构建，React Compiler 负责在编译期自动给组件注入缓存优化，二者职责完全正交，开启其中一个并不会替代另一个。**

工程目录里，`public/` 与 `src/` 的处理链路也截然不同：放在 `public/logo.svg` 的文件会原样拷贝到静态根目录，直接用 `/logo.svg` 访问；放在 `src/` 下的代码与媒体资源会进入构建依赖图，按需打包并生成带哈希的文件名，切忌把所有业务图片和私有配置都丢进 `public/`。

运行脚本方面，`pnpm dev`（`next dev --turbopack`）用于本地热更新；`pnpm build`（`next build`）提前暴露类型、动态路由与服务端边界错误；`pnpm start`（`next start`）只负责启动已经构建好的 `.next/` 产物，部署前必须先执行构建。

## Server vs Client Components 序列化边界

App Router 目录下所有组件**默认都是 Server Component（服务端组件）**。它们只在服务器运行，可以直接查数据库、调用私有 SDK、读取服务端环境变量，且组件本身的依赖代码（如庞大的 Markdown 解析库或 ORM）不会进入浏览器 JS Bundle。

只有当界面需要 `useState`、`useEffect`、事件回调（`onClick`/`onChange`）或浏览器宿主 API 时，才在文件首行加上 `'use client'` 指令声明为客户端组件。

**边界控制的第一原则是把 `'use client'` 下推到最小交互叶子节点，绝不要因为页面右上角有一个点赞按钮，就把整棵页面或 `RootLayout` 标成客户端组件。**

```tsx
// Server Component（默认）：直接读取服务端数据，零客户端打包开销
import { LikeButton } from './LikeButton'

export default async function ArticlePage() {
  const article = await loadArticle()
  return (
    <article>
      <h1>{article.title}</h1>
      {/* 仅把必须交互的按钮拆成 Client Component 叶子节点 */}
      <LikeButton articleId={article.id} />
    </article>
  )
}
```

跨边界传递 Props 时，必须遵守**可序列化约束**：从 Server Component 传给 Client Component 的属性只能是字符串、数字、布尔值、纯对象、数组或 Promise 等可序列化数据，不能直接传递类实例、数据库对象或普通事件函数（服务端向客户端传递可执行动作需要用 Server Action）。

同时记住嵌套方向：**服务端组件可以直接导入并包裹客户端组件，也可以通过 `children` 插槽把另一个服务端组件传进客户端包装容器里；但客户端组件内部绝不能直接 `import` 服务端组件**——一旦这样写，被导入的组件会被强制拉入客户端编译链，遇到服务端私有模块就会直接报错。

## 文件系统约定：`layout`、`template`、`loading` 与 `error`

App Router 通过固定文件名自动组装页面的外层布局、加载骨架和错误兜底：

```text
src/app/
├─ layout.tsx       # 根布局，必须渲染 <html> 与 <body>
├─ page.tsx         # 路由 /（没有 page.tsx 的文件夹无法被访问）
├─ loading.tsx      # 自动套在 page 外层的 React Suspense fallback
├─ error.tsx        # 自动套在 page 外层的错误边界（必须是 'use client'）
├─ not-found.tsx    # 全局或局部 404 UI
└─ docs/
   ├─ template.tsx  # 每次切入子路由都会重新挂载的模板外壳
   └─ page.tsx      # 路由 /docs
```

### `layout.tsx` 与 `template.tsx` 怎么选

| 文件约定 | 切换同级子路由时 | 组件状态 | `useEffect` 行为 |
| --- | --- | --- | --- |
| `layout.tsx` | 保持实例挂载不卸载 | 完整保留 | 仅首次进入布局时执行 |
| `template.tsx` | 销毁旧实例并重新挂载 | 彻底重置 | 每次切入子路由都重新触发 |

导航栏、全局 Provider、侧边栏滚动位置放进 `layout.tsx`；每次进入页面都需要重置表单、重播入场动画或上报页面曝光埋点的，放在 `template.tsx`。

```tsx
// src/app/about/error.tsx
'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section role="alert">
      <p>页面加载失败：{error.message}</p>
      <button type="button" onClick={() => reset()}>
        重试
      </button>
    </section>
  )
}
```

如果服务端组件查库发现指定文章或用户不存在，直接调用 `notFound()`（来自 `next/navigation`）触发最近的 `not-found.tsx` 并返回 404 状态码，不要返回一个空标题的 200 正常页。需要条件跳转时，服务端用 `redirect('/login')`，客户端事件里用 `useRouter().push(...)`（注意客户端跳转仅作界面引导，不能替代接口鉴权）。

## 路由组、动态段、并行路由与拦截路由

App Router 提供了几组特殊目录语法，用来在不破坏 URL 结构的前提下精细组织大型应用：

1. **动态路径段与 Next.js 16 异步 `params`**：`[slug]` 匹配单段、`[...slug]` 匹配多段、`[[...slug]]` 可选多段。**在 Next.js 16 中，页面和布局接收到的 `params` 与 `searchParams` 都是异步 `Promise`，组件必须标记为 `async` 并通过 `const { slug } = await params` 解包读取，旧版同步直接取值写法已废弃。**
2. **路由组 `(group)`**：用圆括号包裹文件夹名（如 `(marketing)/page.tsx`、`(auth)/login/page.tsx`），目录名**不会出现在最终 URL** 中（`/login` 依然是 `/login`），非常适合为不同业务分区挂载各自独立的根布局。
3. **并行路由 `@slot`**：在同一个布局目录里定义 `@analytics/page.tsx` 和 `@activity/page.tsx`，父级 `layout.tsx` 就能作为 Props 直接接收 `{ analytics, activity }` 并同时渲染多个独立加载、独立报错的面板（如仪表盘或分栏工作台）。注意使用并行路由时，子路由缺失匹配往往需要提供 `default.tsx` 防止硬刷新 404。
4. **拦截路由 `(.)` / `(..)`**：常与并行路由 `@modal` 配合实现“列表页点击照片弹出模态框预览、但地址栏真实变成 `/photos/42`；一旦用户直接刷新或分享 `/photos/42`，则整页渲染完整照片详情页”的流畅体验。`(.)` 表示拦截同级路由，`(..)` 表示拦截上一级路由（按 URL 路由段而非文件系统物理目录算层级）。

```tsx
// src/app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params
  const post = await loadPost(slug)
  if (!post) notFound()

  return <article>{post.title}</article>
}
```

只有在页面区域确实拥有独立加载和错误边界生命周期时才上并行路由；如果只是普通 UI 分栏，直接用常规组件组合反而更简单清晰。

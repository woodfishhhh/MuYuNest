---
title: React Router 路由系统：嵌套布局、数据加载与权限控制
slug: react-router
date: 2026-07-13
categories:
  - 前端开发
tags:
  - React 19
  - React Router
  - SPA
  - 嵌套路由
  - 懒加载
---

前端路由把浏览器 URL 映射成一条嵌套组件分支，同时接管历史记录、页面布局嵌套、路由级数据准备、局部提交以及错误边界兜底。在 React Router 生态里，最容易把人绕晕的是版本包名混用（`react-router-dom` vs `react-router`）以及把 Data Router 专属的 `loader`/`action` 往 `<BrowserRouter>` 里硬塞导致运行时报错。

## 三种运行模式与 URL 策略边界

从 **React Router 7** 开始，浏览器端 API 已统一收口进 `react-router` 核心包（`npm install react-router`，旧版 v6 遗留项目仍可见 `react-router-dom` 作为兼容层）。更重要的是分清它提供的三种渐进模式：

| 模式 | 顶层入口 | 适用能力范围 | 典型场景 |
| --- | --- | --- | --- |
| Declarative（声明式） | `<BrowserRouter>` + `<Routes>` | 路由匹配、嵌套 `<Outlet>`、`<Link>`、`useNavigate` | 已有独立请求库（如 TanStack Query）的纯 SPA |
| Data（数据路由） | `createBrowserRouter` + `<RouterProvider>` | 包含声明式全部能力，新增 `loader`、`action`、`useFetcher`、`useNavigation`、路由 `ErrorBoundary` | 自控 Vite 构建与前端数据流的中大型 SPA |
| Framework（全栈框架） | Vite 插件 + `routes.ts` 路由模块 | 自动类型生成、按路由自动代码分割、SSR/预渲染 | 新建全栈或 SSR React 应用 |

**`loader`、`action`、`useFetcher`、`useNavigation` 与路由级 `ErrorBoundary` 均属于 Data / Framework 模式专有能力，在 `<BrowserRouter>` 声明式树下直接调用会直接报错。**

### Browser vs Hash 部署回退

与 Vue Router 一致，URL 历史策略与模式正交：Browser 模式（`createBrowserRouter` / `<BrowserRouter>`）使用 History API 生成干净路径 `/projects/42`；Hash 模式把路径留在 `#` 后面，适合无法控制服务端配置的重静态托管；Memory 模式用于单元测试或非浏览器环境。

使用 Browser 模式上线到 Nginx 时，用户直接刷新 `/projects/42` 会让请求落到服务器磁盘上触发 404，必须在前端入口配置回退规则（同时确保 `/api/` 等后端路由有更精确的 `location`，不要被回退成 HTML）：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## 嵌套布局、`<Outlet>` 与三种路由参数

嵌套路由同时描述 URL 层级与 UI 壳层结构。父路由渲染侧栏或顶栏骨架，并在正文中放置 `<Outlet />` 作为匹配子路由的渲染出口；`index: true` 用来指定进入父路径时默认展示的子页面（索引路由不可再同时写 `path`）；不写 `path` 只写 `Component` 和 `children` 的路由称为 **无路径布局路由（Pathless Layout Route）**，非常适合在不增加 URL 前缀的前提下给一组页面统一套上权限外壳或局部布局。

```tsx
import { createBrowserRouter, Outlet } from 'react-router'
import { RouterProvider } from 'react-router/dom'

function RootLayout() {
  return (
    <div className="app-shell">
      <aside>导航菜单</aside>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, lazy: () => import('./routes/home') },
      {
        path: 'projects',
        children: [
          { index: true, lazy: () => import('./routes/project-list') },
          { path: ':projectId', lazy: () => import('./routes/project-detail') },
        ],
      },
      { path: '*', lazy: () => import('./routes/not-found') },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
```

根据数据生命周期，URL 传参分成三类通道：

1. **路径参数（`useParams`）**：用于标识资源唯一身份（如 `/projects/:projectId`）。参数永远是字符串或 `undefined`，需自行校验转换数值。
2. **查询参数（`useSearchParams`）**：适合分页、搜索关键词和排序条件等可分享、刷新可恢复的 UI 状态；同样需要处理字符串解析与非法值兜底。
3. **Location State（`<Link state={...}>` + `useLocation`）**：存在浏览器历史栈里、不暴露在 URL 中，适合“从哪来”的轻量返回提示，但直接粘贴 URL 打开时为 `null`，**严禁用来存放密码或隐私凭据**。

站内导航优先使用语义化的 `<Link>` 与带高亮回调的 `<NavLink>`（保留右键新标签打开和键盘可访问性）；仅在表单提交完成、倒计时结束等事件处理函数里用 `useNavigate()`（如登录后 `navigate('/dashboard', { replace: true })` 替换历史栈），不要在渲染函数体里直接调 `navigate`。

## Data Router：`loader`、`action`、`useFetcher` 与错误边界

在传统声明式 SPA 里，往往先渲染页面骨架、再在 `useEffect` 里发起请求，容易产生“瀑布流等待”与手写 `AbortController` 样板代码。Data Router 把路由级读取和写入直接前置到路由生命周期中：

```text
URL 变化
  ↓ 匹配路由分支
并行加载各层 route.lazy 与执行 loader（传入 request.signal 自动支持导航中断取消）
  ↓
渲染布局与页面（useNavigation 呈现全局 loading / submitting 状态）
  ↓ 提交 <Form> 或 fetcher.submit
执行目标路由 action → 成功后自动重新验证（revalidation）当前页面的 loader 数据
```

**在 `loader` 发起 `fetch` 时务必透传 `request.signal`，这样当用户快速切换页面导致上一轮导航作废时，浏览器能真正取消在途请求。**

```tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { Form, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router'

export async function projectsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const keyword = url.searchParams.get('keyword') ?? ''
  const response = await fetch(
    `/api/projects?keyword=${encodeURIComponent(keyword)}`,
    { signal: request.signal },
  )
  if (!response.ok) {
    throw new Response('项目列表加载失败', { status: response.status })
  }
  return { projects: (await response.json()) as Array<{ id: string; name: string }> }
}

export async function projectsAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { ok: false, error: '项目名称不能为空' }

  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal: request.signal,
  })
  if (!response.ok) throw new Response('创建失败', { status: response.status })
  return { ok: true }
}

export function ProjectsPage() {
  const { projects } = useLoaderData<typeof projectsLoader>()
  return (
    <section>
      <Form method="post">
        <input name="name" />
        <button type="submit">创建</button>
      </Form>
      <ul>{projects.map(p => <li key={p.id}>{p.name}</li>)}</ul>
    </section>
  )
}

export function ProjectErrorBoundary() {
  const error = useRouteError()
  if (isRouteErrorResponse(error)) {
    return <p role="alert">{error.status}：{String(error.data)}</p>
  }
  return <p role="alert">{error instanceof Error ? error.message : '未知错误'}</p>
}
```

需要注意两种交互的边界：整页表单提交或导航跳转用 `<Form>` + `action`（需要跳转直接在服务端或 `action` 返回 `redirect('/target')`）；如果是列表行内的点赞、收藏、删除等**不改变当前 URL 的局部操作**，则改用 `useFetcher()`（`<fetcher.Form>`），它拥有独立的 `fetcher.state` 与乐观更新能力，不会触发整页顶部的全局 `useNavigation` 进度条。

配置 `ErrorBoundary` 时遵循就近拦截原则：根路由放一个兜底边界，详情页、支付子模块等核心区域单独配局部 `ErrorBoundary`，这样局部加载 404 或渲染报错时不会把整个应用的侧栏和导航一起冲掉。

## 权限守卫与代码分割懒加载

### 路由鉴权拦截

- **Data 模式**：直接在受保护分支的 `loader`（或父布局 `loader`）中校验会话状态，未登录直接 `throw redirect('/login?redirect=...')`，连目标页面组件和接口请求都不会触发。
- **Declarative 模式**：封装无路径布局守卫组件（例如 `<RequireAuth />`），内部检查登录态，未登录则返回 `<Navigate to="/login" state={{ from: location }} replace />`，已登录则返回 `<Outlet />`。

**切记：只检查 `localStorage.getItem('token')` 存在与否以及前端路由拦截都只是交互引导，真正的身份有效性校验和资源权限判断必须由后端接口在每次请求时独立执行。**

### 代码分割懒加载

- **Data 模式**：使用路由对象上的 `lazy: () => import('./routes/reports')` 延迟加载 `Component`、`loader`、`action` 和 `ErrorBoundary`（注意 `path`、`index` 与 `children` 必须在路由树定义时同步写明，否则路由器无法先匹配路径再决定去下载哪个 chunk）。
- **Declarative 模式**：在模块顶层用 `const Settings = lazy(() => import('./pages/Settings'))` 声明，在 `<Route element={...} />` 中用 `<Suspense fallback={...}>` 包裹即可（切勿在组件函数内部调用 `lazy()`）。

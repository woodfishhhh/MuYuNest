---
title: React Router 路由系统
date: 2026-07-13
updated: 2026-07-13
tags:
  - React 19
  - React Router 7
  - TypeScript
  - SPA
  - 路由
source:
  - https://www.bilibili.com/video/BV1mcpPeMETt/
bvid: BV1mcpPeMETt
pages: P33-P40
draft: false
---

# React Router 路由系统

前端路由把 URL 映射为一条匹配分支，再沿这条分支准备数据、渲染布局与页面。它不只是“点击后换组件”，还负责浏览器历史、嵌套路由、导航状态、数据读写和错误恢复。

```text
URL 变化
   ↓
匹配路由分支
   ↓
执行 lazy / loader / action
   ↓
更新导航状态
   ↓
渲染布局 + Outlet + 页面
   ↓
失败时交给最近的路由错误边界
```

## 三种模式

React Router 7 有 Declarative、Data、Framework 三种模式。它们是逐层增加能力的使用方式，不是 Browser、Hash 这类 URL 策略。

| 模式 | 顶层入口 | 主要能力 | 控制权 |
|---|---|---|---|
| Declarative | `<BrowserRouter>` 等组件 | 匹配、嵌套、`Link`、`useNavigate`、位置状态 | 最高，数据层自行组织 |
| Data | `createBrowserRouter` + `<RouterProvider>` | Declarative 能力，加 `loader`、`action`、`fetcher`、待处理状态和路由错误边界 | 自己控制构建与服务端抽象 |
| Framework | React Router Vite 插件 + Route Modules | Data 能力，加约定式类型、自动代码分割、SPA/SSR/静态渲染策略 | 框架提供更多工程能力 |

三种模式都叫 React Router，但 API 可用范围不同。尤其要记住：`loader`、`action`、`useFetcher`、`useNavigation` 和路由 `ErrorBoundary` 属于 Data / Framework 数据路由能力，不能把 Declarative 示例直接加上这些 API 就认为能工作。

新建 React Router 7 项目时可以安装核心包：

```bash
npm install react-router
```

React Router 7 的 DOM API 已从 `react-router` 导出。由 v6 升级的项目可能仍从 `react-router-dom` 导入，它作为兼容升级路径仍可见；一个项目应遵循自身已选定的包和版本，不要混着抄示例。

### Declarative Mode

Declarative 模式把路由写成 React 组件，适合已经有独立数据层、只需要核心导航能力的 SPA：

```tsx
import { BrowserRouter, Route, Routes } from 'react-router';
import { About } from './pages/About';
import { Home } from './pages/Home';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Data Mode

Data 模式把路由表移到 React 渲染之外，由 Data Router 统一调度匹配、数据与错误：

```tsx
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { RootLayout } from './layouts/RootLayout';
import { Home } from './pages/Home';

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      {
        path: 'projects',
        lazy: () => import('./routes/projects'),
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
```

### Framework Mode

Framework 模式通过 Vite 插件和路由模块组织应用。路由配置只描述 URL 与模块的关系：

```ts
// app/routes.ts
import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('./routes/home.tsx'),
  route('projects/:projectId', './routes/project.tsx'),
] satisfies RouteConfig;
```

每个路由模块可以导出页面、数据函数和边界：

```tsx
// app/routes/project.tsx
import type { Route } from './+types/project';

export async function loader({ params }: Route.LoaderArgs) {
  return { project: await getProject(params.projectId) };
}

export default function Project({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.project.name}</h1>;
}
```

Framework Mode 会为路由模块提供类型生成和自动代码分割。Data Mode 则适合想使用同一数据模型，但仍由自己掌管 Vite 配置、服务端或部署方式的项目。

## URL 策略

Browser、Hash、Memory、Static 描述路由运行与历史记录策略，不能和三种模式混为一谈。

| 策略 | Data Mode API | 特点 | 常见场景 |
|---|---|---|---|
| Browser | `createBrowserRouter` | 使用 History API，URL 干净 | 常规 Web SPA |
| Hash | `createHashRouter` | 路由在 `#` 后，服务端看不到片段 | 无法配置回退的静态托管 |
| Memory | `createMemoryRouter` | 历史仅在内存中，地址栏不变 | 测试、非浏览器环境、嵌入式流程 |
| Static | 服务端静态路由 API | 为一次服务端请求匹配和渲染 | SSR 基础设施 |

Declarative Mode 也有对应的 `<BrowserRouter>`、`<HashRouter>` 和 `<MemoryRouter>`。选择策略时先看部署环境，不要只看本地开发服务器是否能刷新。

### Browser 路由为什么刷新会 404

客户端从 `/projects/42` 导航时，React Router 已经在浏览器里运行；直接刷新时，浏览器会向服务器请求 `/projects/42`。服务器若只认识静态文件，就会返回 404。

Nginx 托管纯 SPA 时通常需要把未知前端路径回退到入口文件：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

这条规则只适用于由前端接管的路径。真实 API、静态资源和服务端页面应使用更具体的 `location`，避免全部被错误地回退成 HTML。

## 路由树与 `Outlet`

嵌套路由同时表达 URL 层级和 UI 层级。父路由渲染共享布局，`Outlet` 决定匹配到的子路由放在哪里：

```tsx
import { Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="app-shell">
      <aside>菜单</aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      { index: true, Component: Home },
      {
        path: 'projects',
        Component: ProjectsLayout,
        children: [
          { index: true, Component: ProjectList },
          { path: ':projectId', Component: ProjectDetail },
        ],
      },
      { path: '*', Component: NotFound },
    ],
  },
]);
```

这里包含四种常见结构：

- `children`：子路由继承父路由布局，子路径通常写相对片段。
- `Outlet`：父组件中的子路由出口；没有它，子路由虽匹配却没有渲染位置。
- `index: true`：父路径恰好匹配时显示的默认子路由，索引路由不能同时再写 `path`。
- `:projectId`：动态路径段，具体值通过 `useParams` 或数据函数参数读取。

不写 `path` 但有 `Component` 和 `children` 的路由称为 pathless layout route。它能增加 UI 布局或边界，却不会给 URL 增加前缀。反过来，只写 `path` 和 `children`、不写页面组件，可以只增加路径前缀。

## 路由传参

### 路径参数：资源身份

```tsx
import { useParams } from 'react-router';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) return <p>缺少项目编号</p>;
  return <h1>项目 {projectId}</h1>;
}
```

路径参数适合资源 ID、用户名、文章 slug 等决定“当前是哪一个资源”的值。参数来自 URL，类型默认是字符串，并且在可选匹配场景中可能为 `undefined`。

### Search Params：可分享的页面状态

```tsx
import { useSearchParams } from 'react-router';

export function ProjectFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedPage = Number(searchParams.get('page'));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const keyword = searchParams.get('keyword') ?? '';

  function nextPage() {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page + 1));
    setSearchParams(next);
  }

  return (
    <div>
      <p>关键词：{keyword || '全部'}，第 {page} 页</p>
      <button type="button" onClick={nextPage}>下一页</button>
    </div>
  );
}
```

Query String 适合搜索、排序、分页和筛选，因为刷新和分享后仍可恢复。读取结果都是字符串，需要显式解析数字、布尔值和枚举，并处理非法输入。

### Location State：一次导航的附加上下文

```tsx
import { Link, useLocation } from 'react-router';

<Link to="/checkout" state={{ from: '/cart', coupon: 'SUMMER' }}>
  去结算
</Link>

function Checkout() {
  const location = useLocation();
  const state = location.state as
    | { from?: string; coupon?: string }
    | null;

  return <p>来源：{state?.from ?? '直接访问'}</p>;
}
```

Location State 存在浏览器历史记录中，不出现在 URL。它适合返回来源、过渡提示等非关键上下文，但不能被链接可靠分享，直接打开页面时也可能不存在。它不是安全存储，敏感信息仍不应放进去。

## 懒加载与过渡

三种模式的路由拆分方式不同。

### Data Mode：`route.lazy`

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        path: 'reports',
        lazy: () => import('./routes/reports'),
      },
    ],
  },
]);
```

被导入模块使用路由模块形状：

```tsx
// routes/reports.tsx
export async function loader() {
  return { reports: await listReports() };
}

export function Component() {
  const { reports } = useLoaderData<typeof loader>();
  return <ReportList reports={reports} />;
}

export function ErrorBoundary() {
  return <p>报表加载失败</p>;
}
```

`lazy` 可以延迟加载 `Component`、`loader`、`action`、`ErrorBoundary` 等非匹配属性。`path`、`index` 和 `children` 必须提前可知，因为 Router 要先匹配路由，才能决定调用哪个 `lazy`。

### Declarative Mode：`React.lazy` + `Suspense`

```tsx
import { lazy, Suspense } from 'react';

const Settings = lazy(() => import('./pages/Settings'));

<Route
  path="settings"
  element={
    <Suspense fallback={<p>设置页面加载中...</p>}>
      <Settings />
    </Suspense>
  }
/>
```

与普通组件一样，`lazy` 声明应位于模块顶层。Framework Mode 则会按路由模块自动建立代码分割入口，一般不需要手写这一层。

### 用 `useNavigation` 展示全局进度

Data / Framework Mode 中，路由代码或数据加载期间可以读取导航状态：

```tsx
import { Outlet, useNavigation } from 'react-router';

export function RootLayout() {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  return (
    <>
      {busy && <div role="progressbar" aria-label="页面加载中" />}
      <Outlet />
    </>
  );
}
```

`navigation.state` 的主要状态是 `idle`、`loading`、`submitting`。它表示会改变当前导航的全局过程；局部无导航请求应看对应 `fetcher.state`。

## `loader` 读取数据

`loader` 在路由组件渲染前执行，并接收 `request` 与 `params`。它适合路由级读取，而不是把所有请求都机械地搬出组件：

```tsx
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

interface Project {
  id: string;
  name: string;
}

export async function projectsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') ?? '';
  const response = await fetch(
    `/api/projects?keyword=${encodeURIComponent(keyword)}`,
    { signal: request.signal },
  );

  if (!response.ok) {
    throw new Response('项目列表加载失败', { status: response.status });
  }

  return { projects: (await response.json()) as Project[], keyword };
}

export function ProjectsPage() {
  const { projects, keyword } = useLoaderData<typeof projectsLoader>();

  return (
    <section>
      <h1>项目</h1>
      <p>当前筛选：{keyword || '全部'}</p>
      <ul>{projects.map((project) => <li key={project.id}>{project.name}</li>)}</ul>
    </section>
  );
}
```

页面导航和 GET 表单会根据目标 URL 调用匹配分支的 loader。请求被中止时应让底层 `fetch` 使用 `request.signal`，这样过期导航可以真正取消网络工作。

## `action` 写入数据

非 GET 的 `<Form>`、`useSubmit` 或 `fetcher.submit` 会调用目标路由的 `action`：

```tsx
import type { ActionFunctionArgs } from 'react-router';

export async function projectsAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = String(formData.get('name') ?? '').trim();

  if (!name) {
    return { ok: false, error: '项目名称不能为空' };
  }

  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Response('创建项目失败', { status: response.status });
  }

  return { ok: true };
}
```

```tsx
import { Form, useActionData, useNavigation } from 'react-router';

export function CreateProjectForm() {
  const actionData = useActionData<typeof projectsAction>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';

  return (
    <Form method="post">
      <input name="name" aria-label="项目名称" />
      <button type="submit" disabled={submitting}>
        {submitting ? '创建中...' : '创建项目'}
      </button>
      {actionData && !actionData.ok && <p>{actionData.error}</p>}
    </Form>
  );
}
```

Action 成功后，Router 会重新验证页面上的 loader 数据，使写入结果与读取结果重新同步。需要跳转时，应在 `loader` / `action` 中返回 `redirect('/target')`，而不是等组件渲染后再用 `useNavigate` 修正数据流程。

## `fetcher` 局部交互

`useFetcher` 也调用 route loader / action，普通提交不会改变当前 URL，也不会创建新的历史记录。但如果目标 loader 或 action 返回 `redirect`，Router 仍会执行导航。它适合收藏、行内编辑、自动补全和局部删除：

```tsx
import { useFetcher } from 'react-router';

interface FavoriteButtonProps {
  projectId: string;
  favorite: boolean;
}

export function FavoriteButton({ projectId, favorite }: FavoriteButtonProps) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const pendingValue = fetcher.formData?.get('favorite');
  const optimisticFavorite =
    pendingValue === null || pendingValue === undefined
      ? favorite
      : pendingValue === 'true';

  return (
    <fetcher.Form method="post" action={`/projects/${projectId}/favorite`}>
      <input
        type="hidden"
        name="favorite"
        value={String(!optimisticFavorite)}
      />
      <button type="submit" disabled={fetcher.state !== 'idle'}>
        {optimisticFavorite ? '取消收藏' : '收藏'}
      </button>
    </fetcher.Form>
  );
}
```

Fetcher 拥有独立的 `state`、`data`、`formData`，还提供 `load` 与 `submit`。选择原则很简单：主要页面或 URL 应改变时用导航 API；只更新当前页面中的一小块时用 fetcher。

```text
读取路由页面数据      → loader
提交并改变页面/URL    → Form / useSubmit + action
局部读取或提交不导航  → fetcher.load / fetcher.submit
```

## 导航 API

| API | 使用场景 | 是否在组件渲染中 |
|---|---|---|
| `<Link>` | 普通可访问链接 | 是 |
| `<NavLink>` | 需要激活、待处理状态的导航项 | 是 |
| `useNavigate` | 事件、计时器等命令式跳转 | Hook 返回函数 |
| `redirect` | loader / action 的数据控制流 | 否，数据函数中返回 |

### `Link` 与 `NavLink`

```tsx
import { Link, NavLink } from 'react-router';

<Link to="/projects" state={{ from: 'dashboard' }}>
  项目列表
</Link>

<NavLink
  to="/projects"
  end
  className={({ isActive, isPending }) =>
    ['nav-item', isActive && 'is-active', isPending && 'is-pending']
      .filter(Boolean)
      .join(' ')
  }
>
  项目
</NavLink>
```

`NavLink` 的 `isPending` 依赖 Data / Framework Mode。普通站内导航优先用链接组件，因为它保留链接语义、键盘操作和浏览器打开方式；不要把所有导航都写成按钮点击后 `navigate`。

常见选项包括：

- `replace`：替换当前历史记录，而不是压入新记录。
- `state`：附加 Location State。
- `relative`：指定相对路由层级或相对路径解析。
- `reloadDocument`：绕过客户端路由并进行文档导航，仅在确实需要时使用。

### `useNavigate`

```tsx
import { useNavigate } from 'react-router';

export function PaymentSuccess() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/orders', { replace: true })}>
        查看订单
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        返回
      </button>
    </>
  );
}
```

数据函数中优先 `redirect`，交互事件中使用 `useNavigate`。不要在组件渲染阶段直接调用 `navigate`，否则会把渲染变成副作用。

## 404 与错误边界

404 有两种不同来源：

1. URL 没有匹配任何业务路由，用 `path: '*'` 的兜底页面处理。
2. URL 匹配成功，但 loader 发现对应资源不存在，抛出带 404 状态的响应交给路由错误边界。

```tsx
export async function projectLoader({ params }: LoaderFunctionArgs) {
  const project = await getProject(params.projectId);

  if (!project) {
    throw new Response('项目不存在', { status: 404 });
  }

  return { project };
}
```

Data Mode 可以在路由对象上配置 `ErrorBoundary` 组件，也可以使用 `errorElement` 元素。边界通过 `useRouteError` 读取错误：

```tsx
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function ProjectErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <section role="alert">
        <h1>{error.status}</h1>
        <p>{String(error.data)}</p>
      </section>
    );
  }

  if (error instanceof Error) {
    return (
      <section role="alert">
        <h1>页面发生错误</h1>
        <p>{error.message}</p>
      </section>
    );
  }

  return <h1 role="alert">未知错误</h1>;
}
```

路由错误不只来自 `loader` 和 `action`，也可能来自该路由组件渲染或懒加载。错误会沿当前匹配分支向上冒泡，直到最近配置了边界的路由；不是一律跳到根边界。

```text
/projects/:projectId/payments 渲染失败
        ↓
payments 无边界
        ↓
:projectId 有 ErrorBoundary
        ↓
只替换项目详情区域，根布局仍可保留
```

至少应配置一个根路由边界，重要子域再配置局部边界。这样局部失败时，导航、布局和恢复操作仍能工作。Declarative Mode 没有 Data Router 的这套路由错误数据流，需要使用普通 React Error Boundary，并自行处理请求错误。

## 数据路由骨架

```tsx
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { RootLayout } from './layouts/RootLayout';
import { NotFound } from './routes/NotFound';
import { RootErrorBoundary } from './routes/RootErrorBoundary';
import {
  ProjectsPage,
  projectsAction,
  projectsLoader,
} from './routes/projects';

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      { index: true, lazy: () => import('./routes/home') },
      {
        path: 'projects',
        Component: ProjectsPage,
        loader: projectsLoader,
        action: projectsAction,
      },
      {
        path: 'projects/:projectId',
        lazy: () => import('./routes/project'),
      },
      {
        path: 'projects/:projectId/favorite',
        action: async ({ request, params }) => {
          if (!params.projectId) {
            throw new Response('缺少项目编号', { status: 400 });
          }

          const formData = await request.formData();
          await setFavorite(
            params.projectId,
            formData.get('favorite') === 'true',
          );
          return { ok: true };
        },
      },
      { path: '*', Component: NotFound },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
```

这份骨架把不同职责放到了正确位置：布局负责 `Outlet` 与全局进度，loader 负责读取，action 负责写入，fetcher 调用无页面组件的 action 路由，lazy 拆分页面，边界处理当前分支的错误。

## 常见问题

### 把 Data API 写进 `<BrowserRouter>` 后无法工作

`<BrowserRouter>` 是 Declarative Mode 顶层 API。需要 `loader`、`action`、`fetcher` 时，改用 `createBrowserRouter` + `RouterProvider`，或采用 Framework Mode。

### 子路由匹配了但页面没有出现

检查父路由组件是否渲染了 `<Outlet />`，并确认子路径没有误写成不符合预期的绝对路径。

### Browser 路由本地正常，部署刷新 404

开发服务器通常自动回退到 `index.html`。生产服务器或静态托管也必须配置 SPA fallback，或者改用平台支持的重写规则。

### 点击收藏后整个页面都进入 loading

局部操作应使用 fetcher，并读取 `fetcher.state`。`useNavigation` 描述会改变当前导航的全局过程。

### Action 成功后又手动请求了一遍列表

Data Router 会在成功的 mutation 后重新验证相关 loader。先确认默认 revalidation 是否已经满足需求，再决定是否手动调用 revalidator。

### 所有错误都把整页替换掉了

根边界只能兜底。为项目详情、设置等独立区域配置更近的 `ErrorBoundary`，错误就会在最近边界停止冒泡，并保留外层可用界面。

### 用 Location State 隐藏了敏感信息

不显示在地址栏不等于安全。Location State 仍存在客户端历史状态中，且直接访问时可能为空；身份、权限和敏感数据必须由可信后端验证。

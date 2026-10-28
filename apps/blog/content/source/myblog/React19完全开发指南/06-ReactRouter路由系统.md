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

前端路由把 URL 映射成一条匹配分支，再沿着这条分支准备数据、渲染布局和页面。它不只是"点一下换个组件"，还管浏览器历史、嵌套路由、导航状态、数据读写和错误恢复。

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

React Router 7 有 Declarative、Data、Framework 三种模式。它们是一层层增加能力的用法，不是 Browser、Hash 那种 URL 策略。

| 模式 | 顶层入口 | 主要能力 | 控制权 |
|---|---|---|---|
| Declarative | `<BrowserRouter>` 等组件 | 匹配、嵌套、`Link`、`useNavigate`、位置状态 | 最高，数据层自行组织 |
| Data | `createBrowserRouter` + `<RouterProvider>` | Declarative 能力，加 `loader`、`action`、`fetcher`、待处理状态和路由错误边界 | 自己控制构建与服务端抽象 |
| Framework | React Router Vite 插件 + Route Modules | Data 能力，加约定式类型、自动代码分割、SPA/SSR/静态渲染策略 | 框架提供更多工程能力 |

三种模式都叫 React Router，但能用的 API 范围不一样。尤其要记住：`loader`、`action`、`useFetcher`、`useNavigation` 和路由的 `ErrorBoundary` 都属于 Data / Framework 的数据路由能力，不能在 Declarative 的示例上直接加这些 API 就以为能跑。

新建 React Router 7 项目时可以装核心包：

```bash
npm install react-router
```

React Router 7 的 DOM API 已经从 `react-router` 导出了。从 v6 升级上来的项目可能还在从 `react-router-dom` 导入，它作为兼容的升级路径还能看到；一个项目按自己选定的包和版本来，别混着抄示例。

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

Data 模式把路由表挪到 React 渲染之外，由 Data Router 统一调度匹配、数据和错误：

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

Framework 模式通过 Vite 插件和路由模块组织应用。路由配置只描述 URL 和模块的对应关系：

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

Framework Mode 会给路由模块提供类型生成和自动代码分割。Data Mode 适合想用同一套数据模型、但 Vite 配置、服务端或部署方式还想自己管的项目。

## URL 策略

Browser、Hash、Memory、Static 描述的是路由的运行方式和历史记录策略，别和三种模式混为一谈。

| 策略 | Data Mode API | 特点 | 常见场景 |
|---|---|---|---|
| Browser | `createBrowserRouter` | 使用 History API，URL 干净 | 常规 Web SPA |
| Hash | `createHashRouter` | 路由在 `#` 后，服务端看不到片段 | 无法配置回退的静态托管 |
| Memory | `createMemoryRouter` | 历史仅在内存中，地址栏不变 | 测试、非浏览器环境、嵌入式流程 |
| Static | 服务端静态路由 API | 为一次服务端请求匹配和渲染 | SSR 基础设施 |

Declarative Mode 也有对应的 `<BrowserRouter>`、`<HashRouter>` 和 `<MemoryRouter>`。选策略先看部署环境，别只看本地开发服务器刷新正不正常。

### Browser 路由为什么刷新会 404

从 `/projects/42` 在客户端导航时，React Router 已经在浏览器里跑起来了；直接刷新的话，浏览器会去服务器请求 `/projects/42`。服务器只认识静态文件的话，就返回 404。

Nginx 托管纯 SPA 时，一般要把不认识的前端路径回退到入口文件：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

这条规则只适用于由前端接管的路径。真正的 API、静态资源和服务端页面要用更具体的 `location`，免得全被错误地回退成 HTML。

## 路由树与 `Outlet`

嵌套路由同时表达 URL 层级和 UI 层级。父路由渲染共享的布局，`Outlet` 决定匹配到的子路由放在哪：

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

这里有四种常见结构：

- `children`：子路由继承父路由的布局，子路径一般写相对片段。
- `Outlet`：父组件里子路由的出口；没有它，子路由匹配上了也没地方渲染。
- `index: true`：父路径正好匹配时显示的默认子路由，索引路由不能再同时写 `path`。
- `:projectId`：动态路径段，具体的值通过 `useParams` 或数据函数的参数读。

不写 `path`、但有 `Component` 和 `children` 的路由叫 pathless layout route，它能加一层 UI 布局或边界，但不会给 URL 加前缀。反过来，只写 `path` 和 `children`、不写页面组件，就只是加一段路径前缀。

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

路径参数适合资源 ID、用户名、文章 slug 这类决定"当前是哪个资源"的值。参数来自 URL，默认是字符串，在可选匹配的场景下还可能是 `undefined`。

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

Query String 适合搜索、排序、分页和筛选，因为刷新、分享之后还能恢复。读出来的都是字符串，数字、布尔值和枚举要显式解析，非法输入也要处理。

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

Location State 存在浏览器的历史记录里，不出现在 URL 上。适合放返回来源、过渡提示这类不关键的上下文，但没法通过链接可靠地分享，直接打开页面时也可能没有。它也不是安全的存储，敏感信息还是别放。

## 懒加载与过渡

三种模式拆分路由的方式不一样。

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

被导入的模块用路由模块的形状：

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

`lazy` 能延迟加载 `Component`、`loader`、`action`、`ErrorBoundary` 这些和匹配无关的属性。`path`、`index` 和 `children` 必须提前知道，因为 Router 得先匹配路由，才知道该调哪个 `lazy`。

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

和普通组件一样，`lazy` 声明要放在模块顶层。Framework Mode 会按路由模块自动建立代码分割入口，一般不用手写这一层。

### 用 `useNavigation` 展示全局进度

Data / Framework Mode 里，路由代码或数据加载期间可以读导航状态：

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

`navigation.state` 主要有 `idle`、`loading`、`submitting` 三种状态，表示会改变当前导航的全局过程；局部的、不导航的请求要看对应的 `fetcher.state`。

## `loader` 读取数据

`loader` 在路由组件渲染之前执行，接收 `request` 和 `params`。它适合做路由级别的读取，不是要把所有请求都机械地搬出组件：

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

页面导航和 GET 表单会按目标 URL 调用匹配分支上的 loader。请求被中止时，要让底层的 `fetch` 用上 `request.signal`，这样过期的导航才能真正取消网络请求。

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

Action 成功后，Router 会重新验证页面上的 loader 数据，让写入的结果和读到的结果重新对上。要跳转的话，在 `loader` / `action` 里返回 `redirect('/target')`，别等组件渲染完再用 `useNavigate` 去补救数据流程。

## `fetcher` 局部交互

`useFetcher` 也会调用路由的 loader / action，普通的提交不改当前 URL，也不新增历史记录。但目标的 loader 或 action 返回了 `redirect` 的话，Router 还是会执行导航。它适合收藏、行内编辑、自动补全和局部删除：

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

Fetcher 有自己独立的 `state`、`data`、`formData`，还提供 `load` 和 `submit`。选择原则很简单：主要页面或 URL 要变时用导航 API；只更新当前页面里的一小块时用 fetcher。

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

`NavLink` 的 `isPending` 依赖 Data / Framework Mode。普通的站内导航优先用链接组件，因为它保留了链接的语义、键盘操作和浏览器的打开方式；别把所有导航都写成点按钮后 `navigate`。

常见选项：

- `replace`：替换当前的历史记录，不压入新记录。
- `state`：附加 Location State。
- `relative`：指定按路由层级还是按路径做相对解析。
- `reloadDocument`：绕开客户端路由，做一次文档导航，确实需要时才用。

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

数据函数里优先用 `redirect`，交互事件里用 `useNavigate`。别在组件渲染阶段直接调 `navigate`，那会把渲染变成副作用。

## 404 与错误边界

404 有两种不同的来源：

1. URL 没匹配上任何业务路由，用 `path: '*'` 的兜底页面处理。
2. URL 匹配上了，但 loader 发现对应的资源不存在，就抛一个带 404 状态的响应，交给路由错误边界。

```tsx
export async function projectLoader({ params }: LoaderFunctionArgs) {
  const project = await getProject(params.projectId);

  if (!project) {
    throw new Response('项目不存在', { status: 404 });
  }

  return { project };
}
```

Data Mode 可以在路由对象上配 `ErrorBoundary` 组件，也可以用 `errorElement` 元素。边界通过 `useRouteError` 读取错误：

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

路由错误不只来自 `loader` 和 `action`，也可能来自这个路由组件的渲染或懒加载。错误会沿着当前的匹配分支往上冒泡，直到最近一个配了边界的路由，不是一律跳到根边界。

```text
/projects/:projectId/payments 渲染失败
        ↓
payments 无边界
        ↓
:projectId 有 ErrorBoundary
        ↓
只替换项目详情区域，根布局仍可保留
```

至少配一个根路由的边界，重要的子域再配局部边界。这样局部出错时，导航、布局和恢复操作还能用。Declarative Mode 没有 Data Router 这套路由错误的数据流，要用普通的 React Error Boundary，请求错误也得自己处理。

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

这份骨架把各个职责放到了对的位置：

- 布局负责 `Outlet` 和全局进度
- loader 负责读，action 负责写
- fetcher 调用没有页面组件的 action 路由
- lazy 拆分页面
- 边界处理当前分支的错误

## 常见问题

### 把 Data API 写进 `<BrowserRouter>` 后无法工作

`<BrowserRouter>` 是 Declarative Mode 的顶层 API。要用 `loader`、`action`、`fetcher` 的话，改用 `createBrowserRouter` + `RouterProvider`，或者用 Framework Mode。

### 子路由匹配了但页面没有出现

看父路由组件有没有渲染 `<Outlet />`，再确认子路径没被误写成意料之外的绝对路径。

### Browser 路由本地正常，部署刷新 404

开发服务器一般会自动回退到 `index.html`。生产服务器或静态托管也要配 SPA fallback，或者改用平台支持的重写规则。

### 点击收藏后整个页面都进入 loading

局部操作要用 fetcher，读 `fetcher.state`。`useNavigation` 描述的是会改变当前导航的全局过程。

### Action 成功后又手动请求了一遍列表

Data Router 在 mutation 成功后会重新验证相关的 loader。先确认默认的 revalidation 是不是已经够用，再决定要不要手动调 revalidator。

### 所有错误都把整页替换掉了

根边界只是兜底。给项目详情、设置这些独立区域配更近的 `ErrorBoundary`，错误就会停在最近的边界，外层的界面还能用。

### 用 Location State 隐藏了敏感信息

不显示在地址栏不代表安全。Location State 还是存在客户端的历史状态里，直接访问时还可能是空的；身份、权限和敏感数据必须由可信的后端验证。

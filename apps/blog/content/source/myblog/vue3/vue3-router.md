---
title: Vue Router 原理与实战：路由模式、导航守卫与动态路由
slug: vue3-router
date: 2026-07-13
categories:
  - 前端开发
tags:
  - Vue 3
  - Vue Router
  - SPA
  - 导航守卫
  - 权限控制
---

单页应用（SPA）在打包后只有一个 `index.html`。Vue Router 的核心工作是监听浏览器地址变化，把 URL 匹配到嵌套组件树上，在穿过一系列导航守卫校验后渲染进 `<RouterView>`。路由配置混乱最常见的后果就是：刷新详情页 404、动态路由首次进入空白，或者全局守卫因为注册顺序错乱拿不到 Pinia 会话状态。

## 路由模式与服务端回退配置

Vue Router 4 提供三种历史记录管理模式，URL 形态和服务器部署要求截然不同：

| 创建函数 | URL 形态 | 适用场景 | 服务端配置要求 |
| --- | --- | --- | --- |
| `createWebHistory()` | `/users/42` | 常规 SPA，URL 语义干净 | 未命中静态资源时回退到 `index.html` |
| `createWebHashHistory()` | `/#/users/42` | 无法配置 Nginx 回退的纯静态托管 | 无特殊要求，`#` 后部分不发给服务端 |
| `createMemoryHistory()` | 不操作浏览器地址栏 | SSR 渲染、单元测试、非浏览器环境 | 由代码显式调用初始导航 |

**History 模式下在浏览器直接刷新 `/users/42` 之所以返回 404，是因为请求直接打向了服务端磁盘，而服务器上根本没有 `/users/42` 这个物理文件。**

部署在 Nginx 上时，必须为前端入口补齐 `try_files` 回退规则，同时注意把 `/api/` 等后端代理写在更具体的 `location` 里，避免接口 404 被吞成 200 状态码的 `index.html`（完整上线配置见 [Web 服务上线指南](/posts/server-deployment-pm2-and-nginx)）：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 路由表设计与插件注册顺序

定义路由表时，除首屏极轻量的页面外，其余页面默认采用动态 `import()` 按路由拆包懒加载。同时，**`main.ts` 里必须先执行 `app.use(pinia)` 再执行 `app.use(router)`**，否则路由安装阶段立刻触发的首次导航守卫在调用 `useSessionStore()` 时会因为找不到激活的 Pinia 实例而报错。

```ts
// src/router/index.ts
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    path: '/users/:id',
    name: 'user-detail',
    component: () => import('@/views/UserDetailView.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
```

```ts
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

createApp(App)
  .use(createPinia())
  .use(router)
  .mount('#app')
```

如果导航守卫抽离在应用挂载之前就会执行，则需显式导出 `pinia` 实例并在守卫中传入 `useSessionStore(pinia)`。

## 导航方式、参数边界与嵌套布局

业务组件跳转优先引用稳定的命名路由（`{ name: 'user-detail', params: { id } }`），不要在模板里到处写死字符串路径，日后修改 URL 结构只需动路由表一处。站内跳转使用 `<RouterLink>` 或 `router.push()` / `router.replace()`（登录成功后用 `replace` 防止用户点浏览器后退又回到登录页）；站外链接和文件下载继续使用原生 `<a>`。

### Path Params 与 Query 的职责划分

- **Path Params（`/products/:id`）**：用来标识唯一资源实体。配合路由项 `props: true`，组件直接通过 `defineProps<{ id: string }>()` 接收参数，脱离对 `useRoute()` 的耦合更方便单元测试。注意运行时拿到的参数永远是 `string | string[]`，必须手动做数值转换和合法性校验。
- **Query（`?page=2&sort=price`）**：用来承载筛选、分页、排序等可分享的界面状态。**切勿把完整的商品对象塞进未在路径声明的隐式 `params`（刷新即丢），也绝不能把密码、Token 或个人隐私信息放进 URL Query（会被浏览器历史、Nginx 日志和 `Referer` 泄露）。**

### 嵌套路由与命名视图

后台管理常见的固定侧栏 + 动态主内容区，适合用嵌套路由 `children` 描述。**嵌套子路由的 `path` 必须写成相对路径（如 `'users'` 拼出 `/app/users`），一旦误加前导斜杠 `'/users'`，它会直接变成根级路径脱离父布局。**

```ts
const routes: RouteRecordRaw[] = [
  {
    path: '/app',
    name: 'app',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/UserListView.vue'),
      },
      {
        path: 'users/:id',
        name: 'app-user-detail',
        component: () => import('@/views/UserDetailView.vue'),
        props: true,
      },
    ],
  },
]
```

当单个 URL 需要同时控制同级的多个独立区域（如左侧导航栏 + 主工作区 + 右侧属性检查器）时，可以使用命名视图 `components: { default, sidebar, inspector }` 对应模板里的 `<RouterView name="sidebar" />`。如果是页面内部的局部复用，优先用组件和插槽解决，无需滥用命名视图。

另外，重定向 `redirect` 会改写浏览器地址栏，适合默认首页跳转；别名 `alias` 则允许多个 URL 共享同一条记录而不改变地址栏显示。面向搜索引擎的旧页面永久迁移，必须在服务端返回 HTTP 301/308，客户端路由跳转无法替代 HTTP 状态码重定向。

## 导航守卫执行顺序与鉴权边界

Vue Router 4 推荐使用**返回值风格**控制前置守卫，淘汰容易漏调或重复调用的 `next()` 回调：

| 守卫返回值 | 导航结果 |
| --- | --- |
| `true` 或 `undefined` | 放行当前导航 |
| `false` | 中断并取消导航 |
| 路由定位对象 `{ name: 'login' }` | 重定向到目标路由 |
| 抛出 `Error` | 导航失败，交给 `router.onError` 处理 |

```ts
router.beforeEach(async (to) => {
  const session = useSessionStore()

  if (!session.initialized) {
    await session.restore()
  }

  if (to.meta.requiresAuth && !session.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guestOnly && session.isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})
```

一次完整的路由切换，守卫按固定链路依次触发：

1. 失活组件的 `onBeforeRouteLeave`（适合拦截未保存表单离开提醒）。
2. 全局 `router.beforeEach`。
3. 重用组件的 `onBeforeRouteUpdate`（同一组件实例仅路径参数变化时触发）。
4. 路由记录独享的 `beforeEnter`（仅在从其他路由进入时触发）。
5. 解析异步路由组件。
6. 全局 `router.beforeResolve`（所有组件内守卫和异步组件解析完毕、导航即将确认前）。
7. 导航确认，触发全局 `router.afterEach(to, from, failure)`（适合关闭进度条、更新 `document.title`、埋点统计）。

**前端导航守卫只负责界面层面的跳转引导，绝不能当作安全授权屏障；任何数据接口必须在服务端独立校验 Session/Token 和资源所有权。** 同样不要把所有页面的业务数据请求都塞进全局 `beforeEach`，否则一个慢接口会卡死全站路由切换，且守卫内重定向时务必检查目标页面没有被同一个 `requiresAuth` 条件拦截，防止陷入无限重定向死循环。

### 扩展 `RouteMeta` 类型与路由过渡

通过 TypeScript 模块扩展给 `RouteMeta` 补齐类型提示后，路由表里的标题、权限标志和过渡动画名都能获得静态检查：

```ts
// src/router/meta.d.ts
import 'vue-router'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    guestOnly?: boolean
    transition?: 'fade' | 'slide'
    requiredPermission?: string
  }
}
```

配合 `<RouterView v-slot="{ Component, route: currentRoute }">` 与 `<Transition mode="out-in">` 可以实现平滑的路由切换动画。需要特别留意动态组件的 `:key`：写 `currentRoute.fullPath` 会让每次修改 Query 参数都整页销毁重建；如果希望同路由切换参数时复用页面实例，应改用 `currentRoute.name ?? currentRoute.path` 并在组件内部监听参数变化。

## 滚动行为与动态权限路由

配置 `scrollBehavior` 时，浏览器前进/后退优先归还 `savedPosition`，带 `#hash` 锚点时定位到对应元素（可预留固定顶栏的 `top` 偏移量），其余新页面统一回到 `{ top: 0 }`；注意 Vue Router 4 使用 `top / left`，不再使用旧版的 `x / y`。

做基于角色的动态菜单权限路由时，**服务端只允许返回业务标识（`view: 'reports' | 'audit'`），前端再从本地静态映射表 `viewRegistry` 中查出对应的 `() => import(...)` 懒加载函数，绝不要拿后端下发的字符串直接动态拼文件路径导入。**

```ts
interface MenuRoute {
  name: string
  path: string
  view: 'reports' | 'audit' | 'settings'
  title: string
  permission: string
}

const viewRegistry = {
  reports: () => import('@/views/ReportListView.vue'),
  audit: () => import('@/views/AuditLogView.vue'),
  settings: () => import('@/views/SettingsView.vue'),
} as const

const removeDynamicRoutes: Array<() => void> = []

export function installMenuRoutes(items: MenuRoute[]) {
  for (const remove of removeDynamicRoutes.splice(0)) {
    remove()
  }

  for (const item of items) {
    const component = viewRegistry[item.view]
    const routeName = `dynamic:${item.name}`

    if (
      !component ||
      !/^[a-z0-9][a-z0-9/-]*$/.test(item.path) ||
      router.hasRoute(routeName)
    ) {
      continue
    }

    removeDynamicRoutes.push(
      router.addRoute('app', {
        path: item.path,
        name: routeName,
        component,
        meta: {
          title: item.title,
          requiresAuth: true,
          requiredPermission: item.permission,
        },
      }),
    )
  }
}
```

`router.addRoute()` 只是把记录写入路由表，不会自动重新匹配当前地址栏。**如果用户在动态路由地址上刷新页面，必须在注册完动态路由后补上一句 `await router.replace(router.currentRoute.value.fullPath)`，否则首次进入依然会落入 404。** 退出登录时调用记录下来的注销函数列表移除所有动态路由，确保切换账号后不留残余菜单路由。

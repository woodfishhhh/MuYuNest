---
title: Vue Router 路由系统
date: 2026-07-13
updated: 2026-07-13
tags:
  - Vue 3
  - TypeScript
  - Vue Router
  - SPA
  - 权限控制
source:
  - https://www.bilibili.com/video/BV1dS4y1y7vd/
bvid: BV1dS4y1y7vd
pages: P79-P92
draft: false
---

# Vue Router 路由系统

Vue 单页应用通常只有一个 `index.html`。路由器监听 URL 变化，把当前位置匹配到组件树，再把组件渲染进 `<RouterView>`：

```text
浏览器 URL
    ↓ history/hash 监听
路由匹配器
    ↓ matched records
导航守卫
    ↓
RouterView 渲染对应组件
```

## 1. 安装与最小配置

Vue 3 使用 Vue Router 4：

```bash
npm install vue-router@4
```

### 1.1 路由表

```ts
// src/router/index.ts
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router';

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
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
```

动态 `import()` 会形成按路由拆分的代码块，首次访问时再加载。首屏必需的极小页面可以静态导入，其他页面默认懒加载。

### 1.2 注册插件

```ts
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';

const app = createApp(App);

app
  .use(createPinia())
  .use(router)
  .mount('#app');
```

先安装 Pinia，再安装 Router。这样首次导航触发全局守卫时，守卫中的 `useSessionStore()` 已经能取得 Active Pinia；若守卫在应用安装前就会执行，则应创建并导出同一个 Pinia 实例，再显式传给 `useSessionStore(pinia)`。

### 1.3 两个核心组件

```vue
<script setup lang="ts">
const navigation = [
  { name: 'home', label: '首页' },
  { name: 'login', label: '登录' },
] as const;
</script>

<template>
  <nav aria-label="主导航">
    <RouterLink
      v-for="item in navigation"
      :key="item.name"
      :to="{ name: item.name }"
    >
      {{ item.label }}
    </RouterLink>
  </nav>

  <RouterView />
</template>
```

- `RouterLink` 通过 History API 导航，不会像普通 `<a href>` 那样重新加载整页。
- `RouterView` 是出口；匹配到的页面组件会渲染到这里。
- 普通链接仍适合站外地址、下载和需要完整文档导航的场景。

## 2. 三种 History 实现

| 创建函数 | URL 形态 | 适用场景 | 服务端要求 |
| --- | --- | --- | --- |
| `createWebHistory()` | `/users/42` | 常规 SPA，URL 干净 | 未命中静态文件时回退到 `index.html` |
| `createWebHashHistory()` | `/#/users/42` | 无法配置服务器回退的静态托管 | 无特殊要求，`#` 后内容不发给服务器 |
| `createMemoryHistory()` | 无浏览器地址栏依赖 | SSR、测试或非浏览器环境 | 由应用显式设置初始位置 |

Hash 模式监听 `hashchange`；HTML5 History 模式使用 `pushState()`、`replaceState()` 和 `popstate`。业务代码不要手动拼这些底层 API，应让 Router 保持 URL、组件和导航状态一致。

History 模式直接刷新 `/users/42` 时，请求会先到 Web 服务器。服务器若寻找同名文件就会 404，因此部署时需要：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## 3. 声明式与编程式导航

### 3.1 命名路由

优先通过 `name` 导航，而不是在组件中散落硬编码路径：

```vue
<template>
  <RouterLink :to="{ name: 'user-detail', params: { id: user.id } }">
    查看详情
  </RouterLink>
</template>
```

路由路径变化时，只需修改路由表；业务组件仍引用稳定名称。路由名称在整个 Router 中必须唯一。

### 3.2 `useRouter()` 与 `useRoute()`

- `useRouter()` 返回路由器实例，用于“去哪里”。
- `useRoute()` 返回当前路由的响应式信息，用于“现在在哪里”。

```vue
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

async function openUser(id: number) {
  await router.push({
    name: 'user-detail',
    params: { id: String(id) },
    query: { tab: 'profile' },
  });
}

function goBack() {
  router.back();
}
</script>

<template>
  <p>当前路径：{{ route.fullPath }}</p>
  <button type="button" @click="openUser(42)">打开用户</button>
  <button type="button" @click="goBack">返回</button>
</template>
```

常用方法：

| 方法 | 行为 |
| --- | --- |
| `router.push(location)` | 导航并新增历史记录 |
| `router.replace(location)` | 替换当前历史记录 |
| `router.go(1)` / `router.go(-1)` | 前进或后退指定步数 |
| `router.back()` / `router.forward()` | 后退或前进一项 |

登录成功后通常用 `replace`，避免用户点击后退又回到登录页：

```ts
await router.replace({ name: 'home' });
```

`RouterLink` 也支持 `replace` 属性。

## 4. 路由参数

### 4.1 Path Params

适合标识资源，进入 URL 路径并可刷新恢复：

```ts
{
  path: '/products/:id',
  name: 'product-detail',
  component: () => import('@/views/ProductDetailView.vue'),
  props: true,
}
```

页面通过 Props 接收参数，比让展示组件直接依赖 Router 更容易测试：

```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ id: string }>();

const numericId = computed(() => {
  const value = Number(props.id);
  return Number.isInteger(value) && value > 0 ? value : null;
});
</script>

<template>
  <p v-if="numericId">商品编号：{{ numericId }}</p>
  <p v-else role="alert">商品编号无效</p>
</template>
```

路由参数来自 URL，运行时通常是字符串或字符串数组。TypeScript 注解不会自动把 `"42"` 变成数字，必须转换并校验。

### 4.2 Query

适合筛选、分页、排序和可分享的 UI 状态：

```ts
await router.push({
  name: 'product-list',
  query: {
    page: '2',
    sort: 'price',
    keyword: 'keyboard',
  },
});
```

读取时同样要处理 `string | string[] | null`：

```ts
const page = computed(() => {
  const raw = Array.isArray(route.query.page)
    ? route.query.page[0]
    : route.query.page;
  const value = Number(raw ?? 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
});
```

不要把完整商品对象塞进 Query，也不要把密码、Token 或个人敏感信息放进 URL。URL 会进入浏览器历史、访问日志、分析系统和 Referer。

### 4.3 临时数据与资源详情

旧写法会把任意对象放进 `params`，但不在路径中声明的 Params 不是可靠的数据通道，刷新也会丢失。详情页只传资源 ID，再由页面按 ID 读取 Store 或请求接口：

```ts
await router.push({
  name: 'product-detail',
  params: { id: String(product.id) },
});
```

这样 URL 可复制、可刷新，也能直接进入。

## 5. 嵌套路由

后台布局的侧栏不变、内容区变化，或移动端底部导航不变、页面主体变化，都适合父子路由：

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
];
```

父布局必须提供子出口：

```vue
<script setup lang="ts">
import AppSidebar from '@/components/navigation/AppSidebar.vue';
</script>

<template>
  <div class="app-layout">
    <AppSidebar />
    <main>
      <RouterView />
    </main>
  </div>
</template>
```

子路由的 `path: 'users'` 是相对路径，最终为 `/app/users`。若写成 `path: '/users'`，它会成为根级 URL，通常不符合嵌套意图。

## 6. 命名视图

一个路由需要同时控制多个区域时，可给 `RouterView` 命名：

```ts
{
  path: '/workspace',
  components: {
    default: () => import('@/views/WorkspaceMain.vue'),
    sidebar: () => import('@/views/WorkspaceSidebar.vue'),
    inspector: () => import('@/views/WorkspaceInspector.vue'),
  },
}
```

```vue
<template>
  <RouterView name="sidebar" />
  <RouterView />
  <RouterView name="inspector" />
</template>
```

`default` 对应无 `name` 的出口。命名视图适合由 URL 共同决定的稳定页面区域；普通页面内部复用仍优先用组件和插槽，不要把 Router 当布局系统滥用。

## 7. 重定向与别名

### 7.1 重定向

重定向会改变最终 URL：

```ts
{
  path: '/',
  redirect: { name: 'dashboard' },
}
```

也可根据目标路由计算：

```ts
{
  path: '/legacy-user/:id',
  redirect: (to) => ({
    name: 'app-user-detail',
    params: { id: to.params.id },
  }),
}
```

### 7.2 别名

别名让多个 URL 匹配同一条路由记录，URL 保持用户访问的形式：

```ts
{
  path: '/users',
  alias: ['/members', '/people'],
  component: () => import('@/views/UserListView.vue'),
}
```

迁移旧 URL 时，面向搜索引擎的永久跳转最好由服务器返回 301/308；客户端 Router 重定向不能完全替代 HTTP 重定向。

## 8. 导航守卫

### 8.1 前置守卫

全局 `beforeEach` 会在每次导航确认前运行。Vue Router 4 推荐通过返回值控制导航，不再混用容易漏调用的 `next()`：

```ts
router.beforeEach(async (to) => {
  const session = useSessionStore();

  if (!session.initialized) {
    await session.restore();
  }

  if (to.meta.requiresAuth && !session.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.guestOnly && session.isAuthenticated) {
    return { name: 'dashboard' };
  }

  return true;
});
```

返回值语义：

| 返回值 | 结果 |
| --- | --- |
| `true` / `undefined` | 继续导航 |
| `false` | 取消导航 |
| 路由地址对象 | 重定向 |
| 抛出 Error | 导航失败，交给错误处理 |

前端守卫只控制界面入口，不构成真正授权。服务端接口必须再次校验 Session/Token 和资源权限；用户可以绕过前端直接发 HTTP 请求。

仅检查 `localStorage` 中是否有字符串也不等于已登录。可靠流程应由服务端验证会话，并处理过期、撤销和角色变化。

### 8.2 后置守卫

`afterEach` 不能取消导航，适合结束进度条、记录成功页面访问和更新标题：

```ts
router.beforeEach(() => {
  progress.start();
});

router.afterEach((to, _from, failure) => {
  progress.done();

  if (!failure) {
    document.title = to.meta.title
      ? to.meta.title + ' | Console'
      : 'Console';
  }
});

router.onError((error) => {
  progress.done();
  console.error('route navigation failed', error);
});
```

进度条组件应有明确的 `start()/done()` API，并在卸载或失败时清理 `requestAnimationFrame`。若已有成熟的小型进度条库，优先复用，不必在 `main.ts` 手动创建和挂载复杂 VNode。

### 8.3 路由级与组件级守卫

- `beforeEach`：全局认证、统一前置条件。
- `beforeResolve`：异步组件和组件内守卫已解析后、导航确认前。
- 路由记录的 `beforeEnter`：只约束某条路由。
- `onBeforeRouteLeave()`：离开编辑页前检查未保存内容。
- `onBeforeRouteUpdate()`：同一组件复用但 Params 改变时响应。

不要把所有数据请求都塞进全局守卫，否则一次慢接口会阻塞整个应用导航。

## 9. 路由元信息

`meta` 用于给路由声明标题、访问要求、菜单信息和过渡名。通过模块扩展给它加类型：

```ts
// src/router/meta.d.ts
import 'vue-router';

export {};

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    guestOnly?: boolean;
    transition?: 'fade' | 'slide';
    keepAlive?: boolean;
    requiredPermission?: string;
  }
}
```

```ts
{
  path: '/reports',
  name: 'reports',
  component: () => import('@/views/ReportListView.vue'),
  meta: {
    title: '报告',
    requiresAuth: true,
    transition: 'fade',
    requiredPermission: 'reports:read',
  },
}
```

嵌套路由的 `to.meta` 是所有匹配记录 Meta 的非递归合并结果。权限规则较复杂时，也可以检查 `to.matched`，明确父子记录的组合语义。

## 10. 路由过渡

`RouterView` 的插槽可取得当前组件和路由：

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const transitionName = computed(
  () => route.meta.transition ?? 'fade',
);
</script>

<template>
  <RouterView v-slot="{ Component, route: currentRoute }">
    <Transition :name="transitionName" mode="out-in">
      <component
        :is="Component"
        :key="currentRoute.name ?? currentRoute.path"
      />
    </Transition>
  </RouterView>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active,
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
```

Key 决定组件是否重建。使用 `fullPath` 会让 Query 的每次变化都重建页面；想复用实例时应使用路由名称或路径，并在组件中侦听真正关心的参数。

## 11. 滚动行为

`scrollBehavior` 在导航结束后决定滚动位置：

```ts
import type { RouterScrollBehavior } from 'vue-router';

const scrollBehavior: RouterScrollBehavior = async (
  to,
  _from,
  savedPosition,
) => {
  if (savedPosition) return savedPosition;

  if (to.hash) {
    return {
      el: to.hash,
      top: 72,
      behavior: 'smooth',
    };
  }

  return { top: 0 };
};

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior,
});
```

- 浏览器前进/后退时优先返回 `savedPosition`。
- 新页面默认回到顶部。
- 锚点目标如果异步出现，可以返回 Promise，等待页面布局稳定后再滚动。
- Vue Router 4 使用 `top/left`，不是旧版的 `x/y`。

## 12. 动态路由与菜单权限

服务器可按用户角色返回菜单描述，前端再调用 `addRoute()`。服务器返回的应是业务键，不是可执行的文件路径：

```ts
interface MenuRoute {
  name: string;
  path: string;
  view: 'reports' | 'audit' | 'settings';
  title: string;
  permission: string;
}

const viewRegistry = {
  reports: () => import('@/views/ReportListView.vue'),
  audit: () => import('@/views/AuditLogView.vue'),
  settings: () => import('@/views/SettingsView.vue'),
} as const;

const removeDynamicRoutes: Array<() => void> = [];

export function installMenuRoutes(items: MenuRoute[]) {
  for (const remove of removeDynamicRoutes.splice(0)) {
    remove();
  }

  for (const item of items) {
    const component = viewRegistry[item.view];
    const routeName = 'dynamic:' + item.name;

    if (
      !component ||
      !/^[a-z0-9][a-z0-9/-]*$/.test(item.path) ||
      router.hasRoute(routeName)
    ) {
      continue;
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
    );
  }
}
```

这样有四个好处：

1. Vite 能在构建期发现所有组件。
2. 后端不能让浏览器任意导入一个文件。
3. 未知 `view` 会在类型或边界校验阶段失败。
4. 退出登录时可调用 `removeRoute` 回收用户专属路由。

`addRoute()` 只注册记录，不会自动重跑当前地址的匹配。若当前导航正落在刚添加的路由上，可在安装后执行：

```ts
await router.replace(router.currentRoute.value.fullPath);
```

动态路由只是菜单和页面可见性的表达。真正的数据访问仍必须由服务端按当前身份授权，不能因为菜单没显示就认为接口安全。

## 13. 排错清单

### 页面 URL 变了，内容没变

检查根组件或父布局是否有 `RouterView`，以及子路由是否嵌套到了预期父记录。

### 子路由跳转到错误地址

子 `path` 是否误写了开头的 `/`；命名导航是否引用了重复或错误的 Route Name。

### Params 刷新后消失

确认参数是否在 `path` 中声明。资源详情应把 ID 放进路径，再按 ID 恢复数据。

### 守卫无限重定向

登录路由是否也被 `requiresAuth` 拦截；重定向目标是否和当前地址相同；会话恢复失败时是否正确结束加载状态。

### History 模式刷新 404

这是服务器没有 SPA fallback，不是 Vue 组件错误。Nginx 配置 `try_files $uri $uri/ /index.html`，然后先 `nginx -t` 再重载。

### 动态路由首次进入仍是 404

确保路由已在导航完成前注册，或注册后 `replace()` 当前完整地址。还要检查父路由名称和动态子路径。

## 14. 路由链路

```text
URL 输入
  -> History 模式解析
  -> 路由记录匹配
  -> 导航守卫与权限校验
  -> RouterView 渲染布局和页面
  -> Meta 驱动标题、过渡和缓存策略
  -> scrollBehavior 恢复滚动位置
```

Vue Router 的价值不只是“点击切页面”。它把 URL、组件层级、导航生命周期、页面元信息和可恢复状态组织成一个明确模型。路由表越清晰，权限、布局、刷新恢复和部署行为就越容易验证。

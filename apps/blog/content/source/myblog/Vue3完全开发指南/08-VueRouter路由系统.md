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

Vue 单页应用一般只有一个 `index.html`。路由器监听 URL 的变化，把当前位置匹配到组件树上，再把组件渲染进 `<RouterView>`：

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

Vue 3 用的是 Vue Router 4：

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

动态 `import()` 会形成按路由拆分的代码块，第一次访问时才加载。首屏必需的极小页面可以静态导入，别的页面默认懒加载。

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

先装 Pinia，再装 Router。这样第一次导航触发全局守卫时，守卫里的 `useSessionStore()` 已经能拿到 Active Pinia；要是守卫在应用安装之前就会执行，就要建一个 Pinia 实例并导出，再显式传给 `useSessionStore(pinia)`。

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

- `RouterLink` 通过 History API 导航，不会像普通的 `<a href>` 那样重新加载整个页面。
- `RouterView` 是出口；匹配到的页面组件渲染在这里。
- 站外地址、下载和需要完整文档导航的场景，还是用普通链接。

## 2. 三种 History 实现

| 创建函数 | URL 形态 | 适用场景 | 服务端要求 |
| --- | --- | --- | --- |
| `createWebHistory()` | `/users/42` | 常规 SPA，URL 干净 | 未命中静态文件时回退到 `index.html` |
| `createWebHashHistory()` | `/#/users/42` | 无法配置服务器回退的静态托管 | 无特殊要求，`#` 后内容不发给服务器 |
| `createMemoryHistory()` | 无浏览器地址栏依赖 | SSR、测试或非浏览器环境 | 由应用显式设置初始位置 |

Hash 模式监听 `hashchange`；HTML5 History 模式用 `pushState()`、`replaceState()` 和 `popstate`。业务代码别自己去拼这些底层 API，交给 Router 来保持 URL、组件和导航状态一致。

History 模式下直接刷新 `/users/42`，请求会先到 Web 服务器。服务器要是去找同名的文件，就会 404，所以部署时需要：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## 3. 声明式与编程式导航

### 3.1 命名路由

优先用 `name` 导航，别在组件里到处写死路径：

```vue
<template>
  <RouterLink :to="{ name: 'user-detail', params: { id: user.id } }">
    查看详情
  </RouterLink>
</template>
```

路由路径变了，只用改路由表；业务组件引用的还是那个稳定的名字。路由名在整个 Router 里必须唯一。

### 3.2 `useRouter()` 与 `useRoute()`

- `useRouter()` 返回路由器实例，管"去哪儿"。
- `useRoute()` 返回当前路由的响应式信息，管"现在在哪儿"。

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

登录成功后一般用 `replace`，免得用户点后退又回到登录页：

```ts
await router.replace({ name: 'home' });
```

`RouterLink` 也支持 `replace` 属性。

## 4. 路由参数

### 4.1 Path Params

适合标识资源，写在 URL 路径里，刷新后还能恢复：

```ts
{
  path: '/products/:id',
  name: 'product-detail',
  component: () => import('@/views/ProductDetailView.vue'),
  props: true,
}
```

页面通过 Props 接收参数，比让展示组件直接依赖 Router 更好测：

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

路由参数来自 URL，运行时一般是字符串或字符串数组。TypeScript 注解不会自动把 `"42"` 变成数字，要自己转换并校验。

### 4.2 Query

适合筛选、分页、排序和能分享的 UI 状态：

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

读的时候同样要处理 `string | string[] | null`：

```ts
const page = computed(() => {
  const raw = Array.isArray(route.query.page)
    ? route.query.page[0]
    : route.query.page;
  const value = Number(raw ?? 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
});
```

别把完整的商品对象塞进 Query，也别把密码、Token 或个人敏感信息放进 URL。URL 会进浏览器历史、访问日志、分析系统和 Referer。

### 4.3 临时数据与资源详情

旧写法会把随便什么对象放进 `params`，但没在路径里声明的 Params 不是可靠的数据通道，刷新就没了。详情页只传资源 ID，页面再按 ID 去读 Store 或请求接口：

```ts
await router.push({
  name: 'product-detail',
  params: { id: String(product.id) },
});
```

这样 URL 能复制、能刷新，也能直接打开。

## 5. 嵌套路由

后台布局侧栏不变、内容区变，或者移动端底部导航不变、页面主体变，都适合用父子路由：

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

父布局必须提供子路由的出口：

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

子路由的 `path: 'users'` 是相对路径，最后是 `/app/users`。写成 `path: '/users'` 的话，它就变成根级的 URL 了，一般不符合嵌套的本意。

## 6. 命名视图

一个路由要同时控制好几个区域时，可以给 `RouterView` 起名字：

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

`default` 对应没有 `name` 的出口。命名视图适合由 URL 共同决定的、稳定的页面区域；普通页面内部的复用还是优先用组件和插槽，别把 Router 当布局系统乱用。

## 7. 重定向与别名

### 7.1 重定向

重定向会改变最终的 URL：

```ts
{
  path: '/',
  redirect: { name: 'dashboard' },
}
```

也可以根据目标路由算出来：

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

别名让好几个 URL 匹配同一条路由记录，URL 保持用户访问时的样子：

```ts
{
  path: '/users',
  alias: ['/members', '/people'],
  component: () => import('@/views/UserListView.vue'),
}
```

迁移旧 URL 时，面向搜索引擎的永久跳转最好由服务器返回 301/308；客户端 Router 的重定向不能完全代替 HTTP 重定向。

## 8. 导航守卫

### 8.1 前置守卫

全局 `beforeEach` 会在每次导航确认之前运行。Vue Router 4 推荐用返回值控制导航，别再混用容易漏调的 `next()`：

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

返回值的含义：

| 返回值 | 结果 |
| --- | --- |
| `true` / `undefined` | 继续导航 |
| `false` | 取消导航 |
| 路由地址对象 | 重定向 |
| 抛出 Error | 导航失败，交给错误处理 |

前端守卫只控制界面的入口，不是真正的授权。服务端接口必须再校验一遍 Session/Token 和资源权限；用户可以绕开前端直接发 HTTP 请求。

光检查 `localStorage` 里有没有一个字符串，也不等于已经登录了。可靠的流程要由服务端验证会话，并处理过期、撤销和角色变化。

### 8.2 后置守卫

`afterEach` 取消不了导航，适合结束进度条、记录成功的页面访问和更新标题：

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

进度条组件要有明确的 `start()/done()` API，卸载或失败时清掉 `requestAnimationFrame`。已经有成熟的小进度条库的话优先复用，没必要在 `main.ts` 里手动创建、挂载复杂的 VNode。

### 8.3 路由级与组件级守卫

- `beforeEach`：全局认证、统一的前置条件。
- `beforeResolve`：异步组件和组件内守卫都解析完之后、导航确认之前。
- 路由记录上的 `beforeEnter`：只约束某一条路由。
- `onBeforeRouteLeave()`：离开编辑页之前检查有没有没保存的内容。
- `onBeforeRouteUpdate()`：同一个组件被复用、但 Params 变了时响应。

别把所有数据请求都塞进全局守卫，不然一个慢接口就会卡住整个应用的导航。

## 9. 路由元信息

`meta` 用来给路由声明标题、访问要求、菜单信息和过渡名。通过模块扩展给它加上类型：

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

嵌套路由的 `to.meta`，是所有匹配记录的 Meta 做非递归合并的结果。权限规则比较复杂时，也可以检查 `to.matched`，把父子记录组合起来的含义写清楚。

## 10. 路由过渡

`RouterView` 的插槽能拿到当前的组件和路由：

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

Key 决定组件要不要重建。用 `fullPath` 的话，Query 每变一次页面都会重建；想复用实例就用路由名或路径，再在组件里侦听真正关心的参数。

## 11. 滚动行为

`scrollBehavior` 在导航结束后决定滚到哪儿：

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

- 浏览器前进/后退时，优先返回 `savedPosition`。
- 新页面默认回到顶部。
- 锚点目标是异步出现的话，可以返回一个 Promise，等页面布局稳定了再滚。
- Vue Router 4 用 `top/left`，不是旧版的 `x/y`。

## 12. 动态路由与菜单权限

服务器可以按用户角色返回菜单描述，前端再调 `addRoute()`。服务器返回的应该是业务键，不是能执行的文件路径：

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

1. Vite 在构建期就能发现所有组件。
2. 后端没法让浏览器随便导入一个文件。
3. 不认识的 `view` 会在类型或边界校验阶段就失败。
4. 退出登录时可以调 `removeRoute` 收回用户专属的路由。

`addRoute()` 只是注册记录，不会自动重新匹配当前地址。当前导航正好落在刚加的路由上的话，可以在装完之后执行：

```ts
await router.replace(router.currentRoute.value.fullPath);
```

动态路由只是表达菜单和页面能不能看到。真正的数据访问还是要由服务端按当前身份授权，不能因为菜单没显示就认为接口是安全的。

## 13. 排错清单

### 页面 URL 变了，内容没变

看根组件或父布局里有没有 `RouterView`，以及子路由是不是嵌到了预期的父记录下面。

### 子路由跳转到错误地址

子路由的 `path` 是不是误写了开头的 `/`；命名导航是不是引用了重复或错误的 Route Name。

### Params 刷新后消失

确认参数有没有在 `path` 里声明。资源详情应该把 ID 放进路径，再按 ID 恢复数据。

### 守卫无限重定向

登录路由是不是也被 `requiresAuth` 拦住了；重定向的目标是不是和当前地址一样；会话恢复失败时有没有正确结束加载状态。

### History 模式刷新 404

这是服务器没配 SPA fallback，不是 Vue 组件的错。Nginx 配 `try_files $uri $uri/ /index.html`，然后先 `nginx -t` 再重载。

### 动态路由首次进入仍是 404

确保路由在导航完成前就注册好了，或者注册后 `replace()` 一下当前的完整地址。还要检查父路由的名字和动态子路径。

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

Vue Router 的价值不只是"点一下切个页面"。它把 URL、组件层级、导航的生命周期、页面元信息和可恢复的状态组织成一个明确的模型。路由表越清楚，权限、布局、刷新恢复和部署行为就越容易验证。

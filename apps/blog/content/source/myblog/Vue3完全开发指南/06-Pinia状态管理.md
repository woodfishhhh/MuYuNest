---
title: Vue 3 Pinia 状态管理
date: 2026-07-13
updated: 2026-07-13
tags:
  - Vue 3
  - TypeScript
  - Pinia
  - 状态管理
source:
  - https://www.bilibili.com/video/BV1dS4y1y7vd/
bvid: BV1dS4y1y7vd
pages: P61-P67
draft: false
---

# Vue 3 Pinia 状态管理

## 1. Pinia 解决什么问题

组件内部状态用 `ref`、`reactive`；当同一份状态需要跨组件、跨路由共享，并且要统一修改入口、调试记录或持久化时，再放进 Store。

```text
组件局部状态                  跨功能共享状态
ref / reactive               Pinia Store
     │                            │
computed 派生值              getters 派生值
函数处理行为                 actions 处理业务行为
```

Pinia 的核心特点：

- `state`、`getters`、`actions` 三层已经足够表达大部分业务，不需要 Vuex 的 `mutation` 层。
- Store 按唯一 `id` 扁平注册；功能之间可以互相调用 Store，不依赖深层模块命名空间。
- 直接修改 state、调用 action、执行 `$patch()` 都能被开发者工具记录。
- TypeScript 推导是主要设计目标，Options Store 和 Setup Store 都有完整类型支持。

不要把 Pinia 理解成“所有数据的容器”。输入框的临时值、只属于一个弹窗的开关、可由 props 推导的值，留在组件内更清晰。

> **版本说明（2026-07）**：当前官方文档是 Pinia 3.x。“同时支持 Vue 2 与 Vue 3”属于早期版本背景；新项目应按锁定的 Pinia/Vue 版本阅读对应文档，不要混用 Pinia 2 与 3 的安装要求。

## 2. 安装与创建根实例

```bash
npm install pinia
```

```ts
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
```

`createPinia()` 返回 Vue 插件。`app.use(pinia)` 必须发生在组件调用 Store 之前；插件也会把 Store 接入 Vue Devtools。

一个常见目录：

```text
src/
├─ stores/
│  ├─ cart.ts
│  └─ user.ts
├─ App.vue
└─ main.ts
```

每个业务 Store 单独成文件，`id` 在整个应用内唯一；导出的函数使用 `useXxxStore` 命名。

## 3. 定义 Store

### 3.1 Options Store

Options Store 直接以 `state / getters / actions` 三部分表达状态模型：

```ts
// src/stores/cart.ts
import { defineStore } from 'pinia'

export interface CartItem {
  id: string
  name: string
  unitPrice: number
  quantity: number
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    couponRate: 1,
    submitting: false,
  }),

  getters: {
    itemCount: (state) =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),

    subtotal: (state) =>
      state.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      ),

    total(): number {
      return this.subtotal * this.couponRate
    },
  },

  actions: {
    addItem(item: Omit<CartItem, 'quantity'>) {
      const existing = this.items.find((entry) => entry.id === item.id)

      if (existing) {
        existing.quantity += 1
        return
      }

      this.items.push({ ...item, quantity: 1 })
    },

    async checkout() {
      if (this.submitting || this.items.length === 0) return

      this.submitting = true
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: this.items }),
        })

        if (!response.ok) throw new Error('结算失败')
        this.items = []
      } finally {
        this.submitting = false
      }
    },
  },
})
```

- `state` 必须是返回初始对象的函数，SSR 和多个应用实例才能各自获得状态。
- `getters` 对应 `computed`，应保持纯函数，不发请求、不写 state。
- `actions` 对应业务方法，可同步也可异步，可调用其他 action 或其他 Store。
- Options Store 的 action 使用 `this`，不要写箭头函数，否则 `this` 不会绑定到 Store。

### 3.2 Setup Store

Setup Store 用 Composition API 表达同一套模型：`ref` 变成 state，`computed` 变成 getter，函数变成 action。

```ts
// src/stores/session.ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

interface User {
  id: string
  name: string
}

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)

  const isAuthenticated = computed(
    () => user.value !== null && accessToken.value !== null,
  )

  function signOut() {
    user.value = null
    accessToken.value = null
  }

  return { user, accessToken, isAuthenticated, signOut }
})
```

Setup Store 更适合复用 composable、监听器和组合多个 Store。所有要参与 SSR、Devtools 和插件处理的 state 都必须返回，不能用“未返回的私有 ref”藏状态。

## 4. 修改 state 的几种方式

### 4.1 直接修改

```ts
const cart = useCartStore()
cart.couponRate = 0.9
cart.items.push({ id: 'vue', name: 'Vue 指南', unitPrice: 89, quantity: 1 })
```

Pinia 允许直接写 state。简单、局部、语义明确的更新无需为了“形式统一”额外包 action。

### 4.2 `$patch()` 对象形式

```ts
cart.$patch({
  couponRate: 0.85,
  submitting: false,
})
```

适合批量覆盖几个字段。它会在 Devtools 中形成一次 patch 记录。

### 4.3 `$patch()` 函数形式

```ts
cart.$patch((state) => {
  const item = state.items.find((entry) => entry.id === 'vue')
  if (item) item.quantity += 1
  state.couponRate = Math.max(state.couponRate, 0.8)
})
```

适合数组增删、条件分支等需要原地修改的组合操作。

### 4.4 通过 action 修改

```ts
cart.addItem({ id: 'vue', name: 'Vue 指南', unitPrice: 89 })
```

当更新代表业务动作、需要校验、异步请求或会被多处调用时，优先用 action。这样组件只表达“发生了什么”，规则留在 Store。

### 4.5 `$state` 的真实语义

```ts
cart.$state = {
  items: [],
  couponRate: 1,
  submitting: false,
}
```

给 `$state` 赋值看起来像整体替换，但 Pinia 为了不破坏响应式，会把它转成 `$patch()`；业务代码通常无需使用它。应用级 SSR 注水则操作 `pinia.state.value`，那是另一层能力。

选择原则：

| 场景 | 推荐方式 |
| --- | --- |
| 单字段、就地更新 | 直接修改 |
| 同时覆盖多个字段 | `$patch({ ... })` |
| 数组操作、带分支的批量更新 | `$patch((state) => {})` |
| 业务动作、异步流程、需要复用 | action |
| 恢复 Options Store 初始状态 | `$reset()` |

## 5. 读取与解构

Store 自身是 `reactive` 对象，模板里直接访问即可：

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCartStore } from '@/stores/cart'

const cart = useCartStore()
const { itemCount, total, submitting } = storeToRefs(cart)

// action 已绑定到 Store，可以直接解构。
const { checkout } = cart
</script>

<template>
  <p>{{ itemCount }} 件，合计 {{ total.toFixed(2) }}</p>
  <button :disabled="submitting" @click="checkout">
    {{ submitting ? '提交中' : '结算' }}
  </button>
</template>
```

错误写法：

```ts
const cart = useCartStore()
const { total } = cart // 只拿到当前值，后续更新不会同步
```

正确边界：

- state 和 getter 要解构时使用 `storeToRefs(store)`。
- action 可以直接从 Store 解构；`storeToRefs()` 会跳过函数和非响应式属性。
- 不需要解构时，直接写 `cart.total` 最直观。

`storeToRefs()` 只为 Store 上的响应式属性创建 ref。它解决的是 `reactive` 对象直接解构会丢失响应式的问题，不是复制一份独立状态。

## 6. getters 与 actions

Getter 是 Store 级派生状态，不是“格式化后再存一份”。源数据变化时自动重新计算，结果可缓存。

```ts
getters: {
  itemCount: (state) => state.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  ),

  summary(): string {
    // 使用其他 getter 时显式标注返回类型，TS 推导更稳定。
    return `${this.itemCount} 件 / ${this.total.toFixed(2)} 元`
  },
}
```

Action 可以等待 Promise，并把成功、失败和收尾状态放在一个事务式流程中：

```ts
actions: {
  async loadCart(userId: string): Promise<void> {
    this.submitting = true

    try {
      const response = await fetch(`/api/users/${userId}/cart`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      this.items = (await response.json()) as CartItem[]
    } finally {
      this.submitting = false
    }
  },
}
```

Store 不应吞掉所有错误。可以在 action 内转换成领域错误后继续抛出，让页面决定 Toast、跳转还是内联提示。

## 7. Store 实例 API

### 7.1 `$reset()`

Options Store 自动提供 `$reset()`：

```ts
cart.$reset()
```

Setup Store 没有自动 `$reset()`，需要自己实现并返回：

```ts
function $reset() {
  user.value = null
  accessToken.value = null
}
```

### 7.2 `$subscribe()`

订阅 state 变化，回调同时得到修改元数据和修改后的状态：

```ts
const stop = cart.$subscribe(
  (mutation, state) => {
    console.log(mutation.type, mutation.storeId)
    sessionStorage.setItem('cart-backup', JSON.stringify(state))
  },
  { detached: true },
)

// 不再需要时主动取消。
stop()
```

- 默认在组件 `setup()` 中注册的订阅会随组件卸载。
- `{ detached: true }` 让订阅脱离组件生命周期，适合应用级持久化；也意味着必须管理取消时机。
- 函数式 `$patch()` 中的多次写入只触发一次订阅，适合把一组变化当成一个操作。

### 7.3 `$onAction()`

```ts
const stop = cart.$onAction(({ name, args, after, onError }) => {
  const startedAt = performance.now()

  after(() => {
    console.info(`${name} 完成`, {
      args,
      duration: performance.now() - startedAt,
    })
  })

  onError((error) => {
    console.error(`${name} 失败`, error)
  })
}, true)

stop()
```

`after()` 在同步 action 返回或异步 action resolve 后执行；`onError()` 捕获抛出的错误。它适合日志、指标和审计，不应偷偷改写业务结果。

## 8. 持久化插件

刷新页面会重新执行 JavaScript，内存中的 Store 自然丢失。持久化的完整流程是：

```text
创建 Store
  ↓ 读取并校验存储快照
恢复允许持久化的字段
  ↓
订阅后续变化
  ↓
序列化并写入 localStorage / sessionStorage
```

先做一个只持久化指定字段的插件，避免把 token、临时 loading、错误对象和大列表全部写入浏览器存储。

```ts
// src/stores/persist-plugin.ts
import type { PiniaPluginContext, StateTree } from 'pinia'

interface CartItemSnapshot {
  id: string
  name: string
  unitPrice: number
  quantity: number
}

type FieldGuard = (value: unknown) => boolean

const persistFields: Record<string, Record<string, FieldGuard>> = {
  cart: {
    items: (value) =>
      Array.isArray(value) && value.every(isCartItemSnapshot),
    couponRate: (value) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCartItemSnapshot(value: unknown): value is CartItemSnapshot {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.unitPrice === 'number' && Number.isFinite(value.unitPrice) &&
    value.unitPrice >= 0 &&
    typeof value.quantity === 'number' && Number.isInteger(value.quantity) &&
    value.quantity > 0
  )
}

function pickState(state: StateTree, fields: Record<string, FieldGuard>): StateTree {
  return Object.fromEntries(
    Object.keys(fields)
      .filter((key) => Object.hasOwn(state, key))
      .map((key) => [key, state[key]]),
  )
}

function parseSnapshot(
  raw: string,
  fields: Record<string, FieldGuard>,
): StateTree | null {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.value)) {
    return null
  }

  const restored: StateTree = {}
  for (const [key, guard] of Object.entries(fields)) {
    const value = parsed.value[key]
    if (value !== undefined && !guard(value)) return null
    if (value !== undefined) restored[key] = value
  }
  return restored
}

function removeInvalidSnapshot(storageKey: string, storeId: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch (error) {
    console.warn(`无法清理 Store ${storeId} 的损坏快照`, error)
  }
}

export function persistPiniaPlugin({ store }: PiniaPluginContext): void {
  if (typeof window === 'undefined') return

  const fields = persistFields[store.$id]
  if (!fields) return

  const storageKey = `app:pinia:${store.$id}`

  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const restored = parseSnapshot(raw, fields)
      if (!restored) throw new Error('快照结构或字段类型无效')
      store.$patch(restored)
    }
  } catch (error) {
    console.warn(`无法恢复 Store ${store.$id}`, error)
    removeInvalidSnapshot(storageKey, store.$id)
  }

  store.$subscribe(
    (_mutation, state) => {
      const payload = {
        version: 1,
        value: pickState(state, fields),
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload))
      } catch (error) {
        console.warn(`无法持久化 Store ${store.$id}`, error)
      }
    },
    { detached: true },
  )
}
```

注册顺序：先把插件交给 Pinia，再把 Pinia 安装到应用。

```ts
// src/main.ts
const pinia = createPinia()
pinia.use(persistPiniaPlugin)

createApp(App).use(pinia).mount('#app')
```

生产实现还要考虑：

- **安全**：`localStorage` 不是密钥库，XSS 可以读取它；高价值凭据优先使用服务端 Session + `HttpOnly` Cookie。
- **版本迁移**：快照带 `version`，state 结构变化时迁移或丢弃旧数据。
- **SSR**：服务端没有 `window`；每次请求还必须创建独立 Pinia 实例，不能共享用户状态。
- **容量与类型**：Storage 只能存字符串，`Date`、`Map`、类实例不能靠 JSON 无损恢复。
- **并发标签页**：多标签同步需要监听 `storage` 事件，并定义冲突策略。
- **写入频率**：高频输入应节流；超大状态不应每次完整序列化。

## 9. 调试顺序

### 页面显示旧值

1. 是否直接解构了 Store，而没有使用 `storeToRefs()`。
2. 是否在模板中读错了 Store 实例或字段。
3. Setup Store 是否忘记返回某个 ref。

### action 中的 `this` 是 `undefined`

Options Store 的 action 写成了箭头函数。改为方法简写：

```ts
actions: {
  increment() {
    this.count += 1
  },
}
```

### 刷新后状态没有恢复

检查插件是否在 Store 创建前注册、存储 key 是否一致、JSON 是否损坏，以及恢复时字段是否已在 `state()` 中声明。

### `$reset()` 不存在

Setup Store 需要自行实现；只有 Options Store 自动提供 `$reset()`。

## 10. 最小检查清单

- [ ] 只有跨组件共享、需要业务约束的状态进入 Store。
- [ ] Store `id` 唯一，文件与导出函数使用业务命名。
- [ ] state 初始字段完整，getter 保持纯函数，异步副作用放在 action。
- [ ] 解构 state/getter 使用 `storeToRefs()`，action 直接解构。
- [ ] Setup Store 自行实现 `$reset()`，并返回所有需追踪的 state。
- [ ] 持久化只保存白名单字段，包含版本、异常、SSR 与安全处理。
- [ ] 版本相关 API 以项目锁定的 Pinia 3.x 文档和 lockfile 为准。

## 延伸阅读

- [Pinia：Defining a Store](https://pinia.vuejs.org/core-concepts/)
- [Pinia：State](https://pinia.vuejs.org/core-concepts/state.html)
- [Pinia：Plugins](https://pinia.vuejs.org/core-concepts/plugins.html)

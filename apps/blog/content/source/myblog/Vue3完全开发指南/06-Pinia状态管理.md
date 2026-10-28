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

组件内部的状态用 `ref`、`reactive`；同一份状态要跨组件、跨路由共享，还要统一修改入口、调试记录或者持久化时，再放进 Store。

```text
组件局部状态                  跨功能共享状态
ref / reactive               Pinia Store
     │                            │
computed 派生值              getters 派生值
函数处理行为                 actions 处理业务行为
```

Pinia 的几个特点：

- `state`、`getters`、`actions` 三层就够表达大部分业务了，不需要 Vuex 那一层 `mutation`。
- Store 按唯一的 `id` 扁平注册；功能之间可以互相调 Store，不靠深层的模块命名空间。
- 直接改 state、调 action、执行 `$patch()`，开发者工具都能记下来。
- TypeScript 推导是主要的设计目标，Options Store 和 Setup Store 都有完整的类型支持。

别把 Pinia 当成"装所有数据的容器"。输入框的临时值、只属于一个弹窗的开关、能从 props 推出来的值，留在组件里更清楚。

> 版本说明（2026-07）：现在的官方文档是 Pinia 3.x。"同时支持 Vue 2 和 Vue 3"是早期版本的背景；新项目按锁定的 Pinia/Vue 版本读对应的文档，别把 Pinia 2 和 3 的安装要求混在一起。

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

`createPinia()` 返回一个 Vue 插件。`app.use(pinia)` 一定要在组件调 Store 之前执行；插件也会把 Store 接进 Vue Devtools。

一个常见的目录：

```text
src/
├─ stores/
│  ├─ cart.ts
│  └─ user.ts
├─ App.vue
└─ main.ts
```

每个业务 Store 单独一个文件，`id` 在整个应用里唯一；导出的函数用 `useXxxStore` 命名。

## 3. 定义 Store

### 3.1 Options Store

Options Store 直接用 `state / getters / actions` 三部分表达状态模型：

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

- `state` 必须是一个返回初始对象的函数，SSR 和多个应用实例才能各自拿到自己的状态。
- `getters` 对应 `computed`，要保持纯函数：不发请求、不写 state。
- `actions` 对应业务方法，同步异步都行，能调别的 action 或别的 Store。
- Options Store 的 action 用的是 `this`，别写成箭头函数，不然 `this` 绑不到 Store 上。

### 3.2 Setup Store

Setup Store 用 Composition API 表达同一套模型：`ref` 就是 state，`computed` 就是 getter，函数就是 action。

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

Setup Store 更适合复用 composable、监听器，以及组合多个 Store。所有要参与 SSR、Devtools 和插件处理的 state 都必须 return 出去，不能用"没返回的私有 ref"藏状态。

## 4. 修改 state 的几种方式

### 4.1 直接修改

```ts
const cart = useCartStore()
cart.couponRate = 0.9
cart.items.push({ id: 'vue', name: 'Vue 指南', unitPrice: 89, quantity: 1 })
```

Pinia 允许直接写 state。简单、局部、意思明确的更新，没必要为了"形式统一"再包一层 action。

### 4.2 `$patch()` 对象形式

```ts
cart.$patch({
  couponRate: 0.85,
  submitting: false,
})
```

适合一次覆盖好几个字段，在 Devtools 里会形成一条 patch 记录。

### 4.3 `$patch()` 函数形式

```ts
cart.$patch((state) => {
  const item = state.items.find((entry) => entry.id === 'vue')
  if (item) item.quantity += 1
  state.couponRate = Math.max(state.couponRate, 0.8)
})
```

适合数组增删、条件分支这类要原地修改的组合操作。

### 4.4 通过 action 修改

```ts
cart.addItem({ id: 'vue', name: 'Vue 指南', unitPrice: 89 })
```

更新代表一个业务动作、要校验、要发异步请求，或者会被好几个地方调用时，优先用 action。这样组件只说"发生了什么"，规则留在 Store 里。

### 4.5 `$state` 的真实语义

```ts
cart.$state = {
  items: [],
  couponRate: 1,
  submitting: false,
}
```

给 `$state` 赋值看起来像整体替换，但 Pinia 为了不破坏响应式，会把它转成 `$patch()`；业务代码一般用不着它。应用级的 SSR 注水操作的是 `pinia.state.value`，那是另一层能力。

怎么选：

| 场景 | 推荐方式 |
| --- | --- |
| 单字段、就地更新 | 直接修改 |
| 同时覆盖多个字段 | `$patch({ ... })` |
| 数组操作、带分支的批量更新 | `$patch((state) => {})` |
| 业务动作、异步流程、需要复用 | action |
| 恢复 Options Store 初始状态 | `$reset()` |

## 5. 读取与解构

Store 本身是一个 `reactive` 对象，模板里直接访问就行：

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

正确的边界：

- 要解构 state 和 getter 时，用 `storeToRefs(store)`。
- action 可以直接从 Store 上解构；`storeToRefs()` 会跳过函数和非响应式的属性。
- 不需要解构时，直接写 `cart.total` 最直观。

`storeToRefs()` 只给 Store 上的响应式属性创建 ref。它解决的是 `reactive` 对象直接解构会丢响应式的问题，不是复制出一份独立的状态。

## 6. getters 与 actions

Getter 是 Store 级别的派生状态，不是"格式化完再存一份"。源数据变了它会自动重新算，结果能缓存。

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

Action 可以等 Promise，把成功、失败和收尾的状态放在一个事务式的流程里：

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

Store 别把所有错误都吞掉。可以在 action 里转成领域错误再接着抛出去，让页面决定是弹 Toast、跳转还是显示内联提示。

## 7. Store 实例 API

### 7.1 `$reset()`

Options Store 自动提供 `$reset()`：

```ts
cart.$reset()
```

Setup Store 没有自动的 `$reset()`，要自己实现并 return 出去：

```ts
function $reset() {
  user.value = null
  accessToken.value = null
}
```

### 7.2 `$subscribe()`

订阅 state 的变化，回调同时拿到修改的元数据和修改后的状态：

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

- 默认在组件 `setup()` 里注册的订阅，会跟着组件一起卸载。
- `{ detached: true }` 让订阅脱离组件的生命周期，适合应用级的持久化；同时也意味着要自己管什么时候取消。
- 函数式 `$patch()` 里的多次写入只触发一次订阅，适合把一组变化当成一个操作。

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

`after()` 在同步 action 返回、或者异步 action resolve 之后执行；`onError()` 接住抛出来的错误。它适合做日志、指标和审计，别偷偷改业务结果。

## 8. 持久化插件

刷新页面会重新执行 JavaScript，内存里的 Store 自然就没了。持久化的完整流程：

```text
创建 Store
  ↓ 读取并校验存储快照
恢复允许持久化的字段
  ↓
订阅后续变化
  ↓
序列化并写入 localStorage / sessionStorage
```

先写一个只持久化指定字段的插件，免得把 token、临时的 loading、错误对象和大列表全写进浏览器存储。

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

注册顺序：先把插件交给 Pinia，再把 Pinia 装到应用上。

```ts
// src/main.ts
const pinia = createPinia()
pinia.use(persistPiniaPlugin)

createApp(App).use(pinia).mount('#app')
```

生产实现还要考虑：

- 安全：`localStorage` 不是密钥库，XSS 能读到它；高价值的凭据优先用服务端 Session + `HttpOnly` Cookie。
- 版本迁移：快照里带上 `version`，state 结构变了就迁移或者丢掉旧数据。
- SSR：服务端没有 `window`；每个请求还要建独立的 Pinia 实例，不能共享用户状态。
- 容量和类型：Storage 只能存字符串，`Date`、`Map`、类实例都没法靠 JSON 无损恢复。
- 多个标签页：多标签同步要监听 `storage` 事件，并定好冲突策略。
- 写入频率：高频输入要节流；特别大的状态别每次都完整序列化。

## 9. 调试顺序

### 页面显示旧值

1. 是不是直接解构了 Store，没用 `storeToRefs()`。
2. 模板里是不是读错了 Store 实例或字段。
3. Setup Store 是不是忘了 return 某个 ref。

### action 中的 `this` 是 `undefined`

Options Store 的 action 写成了箭头函数。改成方法简写：

```ts
actions: {
  increment() {
    this.count += 1
  },
}
```

### 刷新后状态没有恢复

看插件是不是在 Store 创建之前注册的、存储的 key 一不一致、JSON 有没有损坏，以及恢复时字段在 `state()` 里有没有声明。

### `$reset()` 不存在

Setup Store 要自己实现；只有 Options Store 会自动提供 `$reset()`。

## 10. 最小检查清单

- [ ] 只有跨组件共享、需要业务约束的状态才进 Store。
- [ ] Store 的 `id` 唯一，文件和导出函数用业务名命名。
- [ ] state 的初始字段写全，getter 保持纯函数，异步副作用放在 action 里。
- [ ] 解构 state/getter 用 `storeToRefs()`，action 直接解构。
- [ ] Setup Store 自己实现 `$reset()`，并 return 所有需要追踪的 state。
- [ ] 持久化只存白名单里的字段，处理好版本、异常、SSR 和安全。
- [ ] 跟版本有关的 API，以项目锁定的 Pinia 3.x 文档和 lockfile 为准。

## 延伸阅读

- [Pinia：Defining a Store](https://pinia.vuejs.org/core-concepts/)
- [Pinia：State](https://pinia.vuejs.org/core-concepts/state.html)
- [Pinia：Plugins](https://pinia.vuejs.org/core-concepts/plugins.html)

---
title: Pinia 状态管理：Store 设计、响应式解构与持久化插件
slug: vue3-pinia-state
date: 2026-07-13
categories:
  - 前端开发
tags:
  - Vue 3
  - Pinia
  - 状态管理
  - TypeScript
  - 持久化
---

并不是所有状态都需要塞进 Pinia。表单输入框的草稿、单个弹窗的显隐开关、能从 Props 直接派生出来的展示字段，留在组件本地反而更清晰；只有需要跨路由、跨多分支共享，或者需要统一变更入口、动作审计和局部持久化的业务状态，才适合放进全局 Store。

Pinia 砍掉了 Vuex 里冗余的 `mutation` 与深层命名空间，所有 Store 按唯一 `id` 扁平注册，支持互相调用，并原生贴合 TypeScript 推导。

## 安装注册与两种 Store 写法取舍

在入口文件里先调用 `createPinia()` 注册插件，再挂载根组件与路由（必须在任何全局守卫或组件调用 `useXxxStore()` 之前完成注册）：

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

Pinia 提供 **Options Store** 与 **Setup Store** 两种定义风格：

### 1. Options Store：结构规整、自带 `$reset()`

Options Store 用 `state / getters / actions` 三个选项直白划分职责，非常适合 CRUD 状态模型：

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

有三个细节需要注意：`state` 必须是返回新对象的工厂函数，SSR 多请求才不会串状态；`getters` 必须保持纯函数且互调其他 getter 时要显式标注返回类型；**Options Store 的 `actions` 依赖 `this` 指向当前 Store 实例，绝不能写成箭头函数，否则 `this` 会变成 `undefined`。**

### 2. Setup Store：自由组合 Composables 与 Watcher

Setup Store 用函数风格组织：`ref()` 是 state，`computed()` 是 getter，普通函数是 action：

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

  function $reset() {
    user.value = null
    accessToken.value = null
  }

  return { user, accessToken, isAuthenticated, signOut, $reset }
})
```

**Setup Store 的两个硬约束：所有需要参与 SSR 注水、Devtools 检查和插件持久化的 `ref` 必须全部 `return` 出去（不能藏私有响应式状态），且 Setup Store 不自带 `$reset()`，必须像上面这样自己手动实现并导出。**

选型判断很简单：常规实体数据与标准异步请求用 Options Store 更规整；内部需要调用 `watch`、复用外部 Composable（如监听网络在线状态、定时器）或协调多个依赖时，直接用 Setup Store。

## 响应式解构陷阱与 `storeToRefs`

Store 实例本身是一个经过 `reactive` 包装的代理对象。在模板里直接写 `cart.total` 没问题，但很多人在 `<script setup>` 里习惯先解构再使用：

```ts
const cart = useCartStore()
// 错误：直接解构会剥离响应性，total 变成一个静态数字快照，后续变化不会更新视图
const { total } = cart
```

**解构 Store 中的 State 与 Getter 必须包一层 `storeToRefs(store)`；Action 方法本身已绑定到 Store 上下文，直接从 Store 实例上解构即可。**

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCartStore } from '@/stores/cart'

const cart = useCartStore()
const { itemCount, total, submitting } = storeToRefs(cart)
const { checkout } = cart
</script>

<template>
  <p>{{ itemCount }} 件，合计 {{ total.toFixed(2) }}</p>
  <button :disabled="submitting" @click="checkout">
    {{ submitting ? '提交中' : '结算' }}
  </button>
</template>
```

## 修改状态的四种方式与订阅钩子

Pinia 允许根据修改复杂度灵活选择写入方式：

| 场景 | 推荐方式 | 原因 |
| --- | --- | --- |
| 单个简单字段就地改动 | 直接赋值 `cart.couponRate = 0.9` | 语义直接，无需无谓包装 |
| 一次性覆盖多个独立字段 | `cart.$patch({ couponRate: 0.85, submitting: false })` | 合并成一条 Devtools 变更记录 |
| 数组增删与带分支的批量修改 | `cart.$patch((state) => { ... })` | 仅触发一次 `$subscribe` 回调 |
| 包含校验、异步请求或复用业务规则 | 调用 `action` | 将业务约束收拢在 Store 内部 |

尽量避免在业务代码里直接赋值 `cart.$state = { ... }`——底层为了不弄断响应式其实还是转成了 `$patch`，只有框架级 SSR 注水才会直接操作 `pinia.state.value`。

### `$subscribe` 与 `$onAction`

当需要监听状态变动落盘或做统一动作审计时，可以用这两个实例方法：

```ts
// 监听状态变更（函数式 $patch 多次写入只触发一次回调）
const stopSubscribe = cart.$subscribe(
  (mutation, state) => {
    console.log(mutation.type, mutation.storeId)
    sessionStorage.setItem('cart-backup', JSON.stringify(state))
  },
  { detached: true },
)

// 拦截 Action 执行前后与异常
const stopOnAction = cart.$onAction(({ name, args, after, onError }) => {
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
```

默认在组件里注册的订阅会在组件卸载时自动销毁；传入 `{ detached: true }`（或 `$onAction` 第二个参数传 `true`）会让监听脱离组件生命周期存活，适合应用级插件，但不需要时记得主动调用返回值 `stop()` 取消。

## 手写安全的持久化插件

持久化插件最常见的事故有两种：一是把敏感的 `accessToken`、临时的 `loading` 状态或巨型缓存全写进 `localStorage`；二是页面在 SSR 服务端执行时访问 `window.localStorage` 报错，或者旧版本数据结构变更导致恢复状态时页面白屏。

**生产级持久化插件必须具备四道防线：按 Store 白名单筛选字段、带版本号的运行时结构校验（校验失败立刻清除脏缓存）、`typeof window === 'undefined'` SSR 护栏，以及不存储高危鉴权凭据（高危凭据应交给服务端 `HttpOnly` Cookie）。**

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

插件必须先通过 `pinia.use(persistPiniaPlugin)` 注册，再执行 `app.use(pinia)`，确保所有 Store 实例化时都已经挂载了拦截逻辑。

## 常见故障排查路径

- **Store 改了值但页面仍显示旧数据**：检查是不是直接解构了 State/Getter 漏掉 `storeToRefs()`，或者 Setup Store 里忘记 `return` 该响应式变量。
- **Action 里 `this` 报 `undefined`**：Options Store 中把 Action 写成了箭头函数，改回对象方法简写 `increment() { this.count += 1 }`。
- **刷新后状态没有恢复**：确认插件注册在 Store 首次调用之前、读取 Key 与写入 Key 一致、JSON 结构未因字段升级被校验拒绝，且恢复字段已经在初始 `state` 中声明。
- **`$reset()` 报错不存在**：Setup Store 不会自动生成该方法，需自行编写并从工厂函数返回。

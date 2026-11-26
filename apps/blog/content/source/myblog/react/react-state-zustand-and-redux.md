---
title: React 状态管理实战：Zustand 与 Redux Toolkit 对比
slug: react-state-zustand-and-redux
date: 2026-07-13
categories:
  - 前端开发
tags:
  - React 19
  - Zustand
  - Redux Toolkit
  - Immer
  - 状态管理
---

引入全局状态库之前，先划清应用里三类状态的归属：**单个组件内的 UI 开关与草稿留在 `useState` / `useReducer`；服务端列表请求、缓存失效和乐观重试交给 TanStack Query、RTK Query 或路由 Loader；真正需要留给 Zustand 或 Redux Toolkit 管理的，是跨远距离组件共享的客户端业务状态（如购物车、多步骤向导、编辑器画布状态、用户本地偏好）。**

在当前 React 生态中，原生手写 Redux（`legacy_createStore` + 满屏 `switch/case` 和 `connect`）已被彻底淘汰，主流方案收敛在轻巧的 **Zustand** 与结构严谨的 **Redux Toolkit（RTK）** 之间。

## Zustand 实战：极简 Store、Selector 陷阱与中间件

Zustand 不需要根组件套 `<Provider>`，每个业务域可以直接创建一个带类型约束的 Store Hook，底层基于 `useSyncExternalStore` 精确驱动订阅组件更新。

### 1. 创建 Store 与 `set` 浅合并规则

```ts
// stores/price.ts
import { create } from 'zustand'

interface PriceStore {
  price: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

export const usePriceStore = create<PriceStore>()((set, get) => ({
  price: 0,
  increment: () => set(state => ({ price: state.price + 1 })),
  decrement: () => set(state => ({ price: state.price - 1 })),
  reset: () => set({ price: 0 }),
}))
```

调用 `set` 时，Zustand 默认只对**第一层字段**做浅合并（不需要手写 `...state` 复制同级字段）；但如果是深层嵌套对象，直接写 `set({ profile: { name: 'new' } })` 会把同级的其他嵌套字段抹掉，必须手动展开路径或者直接接入 `immer` 中间件。如果需要在非 React 函数或事件回调里瞬时读取最新状态而不建立订阅，直接调用 `usePriceStore.getState().price` 即可。

### 2. 窄 Selector 与 Zustand v5 无限渲染陷阱

**使用 Zustand 最大的性能与稳定性禁忌，是直接调用不带参数的 `const store = useFamilyStore()`（订阅整棵状态树），或者在 Selector 里每次返回一个新拼接的对象/数组字面量。**

```tsx
import { useShallow } from 'zustand/react/shallow'

// 危险写法（Zustand v5 会触发 Maximum update depth exceeded 死循环）
const bad = useFamilyStore(state => ({
  children: state.family.children,
  renameChild: state.renameChild,
}))

// 推荐写法 1：拆成窄 Selector
const children = useFamilyStore(state => state.family.children)
const renameChild = useFamilyStore(state => state.renameChild)

// 推荐写法 2：需要一次拿多个字段时包一层 useShallow
const { children: list, renameChild: rename } = useFamilyStore(
  useShallow(state => ({
    children: state.family.children,
    renameChild: state.renameChild,
  })),
)
```

这是因为 Zustand 默认使用 `Object.is` 比对 Selector 返回值。返回一个新对象 `{ a, b }` 时，每次 `getSnapshot` 都会给出新引用，Zustand v5 底层 `useSyncExternalStore` 会判定快照一直在变而陷入重渲染死循环。

### 3. 组合 `immer`、`persist`、`devtools` 与 `subscribeWithSelector`

Zustand 通过高阶包装组合中间件，典型生产配置应当结合 `partialize` 只持久化非敏感UI偏好（绝不要把 `accessToken` 随手存进 `localStorage`）：

```ts
import { create } from 'zustand'
import { createJSONStorage, devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface SettingsStore {
  theme: 'light' | 'dark'
  accessToken: string | null
  setTheme: (theme: SettingsStore['theme']) => void
  setAccessToken: (token: string | null) => void
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          theme: 'light',
          accessToken: null,
          setTheme: (theme) =>
            set(
              (draft) => {
                draft.theme = theme
              },
              false,
              'settings/setTheme',
            ),
          setAccessToken: (accessToken) =>
            set((draft) => {
              draft.accessToken = accessToken
            }),
        })),
        {
          name: 'app-settings',
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({ theme: state.theme }),
        },
      ),
    ),
    { name: 'SettingsStore' },
  ),
)
```

配合 `subscribeWithSelector`，可以在组件 `useEffect` 或 React 外部模块里精准监听某个子切片的变化（比如同步给 Canvas/WebSocket），记得在组件卸载时返回 `unsubscribe` 清理函数。另外，所有能直接从 Store 现有字段算出来的展示文本（如 `age >= 26` 判断），直接在组件 Selector 里计算并返回，不要再在 Store 里冗余存一份同步状态。

## Redux Toolkit（RTK）实战：Slice、Thunk 与组件接入

Redux 本身只是纯 JS 状态容器，需要通过 `react-redux` 提供的 `<Provider store={store}>`、`useSelector` 和 `useDispatch` 接入组件树。现代官方标准写法 **Redux Toolkit（RTK）** 内置了 Immer 和 Thunk 中间件，彻底消除了手写 Action Type 常量的样板代码。

### 1. 用 `createSlice` 定义切片与异步 `createAsyncThunk`

```ts
// store/cartSlice.ts
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface CartState {
  message: string
  count: number
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
}

const initialState: CartState = {
  message: 'hello',
  count: 0,
  status: 'idle',
}

export const syncRemoteCount = createAsyncThunk(
  'cart/syncRemoteCount',
  async (targetId: number, { signal }) => {
    const response = await fetch(`/api/cart/${targetId}`, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { count: number }
    return data.count
  },
)

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    changeMsg: (state, action: PayloadAction<string>) => {
      // 内置 Immer 代理，支持看似直接修改的不可变更新
      state.message = action.payload
    },
    resetMsg: (state) => {
      state.message = 'hello'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncRemoteCount.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(syncRemoteCount.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.count = action.payload
      })
      .addCase(syncRemoteCount.rejected, (state) => {
        state.status = 'failed'
      })
  },
})

export const { changeMsg, resetMsg } = cartSlice.actions
export default cartSlice.reducer
```

### 2. 组装 `configureStore` 与类型化 Hooks

```ts
// store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import cartReducer from './cartSlice'

export const store = configureStore({
  reducer: {
    cart: cartReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

在应用根部包裹 `<Provider store={store}>` 后，组件里建议封装并导出带类型的 `useAppSelector` 与 `useAppDispatch`（替代裸 `useSelector`/`useDispatch`），直接获得完整的状态和异步 Thunk 类型推导：

```tsx
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'
import { changeMsg, syncRemoteCount } from './store/cartSlice'

export function CartBanner() {
  const message = useSelector((state: RootState) => state.cart.message)
  const dispatch = useDispatch<AppDispatch>()

  return (
    <div>
      <p>{message}</p>
      <button type="button" onClick={() => dispatch(changeMsg('world'))}>
        修改消息
      </button>
      <button type="button" onClick={() => void dispatch(syncRemoteCount(1))}>
        同步远端数量
      </button>
    </div>
  )
}
```

**Redux Reducer 必须保持纯同步、无副作用；所有异步请求必须放进 `createAsyncThunk`、`ListenerMiddleware` 或直接采用 RTK Query 管理服务端缓存。** 当项目重度依赖接口数据缓存、自动失效重取和乐观更新时，RTK 自带的 **RTK Query**（`createApi`）能一次性接管整个数据请求层，省去大量手写 Slice 与 Loading 状态。

## 真实项目怎么选：Zustand vs Redux Toolkit

两套方案没有绝对高下，核心按团队规模、状态复杂度和服务端缓存架构决定：

| 评估维度 | Zustand | Redux Toolkit（RTK） |
| --- | --- | --- |
| 接入成本与样板代码 | 极低，无需 Provider，几十行代码即可跑通 | 中等，需配置 Store、Slice 与全局 Provider |
| 状态模型与扩展约束 | 灵活多 Store，自由组织 Action 与外部订阅 | 强单向事件流（Action -> Reducer -> Store），结构高度统一 |
| 中大型团队协作与审计 | 自由度高，需团队约定防止 Store 随意耦合 | 强制 Action 命名、DevTools 时间旅行回溯与中间件生态完备 |
| 服务端缓存配套 | 配合 TanStack Query 或路由 Loader | 内置 RTK Query 深度集成 |
| 常见适用场景 | 中小型 SPA、组件库/微前端独立模块、偏重前端交互状态的编辑器 | 中大型多人协作后台、严格状态机与审计需求、已有 Redux 体系演进 |

**如果项目已经引入了 TanStack Query 或 React Router Data Loader 负责接口缓存，剩下的客户端全局状态优先选 Zustand——它能用最小的代码量解决跨组件共享问题；如果团队规模较大需要强约束的事件流审计，或者希望用一套方案统一管客户端状态和 RTK Query 接口缓存，直接上 Redux Toolkit。**

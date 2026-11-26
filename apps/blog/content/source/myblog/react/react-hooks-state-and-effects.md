---
title: React Hooks 深入：状态快照、Effect 同步与并发 Hook
slug: react-hooks-state-and-effects
date: 2026-07-13
categories:
  - 前端开发
tags:
  - React 19
  - React Hooks
  - useState
  - useEffect
  - 并发渲染
---

用 React Hooks 写业务时，九成以上的隐蔽 Bug 都源自同一个误解：把 `setState` 当成“立刻改写变量”、把 `useEffect` 当成“组件生命周期钩子”。实际上，每次函数组件执行拿到的是那一次渲染的**只读快照**，而 `useEffect` 的唯一职责是让组件与 React 外部的系统（网络、定时器、DOM 事件、第三方实例）保持同步。把这两个心智底座立稳，再来看 React 19 的并发与表单 Hook，所有规则都会串成一条线。

## 状态快照、批处理与不可变更新

Hook 必须只在函数组件或自定义 Hook 的最顶层调用，绝不能放进 `if` 条件、循环或普通嵌套函数里——React 依靠稳定不变的 Hook 调用顺序，把每次渲染的节点状态精确挂回对应的 Fiber 链表位置。

调用 `setCount(count + 1)` 后在下一行紧接着 `console.log(count)`，打印出来的依然是旧值：

```tsx
const [count, setCount] = useState(0)

function handleClick() {
  setCount(count + 1)
  setCount(count + 1)
  console.log(count) // 当前 render 的快照依然是 0；而且最终只加了 1
}
```

**每一次渲染的 `state` 和事件处理器闭包都是固定不变的快照；`setCount` 只是向下一轮渲染提交更新任务，如果在同一轮事件里连续两次基于当前状态计算新值，必须传入函数式更新 `setCount(prev => prev + 1)`。**

React 18+ 默认对所有事件、定时器、Promise 回调里的多次状态更新执行自动批处理（Batching），合并成一次重渲染。日常使用 `useState` 还需要守住三条纪律：

1. **昂贵初值使用惰性初始化**：`useState(() => buildInitialRows())` 传入函数本身而非立刻调用，避免每次重渲染都重复执行初始化计算；注意开发期 `<StrictMode>` 会故意调用两次初始化器验证纯度。
2. **对象和数组按不可变值处理**：React 用 `Object.is` 比较新旧状态引用。直接 `arr.push()` 再把原引用传回去不仅破坏旧快照，还会让 React 判定引用未变直接跳过更新；嵌套对象更新时必须展开变更路径（或者引入第三方 `use-immer` 用 `draft` 写法生成新引用）。
3. **派生状态直接算，不要另存一份 state**：购物车总价可以直接由 `items.reduce(...)` 在渲染期算出，单独建一个 `total` 状态并用 `useEffect` 同步只会制造“商品变了总价慢半拍”的双数据源 Bug。

### `useReducer` 与 `useSyncExternalStore`

当多个业务动作共同操作同一份复杂状态（如购物车增删改数量）时，用 `useReducer(reducer, initialArg, init?)` 配合 TypeScript 可辨识联合类型能把“触发什么动作”与“状态如何迁移”彻底拆开（`reducer` 必须是纯函数，不可写外部副作用，可选的第三个 `init` 参数适合规范化或解析持久化初始值）：

```tsx
import { useReducer } from 'react'

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
}

type CartAction =
  | { type: 'increment'; id: number }
  | { type: 'decrement'; id: number }
  | { type: 'remove'; id: number }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'increment':
      return state.map(item =>
        item.id === action.id ? { ...item, quantity: item.quantity + 1 } : item,
      )
    case 'decrement':
      return state.map(item =>
        item.id === action.id
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item,
      )
    case 'remove':
      return state.filter(item => item.id !== action.id)
    default: {
      const exhaustive: never = action
      throw new Error(`未知操作：${String(exhaustive)}`)
    }
  }
}
```

如果要订阅不归 React 管的外部数据源（如浏览器 `navigator.onLine`、`localStorage`、History 地址栏或自建外部 Store），不要自己手写 `useState + useEffect` 订阅，直接用 **`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)`** 以避免并发渲染下的数据撕裂（Tearing）。

**编写 `getSnapshot` 时有一条硬红线：外部数据没变时必须返回完全相同的引用或原始值，绝不能在 `getSnapshot` 里每次无条件 `return JSON.parse(...)` 或 `return { ...data }`，否则 `Object.is` 每次对比都判定变化，直接触发无限重渲染死循环。**

```tsx
import { useSyncExternalStore } from 'react'

const sameTabStorageEvent = 'app:storage-change'

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(sameTabStorageEvent, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(sameTabStorageEvent, onStoreChange)
  }
}

export function useStoredString(key: string, fallback: string) {
  const value = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback,
  )

  function setValue(nextValue: string) {
    window.localStorage.setItem(key, nextValue)
    window.dispatchEvent(new Event(sameTabStorageEvent))
  }

  return [value, setValue] as const
}
```

## `useEffect` 与 `useLayoutEffect`：同步外部系统与清理竞态

**不要把 `useEffect` 死记成 `componentDidMount` 的平替，它的正确心智模型是“在依赖存在期间连接外部系统，在依赖变化或卸载时对称断开旧连接”。**

```text
提交 DOM
  ↓
setup（建立连接 / 发起带 AbortSignal 的请求）
  ↓ 依赖发生变化
cleanup（断开上一次的连接 / abort 旧请求）
  ↓
setup（按新依赖重建连接）
  ↓ 组件卸载
cleanup（彻底清理）
```

在开发环境的 `<StrictMode>` 下，React 会在初次挂载后主动跑一遍 `setup -> cleanup -> setup`，专门抓那些漏写清理函数导致连接翻倍或定时器失控的代码。写数据请求 Effect 时，必须挂载 `AbortController` 在清理函数中取消过期请求，防止慢网络下的旧请求后返回覆盖掉新状态：

```tsx
useEffect(() => {
  const controller = new AbortController()

  async function loadUser() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextUser: User = await response.json()
      setUser(nextUser)
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : '请求失败')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  void loadUser()
  return () => controller.abort()
}, [userId])
```

什么时候**不需要** `useEffect`？两类最常见的滥用：

- **根据 Props/State 计算派生值**：直接在函数体渲染期算完（耗时再加 `useMemo`），不要多开一个 `useState` 再用 `useEffect` 去同步。
- **用户点击触发提交动作**：直接在 `onClick` / `onSubmit` 事件处理器里发请求，不要先设一个 `submitted = true` 再用 Effect 监听它。

此外，依赖数组必须诚实列出 Effect 内部读取的所有响应式变量；确实需要访问 DOM 并在**浏览器重绘之前**同步测量宽高修正位置（如 Tooltip 定位避免视觉闪烁）时，才改用 `useLayoutEffect`。由于 `useLayoutEffect` 会阻塞浏览器绘制，请求和普通订阅绝不能塞进去。

## `useRef`、`useImperativeHandle` 与 `useContext`（React 19 简化）

### `useRef` 与 React 19 `ref` 作为普通 Prop

`useRef(initialValue)` 返回一个跨渲染身份不变的 `{ current }` 容器，修改 `.current` 不会触发重渲染，适合存放 DOM 节点、定时器句柄和外部第三方库实例。切勿在渲染函数执行期间随意读写 `ref.current`，也不要把它写进 `useEffect` 依赖数组（`ref.current` 变动不会自动触发 Effect）。

向子组件暴露命令式能力（如聚焦、清空输入）时，**React 19 已经允许函数组件直接把 `ref` 当成普通 Prop 解构接收，彻底告别了繁琐的 `forwardRef` 包装**，配合 `useImperativeHandle` 仅暴露最小动作集合：

```tsx
import { useImperativeHandle, useRef, useState, type Ref } from 'react'

export interface SearchFieldHandle {
  focus: () => void
  clear: () => void
}

interface SearchFieldProps {
  ref?: Ref<SearchFieldHandle>
}

export function SearchField({ ref }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => setValue(''),
    }),
    [],
  )

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={event => setValue(event.currentTarget.value)}
    />
  )
}
```

### `useContext` 与稳定性边界

React 19 中可以直接写 `<ThemeContext value={value}>{children}</ThemeContext>`（替代旧版的 `<ThemeContext.Provider>`）。由于 React 会用 `Object.is` 比对 Provider 的 `value`，一旦 `value` 在父组件每次渲染时重新拼装成新对象，所有消费者都会被迫重渲染，因此需要用 `useCallback` 和 `useMemo` 稳住 `value` 引用；对于变化频率差异极大的状态（如高频滚动坐标与低频登录信息），应拆分成不同的 Context。

如果需要生成与 SSR Hydration 严格一致的表单无障碍关联 ID（`htmlFor` / `aria-describedby`），使用 `useId()`（不要拿它当列表 `key` 或业务主键）；封装复杂通用自定义 Hook 时，可以用 `useDebugValue(value, formatFn)` 在 React DevTools 中提供延迟求值的可读标签。

## React 19 并发与表单新 Hook：`useTransition`、`useActionState`、`useOptimistic`、`use`

React 19 把异步交互、表单状态管理和并发调度进一步整合成了一组开箱即用的 Hook：

### 1. `useTransition` 与 `useDeferredValue`：拆开紧急输入与非紧急渲染

受控输入框的文字回显必须同步跟手，而下方过滤上万行列表的渲染属于耗时工作。用 `useTransition` 把较重的状态更新标记为非紧急（React 19 支持向 `startTransition` 传入异步函数，但注意 `await` 之后恢复的状态更新仍需再包一层 `startTransition` 才能保留过渡标记）：

```tsx
const [query, setQuery] = useState('')
const [filter, setFilter] = useState('')
const [isPending, startTransition] = useTransition()

function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  const nextQuery = event.currentTarget.value
  setQuery(nextQuery) // 紧急：输入即时响应
  startTransition(() => {
    setFilter(nextQuery) // 非紧急：可以被下一次输入中断重启
  })
}
```

如果数据来自父组件传入的 Prop，自己拿不到更新它的 `setState` 函数，就用 `const deferredQuery = useDeferredValue(query)` 让慢子树暂用旧值先完成当前帧渲染，等主线程空闲再后台追新值。**`useDeferredValue` 推迟的是渲染而不是网络请求，它没有固定毫秒延迟，不能替代防抖控制接口请求频率。**

### 2. `useActionState`：收拢表单提交状态与错误返回

React 19 用 `useActionState(actionFn, initialState)` 取代了手写 `loading` + `error` + `try/finally` 的表单样板代码，直接返回当前状态、包装后的 `formAction` 以及提交进行中的 `isPending`：

```tsx
import { useActionState } from 'react'

interface FormState {
  error: string | null
  savedName?: string
}

async function updateNameAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: '名称不能为空' }

  const res = await fetch('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ name }),
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) return { error: `保存失败：HTTP ${res.status}` }
  return { error: null, savedName: name }
}

export function ProfileNameForm() {
  const [state, submitAction, isPending] = useActionState(updateNameAction, {
    error: null,
  })

  return (
    <form action={submitAction}>
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? '保存中...' : '保存'}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
```

### 3. `useOptimistic`：异步完成前的乐观 UI 反馈

在点赞、发送评论或切换收藏状态时，在 `startTransition` 或表单 Action 等待期间用 `useOptimistic` 先把期望的新状态渲染出来；一旦异步 Action 结束，界面自动同步回真实的权威状态，若失败也自动回滚：

```tsx
import { useOptimistic } from 'react'

export function MessageItem({
  messages,
  sendMessage,
}: {
  messages: Array<{ id: string; text: string; sending?: boolean }>
  sendMessage: (formData: FormData) => Promise<void>
}) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current, newText: string) => [
      ...current,
      { id: `temp-${Date.now()}`, text: newText, sending: true },
    ],
  )

  async function formAction(formData: FormData) {
    const text = String(formData.get('text') ?? '').trim()
    if (!text) return
    addOptimisticMessage(text)
    await sendMessage(formData)
  }

  return (
    <>
      <ul>
        {optimisticMessages.map(msg => (
          <li key={msg.id}>
            {msg.text}
            {msg.sending ? '（发送中...）' : ''}
          </li>
        ))}
      </ul>
      <form action={formAction}>
        <input name="text" />
        <button type="submit">发送</button>
      </form>
    </>
  )
}
```

### 4. `use`：在条件分支中读取 Promise 与 Context

与传统 Hook 必须在顶层调用不同，React 19 新增的 `use()` API 允许放在 `if` 条件语句或循环内部读取 Context 或 Promise。读取 Promise 时会自动挂起并交给外层最近的 `<Suspense>` 与错误边界接管；唯一要注意的是：**传入 `use(promise)` 的 Promise 必须来自稳定的缓存层、路由 Loader 或服务端组件传入，绝不能在客户端组件每次渲染时现场新建 `fetch(...)`，否则会陷入挂起循环。**

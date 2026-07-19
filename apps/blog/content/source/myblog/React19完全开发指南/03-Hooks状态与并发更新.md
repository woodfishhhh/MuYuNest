---
title: Hooks 状态与并发更新
date: 2026-07-13
updated: 2026-07-13
tags:
  - React 19
  - React Hooks
  - TypeScript
  - Immer
  - 并发渲染
source:
  - https://www.bilibili.com/video/BV1mcpPeMETt/
bvid: BV1mcpPeMETt
pages: P8-P13
draft: false
---

# Hooks 状态与并发更新

**每次渲染拿到的 props 和 state 都是一份固定快照。** `setState` 和 `dispatch` 提交的是下一次渲染要处理的更新，不会改写正在执行的事件处理器所读取的变量。

```text
事件处理器读取当前 render 的快照
        ↓
setState / dispatch 提交下一次 render 的更新
        ↓
React 批处理更新并重新调用组件
        ↓
新 render 获得新快照
```

## Hook 调用规则

Hook 只能在函数组件或自定义 Hook 的顶层调用，不能放进条件、循环和普通嵌套函数。这样 React 才能用稳定的调用顺序把每个 Hook 与对应状态关联起来。

调用 `setCount` 后紧接着读取的仍是旧值。这不是因为 `setCount` 等待某个定时器，而是因为正在执行的事件处理器闭包属于当前 render：

```tsx
const [count, setCount] = useState(0);

function handleClick() {
  setCount(count + 1);
  console.log(count); // 当前 render 的快照，仍是 0
}
```

## `useState`：局部状态

普通局部变量会在每次渲染时重新创建，修改它也不会通知 React。`useState` 同时提供当前快照和提交下一状态的函数：

```tsx
import { useState } from 'react';

export function Toggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <button type="button" onClick={() => setEnabled(value => !value)}>
      {enabled ? '已开启' : '已关闭'}
    </button>
  );
}
```

TypeScript 通常能从初始值推导类型。只有空数组、可空值或联合类型等信息不足的场景，才需要显式泛型：

```tsx
interface User {
  id: number;
  name: string;
}

const [users, setUsers] = useState<User[]>([]);
const [selected, setSelected] = useState<User | null>(null);
```

### 惰性初始化

初始化需要较多计算时，应传函数本身，而不是先调用函数：

```tsx
const [rows] = useState(() => buildInitialRows());
```

React 只在初始化状态时使用其结果。开发环境 Strict Mode 可能额外调用初始化函数来检查纯度，因此初始化函数不能写入外部变量、发送请求或产生其他副作用。

### 对象和数组按只读值处理

状态中的对象与数组不能原地修改。React 通过下一状态的引用判断是否需要继续更新；直接 `push` 后仍把同一数组交回去，既破坏旧快照，也可能让 React 跳过渲染。

| 目的 | 推荐写法 |
|---|---|
| 末尾添加 | `[...items, newItem]` |
| 删除 | `items.filter(...)` |
| 替换 | `items.map(...)` |
| 指定位置插入 | `[...items.slice(0, index), item, ...items.slice(index)]` |
| 排序或反转 | `[...items].sort(...)` / `[...items].reverse()` |

对象更新也要复制变更路径：

```tsx
interface Profile {
  name: string;
  preferences: {
    theme: 'light' | 'dark';
    compact: boolean;
  };
}

const [profile, setProfile] = useState<Profile>({
  name: '小满',
  preferences: { theme: 'light', compact: false },
});

function enableDarkMode() {
  setProfile(current => ({
    ...current,
    preferences: {
      ...current.preferences,
      theme: 'dark',
    },
  }));
}
```

`useState` 不会像某些 Store 那样浅合并对象。传入 `{ name: '新名字' }` 会把整个状态替换成这个新对象。

### 批处理与更新函数

同一个事件里的多次更新通常会被批处理。若下一状态依赖上一状态，应传更新函数：

```tsx
function addThree() {
  setCount(value => value + 1);
  setCount(value => value + 1);
  setCount(value => value + 1);
}
```

React 会按顺序把队列中的三个更新函数应用到待处理状态。若连续写三次 `setCount(count + 1)`，三次读取的都是当前 render 中相同的 `count`，最终只得到一次加一。这里的核心是**快照与更新队列**，不是“`setState` 天然防抖”或普通同步/异步任务的区别。

## `useReducer`：状态转换

当多个事件都要修改同一组结构化状态时，`useReducer` 可以把“发生了什么”和“状态怎样变化”分开：

```text
组件 dispatch(action)
        ↓
reducer(currentState, action)
        ↓
返回 nextState
        ↓
下一次 render 读取 nextState
```

Reducer 必须是纯函数：不能修改传入的旧状态，不能发送请求，也不能依赖调用次数。可辨识联合类型能让购物车 Action 保持类型安全：

```tsx
import { useReducer } from 'react';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

type CartAction =
  | { type: 'increment'; id: number }
  | { type: 'decrement'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'rename'; id: number; name: string };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'increment':
      return state.map(item =>
        item.id === action.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    case 'decrement':
      return state.map(item =>
        item.id === action.id
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item,
      );
    case 'remove':
      return state.filter(item => item.id !== action.id);
    case 'rename':
      return state.map(item =>
        item.id === action.id ? { ...item, name: action.name } : item,
      );
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`未知购物车操作：${String(exhaustiveCheck)}`);
    }
  }
}

const initialCart: CartItem[] = [
  { id: 1, name: '键盘', price: 299, quantity: 1 },
  { id: 2, name: '鼠标', price: 159, quantity: 2 },
];

export function Cart() {
  const [items, dispatch] = useReducer(cartReducer, initialCart);
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          {item.name} × {item.quantity}
          <button
            type="button"
            onClick={() => dispatch({ type: 'increment', id: item.id })}
          >
            +
          </button>
        </li>
      ))}
      <li>总价：{total}</li>
    </ul>
  );
}
```

总价是当前购物车能直接计算出的派生值，不必再保存成另一份状态。这样不会出现“商品数量已经更新，总价状态却忘了同步”的双数据源问题。

### 第三个参数：初始化函数

`useReducer(reducer, initialArg, init?)` 的 `init` 接收 `initialArg`，其返回值才是初始状态。它适合解析持久化数据或规范化初始值：

```tsx
function normalizeCart(items: CartItem[]): CartItem[] {
  return items.map(item => ({
    ...item,
    quantity: Math.max(0, item.quantity),
  }));
}

const [items, dispatch] = useReducer(
  cartReducer,
  initialCart,
  normalizeCart,
);
```

与 `useState` 一样，开发环境 Strict Mode 可能额外调用 reducer 和初始化函数来检查纯度。`dispatch` 也只提交下一次 render 的状态；在同一个事件处理器里紧接着读取 `items`，读到的仍是当前快照。

## `useImmer`：Draft 更新

`useImmer` 和 `useImmerReducer` 来自第三方包 **`use-immer`**，不是 React 官方 Hook。它们基于 Immer，让代码看起来像在修改 Draft，最终仍生成新的不可变状态并复用未修改的结构。

```bash
npm install immer use-immer
```

```tsx
import { useImmer } from 'use-immer';

export function ProfileEditor() {
  const [profile, updateProfile] = useImmer({
    name: '小满',
    preferences: {
      theme: 'light' as 'light' | 'dark',
      compact: false,
    },
  });

  function enableDarkMode() {
    updateProfile(draft => {
      draft.preferences.theme = 'dark';
      draft.preferences.compact = true;
    });
  }

  return (
    <button type="button" onClick={enableDarkMode}>
      {profile.preferences.theme}
    </button>
  );
}
```

数组的 `push`、`splice` 和下标赋值也可用于 Draft。它们修改的是 Immer 提供的代理，不是 React 交给当前 render 的旧状态。

`useImmerReducer` 保留 Action 模型，但 reducer 接收可写 Draft：

```tsx
import { useImmerReducer } from 'use-immer';

interface CounterState {
  count: number;
}

type CounterAction = { type: 'increment' } | { type: 'reset' };

function counterReducer(draft: CounterState, action: CounterAction) {
  if (action.type === 'increment') draft.count += 1;
  if (action.type === 'reset') draft.count = 0;
}

const [state, dispatch] = useImmerReducer(counterReducer, { count: 0 });
```

Immer 降低的是深层复制的书写成本，不会替代合理的状态拆分。Draft 也不应保存到外部、异步回调或下一次更新中继续使用。

## `useSyncExternalStore`：外部 Store 快照

`useSyncExternalStore` 用于连接不由 React 管理、但能被订阅的数据源，例如自建 Store、浏览器在线状态、`localStorage` 或 History。它接收三个契约：

| 参数 | 责任 |
|---|---|
| `subscribe(onStoreChange)` | 建立订阅；数据可能变化时调用回调；返回取消订阅函数 |
| `getSnapshot()` | 返回客户端当前快照 |
| `getServerSnapshot()` | 返回服务端渲染与 hydration 使用的初始快照 |

React 用 `Object.is` 比较相邻快照。快照必须满足以下要求：

- Store 没变化时，多次调用必须返回相同值或相同引用。
- Store 变化后，必须返回新的不可变快照。
- 若底层数据可变，应由适配层缓存最近一次不可变快照。
- 不要在 `getSnapshot` 中无条件写 `return JSON.parse(...)`、`return {...data}` 或 `return [...data]`，否则每次都是新引用，可能触发无限更新。

### 订阅 `localStorage`

`localStorage` 的原始值是字符串，天然适合作为稳定快照。浏览器的 `storage` 事件只通知同源的其他文档，因此当前标签页写入后还要发一个应用内事件：

```tsx
import { useSyncExternalStore } from 'react';

const sameTabStorageEvent = 'app:storage-change';

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(sameTabStorageEvent, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(sameTabStorageEvent, onStoreChange);
  };
}

export function useStoredString(key: string, fallback: string) {
  const value = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback,
  );

  function setValue(nextValue: string) {
    window.localStorage.setItem(key, nextValue);
    window.dispatchEvent(new Event(sameTabStorageEvent));
  }

  return [value, setValue] as const;
}
```

若要保存对象，可以让快照仍保持序列化字符串，再在快照之外解析；或者在 Store 适配器中缓存解析后的不可变对象。SSR 场景的 `getServerSnapshot` 必须与客户端 hydration 时的初始数据一致，实际项目通常由服务端把这份数据序列化到页面中。

### 订阅 History

`popstate` 会响应前进和后退，但 `history.pushState()` 与 `replaceState()` 本身不会派发 `popstate`。封装导航方法时应主动通知订阅者：

```tsx
const locationChangeEvent = 'app:location-change';

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener(locationChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener(locationChangeEvent, onStoreChange);
  };
}

function getLocationSnapshot() {
  return location.pathname + location.search + location.hash;
}

function push(url: string) {
  history.pushState(null, '', url);
  window.dispatchEvent(new Event(locationChangeEvent));
}

function useLocationPath() {
  return useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    () => '/',
  );
}
```

真实 SSR 应把请求 URL 作为服务端快照，而不是固定写成 `/`。完整路由器还要处理 base path、滚动恢复、并发导航和错误边界，这个示例只说明外部 Store 的订阅协议。

## `useTransition`：非紧急更新

Transition 不是动画，也不是定时器。传给 `startTransition` 的函数会立即执行；React 只是把其中同步提交的状态更新标记为非紧急，使渲染可以被点击、输入等更紧急的更新打断并重启。

```tsx
import { memo, useMemo, useState, useTransition } from 'react';

interface Row {
  id: number;
  name: string;
}

const ResultList = memo(function ResultList({
  rows,
  filter,
}: {
  rows: Row[];
  filter: string;
}) {
  const visibleRows = useMemo(
    () => rows.filter(row => row.name.includes(filter)),
    [rows, filter],
  );

  return <ul>{visibleRows.map(row => <li key={row.id}>{row.name}</li>)}</ul>;
});

export function SearchPanel({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.currentTarget.value;

    setQuery(nextQuery); // 紧急：受控输入必须同步跟手
    startTransition(() => {
      setFilter(nextQuery); // 非紧急：较重的结果区域可以稍后完成
    });
  }

  return (
    <section aria-busy={isPending}>
      <input value={query} onChange={handleChange} />
      {isPending && <p>正在更新结果...</p>}
      <ResultList rows={rows} filter={filter} />
    </section>
  );
}
```

受控文本框的 `value` 不能由 Transition 更新，否则输入会失去即时一致性。应同步更新输入值，只把列表、图表、Tab 内容或导航结果等可中断部分放进 Transition。

React 19 的 Transition Action 可以是异步函数，但目前 `await` 之后的状态更新需要再包一层 `startTransition` 才会被标记：

```tsx
startTransition(async () => {
  const result = await saveSettings();
  startTransition(() => {
    setSavedSettings(result);
  });
});
```

把 `setState` 放入 `setTimeout` 后不会自动继承 Transition 标记。异步请求还可能乱序完成，应另外使用取消、请求序号、队列或更高层的 Action API 维护顺序。

## `useDeferredValue`：延后值

无法直接控制状态更新位置时，可以把一个值的“旧版本”暂时交给较慢的子树：

```tsx
import { useDeferredValue, useState } from 'react';

export function DeferredSearch({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <section>
      <input
        value={query}
        onChange={event => setQuery(event.currentTarget.value)}
      />
      <div
        aria-busy={isStale}
        style={{ opacity: isStale ? 0.5 : 1 }}
      >
        <ResultList rows={rows} filter={deferredQuery} />
      </div>
    </section>
  );
}
```

首次渲染时，没有旧值可用，返回值通常与传入值相同。更新时，React 先用旧的 deferred 值完成当前渲染，再在后台尝试新值；后台渲染可以被新的输入打断。

`useDeferredValue` 没有固定的 300ms 或 500ms 延迟，所以它不是防抖，也不保证减少网络请求。若每次按键都发请求，仍然会产生每次按键对应的请求；它延后的只是使用该值的渲染。要控制请求频率，应另做防抖、缓存或取消。

## 选型

| 需求 | 选择 |
|---|---|
| 少量局部状态 | `useState` |
| 多个事件修改同一组复杂状态 | `useReducer` |
| 深层不可变更新太繁琐 | 第三方 `useImmer` / `useImmerReducer` |
| 订阅 React 外部 Store 或浏览器数据源 | `useSyncExternalStore` |
| 自己掌握更新函数，想降低该更新的紧急度 | `useTransition` |
| 只拿到一个值，想让慢 UI 暂时使用旧值 | `useDeferredValue` |

判断是否使用并发 Hook 时，先通过性能分析确认瓶颈。Transition 和 deferred value 只能让渲染调度更合理，不能替代虚拟列表、数据缓存、拆分组件或降低计算复杂度。

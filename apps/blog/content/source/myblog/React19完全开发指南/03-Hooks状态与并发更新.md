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

每次渲染拿到的 props 和 state 都是一份固定的快照。`setState` 和 `dispatch` 提交的是下一次渲染要处理的更新，不会改掉正在执行的事件处理器里读到的变量。

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

Hook 只能在函数组件或自定义 Hook 的顶层调用，不能放进条件、循环和普通的嵌套函数里。这样 React 才能靠稳定的调用顺序，把每个 Hook 和对应的状态对上。

调完 `setCount` 紧接着读，拿到的还是旧值。原因不是 `setCount` 在等什么定时器，而是正在执行的事件处理器闭包属于当前这次 render：

```tsx
const [count, setCount] = useState(0);

function handleClick() {
  setCount(count + 1);
  console.log(count); // 当前 render 的快照，仍是 0
}
```

## `useState`：局部状态

普通的局部变量每次渲染都会重新创建，改了也不会通知 React。`useState` 同时给出当前的快照和提交下一个状态的函数：

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

TypeScript 一般能从初始值推出类型。只有空数组、可空值、联合类型这类信息不够的场景，才要显式写泛型：

```tsx
interface User {
  id: number;
  name: string;
}

const [users, setUsers] = useState<User[]>([]);
const [selected, setSelected] = useState<User | null>(null);
```

### 惰性初始化

初始化要做比较多的计算时，传函数本身，别先把函数调了：

```tsx
const [rows] = useState(() => buildInitialRows());
```

React 只在初始化状态时用它的结果。开发环境的 Strict Mode 可能多调一次初始化函数来检查纯度，所以初始化函数里不能写外部变量、发请求或者产生别的副作用。

### 对象和数组按只读值处理

状态里的对象和数组不能原地改。React 靠下一个状态的引用判断要不要接着更新；直接 `push` 之后还把同一个数组交回去，既破坏了旧快照，也可能让 React 跳过渲染。

| 目的 | 推荐写法 |
|---|---|
| 末尾添加 | `[...items, newItem]` |
| 删除 | `items.filter(...)` |
| 替换 | `items.map(...)` |
| 指定位置插入 | `[...items.slice(0, index), item, ...items.slice(index)]` |
| 排序或反转 | `[...items].sort(...)` / `[...items].reverse()` |

更新对象也要把变更的那条路径复制一遍：

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

`useState` 不会像某些 Store 那样浅合并对象。传 `{ name: '新名字' }` 进去，整个状态就被换成了这个新对象。

### 批处理与更新函数

同一个事件里的多次更新一般会被批处理。下一个状态依赖上一个状态时，要传更新函数：

```tsx
function addThree() {
  setCount(value => value + 1);
  setCount(value => value + 1);
  setCount(value => value + 1);
}
```

React 会按顺序把队列里的三个更新函数应用到待处理的状态上。要是连写三次 `setCount(count + 1)`，三次读到的都是当前 render 里同一个 `count`，最后只加了一次。关键在快照和更新队列，跟"`setState` 自带防抖"或者普通的同步/异步任务没关系。

## `useReducer`：状态转换

好几个事件都要改同一组结构化状态时，`useReducer` 能把"发生了什么"和"状态怎么变"分开：

```text
组件 dispatch(action)
        ↓
reducer(currentState, action)
        ↓
返回 nextState
        ↓
下一次 render 读取 nextState
```

Reducer 必须是纯函数：不能改传进来的旧状态，不能发请求，也不能依赖被调了几次。可辨识联合类型能让购物车的 Action 保持类型安全：

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

总价是当前购物车能直接算出来的派生值，不用再存成另一份状态。这样就不会出现"商品数量更新了，总价状态却忘了同步"的双数据源问题。

### 第三个参数：初始化函数

`useReducer(reducer, initialArg, init?)` 的 `init` 接收 `initialArg`，它的返回值才是初始状态。适合用来解析持久化数据或规范化初始值：

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

和 `useState` 一样，开发环境的 Strict Mode 可能多调几次 reducer 和初始化函数来检查纯度。`dispatch` 也只是提交下一次 render 的状态；同一个事件处理器里紧接着读 `items`，读到的还是当前的快照。

## `useImmer`：Draft 更新

`useImmer` 和 `useImmerReducer` 来自第三方包 `use-immer`，不是 React 官方的 Hook。它们基于 Immer，代码看起来像在改 Draft，最后还是生成新的不可变状态，并复用没改动的结构。

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

数组的 `push`、`splice` 和下标赋值也能用在 Draft 上。它们改的是 Immer 提供的代理，不是 React 交给当前 render 的旧状态。

`useImmerReducer` 保留了 Action 模型，只是 reducer 接收的是能写的 Draft：

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

Immer 省掉的是深层复制的书写成本，代替不了合理的状态拆分。Draft 也别存到外面、放进异步回调，或者留到下一次更新接着用。

## `useSyncExternalStore`：外部 Store 快照

`useSyncExternalStore` 用来连接不归 React 管、但能订阅的数据源，比如自建的 Store、浏览器的在线状态、`localStorage` 或 History。它接收三个约定：

| 参数 | 责任 |
|---|---|
| `subscribe(onStoreChange)` | 建立订阅；数据可能变化时调用回调；返回取消订阅函数 |
| `getSnapshot()` | 返回客户端当前快照 |
| `getServerSnapshot()` | 返回服务端渲染与 hydration 使用的初始快照 |

React 用 `Object.is` 比较相邻的两次快照。快照要满足：

- Store 没变时，多次调用要返回相同的值或相同的引用。
- Store 变了以后，要返回新的不可变快照。
- 底层数据是可变的话，要由适配层缓存最近一次的不可变快照。
- 别在 `getSnapshot` 里无条件写 `return JSON.parse(...)`、`return {...data}` 或 `return [...data]`，不然每次都是新引用，可能触发无限更新。

### 订阅 `localStorage`

`localStorage` 的原始值是字符串，天然适合当稳定的快照。浏览器的 `storage` 事件只通知同源的其他文档，所以当前标签页写完后，还要自己发一个应用内的事件：

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

要存对象的话，可以让快照还是序列化的字符串，在快照之外再解析；或者在 Store 适配器里缓存解析好的不可变对象。SSR 场景下的 `getServerSnapshot` 必须和客户端 hydration 时的初始数据一致，实际项目一般由服务端把这份数据序列化到页面里。

### 订阅 History

`popstate` 会响应前进和后退，但 `history.pushState()` 和 `replaceState()` 本身不会派发 `popstate`。封装导航方法时要主动通知订阅者：

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

真实的 SSR 要把请求的 URL 当作服务端快照，别固定写成 `/`。完整的路由器还要处理 base path、滚动恢复、并发导航和错误边界，这个示例只用来说明外部 Store 的订阅协议。

## `useTransition`：非紧急更新

Transition 不是动画，也不是定时器。传给 `startTransition` 的函数会立刻执行；React 只是把里面同步提交的状态更新标成非紧急，让这次渲染能被点击、输入这些更紧急的更新打断并重来。

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

受控文本框的 `value` 不能用 Transition 更新，不然输入就没法即时保持一致。输入值要同步更新，只把列表、图表、Tab 内容或导航结果这些能中断的部分放进 Transition。

React 19 的 Transition Action 可以是异步函数，但目前 `await` 之后的状态更新还要再包一层 `startTransition` 才会被标记：

```tsx
startTransition(async () => {
  const result = await saveSettings();
  startTransition(() => {
    setSavedSettings(result);
  });
});
```

把 `setState` 放进 `setTimeout` 后，不会自动继承 Transition 标记。异步请求还可能乱序完成，要另外用取消、请求序号、队列或更上层的 Action API 来维护顺序。

## `useDeferredValue`：延后值

没法直接控制状态在哪里更新时，可以把一个值的"旧版本"暂时交给比较慢的子树：

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

首次渲染时没有旧值可用，返回值一般和传进去的一样。更新时，React 先用旧的 deferred 值完成这次渲染，再在后台试新值；后台渲染能被新的输入打断。

`useDeferredValue` 没有固定的 300ms 或 500ms 延迟，所以它不是防抖，也不保证减少网络请求。每次按键都发请求的话，请求照样每次都会发；它推迟的只是用到这个值的渲染。要控制请求频率，得另外做防抖、缓存或取消。

## 选型

| 需求 | 选择 |
|---|---|
| 少量局部状态 | `useState` |
| 多个事件修改同一组复杂状态 | `useReducer` |
| 深层不可变更新太繁琐 | 第三方 `useImmer` / `useImmerReducer` |
| 订阅 React 外部 Store 或浏览器数据源 | `useSyncExternalStore` |
| 自己掌握更新函数，想降低该更新的紧急度 | `useTransition` |
| 只拿到一个值，想让慢 UI 暂时使用旧值 | `useDeferredValue` |

决定要不要用并发 Hook 之前，先用性能分析确认瓶颈在哪。Transition 和 deferred value 只能让渲染调度更合理，代替不了虚拟列表、数据缓存、拆分组件或者降低计算复杂度。

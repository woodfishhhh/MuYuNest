---
title: Effect、引用与性能优化
date: 2026-07-13
updated: 2026-07-13
tags:
  - React 19
  - React Hooks
  - Effect
  - Context
  - 性能优化
  - 可访问性
source:
  - https://www.bilibili.com/video/BV1mcpPeMETt/
bvid: BV1mcpPeMETt
pages: P14-P22
draft: false
---

# Effect、引用与性能优化

## `useEffect`：同步外部系统

React 组件的渲染必须是纯的。网络连接、浏览器事件、计时器、第三方控件和手动调 DOM API 都不归 React 管，Effect 用来让组件和这些外部系统保持同步。

纯计算是同样的输入得到同样的输出，而且不改外部的值。副作用会观察或改变函数之外的系统，比如建连接、写存储、订阅事件。React 要求 render 保持纯粹，再把这些外部同步的工作放进 Effect。

别只把 Effect 记成类组件生命周期的替代品。更稳的思维模型是一个能重复执行的同步过程：

```text
提交 DOM
  ↓
setup：连接当前外部系统
  ↓ 依赖变化
cleanup：断开旧系统
  ↓
setup：连接新系统
  ↓ 组件卸载
cleanup：最后断开一次
```

### setup、依赖与 cleanup

```tsx
import { useEffect } from 'react';

interface ChatRoomProps {
  serverUrl: string;
  roomId: string;
}

export function ChatRoom({ serverUrl, roomId }: ChatRoomProps) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();

    return () => {
      connection.disconnect();
    };
  }, [serverUrl, roomId]);

  return <p>房间：{roomId}</p>;
}
```

依赖数组要包含 Effect 里读到的所有响应式值，包括 props、state，以及组件里声明的变量和函数。React 用 `Object.is` 比较相邻两次的依赖：

| 写法 | 执行语义 |
|---|---|
| 不传依赖数组 | 每次提交后重新同步 |
| `[]` | 没有响应式依赖；生产环境在初次提交后建立同步 |
| `[a, b]` | 初次提交后执行；`a` 或 `b` 改变时先 cleanup 再 setup |

开发环境的 Strict Mode 会在第一次真正的 setup 之前，多跑一次 `setup → cleanup`，用来检查清理逻辑写全了没有。所以 `[]` 不能粗略地理解成"任何环境下都绝对只执行一次"。用户应该感觉不到一次 setup 和 `setup → cleanup → setup` 有什么区别。

Effect 只在客户端运行。普通的 Effect 在提交后执行；非交互的更新里，React 一般会先让浏览器绘制，但别依赖某个绝对的绘制时序。必须在重绘前完成的视觉测量要用 `useLayoutEffect`。

### 请求也需要清理竞态

依赖变了以后，旧请求可能比新请求晚返回。cleanup 要取消不再需要的请求：

```tsx
import { useEffect, useState } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

function UserDetails({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const nextUser: User = await response.json();
        setUser(nextUser);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : '请求失败');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadUser();
    return () => controller.abort();
  }, [userId]);

  if (loading) return <p>加载中...</p>;
  if (error) return <p role="alert">{error}</p>;
  return <p>{user?.name}</p>;
}
```

用的路由或请求库支持数据加载的话，优先用框架提供的缓存、SSR、预取和竞态处理，别每个组件都手写一个 fetch Effect。

### 什么时候不需要 Effect

没有外部系统的话，一般就不需要 Effect：

```tsx
// 不推荐：为纯派生值维护第二份状态
useEffect(() => {
  setTotal(items.reduce((sum, item) => sum + item.price, 0));
}, [items]);

// 推荐：渲染时直接计算
const total = items.reduce((sum, item) => sum + item.price, 0);
```

用户点击后要提交表单，也应该直接在事件处理器里做，别先设一个 `submitted`、再用 Effect 去观察它。Effect 是用来同步外部系统的，不是让普通的数据流绕一圈。

## `useLayoutEffect`：重绘前测量

`useLayoutEffect` 的依赖和 cleanup 规则跟 `useEffect` 一样，区别在时机：组件已经提交到 DOM，但浏览器还没重绘。它本身和里面触发的状态更新都会阻塞这次重绘。

```text
render
  ↓
React 提交 DOM
  ↓
useLayoutEffect：读取布局、必要时同步修正
  ↓
浏览器重绘
  ↓
useEffect：通常在此后同步非视觉外部系统
```

一个要根据真实高度调整位置的浮层，可以先渲染、测量，再在用户看到之前完成第二次渲染：

```tsx
import { useLayoutEffect, useRef, useState } from 'react';

export function Tooltip({ text }: { text: string }) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const nextHeight =
      tooltipRef.current?.getBoundingClientRect().height ?? 0;
    setHeight(nextHeight);
  }, [text]);

  return (
    <div
      ref={tooltipRef}
      style={{ transform: `translateY(-${height}px)` }}
    >
      {text}
    </div>
  );
}
```

适合的场景有：tooltip 定位、首次显示前的尺寸测量、必须避免跳动的滚动位置恢复。请求、日志和普通的订阅别放进 `useLayoutEffect`；阻塞重绘的代码越多，页面越卡。服务端没有布局信息，这类组件一般要在客户端交互之后再显示。

## `useRef`：持久可变引用

`useRef(initialValue)` 返回一个稳定的对象 `{ current }`。改 `current` 不会触发重新渲染，所以适合存：

- DOM 节点。
- 计时器句柄、第三方实例和订阅句柄。
- 只给事件或 Effect 用的上一次的值。

会影响 JSX 的数据都应该放 state，别放 ref。

### 聚焦 DOM 节点

```tsx
import { useRef } from 'react';

export function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input ref={inputRef} type="search" />
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
      >
        聚焦搜索框
      </button>
    </div>
  );
}
```

能用 JSX 声明的样式和内容，还是保持声明式；ref 更适合焦点、选区、滚动、测量和第三方的命令式 API。

### 保存计时器句柄

函数组件重新执行时，普通的局部变量会重新初始化；把变量提到模块顶层，又会让多个组件实例共用一份数据。ref 能在每个组件实例里稳定地保存句柄：

```tsx
import { useEffect, useRef, useState } from 'react';

export function Timer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() {
    if (intervalRef.current !== null) return;

    intervalRef.current = setInterval(() => {
      setSeconds(value => value + 1);
    }, 1000);
  }

  function stop() {
    if (intervalRef.current === null) return;

    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div>
      <output>{seconds}</output>
      <button type="button" onClick={start}>开始</button>
      <button type="button" onClick={stop}>停止</button>
    </div>
  );
}
```

别在 render 过程中随便读写 `ref.current`。渲染要保持纯粹，ref 一般在事件处理器、Effect 或 React 管理的 ref 回调里用。`ref.current` 也不是响应式的依赖；把它写进 Effect 的依赖，current 变了 Effect 也不会自动执行。

## `useImperativeHandle`：最小命令式接口

父组件一般应该通过 props 控制子组件。只有焦点、滚动、播放、打开弹窗、表单校验或重置这类天然就是命令式的能力，才适合通过 ref 暴露。

React 19 可以直接把 `ref` 当 prop 接收，不用再 `forwardRef`：

```tsx
import { useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';

export interface SearchFieldHandle {
  focus: () => void;
  clear: () => void;
}

interface SearchFieldProps {
  ref?: Ref<SearchFieldHandle>;
}

export function SearchField({ ref }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => setValue(''),
    }),
    [],
  );

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={event => setValue(event.currentTarget.value)}
    />
  );
}

export function SearchPage() {
  const fieldRef = useRef<SearchFieldHandle>(null);

  return (
    <div>
      <SearchField ref={fieldRef} />
      <button type="button" onClick={() => fieldRef.current?.focus()}>
        聚焦
      </button>
      <button type="button" onClick={() => fieldRef.current?.clear()}>
        清空
      </button>
    </div>
  );
}
```

`useImperativeHandle(ref, createHandle, dependencies?)` 会把 `createHandle` 返回的对象交给父组件，依赖规则跟其他 Hook 一样。接口尽量只暴露必要的动作，别把整个 DOM、内部 state 和 setter 一股脑交出去，不然子组件的边界就没意义了。React 18 及更早的版本才需要用 `forwardRef` 接 ref。

## `useContext`：跨层读取上下文

Context 解决的是主题、认证信息、区域设置这类树级数据跨好几层组件传递时，props 要一层层转发的问题。它不是自动的全局 Store：值还是由某个 Provider 提供，受这棵组件树的边界约束。

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>('light');
  const toggleTheme = useCallback(() => {
    setTheme(current => (current === 'light' ? 'dark' : 'light'));
  }, []);
  const value = useMemo(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  // React 19 的 Provider 简写
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme 必须在 ThemeProvider 内调用');
  }
  return value;
}

export function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      当前主题：{theme}
    </button>
  );
}
```

React 18 用 `<ThemeContext.Provider value={value}>`；React 19 可以直接渲染 `<ThemeContext value={value}>`。

要记住这几条边界：

- `useContext` 读的是组件上方最近的同一个 Context 的 Provider。
- 同一个 Context 嵌套时，内层的 Provider 覆盖外层的值。
- `createContext(defaultValue)` 的默认值只是没有 Provider 时的静态兜底，不会自己更新。
- Provider 的新旧 `value` 用 `Object.is` 比较。对象每次重建，就会通知所有消费者。
- `memo` 挡不住组件收到新的 Context 值。变化频率差别很大的数据，可以拆成好几个 Context。

示例里的 `useMemo` 和 `useCallback` 只是为了减少 value 身份不必要的变化；Context 的正确性不能靠缓存存在来保证。

## `memo` 与 `useMemo`：缓存组件和计算

`memo` 包装组件：父组件重新渲染、而这个组件的 props 没变时，React 一般能跳过它。默认逐项用 `Object.is` 比较 props。组件自己的 state 或读的 Context 变了，它还是会重新渲染。

`useMemo` 缓存一次纯计算的结果，依赖没变就复用。购物车可以同时缓存子组件和筛选计算：

```tsx
import { memo, useCallback, useMemo, useState } from 'react';

interface CartLine {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

const CartRow = memo(function CartRow({
  item,
  onRemove,
}: {
  item: CartLine;
  onRemove: (id: number) => void;
}) {
  return (
    <li>
      {item.name} × {item.quantity}
      <button type="button" onClick={() => onRemove(item.id)}>
        删除
      </button>
    </li>
  );
});

export function CartView({ initialItems }: { initialItems: CartLine[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');

  const total = useMemo(
    () => items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    ),
    [items],
  );

  const removeItem = useCallback((id: number) => {
    setItems(current => current.filter(item => item.id !== id));
  }, []);

  return (
    <section>
      <input value={query} onChange={event => setQuery(event.currentTarget.value)} />
      <ul>
        {items.map(item => (
          <CartRow key={item.id} item={item} onRemove={removeItem} />
        ))}
      </ul>
      <p>总价：{total}</p>
    </section>
  );
}
```

输入 `query` 会让父组件重新渲染，但 `items`、每个没改动的 `item` 的引用和 `removeItem` 都没变，所以 memo 过的行组件有机会跳过渲染。`total` 只在 `items` 的引用变了时才重新算。

这些 API 都只是性能优化，不保证语义。React 可能因为开发时的热更新、初次挂起等原因丢掉缓存，也可能重新渲染 memo 过的组件。去掉 `memo` 和 `useMemo` 之后，代码也必须是对的。先用 React Profiler 找到真正慢的计算或高频的子树，再加缓存；简单的加法和普通的内联对象一般不值得缓存。

开了 React Compiler 的项目会自动做很多等价的优化，手写 memoization 的必要性就更低了。

## `useCallback`：缓存函数引用

`useCallback(fn, dependencies)` 返回函数本身，不会调用它；它和 `useMemo(() => fn, dependencies)` 是等价的。常用在两类边界：

- 把回调传给 `memo` 包装的子组件，免得函数身份每次都变。
- 某个 Hook 或外部 API 明确靠函数身份决定要不要重新订阅。

上面例子里的 `removeItem` 用的是函数式的状态更新，不需要读 `items`，所以依赖可以放心写成 `[]`。回调要是读了 props、state 或组件里的变量，就必须把这些响应式值写进依赖，不能为了"让函数不变"故意漏依赖，不然会读到旧的闭包。

普通内联函数的创建一般很便宜。给每个函数都单独套一层 `useCallback`，反而多了依赖维护和缓存的成本。和 `useMemo` 一样，它只能当优化用，去掉以后功能也得是对的。

## `useDebugValue`：自定义 Hook 调试标签

`useDebugValue` 给自定义 Hook 在 React DevTools 里加一个好读的标签，不渲染 UI，也代替不了日志和测试。在线状态的 Hook 可以直接暴露调试标签：

```tsx
import { useDebugValue, useSyncExternalStore } from 'react';

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true,
  );

  useDebugValue(isOnline, value => (value ? 'Online' : 'Offline'));
  return isOnline;
}
```

第二个参数是格式化函数，React DevTools 检查这个组件时才会调用，所以适合把复杂的内部结构推迟到那时再格式化。不用给每个简单的自定义 Hook 都加调试值；共享库和内部状态比较复杂的 Hook 收益最大。

## `useId`：可访问性 ID

`useId` 生成和组件树位置关联的 ID，适合把 `label`、输入框、提示和错误信息连起来；服务端渲染和客户端 hydration 的组件树一致时，两边的 ID 也能对上。

```tsx
import { useId } from 'react';

export function EmailField() {
  const baseId = useId();
  const inputId = `${baseId}-email`;
  const hintId = `${baseId}-hint`;

  return (
    <div>
      <label htmlFor={inputId}>邮箱</label>
      <input
        id={inputId}
        type="email"
        aria-describedby={hintId}
      />
      <p id={hintId}>用于接收账户通知。</p>
    </div>
  );
}
```

一次 `useId` 可以给好几个相关元素当前缀。返回的字符串当成不透明的值，别去解析，也别依赖它现在的冒号格式。

`useId` 有三件事不能干：

- 不能用来生成列表的 `key`。key 必须来自数据本身，才能表达条目的身份。
- 不能当业务主键或接口请求 ID。这类 ID 要由后端生成，或者在事件发生时用专门的 UUID 方案生成。
- 不能代替缓存 key。缓存的身份同样要由数据决定。

## 选型

```text
能在 render 中直接计算
    → 直接计算，不加 Effect

需要同步浏览器、网络或第三方系统
    → useEffect + 对称 cleanup

必须在重绘前读取并修正布局
    → useLayoutEffect，保持短小

值不参与渲染，只需跨 render 保存
    → useRef

必须向父组件暴露少量命令式动作
    → React 19 ref prop + useImperativeHandle

跨层共享树级数据
    → Context，控制 value 身份和更新范围

Profiler 证明存在重复计算或渲染
    → memo / useMemo / useCallback
```

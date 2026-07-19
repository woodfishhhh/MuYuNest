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

React 组件的渲染必须保持纯粹。网络连接、浏览器事件、计时器、第三方控件和手动 DOM API 都不由 React 管理，Effect 用来让组件与这些外部系统同步。

纯计算在相同输入下得到相同输出，并且不会修改外部值。副作用则会观察或改变函数之外的系统，例如建立连接、写入存储或订阅事件。React 要求 render 保持纯粹，再把这些外部同步工作放进 Effect。

不要把 Effect 只记成类组件生命周期的替代品。更稳定的思维模型是一个可重复的同步过程：

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

依赖数组必须包含 Effect 中读取的所有响应式值，包括 props、state，以及组件内部声明的变量和函数。React 用 `Object.is` 比较相邻依赖：

| 写法 | 执行语义 |
|---|---|
| 不传依赖数组 | 每次提交后重新同步 |
| `[]` | 没有响应式依赖；生产环境在初次提交后建立同步 |
| `[a, b]` | 初次提交后执行；`a` 或 `b` 改变时先 cleanup 再 setup |

开发环境 Strict Mode 会在第一次真实 setup 前额外执行一次 `setup → cleanup`，用于检查清理逻辑是否完整。因此 `[]` 不能粗略理解成“任何环境绝对只执行一次”。用户不应感知到一次 setup 与 `setup → cleanup → setup` 的区别。

Effect 只在客户端运行。普通 Effect 在提交后执行；非交互更新时 React 通常会先让浏览器绘制，但不应依赖某个绝对的绘制时序。必须在重绘前完成的视觉测量应使用 `useLayoutEffect`。

### 请求也需要清理竞态

依赖变化时，旧请求可能晚于新请求返回。cleanup 应取消不再需要的请求：

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

在支持数据加载的路由或请求库中，优先使用框架提供的缓存、SSR、预取和竞态处理能力，而不是每个组件都手写 fetch Effect。

### 什么时候不需要 Effect

若没有外部系统，通常不需要 Effect：

```tsx
// 不推荐：为纯派生值维护第二份状态
useEffect(() => {
  setTotal(items.reduce((sum, item) => sum + item.price, 0));
}, [items]);

// 推荐：渲染时直接计算
const total = items.reduce((sum, item) => sum + item.price, 0);
```

用户点击后要提交表单，也应在事件处理器中执行，而不是先设置 `submitted` 再用 Effect 观察它。Effect 的职责是同步外部系统，不是把普通数据流绕一圈。

## `useLayoutEffect`：重绘前测量

`useLayoutEffect` 的依赖和 cleanup 规则与 `useEffect` 相同，区别在时机：组件已经提交到 DOM，但浏览器还没有重绘。它以及其中触发的状态更新会阻塞当前重绘。

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

一个需要根据真实高度调整位置的浮层，可以先渲染、测量，再在用户看到之前完成第二次渲染：

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

适合的场景包括 tooltip 定位、首次显示前的尺寸测量，以及必须避免跳动的滚动位置恢复。不要把请求、日志和普通订阅放进 `useLayoutEffect`；阻塞重绘的代码越多，页面越卡。服务端没有布局信息，这类组件通常应在客户端交互后再显示。

## `useRef`：持久可变引用

`useRef(initialValue)` 返回一个稳定对象 `{ current }`。修改 `current` 不会触发重新渲染，因此它适合保存：

- DOM 节点。
- 计时器句柄、第三方实例和订阅句柄。
- 只供事件或 Effect 使用的上一次值。

凡是会影响 JSX 的数据都应该放在 state 中，而不是 ref 中。

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

能用 JSX 声明的样式和内容仍应保持声明式；ref 更适合焦点、选区、滚动、测量和第三方命令式 API。

### 保存计时器句柄

函数组件重新执行时，普通局部变量会重新初始化。把变量提到模块顶层又会让多个组件实例共享同一份数据。ref 能在每个组件实例内稳定保存句柄：

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

不要在 render 过程中随意读取或写入 `ref.current`。渲染应保持纯粹，ref 通常在事件处理器、Effect 或 React 管理的 ref 回调中使用。`ref.current` 也不是响应式依赖；把它写进 Effect 依赖不会让 Effect 在 current 改变时自动执行。

## `useImperativeHandle`：最小命令式接口

父组件通常应通过 props 控制子组件。只有焦点、滚动、播放、打开弹窗、表单校验或重置等天然命令式能力，才适合通过 ref 暴露。

React 19 可以直接把 `ref` 当作 prop 接收，不再需要 `forwardRef`：

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

`useImperativeHandle(ref, createHandle, dependencies?)` 会把 `createHandle` 返回的对象交给父组件。依赖规则与其他 Hook 相同。接口应尽量只暴露必要动作，不要把全部 DOM、内部 state 和 setter 一股脑交出去，否则子组件边界会失去意义。React 18 及更早版本才需要用 `forwardRef` 接收 ref。

## `useContext`：跨层读取上下文

Context 解决跨多层组件传递主题、认证信息、区域设置等树级数据时的 props 逐层转发。它不是自动的全局 Store：值仍由某个 Provider 提供，并受该组件树边界约束。

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

React 18 使用 `<ThemeContext.Provider value={value}>`；React 19 可以直接渲染 `<ThemeContext value={value}>`。

需要记住以下边界：

- `useContext` 读取组件上方最近的同一个 Context Provider。
- 同一 Context 嵌套时，内层 Provider 会覆盖外层值。
- `createContext(defaultValue)` 的默认值只是在没有 Provider 时使用的静态兜底，不会自行更新。
- Provider 的新旧 `value` 用 `Object.is` 比较。对象每次重建会通知所有消费者。
- `memo` 不能阻止组件接收新的 Context 值。变化频率差异很大的数据可以拆成多个 Context。

示例中的 `useMemo` 和 `useCallback` 只是减少不必要 value 身份变化的优化；Context 的正确性不应依赖缓存存在。

## `memo` 与 `useMemo`：缓存组件和计算

`memo` 包装组件，父组件重新渲染而该组件 props 仍相同时，React 通常可以跳过该组件。默认逐项使用 `Object.is` 比较 props。组件自己的 state 或读取的 Context 改变时，它仍会重新渲染。

`useMemo` 缓存一次纯计算的结果，依赖未变时可以复用。购物车可以同时缓存子组件和筛选计算：

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

输入 `query` 会让父组件重新渲染，但 `items`、每个未修改的 `item` 引用和 `removeItem` 都保持不变，因此 memoized 行组件有机会跳过渲染。`total` 只在 `items` 引用改变时重新计算。

这些 API 都只是性能优化，不是语义保证。React 可能因开发热更新、初次挂起等原因丢弃缓存，也可能重新渲染 memoized 组件。代码在移除 `memo` 和 `useMemo` 后仍必须正确。应先用 React Profiler 找到实际的慢计算或高频子树，再增加缓存；简单加法和普通内联对象通常不值得缓存。

启用 React Compiler 的项目会自动应用许多等价优化，手写 memoization 的必要性会进一步降低。

## `useCallback`：缓存函数引用

`useCallback(fn, dependencies)` 返回函数本身，不会调用它；`useMemo(() => fn, dependencies)` 与之等价。它常用于两类边界：

- 把回调传给 `memo` 包装的子组件，避免函数身份每次都变。
- 某个 Hook 或外部 API 明确以函数身份决定是否重新订阅。

上一个例子中的 `removeItem` 使用函数式状态更新，因此不需要读取 `items`，依赖可以安全地写成 `[]`。若回调读取了 props、state 或组件内变量，就必须把这些响应式值列入依赖，不能为了“保持函数不变”故意漏依赖，否则会读到旧闭包。

普通内联函数的创建通常很便宜。单独给每个函数套 `useCallback` 反而增加依赖维护和缓存成本。和 `useMemo` 一样，它只能作为优化；移除后功能也必须正确。

## `useDebugValue`：自定义 Hook 调试标签

`useDebugValue` 为自定义 Hook 在 React DevTools 中增加可读标签，不会渲染 UI，也不会替代日志或测试。在线状态 Hook 可以直接暴露调试标签：

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

第二个参数是格式化函数。React DevTools 检查该组件时才调用它，因此适合把复杂内部结构延迟格式化。无需给每个简单自定义 Hook 都添加调试值；共享库和内部状态较复杂的 Hook 收益最大。

## `useId`：可访问性 ID

`useId` 生成与组件树位置关联的 ID，适合把 `label`、输入框、提示和错误信息连接起来，并能在服务端渲染与客户端 hydration 的组件树一致时保持匹配。

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

一次 `useId` 可以作为多个相关元素的前缀。返回字符串应视为不透明值，不要解析或依赖它当前的冒号格式。

`useId` 有三个明确的非用途：

- **不能生成列表 `key`**。key 必须来自数据本身，才能表达条目身份。
- **不能充当业务主键或接口请求 ID**。这类 ID 应由后端或在事件发生时用专门的 UUID 方案生成。
- **不能代替缓存 key**。缓存身份同样应由数据决定。

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

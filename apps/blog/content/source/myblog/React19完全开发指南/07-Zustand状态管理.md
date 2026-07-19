---
title: Zustand 状态管理
date: 2026-07-13
updated: 2026-07-13
tags:
  - Zustand
  - React 19
  - TypeScript
  - Immer
  - 状态管理
source:
  - https://www.bilibili.com/video/BV1mcpPeMETt/
bvid: BV1mcpPeMETt
pages: P41-P45
draft: false
---

# Zustand 状态管理

Zustand 用一个独立 Store 保存跨组件状态。组件通过 Hook 读取自己需要的片段，Action 通过 `set` 产生下一个状态。它适合共享业务状态，但不代表所有局部状态都应移入全局 Store。

```text
用户操作
    ↓
Action 调用 set
    ↓
Store 产生新状态
    ↓
Selector 比较选中结果
    ↓
只重新渲染结果发生变化的订阅组件
```

## 什么状态适合放进 Store

先区分三类状态：

| 状态 | 常见归属 | 例子 |
|---|---|---|
| 单个组件专用 | `useState` / `useReducer` | 展开状态、表单临时输入 |
| 多个远距离组件共享 | Zustand Store | 购物车、用户偏好、跨页筛选条件 |
| 服务器数据缓存 | 数据请求库或路由数据层 | 列表请求、缓存失效、重试 |

Store 可以避免多层 Props 透传，但不应只因为“可以全局”就把状态全部全局化。状态放得越远，所有权和生命周期越难看清。

## 创建类型安全的 Store

安装依赖：

```bash
npm install zustand
```

一个 Store 通常同时包含状态和修改状态的 Action：

```ts
// stores/price.ts
import { create } from 'zustand';

interface PriceStore {
  price: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  readPrice: () => number;
}

export const usePriceStore = create<PriceStore>()((set, get) => ({
  price: 0,
  increment: () => set((state) => ({ price: state.price + 1 })),
  decrement: () => set((state) => ({ price: state.price - 1 })),
  reset: () => set({ price: 0 }),
  readPrice: () => get().price,
}));
```

三个核心参数各有明确职责：

- `set`：提交下一份状态；传函数时可以读取当前状态。
- `get`：立即读取 Store 当前值，常用于 Action 内部逻辑。
- Store 返回值：定义状态字段与 Action，TypeScript 接口描述它们的契约。

`set` 默认对返回对象做一层浅合并，因此更新 `price` 时不必手动复制同级字段。这个便利只存在于第一层，不能自动替你合并嵌套对象。

### 在组件中按需读取

组件应通过 Selector 订阅自己真正使用的值：

```tsx
import { usePriceStore } from './stores/price';

export function PricePanel() {
  const price = usePriceStore((state) => state.price);
  const increment = usePriceStore((state) => state.increment);
  const reset = usePriceStore((state) => state.reset);

  return (
    <section>
      <p>当前金额：{price}</p>
      <button type="button" onClick={increment}>增加</button>
      <button type="button" onClick={reset}>重置</button>
    </section>
  );
}
```

Selector 的返回值默认按 `Object.is` 比较。`price` 未变时，这个组件不会因 Store 中其他字段更新而重新渲染。

### `get` 不会建立响应式订阅

`get()` 只是当场读取。组件如果要随状态更新，仍然应通过 Selector 读取：

```ts
const current = usePriceStore.getState().price;
```

上面的调用适合事件处理、调试或框架外逻辑，不会让所在组件跟随 `price` 重新渲染。

## 深层状态与不可变更新

对嵌套状态只更新最内层对象，会丢掉未带回的兄弟字段：

```ts
interface Profile {
  name: string;
  preferences: {
    theme: 'light' | 'dark';
    compact: boolean;
  };
}
```

手动更新时，需要沿变更路径复制：

```ts
set((state) => ({
  profile: {
    ...state.profile,
    preferences: {
      ...state.profile.preferences,
      theme: 'dark',
    },
  },
}));
```

这样会保留未变部分的引用，也会为变更路径创建新引用，便于 React 和 Selector 识别变化。

## 用 Immer 简化嵌套更新

对象较深时，可以使用 Zustand 的 Immer 中间件：

```bash
npm install immer
```

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface FamilyStore {
  family: {
    children: Array<{
      id: number;
      name: string;
    }>;
  };
  renameChild: (id: number, name: string) => void;
}

export const useFamilyStore = create<FamilyStore>()(
  immer((set) => ({
    family: {
      children: [
        { id: 1, name: '大娃' },
        { id: 2, name: '二娃' },
      ],
    },
    renameChild: (id, name) =>
      set((draft) => {
        const child = draft.family.children.find((item) => item.id === id);
        if (child) child.name = name;
      }),
  })),
);
```

写法看起来像直接修改 `draft`，实际上 Immer 通过 Proxy 记录读写，在最终化时产生新状态，并尽量复用未改动部分的引用。这种结构共享能减少不必要的复制。

需要避免两种误解：

- `draft` 不是普通业务对象，不应逃离 `set` 回调后继续使用。
- Immer 简化的是不可变更新，不会自动修正错误的状态边界或业务逻辑。

## Selector 与渲染范围

下面这种写法订阅了整个 Store：

```tsx
const store = useFamilyStore();
```

Store 任意一部分变化都可能让组件重新渲染。如果只需要一个字段，就返回一个字段：

```tsx
const children = useFamilyStore((state) => state.family.children);
```

如果 Selector 每次都创建新对象，即使内部字段没变，默认的 `Object.is` 也会认为结果不同：

```tsx
// 错误示例：每次都返回新对象
const selection = useFamilyStore((state) => ({
  children: state.family.children,
  renameChild: state.renameChild,
}));
```

在 Zustand v5 中，这不只是多渲染一次。未缓存的 Selector 结果可能让 `useSyncExternalStore` 持续看到“新快照”，最终触发 `Maximum update depth exceeded` 一类循环更新。

有两种常用处理方式。

### 拆成窄 Selector

```tsx
const children = useFamilyStore((state) => state.family.children);
const renameChild = useFamilyStore((state) => state.renameChild);
```

这种方式直接，比较语义也最清晰。

### 使用 `useShallow`

```tsx
import { useShallow } from 'zustand/react/shallow';

const { children, renameChild } = useFamilyStore(
  useShallow((state) => ({
    children: state.family.children,
    renameChild: state.renameChild,
  })),
);
```

`useShallow` 对 Selector 返回结果的顶层字段做浅比较。它适合把若干稳定引用组成小对象，不是深比较，也无法弥补原地突变状态的问题。

## 中间件组合

中间件包装 State Creator，为 `set`、Store API 或持久化流程增加行为。常见内置中间件包括：

| 中间件 | 作用 |
|---|---|
| `devtools` | 接入 Redux DevTools，观察状态与 Action |
| `persist` | 把指定状态序列化到存储层 |
| `immer` | 使 `set` 回调可以使用 Draft 写法 |
| `subscribeWithSelector` | 让 `subscribe` 可以监听 Selector 片段 |

一个组合示例：

```ts
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface SettingsStore {
  theme: 'light' | 'dark';
  accessToken: string | null;
  setTheme: (theme: SettingsStore['theme']) => void;
  setAccessToken: (token: string | null) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      immer((set) => ({
        theme: 'light',
        accessToken: null,
        setTheme: (theme) =>
          set((draft) => {
            draft.theme = theme;
          }),
        setAccessToken: (accessToken) =>
          set((draft) => {
            draft.accessToken = accessToken;
          }),
      })),
      {
        name: 'app-settings',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ theme: state.theme }),
      },
    ),
    { name: 'SettingsStore' },
  ),
);
```

这里用 `partialize` 只保存主题，没有把访问令牌写入 `localStorage`。持久化不是安全存储，敏感数据不应因为接入 `persist` 就无条件写入浏览器。

### `persist` 的边界

`persist` 常用选项包括：

- `name`：存储键，应在应用内保持唯一。
- `storage`：存储适配器，默认场景常用 `localStorage`，也可改为其他兼容存储。
- `partialize`：只保留需要持久化的字段。
- `version` 与 `migrate`：状态结构升级时迁移旧数据。

在 SSR 或混合渲染应用中，浏览器存储不存在于服务端，还需要处理 hydration 时机和首屏一致性。

### 自定义日志与 Action 命名

日志中间件可以通过包装 `set` 实现：更新前读取旧状态，调用原 `set`，再读取新状态。生产代码还需处理完整类型、`setState` 的所有参数以及敏感数据脱敏。

`devtools` 包装 State Creator 后，`set` 的第三个参数可以记录 Action 名称：

```ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface PriceStore {
  price: number;
  increment: () => void;
}

export const usePriceStore = create<PriceStore>()(
  devtools(
    (set) => ({
      price: 0,
      increment: () =>
        set(
          (state) => ({ price: state.price + 1 }),
          false,
          'price/increment',
        ),
    }),
    { name: 'PriceStore' },
  ),
);
```

中间件的包装顺序会影响类型和它能观察到的更新，应按当前 Zustand 版本文档与项目验证结果组合，不要把某个示例顺序当成永不变的规则。

## 订阅 Store 变化

Store 除了为 React 组件提供 Hook，还提供命令式订阅：

```ts
const unsubscribe = usePriceStore.subscribe((state, previousState) => {
  console.log('price', previousState.price, '->', state.price);
});

unsubscribe();
```

普通 `subscribe` 会监听 Store 更新。如果只想监听某个片段，创建 Store 时加入 `subscribeWithSelector`：

```ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AccountStore {
  age: number;
  setAge: (age: number) => void;
}

export const useAccountStore = create<AccountStore>()(
  subscribeWithSelector((set) => ({
    age: 24,
    setAge: (age) => set({ age }),
  })),
);
```

现在可以把 Selector 作为订阅的第一个参数：

```ts
const unsubscribe = useAccountStore.subscribe(
  (state) => state.age,
  (age, previousAge) => {
    console.log({ age, previousAge });
  },
  {
    fireImmediately: true,
  },
);
```

`fireImmediately` 控制是否在建立订阅后立即执行一次回调。选择性订阅仍需要合理的比较语义；如果 Selector 返回对象，可通过 `equalityFn` 明确指定比较方式。

### 组件中必须清理订阅

```tsx
import { useEffect } from 'react';
import { useAccountStore } from './stores/account';

export function AccountAudit() {
  useEffect(() => {
    const unsubscribe = useAccountStore.subscribe(
      (state) => state.age,
      (age, previousAge) => {
        console.log(`age: ${previousAge} -> ${age}`);
      },
    );

    return unsubscribe;
  }, []);

  return null;
}
```

Effect 在开发环境 Strict Mode 下可能经历额外的 setup 与 cleanup 检查。正确返回取消函数，可以避免重复订阅和组件卸载后继续执行副作用。

## 派生值优先直接计算

如果年龄只用于计算展示状态，不需要额外副作用，更简单的方法是直接在 Selector 中派生：

```tsx
export function RelationshipStatus() {
  const status = useAccountStore((state) =>
    state.age >= 26 ? '已达设定年龄' : '未达设定年龄',
  );

  return <p>{status}</p>;
}
```

这样不会在 Store 状态和本地 `useState` 之间维护两份可能失同的数据。

`subscribe` 更适合真正的副作用和框架外集成，例如：

- 把特定状态同步给非 React 小部件。
- 在状态跨过阈值时记录分析事件。
- 将 Store 与 WebSocket、Canvas 或其他命令式 API 连接。

## 一个完整的使用边界

```text
组件内临时 UI 状态
    → useState / useReducer

跨组件共享的客户端状态
    → Zustand Store + 窄 Selector

嵌套状态修改频繁
    → Immer 中间件或手动不可变更新

多字段组合订阅
    → 拆分 Selector 或 useShallow

持久化与调试
    → persist / devtools，明确存储边界

框架外副作用
    → subscribe / subscribeWithSelector + unsubscribe
```

## 常见问题

### 修改了嵌套字段，其他字段丢失

`set` 只浅合并顶层。手动复制变更路径，或使用 Immer 中间件。

### 无关状态更新也导致重新渲染

检查是否调用了无 Selector 的 Store Hook，或 Selector 是否每次返回新对象。优先返回最小字段，必要时使用 `useShallow`。

### 订阅回调越来越多

组件 Effect 没有返回 `unsubscribe`，或每次渲染都重新订阅。订阅建立与清理必须成对。

### 刷新后持久化数据与页面首帧不一致

这通常是 hydration 时机问题，不是简单的 `set` 失效。根据渲染框架设计客户端恢复状态的时机。

### 把所有状态都存进了 `localStorage`

使用 `partialize` 缩小范围，不保存短命数据、可重新请求的缓存或敏感信息，并为状态结构升级准备版本迁移。

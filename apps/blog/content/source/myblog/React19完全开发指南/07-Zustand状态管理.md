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

Zustand 用一个独立的 Store 保存跨组件的状态。组件通过 Hook 读自己要的那一片，Action 通过 `set` 产生下一个状态。它适合共享的业务状态，但不是说所有局部状态都该挪进全局 Store。

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

先分清三类状态：

| 状态 | 常见归属 | 例子 |
|---|---|---|
| 单个组件专用 | `useState` / `useReducer` | 展开状态、表单临时输入 |
| 多个远距离组件共享 | Zustand Store | 购物车、用户偏好、跨页筛选条件 |
| 服务器数据缓存 | 数据请求库或路由数据层 | 列表请求、缓存失效、重试 |

Store 能避免 Props 一层层透传，但别只因为"能全局"就把状态全都全局化。状态放得越远，归谁管、活多久就越难看清。

## 创建类型安全的 Store

安装依赖：

```bash
npm install zustand
```

一个 Store 一般同时包含状态和修改状态的 Action：

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

三个核心部分各管一件事：

- `set`：提交下一份状态；传函数的话可以读当前状态。
- `get`：马上读 Store 当前的值，常用在 Action 内部的逻辑里。
- Store 的返回值：定义状态字段和 Action，TypeScript 接口描述它们的约定。

`set` 默认对返回的对象做一层浅合并，所以更新 `price` 时不用手动复制同级的字段。这个便利只在第一层有，嵌套对象它不会自动帮你合并。

### 在组件中按需读取

组件要用 Selector 订阅自己真正用到的值：

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

Selector 的返回值默认用 `Object.is` 比较。`price` 没变的话，Store 里其他字段更新，这个组件也不会重新渲染。

### `get` 不会建立响应式订阅

`get()` 只是当场读一下。组件要跟着状态更新的话，还是要用 Selector 读：

```ts
const current = usePriceStore.getState().price;
```

上面这种调用适合事件处理、调试或者框架外的逻辑，不会让所在的组件跟着 `price` 重新渲染。

## 深层状态与不可变更新

嵌套的状态只更新最里层的对象，没带回来的兄弟字段就丢了：

```ts
interface Profile {
  name: string;
  preferences: {
    theme: 'light' | 'dark';
    compact: boolean;
  };
}
```

手动更新时，要沿着变更的路径一路复制：

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

这样没变的部分保留原来的引用，变更路径上则是新引用，React 和 Selector 都能认出变化。

## 用 Immer 简化嵌套更新

对象比较深时，可以用 Zustand 的 Immer 中间件：

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

写法看着像直接改 `draft`，其实 Immer 用 Proxy 记下读写，在最后一步生成新状态，并尽量复用没改动部分的引用。这种结构共享能少做一些没必要的复制。

两个误解要避开：

- `draft` 不是普通的业务对象，别带出 `set` 回调之外继续用。
- Immer 简化的是不可变更新，错误的状态边界和业务逻辑它不会帮你改对。

## Selector 与渲染范围

下面这种写法订阅了整个 Store：

```tsx
const store = useFamilyStore();
```

Store 任何一部分变了，组件都可能重新渲染。只需要一个字段的话，就只返回一个字段：

```tsx
const children = useFamilyStore((state) => state.family.children);
```

Selector 每次都创建一个新对象的话，就算里面的字段没变，默认的 `Object.is` 也会认为结果不一样：

```tsx
// 错误示例：每次都返回新对象
const selection = useFamilyStore((state) => ({
  children: state.family.children,
  renameChild: state.renameChild,
}));
```

在 Zustand v5 里，这不只是多渲染一次。没缓存的 Selector 结果可能让 `useSyncExternalStore` 一直看到"新快照"，最后触发 `Maximum update depth exceeded` 这类循环更新。

常用的处理方式有两种。

### 拆成窄 Selector

```tsx
const children = useFamilyStore((state) => state.family.children);
const renameChild = useFamilyStore((state) => state.renameChild);
```

这种方式直接，比较的语义也最清楚。

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

`useShallow` 对 Selector 返回结果的顶层字段做浅比较。适合把几个稳定的引用组成一个小对象；它不是深比较，原地突变状态的问题也补救不了。

## 中间件组合

中间件包装 State Creator，给 `set`、Store API 或持久化流程加行为。常见的内置中间件：

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

这里用 `partialize` 只保存了主题，没把访问令牌写进 `localStorage`。持久化不是安全存储，敏感数据别因为接了 `persist` 就不加区分地写进浏览器。

### `persist` 的边界

`persist` 的常用选项：

- `name`：存储键，在应用里要唯一。
- `storage`：存储适配器，默认场景常用 `localStorage`，也能换成别的兼容存储。
- `partialize`：只保留要持久化的字段。
- `version` 和 `migrate`：状态结构升级时迁移旧数据。

在 SSR 或混合渲染的应用里，服务端没有浏览器存储，还要处理 hydration 的时机和首屏一致性。

### 自定义日志与 Action 命名

日志中间件可以靠包装 `set` 实现：更新前读旧状态，调原来的 `set`，再读新状态。生产代码还要处理完整的类型、`setState` 的所有参数，以及敏感数据脱敏。

`devtools` 包装 State Creator 后，`set` 的第三个参数能记录 Action 名：

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

中间件的包装顺序会影响类型，也会影响它能观察到哪些更新。按当前 Zustand 版本的文档和项目里的验证结果来组合，别把某个示例的顺序当成永远不变的规则。

## 订阅 Store 变化

Store 除了给 React 组件提供 Hook，还提供命令式的订阅：

```ts
const unsubscribe = usePriceStore.subscribe((state, previousState) => {
  console.log('price', previousState.price, '->', state.price);
});

unsubscribe();
```

普通的 `subscribe` 监听 Store 的所有更新。只想监听某一片的话，建 Store 时加上 `subscribeWithSelector`：

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

这样就能把 Selector 当作订阅的第一个参数：

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

`fireImmediately` 控制建立订阅后要不要马上执行一次回调。选择性订阅也要有合理的比较语义；Selector 返回对象的话，可以用 `equalityFn` 明确指定比较方式。

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

开发环境的 Strict Mode 下，Effect 可能多经历一轮 setup 和 cleanup 检查。正确返回取消函数，就能避免重复订阅，也不会在组件卸载后还继续执行副作用。

## 派生值优先直接计算

年龄只是用来算展示状态、不需要额外副作用的话，更简单的做法是直接在 Selector 里派生：

```tsx
export function RelationshipStatus() {
  const status = useAccountStore((state) =>
    state.age >= 26 ? '已达设定年龄' : '未达设定年龄',
  );

  return <p>{status}</p>;
}
```

这样就不用在 Store 状态和本地 `useState` 之间维护两份可能不同步的数据。

`subscribe` 更适合真正的副作用和框架外的集成，比如：

- 把特定的状态同步给非 React 的小部件。
- 状态跨过某个阈值时记一条分析事件。
- 把 Store 和 WebSocket、Canvas 或其他命令式 API 连起来。

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

`set` 只浅合并顶层。手动复制变更路径，或者用 Immer 中间件。

### 无关状态更新也导致重新渲染

看是不是调了不带 Selector 的 Store Hook，或者 Selector 每次都返回新对象。优先返回最小的字段，必要时用 `useShallow`。

### 订阅回调越来越多

组件的 Effect 没返回 `unsubscribe`，或者每次渲染都重新订阅。建立订阅和清理订阅必须成对出现。

### 刷新后持久化数据与页面首帧不一致

这一般是 hydration 时机的问题，不是 `set` 失效了。按渲染框架来设计客户端恢复状态的时机。

### 把所有状态都存进了 `localStorage`

用 `partialize` 缩小范围，短命的数据、能重新请求的缓存和敏感信息都别存，并给状态结构升级准备好版本迁移。

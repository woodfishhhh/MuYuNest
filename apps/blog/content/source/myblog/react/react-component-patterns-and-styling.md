---
title: React 组件模式、样式隔离与遗留类组件速查
slug: react-component-patterns-and-styling
date: 2026-07-13
categories:
  - 前端开发
tags:
  - React 19
  - 组件模式
  - CSS Modules
  - Tailwind CSS
  - Class 组件
---

把界面拆成组件，重点不在多建几个文件，而是把状态归属、外部输入契约与内部私有实现划清楚。现代 React 一律以函数组件为主体，通过组合 `children`、受控状态提升、Portal 挂载、ErrorBoundary 兜底和构建期样式隔离来组织应用；只有在维护历史存量代码时，才需要读懂类组件的 `this` 绑定、`setState` 浅合并、旧生命周期与高阶组件（HOC）。

## 函数组件组合模式与数据通信

在 React 里，组件标签上的属性和嵌套在标签里的子节点统一经由 `props` 传入，`children` 本质上就是一个名字特殊的普通 Prop。比起给头部、图标、底部动作各起一堆字符串属性，直接传递 JSX 节点保留了最大的组合自由度。

```tsx
import type { ReactNode } from 'react'

interface CardProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function Card({
  title,
  subtitle = '暂无补充信息',
  children,
  footer,
}: CardProps) {
  return (
    <article className="card">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div>{children}</div>
      {footer != null && typeof footer !== 'boolean' ? (
        <footer>{footer}</footer>
      ) : null}
    </article>
  )
}
```

**判断 `footer` 等可选 `ReactNode` 插槽是否渲染容器时，不能写 `footer && <footer>...</footer>`——因为数字 `0` 是合法的 `ReactNode`，短路判断会把 `0` 当作假值直接漏在容器外面显示出来。**

组件间的通信遵循清晰的流向约定：

- **父传子**：通过只读 Props 传递数据与行为，子组件严禁直接改写接收到的 Prop 对象。
- **子传父**：父组件向下传递语义化事件回调（如 `onSelect`、`onRemove`，不要起模糊的 `callback`），子组件在交互时调用并带回载荷。
- **兄弟组件共享**：把共享状态提升到最近的共同父组件管理；只有在确实跨越多层组件树且更新低频时，才切到 Context 或 [Zustand 状态管理](/posts/react-state-zustand-and-redux)，切忌为了两个相邻兄弟组件通信就引入全局发布订阅事件总线，把数据流藏暗。

## 受控与非受控表单的严格边界

“受控”与“非受控”区分的是表单当前值到底保存在 React State 里还是 DOM 节点自己手里：

| 模式 | 状态存储 | 读取方式 | 适用场景 |
| --- | --- | --- | --- |
| 受控组件 | React State / Props | 直接读取状态变量 | 即时校验、输入格式化、多字段联动、外部重置 |
| 非受控组件 | DOM 元素自身 | `ref.current.value` 或提交时 `FormData` | 简单一次性提交表单、文件选择、接入命令式库 |

编写受控组件时要按控件类型匹配属性：普通输入框与 `<select>` 绑定 `value` + `onChange`，单个复选框或单选框绑定 `checked` + `onChange`（多选复选框用数组存储选中项，更新时先 `[...checkedValues]` 拷贝或 `.filter()` 生成新数组）。

**一个表单控件在生命周期里绝对不能在受控和非受控之间来回切换：如果接口数据还没回来，`profile?.name` 一开始是 `undefined`、拿到数据后变成字符串，React 会直接发出受控切换警告，务必写成 `value={profile?.name ?? ''}` 保证始终是字符串。** 若确实只需要展示只读值，应显式加上 `readOnly`，不要写一个不配 `onChange` 的死 `value` 充当默认值（非受控初始值用 `defaultValue` / `defaultChecked`）。另外 `<input type="file">` 出于浏览器安全限制，永远只能按非受控方式从 `fileRef.current?.files?.[0]` 读取。

## 代码分割（`lazy`/`Suspense`）、`Portal` 与错误边界

### 1. `React.lazy` 与 `Suspense`

重型路由或弹窗面板用 `lazy(() => import('./SettingsPage'))` 配合 `<Suspense fallback={...}>` 实现按需分包加载。**`lazy()` 声明必须放在模块顶层，绝不能写进组件函数内部，否则每次父组件重渲染都会生成全新组件类型，导致子树被反复销毁重建、内部状态清零。** 如模块采用命名导出，可在 `.then(m => ({ default: m.Chart }))` 中转成默认导出。

### 2. `createPortal`：DOM 脱离父容器裁切

模态框、Tooltip 和抽屉放在带有 `overflow: hidden`、`transform` 或局部 `z-index` 的容器里时容易被裁切，用 `createPortal(jsx, document.body)` 可以把真实 DOM 节点挂载到指定宿主节点下：

```tsx
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={onClose}>关闭</button>
      </section>
    </div>,
    document.body,
  )
}
```

**`Portal` 只改变了物理 DOM 的插入位置，它在 React 组件树里的逻辑位置完全不变——Context 依然能正常穿透，事件依然沿着 React 父组件树向上冒泡，因此弹窗内容区必须显式 `stopPropagation()` 防止误触外层遮罩或父级点击事件。**

### 3. `ErrorBoundary`：React 仅存的类组件刚需场景

函数组件目前仍无法直接充当渲染错误边界（Error Boundary）。生产应用中必须至少在根级或核心功能区外包裹错误边界（自己写一个实现 `getDerivedStateFromError` 与 `componentDidCatch` 的最小类组件，或者直接使用成熟的 `react-error-boundary` 库），防止局部组件渲染抛出异常时整页白屏崩毁。

## 样式隔离方案与组件库打包契约

React 本身不内置样式隔离机制，工程里主要在三种策略里做取舍：

| 方案 | 隔离原理 | 动态样式写法 | 主要成本 |
| --- | --- | --- | --- |
| CSS Modules | 构建期将类名哈希化为 `styles.box` | 配合 `classnames/bind` 映射条件类名 | 样式与 TSX 拆分在不同文件 |
| Tailwind CSS | 原子工具类组合，按源码扫描按需生成 | 条件拼接或变体映射表 | JSX 类名偏长，需团队约束规范 |
| CSS-in-JS | 运行时或编译期生成作用域组件 | 直接读取组件 Props 算样式 | 额外包体积、SSR 配置及潜在运行时开销 |

使用 **CSS Modules + `classnames/bind`** 时切记不能直接把普通字符串丢进 `classnames({ active: isActive })`——那样只会生成未哈希的原始字符串 `"active"`，根本匹配不到模块化的 `styles.active`：

```tsx
import cx from 'classnames/bind'
import styles from './Box.module.css'

const cls = cx.bind(styles)

export function Box({ isActive }: { isActive: boolean }) {
  return <div className={cls('box', { active: isActive })} />
}
```

在 Vite 项目中接入 **Tailwind CSS v4** 则更为简洁：安装 `tailwindcss` 与 `@tailwindcss/vite`，在 `vite.config.ts` 插件数组中加入 `tailwindcss()`，并在入口样式文件写入 `@import "tailwindcss";` 即可（注意勿在运行时动态拼接模板字符串类名，确保完整类名在源码中静态可扫描）。

如果进一步把内部递归组件（如带受控 `checkedKeys` 的 `Tree`）沉淀为对外发布的 npm 组件库，构建配置务必守住三条契约：将 `react`、`react-dom` 和 `react/jsx-runtime` 放入 `external` 与 `peerDependencies` 防止打包出两份 React 实例；在 `package.json` 正确配置 `exports` 与 `"sideEffects": ["**/*.css"]` 防止样式文件被 Tree Shaking 误删；发版前务必通过 `npm pack` 打出 `.tgz` 包放进空白消费项目里验证 ESM/CJS 入口、`.d.ts` 类型与样式导出，不要只测源码目录。

## 维护老项目：类组件与 HOC 对照速查

接手老 React 仓库时，依然会频繁遇到继承 `React.Component` 的类组件和高阶组件（HOC）。下面把历史写法与现代函数组件的对等关系浓缩成速查表，方便快速排错与渐进重构：

### 1. 类组件事件 `this` 丢失与传参顺序

类组件直接写 `onClick={this.handleClick}` 时，方法在回调中丢失实例上下文，`this` 会变成 `undefined`。老代码一般用三种方式修补：

1. **类字段箭头函数（最常见）**：`handleClick = (e) => { ... }`，直接绑定实例 `this`。
2. **渲染时 `.bind(this)`**：支持顺带传参 `onClick={this.handleClick.bind(this, id)}`——注意用 `bind` 传参时，事件回调接收到的参数顺序是**自定义参数在前，React 合成事件 `SyntheticEvent` 排在最后一位**。
3. **内联箭头函数包裹**：`onClick={(e) => this.handleClick(id, e)}`。

注意 React 事件名采用小驼峰（`onClick`、`onChange`），接收函数引用而不是立刻执行调用结果；`e` 是 React 跨浏览器包装的 `SyntheticEvent`，极少数场景需读取原生事件可通过 `e.nativeEvent` 获取。

### 2. `this.state`、`setState` 浅合并与 `PureComponent` 引用陷阱

- **绝不能直接赋值 `this.state.a = 1`**，必须调用 `this.setState(...)` 通知 React 更新队列。
- **只做第一层浅合并**：`this.setState({ b: { c1: 9 } })` 会把 `this.state.b` 里原有的 `c2` 抹掉，嵌套对象必须写成 `{ b: { ...this.state.b, c1: 9 } }`。
- **异步批处理与回调读取**：`this.setState` 更新后紧跟的同步代码读到的仍是旧 `this.state`。如果基于前一次状态递增，传函数 `this.setState(prev => ({ a: prev.a + 1 }))`；需要在 DOM 更新完成后读取最新状态，传第二个回调参数 `this.setState(next, () => { ... })`。
- **`PureComponent` 只做浅比较**：它对 `props` 和 `state` 做第一层 `Object.is` 比较以跳过无效更新。如果直接对 `this.state.arr.push(4)` 再 `setState({ arr: this.state.arr })`，数组内存引用未变，`PureComponent` 会误判为无变化而拒绝渲染；必须生成新引用 `[...this.state.arr, 4]`。

### 3. 类组件生命周期与 Hooks 对照

类组件按“挂载 -> 更新 -> 卸载”三阶段流转（`StrictMode` 开发期会重跑检查纯度），与函数组件 Hook 的核心映射如下：

| 类组件阶段 / 方法 | 常见用途与禁忌 | 函数组件等价方案 |
| --- | --- | --- |
| `constructor` | 初始化状态、手动 `bind(this)`（如今多用类字段简写跳过） | `useState` 惰性初始化 |
| `render()` | 返回 JSX；**严禁在此调用 `this.setState`**（必死循环） | 函数组件体本身 |
| `componentDidMount` | 首屏请求、操作 DOM（通过 `React.createRef()` 拿节点/类实例） | `useEffect(..., [])` |
| `shouldComponentUpdate` | 手动浅比较拦截无效更新（不可与 `PureComponent` 混用） | `React.memo` |
| `componentDidUpdate` | 依赖变化后操作 DOM 或发起新请求 | `useEffect(..., [deps])` |
| `componentWillUnmount` | 清除定时器、解绑事件监听、取消订阅 | `useEffect` 返回的清理函数 |
| `static contextType` | 通过 `this.context` 消费单个上下文（多上下文需套 `Consumer`） | `useContext` |

### 4. HOC 高阶组件的局限与替代思路

老代码里常用 `withPermission(Wrapped)` 或 `withMousePosition(Wrapped)` 这类接收组件返回增强类组件的高阶组件（HOC）来复用无 UI 的横切逻辑。维护 HOC 代码时需重点防备三个坑：**必须在模块顶层调用 HOC**（在 `render` 内调用会反复销毁重建组件）、**必须用 `{...this.props}` 完整透传属性**、**不会自动转发 `ref` 与静态方法**且容易形成多层嵌套“包装地狱”。重构老项目时，这类无 UI 的状态订阅、事件监听和权限校验逻辑应直接改写为自定义 Hook（如 `useMousePosition`、`usePermission`），彻底摆脱包装层级。

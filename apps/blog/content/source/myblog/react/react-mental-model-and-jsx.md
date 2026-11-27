---
title: React 组件心智模型、JSX 编译与 Vite 工程化
slug: react-mental-model-and-jsx
aliases:
  - 1-849fada0
  - 1-cc97fa54
date: 2026-07-13
categories:
  - 前端开发
tags:
  - React 19
  - JSX
  - TSX
  - Vite
  - TypeScript
---

用 Vue 的思路直接去套 React，最容易在三个地方卡住：为什么父组件改了一个无关紧要的状态，子组件默认跟着全重跑一遍？为什么在花括号里写 `if` 会直接报语法错？为什么 `src/main.tsx` 里要套一层在开发期执行两次渲染的 `<StrictMode>`？把 React 的声明式心智模型、JSX 编译产物与 Vite 工具链边界一次拆清楚，后面学 Hooks 和并发渲染才不会到处碰壁。

## React 声明式模型与 `react` / `react-dom` 分工

React 把界面拆成纯函数式的组件，组件接收 `props` 和 `state`，吐出这一帧界面长什么样子的描述对象（React Element）。至于怎么创建真实节点、修改属性和卸载 DOM，则完全交给宿主渲染器 `react-dom` 处理。

```text
业务数据（props / state）
  ↓
组件函数计算 UI 描述（React Element）
  ↓
React 协调器比较前后两次描述
  ↓
react-dom（或 React Native 等渲染器）将必要变更提交到宿主平台
```

**Vue 的单文件组件通过依赖追踪知道哪几个组件读了某个属性，而 React 默认沿组件树自顶向下重新执行函数计算新描述，再去比对差异。** 正因如此，React 严格要求组件渲染函数保持纯粹：给定相同的 `props` 和 `state` 必须产出一致的 JSX，渲染期间禁止直接改外部变量、发网络请求或手动操作 DOM。只要渲染是纯的，React 才能在并发模式下安全地暂停、重启甚至丢弃未提交的计算结果。

从入口到页面的挂载链路非常精简：

1. `index.html` 提供 `<div id="root"></div>` 与 `<script type="module" src="/src/main.tsx"></script>`。
2. `src/main.tsx` 通过 `createRoot(container).render(<StrictMode><App /></StrictMode>)` 创建根渲染器并挂载根组件（不再使用旧版 `ReactDOM.render`）。
3. 开发期包裹的 `<StrictMode>` 会故意多调用一次组件渲染函数、`useState` 初始化器以及 Effect 的 `setup -> cleanup` 链路，用来暴露隐蔽的副作用和清理遗漏；生产构建会自动剥离这部分检查，不会导致线上跑两遍。

与早期依赖 Webpack 且早已停止维护的 Create React App 不同，新建现代 React 工程一律使用 **Vite** 配合 TypeScript 模板（`npm create vite@latest my-app -- --template react-ts` 或选 SWC 变体 `react-swc-ts`）。

工程目录里的静态资源同样分两条路走：`src/assets/` 下的图片由源代码 `import logoUrl from './assets/logo.svg'` 引入，进入 Vite 依赖图并生成内容哈希缓存名；`public/` 下的文件则原封不动拷贝到产物根目录，直接通过 `/manual.pdf` 访问（切勿在路径里写 `/public/`）。

## JSX / TSX 编译链路：Babel、SWC 与自动 Runtime

浏览器根本看不懂 JSX 标签，`.tsx` 文件在进入浏览器之前必须经历两层处理：**移除 TypeScript 类型语法** + **把 JSX 标签转换为普通的 JavaScript 函数调用**。

```tsx
// 源码
const view = <h1 className="title">React 19</h1>

// 现代自动 JSX runtime（react/jsx-runtime）编译概念产物
import { jsx as _jsx } from 'react/jsx-runtime'
const view = _jsx('h1', { className: 'title', children: 'React 19' })
```

**现代项目默认启用自动 JSX Runtime，编译器会自动注入 `react/jsx-runtime` 导入，因此无需为了写 JSX 在每个文件顶部补一句 `import React from 'react'`；只有旧版 classic runtime 编译成的 `React.createElement(...)` 才依赖作用域里的默认 `React`。**

无论 Vite 底层选用 Babel（`@vitejs/plugin-react`）还是 Rust 编写的 SWC（`@vitejs/plugin-react-swc`），**两者都只负责把 TypeScript 类型剥离并转换 JSX 语法，绝不会替你执行完整类型检查**。发版前依然要通过 `tsc --noEmit` 跑一遍类型校验。另外要注意 Babel 默认只做语法转译，如果目标浏览器缺少 `Promise`、`structuredClone` 等新运行时 API，需要结合浏览器兼容目标按需配置 Polyfill。

## 花括号表达式、条件与列表渲染规则

JSX 花括号 `{}` 里只能放有求值结果的 JavaScript 表达式，不能直接放 `if`、`for` 等控制流语句。不同返回值在 React 渲染树里的表现差异很大：

| 表达式返回值 | 真实 DOM 输出 | 常见陷阱 |
| --- | --- | --- |
| 字符串 / 数字 | 原样渲染文本节点（`0` 也会显示） | `count && <Badge />` 当 `count` 为 `0` 时会在页面直接印出数字 `0` |
| `true` / `false` / `null` / `undefined` | 静默跳过，不产生任何 DOM | 用来控制显隐，但不能和数字 `0` 混用短路判断 |
| React Element 或由它们组成的数组 | 渲染对应组件/节点 | 数组项缺少稳定 `key` 会导致状态错乱和控制台告警 |
| 普通对象（非 React Element） | 直接抛出运行时错误 | 不能写 `{user}`，必须展开具体字段或序列化 |
| 函数本身 | 告警并忽略渲染 | 事件绑定传函数引用 `onClick={save}`，渲染内容要调用后返回节点 |

**做条件渲染使用 `&&` 短路时，左侧必须先转成严格的布尔值（如 `items.length > 0 && <List />` 或改用三元表达式 `items.length > 0 ? <List /> : null`），否则左边的数字 `0` 会直接漏到页面上。**

编写列表循环时，优先使用数组的 `.map()` 映射并绑定业务实体的唯一稳定 ID 作为 `key`（`key` 仅用于兄弟节点间的 Diff 身份比对，不会作为普通 prop 传进子组件）。如果希望返回多个同级兄弟元素且不额外包裹多余 `<div>`，可以使用 Fragment 简写 `<>...</>`；当列表循环本身需要返回多个兄弟节点并挂 `key` 时，则必须显式导入并写全 `<Fragment key={item.id}>...</Fragment>`。

另外有两个高频语法细节：

1. **TSX 泛型箭头函数歧义**：在 `.tsx` 文件中写 `const first = <T>(items: T[]) => ...` 时，`<T>` 会被编译器误认为 JSX 开始标签。写成 `<T,>` 补一个尾逗号即可消歧，或者直接使用普通 `function first<T>(...)` 声明。
2. **`dangerouslySetInnerHTML` 红线**：React 默认对所有文本插值执行自动转义防 XSS。只有对经过严格白名单 Sanitizer 清洗后的富文本，才允许使用 `dangerouslySetInnerHTML={{ __html: cleanHtml }}`，禁止把未经净化的用户输入或接口原文直接塞进去。

## Vue 与 React 心智模型对照

从 Vue 切到 React，或者在团队双栈项目间切换时，下面这张结构对照能帮你快速切换思考方式：

| 维度 | Vue 3 | React 19 |
| --- | --- | --- |
| 组件封装载体 | `.vue` 单文件组件（模板/脚本/样式同文件） | `.tsx` 组件文件 + 独立 CSS Modules / Tailwind |
| 运行时职责划分 | 单一核心库统一处理响应式、编译与挂载 | `react` 定义组件与协调逻辑，`react-dom` 负责宿主打补丁 |
| 条件与列表表达 | 模板指令驱动（`v-if`、`v-for`） | 原生 JS 表达式驱动（三元运算符、`.map()`） |
| 更新触发与传播 | Proxy 依赖收集，精确重渲染依赖变更的组件 | 状态变更后默认自顶向下重跑子树函数，配合 `memo`/Compiler 剪枝 |
| 作用域内容分发 | `<slot>` / 具名插槽 / 作用域插槽 | `children` prop、命名 JSX prop、Render Props 函数 |
| 表单双向同步 | `v-model` / `defineModel` 语法糖 | 显式受控（`value` + `onChange`）或原生非受控（`FormData` / `ref`） |
| 组件命名与区分 | 注册或导入组件名 | 组件首字母必须大写，小写一律识别为原生宿主标签 |

理解 React 把控制流全部交回给原生 JavaScript 之后，接下来看清渲染函数在调用栈与 Fiber 树里如何调度，就能彻底明白并发特性为什么成立——详情参见 [React 渲染原理：虚拟 DOM、Fiber 架构与并发调度](/posts/react-fiber-and-reconciliation)。

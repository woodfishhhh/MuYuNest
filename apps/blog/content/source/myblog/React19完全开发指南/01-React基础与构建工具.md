---
title: React 基础与构建工具
date: 2026-07-13
updated: 2026-07-13
tags:
  - React 19
  - TypeScript
  - TSX
  - Vite
  - Babel
  - SWC
source:
  - https://www.bilibili.com/video/BV1mcpPeMETt/
bvid: BV1mcpPeMETt
pages: P1-P5
draft: false
---

# React 基础与构建工具

## 1. React 的界面模型

React 是用于构建 Web 与原生用户界面的 JavaScript 库。它最重要的开发模型不是“替你写几个 DOM API”，而是把界面拆成组件，再用数据描述每个组件此刻应该显示什么。

```text
业务数据
  ↓
组件根据 props / state 计算界面描述
  ↓
React 比较前后两次渲染结果
  ↓
渲染器把必要变化提交到目标平台
```

这种模型带来两个直接收益：

1. **组件化**：导航、列表、表单和弹窗可以独立开发、组合与复用。
2. **声明式更新**：业务代码表达“结果应该是什么”，React 负责把当前界面更新到该结果。

原生 DOM 并没有失去价值。React DOM 最终仍要调用浏览器 DOM API，只是把节点创建、属性同步和更新顺序集中到渲染器中。对于很小的静态页面，原生 JavaScript 可能更直接；React 的优势会在状态较多、组件需要复用、页面持续演进时变得明显。

### 1.1 函数组件

一个函数组件接收输入并返回界面描述：

```tsx
interface GreetingProps {
  name: string;
  unreadCount: number;
}

export function Greeting({ name, unreadCount }: GreetingProps) {
  return (
    <header>
      <h1>你好，{name}</h1>
      <p>未读消息：{unreadCount}</p>
    </header>
  );
}
```

组件名使用大写开头，React 才会把它当作自定义组件。`<header>`、`<h1>` 等小写标签代表宿主平台元素，在 React DOM 中会对应浏览器 DOM 节点。

渲染函数必须保持纯粹：相同的 props 与 state 应得到相同的 JSX，渲染期间不要修改外部变量、发送请求或直接操作 DOM。纯渲染让 React 可以安全地重新调用、暂停或放弃尚未提交的计算。

## 2. Vite 创建工程

用 Vite 初始化 React 项目前，先确认 Node.js 满足当前 Vite 的版本要求：

```bash
npm create vite@latest
```

在交互提示中选择 React 和 TypeScript；如果脚手架提供 SWC 变体，也可以选择 TypeScript + SWC。创建完成后进入项目并安装依赖：

```bash
cd react-notes
npm install
npm run dev
```

也可以直接选择标准 React TypeScript 模板：

```bash
npm create vite@latest react-notes -- --template react-ts
```

Vite 在开发阶段提供开发服务器、模块转换与热更新，生产阶段再执行完整构建。Vite 是构建工具，React 是界面库，两者职责不同。

### 2.1 常用脚本

脚本以实际 `package.json` 为准，典型模板包含：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器与热更新 |
| `npm run build` | 类型检查或构建生产资源，具体步骤由模板脚本决定 |
| `npm run lint` | 按 ESLint 配置检查代码 |
| `npm run preview` | 在本地预览已经生成的生产构建 |

`preview` 不等于开发服务器。它用于检查 `build` 的产物，修改源码后不会像 `dev` 那样提供完整开发体验。

## 3. 入口与目录

Vite React 工程的入口链路如下：

```text
index.html
  ↓ 引用 /src/main.tsx
main.tsx
  ↓ createRoot(...).render(...)
App.tsx
  ↓ 组合业务组件
页面 DOM
```

### 3.1 `index.html`

Vite 把项目根目录的 `index.html` 视为入口之一。页面通常提供一个空容器：

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

浏览器先加载 HTML，Vite 再处理模块入口及其依赖图。

### 3.2 `main.tsx`

`createRoot` 创建 React 根，`root.render` 触发首次渲染：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('缺少 #root 挂载节点');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

显式判断容器比盲目写非空断言 `!` 更稳妥。非空断言只会让 TypeScript 停止报错，不会在运行时创建缺失的节点。

`StrictMode` 只在开发环境增加检查，例如额外调用渲染函数来暴露不纯逻辑。它不会凭空修复副作用，也不会让生产环境渲染两遍。

### 3.3 文件职责

| 文件或目录 | 核心职责 |
| --- | --- |
| `src/` | 参与模块依赖图的应用源码 |
| `src/main.tsx` | 浏览器端 React 入口 |
| `src/App.tsx` | 示例根组件，可按业务继续拆分 |
| `src/assets/` | 通过 `import` 引入、由构建工具处理的资源 |
| `public/` | 按原文件名复制到产物根目录的资源 |
| `vite.config.*` | Vite 与插件配置 |
| `tsconfig*.json` | TypeScript 类型检查与 JSX 模式等配置 |
| `eslint.config.*` | ESLint 规则 |
| `package.json` | 脚本、依赖和项目元数据 |
| `package-lock.json` | npm 解析出的完整依赖树与完整性信息 |
| `node_modules/` | 本机安装的依赖，不应提交到 Git |

`dependencies` 与 `devDependencies` 表达安装意图和使用阶段，不直接决定某段代码最终是否进入浏览器包。产物包含什么，还取决于导入关系、打包器和 tree shaking。

### 3.4 `src/assets` 与 `public`

优先把应用源码依赖的资源放进 `src` 并通过模块导入：

```tsx
import logoUrl from './assets/logo.svg';

export function Brand() {
  return <img src={logoUrl} alt="站点标志" />;
}
```

这类资源进入依赖图后，构建工具可以校验路径、生成哈希文件名并重写 URL。

`public` 适合必须保留原文件名、不会从源码中导入，或需要直接用固定根路径访问的文件：

```tsx
export function DownloadLink() {
  return <a href="/manual.pdf">下载使用手册</a>;
}
```

不要在源码里写 `/public/manual.pdf`。`public/manual.pdf` 构建后从 `/manual.pdf` 访问。需要缓存失效与依赖追踪的资源通常更适合放在 `src/assets`。

## 4. 从触发到提交

React 更新分为三个阶段：

```text
Trigger：首次 root.render，或状态更新进入队列
   ↓
Render：React 调用组件，计算下一份界面描述
   ↓
Commit：React DOM 把必要变化写入真实 DOM
   ↓
Browser paint：浏览器绘制像素
```

“渲染”不等于“DOM 一定发生变化”。组件可以重新执行，但如果前后输出对应的 DOM 属性和文本相同，提交阶段可能不需要修改该节点。

常见触发来源有两类：`root.render` 负责首次渲染，state 更新会排队触发重新渲染。

## 5. JSX 与 TSX

JSX 是 JavaScript 的语法扩展，让标签形式的界面描述可以和 JavaScript 表达式写在一起。浏览器不能直接执行 JSX，必须由 TypeScript、Babel、SWC 或其他工具转换成普通 JavaScript。

TSX 不是另一套 React 模板语言。`.tsx` 文件表示其中既允许 TypeScript 语法，也允许 JSX 语法；只含 TypeScript 而没有 JSX 的文件通常使用 `.ts`。

```text
.tsx 源码
  ↓ JSX 转换 + 移除 TypeScript 类型
JavaScript 模块
  ↓ 浏览器执行
React 创建元素描述并完成渲染
```

TypeScript 类型在运行时会被移除。Babel 或 SWC 也可以移除类型语法，但这不等于完成类型检查；项目仍应运行 `tsc` 或模板提供的类型检查命令。

### 5.1 自动 JSX runtime

现代 React 工具链通常使用自动 JSX runtime。编译器会自动生成对 `react/jsx-runtime` 的导入，因此仅仅为了使用 JSX，不需要在每个文件写：

```tsx
import React from 'react';
```

需要 Hook、`StrictMode`、`Fragment` 或类型时，仍然要导入实际使用的名字：

```tsx
import { Fragment, type MouseEventHandler } from 'react';
```

旧的 classic runtime 会把 JSX 转换成 `React.createElement(...)`，这时 `React` 必须处于作用域内。两种转换都只是生成元素描述的方式，不改变 React 的组件模型。

### 5.2 JSX 表达式

花括号中放的是 JavaScript **表达式**，不是任意语句：

```tsx
const user = {
  name: '小满',
  score: 96.125,
  active: true,
};

export function Profile() {
  return (
    <section>
      <h2>{user.name}</h2>
      <p>得分：{user.score.toFixed(2)}</p>
      <p>{user.active ? '在线' : '离线'}</p>
    </section>
  );
}
```

字符串、数字、React 元素以及由这些值组成的数组都可以形成子节点。`null`、`undefined` 和布尔值通常不显示，常用于条件渲染。普通对象不能直接作为 React 子节点；调试时可先 `JSON.stringify`，正式界面则应明确选择要展示的字段。

`if`、`for` 和变量声明是语句，不能直接塞进花括号。先在 `return` 前计算结果，或改用三元表达式、`&&`、`map` 等表达式。

### 5.3 属性、样式与事件

大部分动态属性使用花括号，部分 DOM 属性采用 JavaScript 命名：

```tsx
import type { MouseEventHandler } from 'react';

const buttonClass = 'button button-primary';

export function SaveButton() {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    console.log(event.currentTarget.name);
  };

  return (
    <button
      type="button"
      name="save"
      className={buttonClass}
      style={{ color: '#fff', backgroundColor: '#1769aa' }}
      onClick={handleClick}
    >
      保存
    </button>
  );
}
```

- HTML 的 `class` 在 JSX 中写成 `className`。
- `style` 接收对象，CSS 属性使用 camelCase，例如 `backgroundColor`。
- 事件名使用 camelCase，例如 `onClick`、`onChange`。
- 传递的是函数本身：`onClick={handleClick}`，而不是立即调用的 `onClick={handleClick()}`。

需要额外参数时返回一个新的事件处理函数：

```tsx
function selectUser(id: number) {
  console.log(id);
}

<button type="button" onClick={() => selectUser(42)}>
  选择用户
</button>
```

### 5.4 条件、列表与 `key`

列表使用 `map` 把数据映射为元素：

```tsx
interface Todo {
  id: string;
  title: string;
  done: boolean;
}

const todos: Todo[] = [
  { id: 'learn-tsx', title: '掌握 TSX', done: true },
  { id: 'read-fiber', title: '理解 Fiber', done: false },
];

export function TodoList() {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          {todo.done ? '已完成' : '待完成'}：{todo.title}
        </li>
      ))}
    </ul>
  );
}
```

`key` 表示同一父节点下元素的稳定身份。优先使用业务数据中的唯一 ID，不要在会插入、删除或排序的列表中用数组下标充当 key。`key` 只供 React 协调使用，不会作为普通 prop 传给组件。

### 5.5 Fragment

组件需要返回一个 React 节点。相邻元素不想额外包一层 DOM 时，可使用 Fragment：

```tsx
export function ArticleHeader() {
  return (
    <>
      <h1>React 学习笔记</h1>
      <p>从 TSX 到 Fiber</p>
    </>
  );
}
```

简写 Fragment `<>...</>` 不能接收 `key`。列表中的 Fragment 需要导入 `Fragment` 并写 `<Fragment key={id}>`。

### 5.6 TSX 泛型箭头函数

在 TSX 中，`<T>` 可能被解析为 JSX 标签。给泛型参数增加逗号可以消除歧义：

```tsx
const first = <T,>(items: T[]): T | undefined => items[0];

const firstName = first(['Ada', 'Linus']);
```

普通 `function first<T>(...)` 没有这个 JSX 歧义。

### 5.7 原始 HTML 风险

React 使用 `dangerouslySetInnerHTML` 明确标记直接注入 HTML 的风险：

```tsx
interface HtmlPreviewProps {
  trustedHtml: string;
}

export function HtmlPreview({ trustedHtml }: HtmlPreviewProps) {
  return <article dangerouslySetInnerHTML={{ __html: trustedHtml }} />;
}
```

只有经过可信清洗的 HTML 才能进入这个属性。不要把用户输入、远端富文本或 URL 参数未经处理地注入，否则会形成 XSS。能用普通 JSX 表达的内容不要改用原始 HTML。

## 6. Babel 编译链

Babel 是 JavaScript 编译器，不是 React 运行时，也不是完整打包器。它的核心工作可以概括为：

```text
source code
  ↓ parse
AST
  ↓ transform：插件访问或替换节点
new AST
  ↓ generate
target code + source map
```

AST 是编译器理解源码的结构化表示。它和 React 运行时的元素树不是一回事：

- JavaScript / JSX AST 存在于构建阶段，用于分析和生成代码。
- React 元素存在于运行时，用于描述界面。

### 6.1 Preset 与 Plugin

Plugin 通常处理一类语法或变换；Preset 是一组可共享的 Plugin 与配置。

```json
{
  "presets": [
    ["@babel/preset-env", { "targets": "defaults" }],
    ["@babel/preset-react", { "runtime": "automatic" }],
    "@babel/preset-typescript"
  ]
}
```

三组预设的职责不同：

| Preset | 主要作用 |
| --- | --- |
| `@babel/preset-env` | 按目标环境转换较新的 JavaScript 语法 |
| `@babel/preset-react` | 解析并转换 JSX |
| `@babel/preset-typescript` | 移除 TypeScript 类型语法，不负责完整类型检查 |

自动 runtime 的 JSX 大致会从：

```tsx
const title = <h1 className="title">React</h1>;
```

转换为编译器自动导入的 `jsx` 调用。classic runtime 才会生成 `React.createElement`。因此看到旧教程的转换结果时，要先确认使用的是哪一种 JSX runtime。

### 6.2 语法转换与 Polyfill

把箭头函数转成普通函数属于**语法转换**。旧浏览器缺少 `Promise`、`Object.assign` 等运行时能力，则需要 **polyfill**。

Babel 本身不会无条件实现所有新 API。可以结合 `@babel/preset-env`、目标浏览器配置与 `core-js` 按需注入，也可以由应用入口或其他兼容层负责。是否需要 polyfill 应由支持范围决定，不要为了“兼容”把整个垫片库盲目塞进产物。

## 7. SWC 转换

SWC 使用 Rust 编写，可以解析、转换和生成 JavaScript / TypeScript，并支持 JSX。它和 Babel 有相似的编译阶段，但生态与扩展方式不同。

一个最小 `.swcrc`：

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "target": "es2022",
    "transform": {
      "react": {
        "runtime": "automatic"
      }
    }
  },
  "module": {
    "type": "es6"
  },
  "sourceMaps": true
}
```

这份配置允许解析 TSX、移除类型并使用自动 JSX runtime。和 Babel 一样，SWC 完成语法转换不代表已经执行 TypeScript 类型检查。

### 7.1 Babel 与 SWC

| 维度 | Babel | SWC |
| --- | --- | --- |
| 实现语言 | JavaScript | Rust |
| 典型优势 | 插件生态成熟，定制转换资料多 | 转换速度快，适合开发与构建热路径 |
| JSX / TypeScript | 通过 Preset 和 Plugin 组合 | 由解析器与 transform 配置支持 |
| 类型检查 | 不负责 | 不负责 |
| 是否为 React 运行时 | 否 | 否 |
| 是否天然等于打包器 | 否 | 否 |

不要只用“谁更快”决定。项目依赖 Babel 专属插件时，Babel 更自然；工具链已经集成 SWC 且没有特殊转换需求时，SWC 可以减少编译等待。Vite 的 React 插件会决定具体转换器，应用代码不应依赖某个编译器的内部 AST 结构。

## 8. 工具链全链路

```text
App.tsx
  ↓ TypeScript 类型检查
发现类型错误，但不生成运行时类型

App.tsx
  ↓ Babel / SWC / 当前构建工具的转换器
移除类型语法，转换 JSX 与目标环境不支持的语法

JavaScript modules + imported assets
  ↓ Vite 构建
解析依赖、分块、生成资源 URL 与生产产物

浏览器加载产物
  ↓ React runtime + React DOM
Trigger → Render → Commit
```

这个边界能避免几类常见误解：

- JSX 是 JavaScript 语法扩展，不是浏览器原生 HTML 模板。
- `.tsx` 承载 TypeScript 与 JSX；类型只在开发和构建阶段存在。
- 自动 JSX runtime 不要求每个 JSX 文件导入默认 `React`。
- Babel 和 SWC 是编译器，不负责在浏览器中维护组件状态。
- Vite 组织开发服务器与构建流程，不替代 React 的渲染器。
- React 更新要区分触发、渲染和提交，组件执行不等于 DOM 必然变化。

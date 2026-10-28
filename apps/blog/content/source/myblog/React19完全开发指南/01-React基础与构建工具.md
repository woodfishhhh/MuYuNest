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

React 是用来构建 Web 和原生用户界面的 JavaScript 库。它最重要的开发模型是把界面拆成组件，再用数据描述每个组件此刻该显示什么，而不只是替你调几个 DOM API。

```text
业务数据
  ↓
组件根据 props / state 计算界面描述
  ↓
React 比较前后两次渲染结果
  ↓
渲染器把必要变化提交到目标平台
```

这种模型带来两个直接的好处：

1. 组件化：导航、列表、表单和弹窗可以各自开发、组合和复用。
2. 声明式更新：业务代码只写"结果应该是什么"，React 负责把当前界面更新成那个结果。

原生 DOM 并没有过时。React DOM 最后还是要调浏览器的 DOM API，只是把节点创建、属性同步和更新顺序集中到了渲染器里。很小的静态页面，用原生 JavaScript 可能更直接；状态多、组件要复用、页面一直在迭代时，React 的优势才明显。

### 1.1 函数组件

函数组件接收输入，返回界面描述：

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

组件名要大写开头，React 才会把它当成自定义组件。`<header>`、`<h1>` 这些小写标签代表宿主平台的元素，在 React DOM 里对应浏览器的 DOM 节点。

渲染函数必须是纯的：同样的 props 和 state 要得到同样的 JSX，渲染期间别改外部变量、发请求或直接操作 DOM。渲染是纯的，React 才能放心地重新调用、暂停或丢掉还没提交的计算。

## 2. Vite 创建工程

用 Vite 初始化 React 项目之前，先确认 Node.js 满足当前 Vite 的版本要求：

```bash
npm create vite@latest
```

交互提示里选 React 和 TypeScript；脚手架有 SWC 变体的话，也可以选 TypeScript + SWC。建好后进项目装依赖：

```bash
cd react-notes
npm install
npm run dev
```

也可以直接选标准的 React TypeScript 模板：

```bash
npm create vite@latest react-notes -- --template react-ts
```

Vite 在开发阶段提供开发服务器、模块转换和热更新，生产阶段再做完整构建。Vite 是构建工具，React 是界面库，各管各的。

### 2.1 常用脚本

脚本以实际的 `package.json` 为准，典型模板里有：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器与热更新 |
| `npm run build` | 类型检查或构建生产资源，具体步骤由模板脚本决定 |
| `npm run lint` | 按 ESLint 配置检查代码 |
| `npm run preview` | 在本地预览已经生成的生产构建 |

`preview` 不是开发服务器，它用来检查 `build` 的产物，改了源码不会像 `dev` 那样有完整的开发体验。

## 3. 入口与目录

Vite React 工程的入口链路：

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

Vite 把项目根目录的 `index.html` 当作入口之一。页面一般提供一个空容器：

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

浏览器先加载 HTML，Vite 再处理模块入口和它的依赖图。

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

显式判断容器存不存在，比直接写非空断言 `!` 稳妥。非空断言只是让 TypeScript 不报错，运行时缺的节点并不会凭空出现。

`StrictMode` 只在开发环境加检查，比如多调用一次渲染函数来暴露不纯的逻辑。它不会自动修好副作用，也不会让生产环境渲染两遍。

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

`dependencies` 和 `devDependencies` 表达的是安装意图和使用阶段，不直接决定某段代码最后会不会进浏览器包。产物里有什么，还要看导入关系、打包器和 tree shaking。

### 3.4 `src/assets` 与 `public`

应用源码依赖的资源，优先放进 `src`，通过模块导入：

```tsx
import logoUrl from './assets/logo.svg';

export function Brand() {
  return <img src={logoUrl} alt="站点标志" />;
}
```

这类资源进了依赖图，构建工具就能校验路径、生成带哈希的文件名并重写 URL。

`public` 适合这几类文件：必须保留原文件名、不会从源码里导入、或者要用固定的根路径直接访问：

```tsx
export function DownloadLink() {
  return <a href="/manual.pdf">下载使用手册</a>;
}
```

别在源码里写 `/public/manual.pdf`。`public/manual.pdf` 构建后从 `/manual.pdf` 访问。需要缓存失效和依赖追踪的资源，一般更适合放 `src/assets`。

## 4. 从触发到提交

React 的更新分三个阶段：

```text
Trigger：首次 root.render，或状态更新进入队列
   ↓
Render：React 调用组件，计算下一份界面描述
   ↓
Commit：React DOM 把必要变化写入真实 DOM
   ↓
Browser paint：浏览器绘制像素
```

"渲染"了，DOM 不一定会变。组件可以重新执行，但前后输出对应的 DOM 属性和文本一样的话，提交阶段可能就不用改这个节点。

常见的触发来源有两类：`root.render` 负责首次渲染，state 更新会排队触发重新渲染。

## 5. JSX 与 TSX

JSX 是 JavaScript 的语法扩展，让标签形式的界面描述能和 JavaScript 表达式写在一起。浏览器不能直接执行 JSX，必须由 TypeScript、Babel、SWC 或其他工具转成普通的 JavaScript。

TSX 不是另一套 React 模板语言。`.tsx` 文件表示里面既能写 TypeScript 语法，也能写 JSX；只有 TypeScript、没有 JSX 的文件一般用 `.ts`。

```text
.tsx 源码
  ↓ JSX 转换 + 移除 TypeScript 类型
JavaScript 模块
  ↓ 浏览器执行
React 创建元素描述并完成渲染
```

TypeScript 类型在运行时会被去掉。Babel 或 SWC 也能去掉类型语法，但这不算做了类型检查；项目还是要跑 `tsc` 或模板提供的类型检查命令。

### 5.1 自动 JSX runtime

现代的 React 工具链一般用自动 JSX runtime。编译器会自动生成对 `react/jsx-runtime` 的导入，所以光为了用 JSX，不用在每个文件里写：

```tsx
import React from 'react';
```

要用 Hook、`StrictMode`、`Fragment` 或类型时，还是要导入实际用到的名字：

```tsx
import { Fragment, type MouseEventHandler } from 'react';
```

旧的 classic runtime 会把 JSX 转成 `React.createElement(...)`，这时 `React` 必须在作用域里。两种转换都只是生成元素描述的方式，不会改变 React 的组件模型。

### 5.2 JSX 表达式

花括号里放的是 JavaScript 表达式，不是任意语句：

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

字符串、数字、React 元素，以及由它们组成的数组，都能当子节点。`null`、`undefined` 和布尔值一般不显示，常拿来做条件渲染。普通对象不能直接当 React 子节点；调试时可以先 `JSON.stringify`，正式界面要明确挑出要展示的字段。

`if`、`for` 和变量声明是语句，不能直接塞进花括号。先在 `return` 前算好结果，或者改用三元表达式、`&&`、`map` 这些表达式。

### 5.3 属性、样式与事件

大部分动态属性用花括号，部分 DOM 属性用 JavaScript 的命名：

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

- HTML 的 `class` 在 JSX 里写成 `className`。
- `style` 接收对象，CSS 属性用 camelCase，比如 `backgroundColor`。
- 事件名用 camelCase，比如 `onClick`、`onChange`。
- 传的是函数本身：`onClick={handleClick}`，不是立刻调用的 `onClick={handleClick()}`。

要带额外参数时，返回一个新的事件处理函数：

```tsx
function selectUser(id: number) {
  console.log(id);
}

<button type="button" onClick={() => selectUser(42)}>
  选择用户
</button>
```

### 5.4 条件、列表与 `key`

列表用 `map` 把数据映射成元素：

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

`key` 表示同一个父节点下元素的稳定身份。优先用业务数据里的唯一 ID，会插入、删除或排序的列表别拿数组下标当 key。`key` 只给 React 协调用，不会当普通 prop 传给组件。

### 5.5 Fragment

组件要返回一个 React 节点。几个相邻元素不想额外包一层 DOM 时，可以用 Fragment：

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

简写的 Fragment `<>...</>` 不能接收 `key`。列表里的 Fragment 要导入 `Fragment`，写成 `<Fragment key={id}>`。

### 5.6 TSX 泛型箭头函数

在 TSX 里，`<T>` 可能被当成 JSX 标签解析。给泛型参数加一个逗号就能消除歧义：

```tsx
const first = <T,>(items: T[]): T | undefined => items[0];

const firstName = first(['Ada', 'Linus']);
```

普通的 `function first<T>(...)` 没有这个 JSX 歧义。

### 5.7 原始 HTML 风险

React 用 `dangerouslySetInnerHTML` 这个名字明确标出直接注入 HTML 的风险：

```tsx
interface HtmlPreviewProps {
  trustedHtml: string;
}

export function HtmlPreview({ trustedHtml }: HtmlPreviewProps) {
  return <article dangerouslySetInnerHTML={{ __html: trustedHtml }} />;
}
```

只有经过可信清洗的 HTML 才能放进这个属性。用户输入、远端富文本或 URL 参数不处理就注入，会形成 XSS。能用普通 JSX 表达的内容，别改用原始 HTML。

## 6. Babel 编译链

Babel 是 JavaScript 编译器，不是 React 运行时，也不是完整的打包器。它的核心工作可以概括成：

```text
source code
  ↓ parse
AST
  ↓ transform：插件访问或替换节点
new AST
  ↓ generate
target code + source map
```

AST 是编译器理解源码用的结构化表示，和 React 运行时的元素树是两回事：

- JavaScript / JSX AST 存在于构建阶段，用来分析和生成代码。
- React 元素存在于运行时，用来描述界面。

### 6.1 Preset 与 Plugin

Plugin 一般处理一类语法或变换；Preset 是一组能共享的 Plugin 和配置。

```json
{
  "presets": [
    ["@babel/preset-env", { "targets": "defaults" }],
    ["@babel/preset-react", { "runtime": "automatic" }],
    "@babel/preset-typescript"
  ]
}
```

三组预设各管一块：

| Preset | 主要作用 |
| --- | --- |
| `@babel/preset-env` | 按目标环境转换较新的 JavaScript 语法 |
| `@babel/preset-react` | 解析并转换 JSX |
| `@babel/preset-typescript` | 移除 TypeScript 类型语法，不负责完整类型检查 |

自动 runtime 下的 JSX 大致会从：

```tsx
const title = <h1 className="title">React</h1>;
```

转成编译器自动导入的 `jsx` 调用。classic runtime 才会生成 `React.createElement`。所以看旧教程里的转换结果时，先确认用的是哪种 JSX runtime。

### 6.2 语法转换与 Polyfill

把箭头函数转成普通函数属于语法转换。旧浏览器缺少 `Promise`、`Object.assign` 这些运行时能力，则需要 polyfill。

Babel 本身不会无条件实现所有新 API。可以结合 `@babel/preset-env`、目标浏览器配置和 `core-js` 按需注入，也可以交给应用入口或别的兼容层负责。要不要 polyfill 由支持范围决定，别为了"兼容"把整个垫片库一股脑塞进产物。

## 7. SWC 转换

SWC 用 Rust 写，能解析、转换和生成 JavaScript / TypeScript，也支持 JSX。它和 Babel 的编译阶段差不多，但生态和扩展方式不一样。

一个最小的 `.swcrc`：

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

这份配置允许解析 TSX、去掉类型，并使用自动 JSX runtime。和 Babel 一样，SWC 做完语法转换，不代表执行过 TypeScript 类型检查。

### 7.1 Babel 与 SWC

| 维度 | Babel | SWC |
| --- | --- | --- |
| 实现语言 | JavaScript | Rust |
| 典型优势 | 插件生态成熟，定制转换资料多 | 转换速度快，适合开发与构建热路径 |
| JSX / TypeScript | 通过 Preset 和 Plugin 组合 | 由解析器与 transform 配置支持 |
| 类型检查 | 不负责 | 不负责 |
| 是否为 React 运行时 | 否 | 否 |
| 是否天然等于打包器 | 否 | 否 |

别光看"谁更快"。项目依赖 Babel 专属插件的话，用 Babel 更自然；工具链已经集成了 SWC、又没有特殊的转换需求时，SWC 能少等一些编译时间。具体用哪个转换器由 Vite 的 React 插件决定，应用代码别依赖某个编译器内部的 AST 结构。

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

划清这个边界，能避开几类常见误解：

- JSX 是 JavaScript 的语法扩展，不是浏览器原生的 HTML 模板。
- `.tsx` 装的是 TypeScript 和 JSX；类型只存在于开发和构建阶段。
- 自动 JSX runtime 不要求每个 JSX 文件都导入默认的 `React`。
- Babel 和 SWC 是编译器，不负责在浏览器里维护组件状态。
- Vite 组织开发服务器和构建流程，代替不了 React 的渲染器。
- React 的更新要分清触发、渲染和提交，组件执行了，DOM 不一定会变。

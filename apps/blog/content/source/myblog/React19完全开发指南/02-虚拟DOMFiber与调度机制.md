---
title: 虚拟 DOM、Fiber 与调度机制
date: 2026-07-13
updated: 2026-07-13
tags:
  - React 19
  - Virtual DOM
  - Fiber
  - Reconciliation
  - Scheduler
source:
  - https://www.bilibili.com/video/BV1mcpPeMETt/
bvid: BV1mcpPeMETt
pages: P6-P7
draft: false
---

# 虚拟 DOM、Fiber 与调度机制

Fiber、lanes、Scheduler 及其字段属于 React 内部实现心智模型，不是稳定公共 API。业务代码应依赖公开的 React API，而不是内部字段名或优先级数值。

## 1. 三棵树

学习 React 原理时，最容易混淆的是元素描述、Fiber 与真实 DOM。它们处在不同层：

| 层 | 表示什么 | 典型生命周期 |
| --- | --- | --- |
| React 元素树 | 组件这次希望得到的界面描述 | 作为本轮协调输入，通常由渲染计算得到 |
| Fiber 树 | React 协调工作的持久记录 | 在多次更新之间复用并保存工作状态 |
| 宿主树 | 浏览器 DOM 或其他平台节点 | 提交阶段按必要变化更新 |

另外还有一类完全不同的树：Babel、SWC 解析源码得到的 AST。AST 属于**编译阶段**；React 元素和 Fiber 属于**运行阶段**。不能因为它们都是 JavaScript 对象，就把 JSX AST、虚拟 DOM 和 Fiber 当成同一种结构。

### 1.1 JSX 与元素描述

这段 TSX：

```tsx
const view = (
  <button type="button" className="primary">
    保存
  </button>
);
```

在自动 JSX runtime 下，会被编译成对 `react/jsx-runtime` 中函数的调用。classic runtime 才会生成 `React.createElement(...)`。无论使用哪种转换，运行结果都可以概念化为：

```ts
interface ElementDescription {
  type: string;
  key: string | null;
  props: {
    type: string;
    className: string;
    children: string;
  };
}
```

这个接口只是帮助理解，不是 React 元素对象的稳定公开布局。应用不应修改元素对象，也不应读取未文档化的内部字段。

### 1.2 元素描述的作用

声明式组件只负责给出“下一份界面应该是什么”。协调器可以先在内存中比较前后描述，再把需要的变化交给具体渲染器：

```text
组件输出 React 元素
        ↓
共享的协调思路
        ↓
React DOM       React Native       其他渲染器
浏览器节点       原生视图            各自宿主节点
```

跨平台能力来自协调与宿主操作的分离，不是因为一个普通 JavaScript 对象能自动变成任意平台界面。每个渲染器仍需实现目标平台的创建、更新与删除操作。

## 2. Trigger、Render、Commit

任何一次界面更新都应先用三阶段模型分析：

```text
Trigger
首次 root.render，或某个状态更新进入队列
    ↓
Render
调用组件，协调新旧结果，准备工作树和变更标记
    ↓
Commit
把已完成结果写入 DOM，并处理与提交相关的工作
    ↓
Browser paint
浏览器把新 DOM 绘制成像素
```

### 2.1 Trigger 只是把工作交给 React

首次渲染由根节点触发：

```tsx
import { createRoot } from 'react-dom/client';

function Status({ online }: { online: boolean }) {
  return <p>{online ? '在线' : '离线'}</p>;
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('缺少 #root');
}

const root = createRoot(container);
root.render(<Status online={false} />);

setTimeout(() => {
  root.render(<Status online />);
}, 1000);
```

state 更新同样会触发渲染。触发不表示 React 立即重写整棵 DOM，它只是让相应更新进入待处理工作。

### 2.2 Render 是纯计算

Render 阶段会调用组件并计算下一份结果。它可能发生多次，也可能产生一份最后没有提交的工作结果。因此渲染期间不能发送请求、修改 DOM 或改变组件外部对象。

并发能力主要作用于这段**计算工作**。在允许并发的路径上，React 可以在工作单元边界让出主线程，之后继续、重新开始或丢弃过时工作。

### 2.3 Commit 才改变宿主界面

Render 阶段完成后，React 才进入 Commit。DOM 插入、属性更新和删除在这里执行。一次提交开始后不会为了另一份 React 渲染工作在中途让出并展示半棵新树；需要分片的是提交前的可计算工作，而不是把一次 DOM 提交拆成用户可见的半成品。

组件重新执行也不代表 DOM 必然变化。如果新旧结果对应的文本、属性和节点身份相同，提交阶段可能不需要操作该 DOM 节点。

## 3. 协调与虚拟 DOM

“虚拟 DOM”通常指运行时用于描述界面的 React 元素及相关树状结果。真正决定如何从旧结果走到新结果的过程叫 **reconciliation**，即协调。日常所说的 React Diff 多半是这套协调过程的简称，不是某个公开 API。

```text
previous element result
          +
next element result
          ↓
reconciliation
          ↓
reuse / update / insert / remove
```

虚拟 DOM 不是“任何时候都比手写 DOM 快”的保证。它的价值主要是：

- 给声明式组件提供统一的运行时表示。
- 让 React 有机会批量协调前后结果。
- 把协调逻辑与浏览器或原生平台的具体操作分开。
- 在通用抽象成本与可维护性之间取得工程平衡。

如果开发者精确知道唯一要改的 DOM 属性，直接写一次 DOM API 当然可能更少。React 优化的是复杂应用中持续更新的整体模型，而不是宣称每次比较都没有成本。

### 3.1 位置、类型与 `key`

可以用两条启发式规则理解协调：

1. 不同元素或组件类型通常代表不同子树，旧子树会被替换。
2. 同一父节点下的列表使用 `key` 区分稳定身份。

```tsx
interface Message {
  id: string;
  text: string;
}

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <ul>
      {messages.map((message) => (
        <li key={message.id}>{message.text}</li>
      ))}
    </ul>
  );
}
```

当列表重新排序时，`message.id` 仍指向同一个业务实体，React 才能正确判断节点应复用、移动、插入还是删除。若使用数组下标，位置变化会让身份漂移，组件局部状态和输入状态可能跟到错误条目。

`key` 的作用域只在当前兄弟列表中。它需要稳定、可预测，并在这组兄弟之间唯一，不要求在整个应用全局唯一。

### 3.2 同类型复用

如果旧元素与新元素类型和身份可以对应，React 可以复用已有 Fiber 与宿主节点，但仍需比较新的 props、文本和子节点：

```tsx
// 标签身份可复用，但 className 与文本需要更新。
<button className="idle">保存</button>
<button className="success">已保存</button>
```

如果类型从 `span` 变成 `p`，通常会创建新宿主节点并删除旧节点。对组件而言，类型或 `key` 变化还会使其状态边界重置。

只按新旧节点顺序和 `type` 比较的简化循环，最多展示新增、更新、删除三类动作。真实协调器还要处理 `key`、组件、Fragment、Suspense、错误边界和多种宿主环境，不能把这种循环当作 React 源码算法。

## 4. Fiber 工作记录

传统递归遍历依赖 JavaScript 调用栈。一旦深度递归开始，框架无法把浏览器调用栈保存到一半后随意恢复。Fiber 把组件树上的工作显式表示为 JavaScript 对象和链接关系，使协调器可以自己决定下一个工作单元。

```text
Parent Fiber
    │ child
    ▼
FirstChild Fiber ── sibling ──▶ SecondChild Fiber
    │ return                         │ return
    └──────────── Parent ◀───────────┘
```

一个 Fiber 可以理解为“某个组件或宿主节点的一份工作记录”。它不是 DOM 节点，也不是 Web Worker，更不是操作系统线程。

### 4.1 Fiber 字段

常见内部字段可以帮助定位职责，但字段名和组织方式可能随 React 版本变化：

| 字段概念 | 作用 |
| --- | --- |
| `type`、`key` | 参与判断节点身份与能否复用 |
| `child`、`sibling`、`return` | 把递归树表示为可逐步遍历的链接结构 |
| `pendingProps`、`memoizedProps` | 保存待处理输入与上次完成的输入 |
| `memoizedState`、更新队列 | 保存组件状态与待处理更新 |
| `stateNode` | 指向宿主节点、类实例或根等具体对象 |
| `alternate` | 连接 current 与 work-in-progress 两个版本 |
| `flags`、`subtreeFlags` | 汇总提交阶段需要执行的工作 |
| `lanes`、`childLanes` | 标记自身与子树尚待处理的更新集合 |

这些字段不是业务代码可以依赖的 API。React DevTools 或源码调试可能展示它们，但生产逻辑不应读写。

### 4.2 工作循环

这段简化伪代码展示了 `child`、`sibling`、`return` 如何替代一次不可控制的递归：

```ts
interface TeachingFiber {
  child: TeachingFiber | null;
  sibling: TeachingFiber | null;
  return: TeachingFiber | null;
}

declare function beginWork(
  fiber: TeachingFiber,
): TeachingFiber | null;

declare function completeWork(fiber: TeachingFiber): void;

function performUnitOfWork(
  fiber: TeachingFiber,
): TeachingFiber | null {
  const child = beginWork(fiber);

  if (child) {
    return child;
  }

  let node: TeachingFiber | null = fiber;

  while (node) {
    completeWork(node);

    if (node.sibling) {
      return node.sibling;
    }

    node = node.return;
  }

  return null;
}
```

协调器处理一个 Fiber 后，显式返回下一个工作单元。并发工作循环可以在单元之间检查是否应该让出主线程。真实 `beginWork`、`completeWork` 和退出条件远比这个版本复杂。

### 4.3 双缓冲树

Fiber 使用双缓冲思想维护两套角色：

```text
current tree
已经提交、对应当前屏幕
       │ alternate
       ▼
work-in-progress tree
正在计算下一次结果
```

更新时，React 会复用或创建 work-in-progress Fiber，在上面计算子树并收集标记。只有整棵需要提交的工作完成后，才会提交结果并把完成的树变成新的 current。

如果更高优先级更新使当前计算过时，尚未提交的 work-in-progress 可以被放弃或重新计算。因为 DOM 还没在 Render 阶段改变，屏幕仍对应 current 树。

## 5. Lanes 与更新优先级

现代 React 内部使用 lanes 表示更新属于哪些待处理工作集合。可以把 lane 想成位掩码中的一位或一组位：

```text
000001  某类紧急工作
000100  某类普通工作
010000  某个 transition 工作
100000  某类空闲工作
```

真实位分配、lane 名称、合并规则和选择算法都属于内部实现。业务代码不应保存 lane 数字，也不应假定某个事件永远映射到固定 bit。

Lanes 主要回答：

- 这个根上有哪些更新还没处理？
- 当前这轮渲染应该选择哪些更新？
- 某个子树是否包含本轮相关工作？
- 新的高紧急度更新到来时，当前工作是否应重新安排？

### 5.1 Lanes 与 Scheduler

两者都谈“优先级”，但处在不同层：

```text
React update
   ↓ 标记 lane
Reconciler 选择本轮要渲染的 lanes
   ↓
为根安排 Scheduler task
   ↓
Scheduler 决定何时获得主线程时间
   ↓
Fiber work loop 执行所选工作
   ↓
Commit
```

Lanes 管理 React 更新集合和渲染选择；Scheduler 管理 JavaScript 回调何时运行以及何时协作式让出主线程。把两者都简单写成“数字越小越优先”会掩盖边界。

### 5.2 可中断边界

“Fiber 让 React 所有更新都能中断”是不准确的。更稳妥的说法是：

- 在支持并发的渲染路径上，部分 Render 工作可以让出、恢复、重启或丢弃。
- 同步或高紧急度更新可能直接完成，不一定经过可观察的让出。
- 工作量很小时，即使允许让出，也可能在一个时间片内完成。
- Transition 等低紧急度工作更适合在更紧急更新到来时被重新安排。
- Commit 阶段不会作为普通并发渲染工作被切成多个可中断片段。

并发渲染仍主要运行在同一个 JavaScript 主线程上。它是协作式调度，不是把组件自动并行到多个 CPU 核心。

## 6. Scheduler

浏览器主线程同时承担 JavaScript、用户事件、样式计算、布局和绘制等工作。一个长时间不返回的 JavaScript 任务会延迟输入响应与页面绘制。

```text
长任务：
[---------------- JavaScript ----------------]
用户输入和绘制只能等待

协作式切片：
[JS work][让出][输入/绘制][JS work][让出]...
```

React 不能在任意 JavaScript 指令中间强行抢占自己。它必须把工作拆成单元，并在安全边界主动检查是否该让出。

### 6.1 `requestIdleCallback` 不是 Scheduler

`requestIdleCallback` 可以在浏览器报告空闲时间时执行低优先级回调，并通过 deadline 查询剩余时间。它能表达“有空做一点，没空下次继续”的协作模型。

React Scheduler 并不是直接依赖原生 `requestIdleCallback` 完成全部调度。兼容性、触发时机和优先级控制都不满足 React 的完整需求。浏览器环境中的宿主回调常借助 `MessageChannel` 安排任务，再由 Scheduler 自己维护时间片、优先级与过期策略；具体宿主实现可能随版本和环境变化。

`MessageChannel` 也不会神奇地把任务变成多线程。它只是让后续回调进入宿主事件循环，React 获得下一段执行机会。

### 6.2 优先级与过期时间

Scheduler 的基本心智模型是：

1. 为回调记录优先级、开始时间与过期时间。
2. 从可执行任务中选择最该处理的任务。
3. 在时间片内调用回调。
4. 若回调返回 continuation，则保留剩余工作，稍后继续。
5. 时间片用尽且任务未过期时，主动把控制权还给宿主。

高优先级任务到来时，正在运行的 JavaScript 回调不会在任意指令中被强制掐断。只有当前工作到达协作检查点并让出，调度器才能先处理新任务。

### 6.3 最小协作调度器

这段代码只保留 `MessageChannel`、过期时间、时间片和 continuation。它不是 React Scheduler 源码，也没有实现延迟任务、取消、错误恢复与真实最小堆：

```ts
type Priority = 'user-blocking' | 'normal' | 'idle';
type TaskCallback = () => TaskCallback | void;

interface Task {
  id: number;
  expiresAt: number;
  callback: TaskCallback;
}

const timeoutByPriority: Record<Priority, number> = {
  'user-blocking': 250,
  normal: 5000,
  idle: Number.POSITIVE_INFINITY,
};

const tasks: Task[] = [];
const channel = new MessageChannel();

let nextId = 1;
let hostCallbackScheduled = false;

function sortTasks() {
  tasks.sort((a, b) => a.expiresAt - b.expiresAt);
}

function requestHostCallback() {
  if (hostCallbackScheduled) return;

  hostCallbackScheduled = true;
  channel.port2.postMessage(null);
}

export function schedule(
  priority: Priority,
  callback: TaskCallback,
) {
  tasks.push({
    id: nextId++,
    expiresAt: performance.now() + timeoutByPriority[priority],
    callback,
  });

  sortTasks();
  requestHostCallback();
}

channel.port1.onmessage = () => {
  hostCallbackScheduled = false;
  const sliceDeadline = performance.now() + 5;

  while (tasks.length > 0) {
    const now = performance.now();
    const task = tasks[0]!;
    const didTimeout = task.expiresAt <= now;

    if (!didTimeout && now >= sliceDeadline) {
      break;
    }

    tasks.shift();
    const continuation = task.callback();

    if (continuation) {
      task.callback = continuation;
      tasks.push(task);
      sortTasks();
    }
  }

  if (tasks.length > 0) {
    requestHostCallback();
  }
};
```

一个可续执行的任务：

```ts
function createChunkedTask(
  values: number[],
  chunkSize = 200,
): TaskCallback {
  let cursor = 0;

  function runChunk(): TaskCallback | void {
    const end = Math.min(cursor + chunkSize, values.length);

    while (cursor < end) {
      Math.sqrt(values[cursor]);
      cursor += 1;
    }

    if (cursor < values.length) {
      return runChunk;
    }
  }

  return runChunk;
}

const values = Array.from({ length: 1000 }, (_, index) => index + 1);
schedule('normal', createChunkedTask(values));
```

这里真正能够“继续”的原因不是 `MessageChannel` 本身，而是任务把进度保存在 `cursor`，并返回 continuation。Fiber 也提供了可保存和恢复工作位置的数据结构，但真实实现要复杂得多。

## 7. Render 与 Commit

简化渲染器可以先为 Fiber 标记“新增、更新、删除”，等所有工作单元完成后再统一操作 DOM：

```text
Render phase
构建 work-in-progress
比较新旧输入
记录需要执行的工作
不把半成品展示到屏幕
        ↓
Commit phase
执行插入、更新、删除
更新 current 指向
```

现代 React 内部会使用 `flags` 与 `subtreeFlags` 等结构收集提交工作。旧资料常见的 `effectTag`、独立 effect list 等名字可能已经变化。稳定的边界是“Render 计算并标记，Commit 执行宿主变化”，不是某个具体字段名。

### 7.1 先计算再提交

如果边比较边把每个中间结果立即写进 DOM：

- 工作被打断时，页面可能停在不一致的半成品。
- 后来的高优先级更新难以放弃前一份计算。
- 渲染逻辑容易混入不可回滚的副作用。

把可丢弃的计算放在 Render，把不可随意撤回的宿主修改集中到 Commit，React 才能安全地重试与重新安排渲染工作。

## 8. 简化模型与真实实现

| 简化模型 | 应如何理解 |
| --- | --- |
| 手写 `createElement` 返回 `{ type, props, children }` | 用于理解元素描述；真实元素格式和开发字段不要依赖 |
| `requestIdleCallback` 驱动工作循环 | 用于演示空闲切片；React Scheduler 不等同于原生该 API |
| 新旧节点按顺序比较 `type` | 只展示协调基本动作；真实逻辑还依赖 `key`、组件类型和多种边界 |
| 数组排序模拟优先队列 | 便于学习；真实 Scheduler 使用更合适的数据结构和更多队列 |
| `effectTag` 标记新增、更新、删除 | 对应“Render 标记、Commit 执行”的思路，字段名不是稳定 API |
| Fiber 让任务“可中断” | 仅部分 Render 路径可协作让出，不代表每次更新、每个阶段都可中断 |

原理代码的目标是解释职责，不是做一个兼容 React 19 的替代实现。真实协调器还需处理 Hooks、Context、Suspense、错误边界、hydration、服务端组件和不同宿主渲染器。

## 9. 更新链路

```text
1. 事件或数据变化产生 update
2. React 为 update 标记内部 lane
3. 根节点汇总待处理 lanes
4. React 根据紧急度安排同步工作或 Scheduler task
5. Scheduler 获得主线程时间
6. Fiber work loop 处理 work-in-progress
7. 可并发路径在工作单元边界检查是否让出
8. Render 完成后进入 Commit
9. React DOM 执行必要宿主操作
10. 完成树成为新的 current，浏览器随后绘制
```

这条链路也说明了三组概念不能互换：

- React 元素描述“想要什么”。
- Fiber 保存“这份渲染工作做到哪里、还要做什么”。
- Scheduler 决定“什么时候继续执行回调”。

## 10. 常见误区

### 虚拟 DOM 就是 AST

不是。AST 是 Babel、SWC 等编译器解析源码的结果；React 元素是编译后 JavaScript 执行产生的运行时值。

### Fiber 就是虚拟 DOM 节点

不准确。React 元素描述这次期望结果，Fiber 是跨渲染保存组件状态、更新队列和工作信息的内部记录。

### 有 Fiber 就一定不会卡

不成立。超长的事件处理函数、同步循环、Commit DOM 操作、布局抖动和第三方脚本仍能阻塞主线程。协作调度只能在框架可以控制的工作边界让出。

### Scheduler 会抢占正在执行的 JavaScript

不会。浏览器中的 JavaScript 仍遵守 run-to-completion。所谓中断发生在 React 主动检查并让出之后。

### 每个 state 更新都能被中断

不会。更新紧急度、渲染路径和所在阶段都会影响行为；同步工作和 Commit 不能用“都可中断”概括。

### `MessageChannel` 就是多线程

不是。它可用于上下文通信，也可用于安排后续任务；React 浏览器调度仍主要在主线程协作执行。

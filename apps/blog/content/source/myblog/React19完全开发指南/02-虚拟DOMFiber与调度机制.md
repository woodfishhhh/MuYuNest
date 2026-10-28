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

先说一句：Fiber、lanes、Scheduler 和它们的字段都是 React 内部实现的心智模型，不是稳定的公共 API。业务代码要依赖公开的 React API，别依赖内部字段名或优先级数值。

## 1. 三棵树

学 React 原理时最容易混的，是元素描述、Fiber 和真实 DOM。它们在不同的层：

| 层 | 表示什么 | 典型生命周期 |
| --- | --- | --- |
| React 元素树 | 组件这次希望得到的界面描述 | 作为本轮协调输入，通常由渲染计算得到 |
| Fiber 树 | React 协调工作的持久记录 | 在多次更新之间复用并保存工作状态 |
| 宿主树 | 浏览器 DOM 或其他平台节点 | 提交阶段按必要变化更新 |

另外还有一类完全不同的树：Babel、SWC 解析源码得到的 AST。AST 属于编译阶段；React 元素和 Fiber 属于运行阶段。不能因为它们都是 JavaScript 对象，就把 JSX AST、虚拟 DOM 和 Fiber 当成同一种结构。

### 1.1 JSX 与元素描述

这段 TSX：

```tsx
const view = (
  <button type="button" className="primary">
    保存
  </button>
);
```

在自动 JSX runtime 下，会被编译成对 `react/jsx-runtime` 里函数的调用；classic runtime 才会生成 `React.createElement(...)`。不管用哪种转换，运行结果大致可以理解成：

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

这个接口只是帮助理解，不是 React 元素对象稳定的公开结构。应用别改元素对象，也别读没写进文档的内部字段。

### 1.2 元素描述的作用

声明式组件只负责给出"下一份界面应该是什么"。协调器可以先在内存里比较前后两份描述，再把需要的变化交给具体的渲染器：

```text
组件输出 React 元素
        ↓
共享的协调思路
        ↓
React DOM       React Native       其他渲染器
浏览器节点       原生视图            各自宿主节点
```

跨平台的能力来自协调和宿主操作的分离，并不是一个普通的 JavaScript 对象能自动变成任意平台的界面。每个渲染器还是要实现目标平台的创建、更新和删除操作。

## 2. Trigger、Render、Commit

分析任何一次界面更新，都先套这个三阶段模型：

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

state 更新同样会触发渲染。触发不代表 React 马上重写整棵 DOM，只是让对应的更新进入待处理的工作。

### 2.2 Render 是纯计算

Render 阶段会调用组件，算出下一份结果。它可能发生好几次，也可能算出一份最后没被提交的结果。所以渲染期间不能发请求、改 DOM 或者改组件外部的对象。

并发能力主要作用在这段计算工作上。在允许并发的路径上，React 可以在工作单元的边界让出主线程，之后接着做、从头再来，或者丢掉过时的工作。

### 2.3 Commit 才改变宿主界面

Render 阶段完成后，React 才进入 Commit，DOM 的插入、属性更新和删除都在这里执行。一次提交开始以后，不会为了另一份 React 渲染工作中途让出、把半棵新树展示出来；要分片的是提交前的计算工作，不是把一次 DOM 提交拆成用户看得见的半成品。

组件重新执行了，DOM 也不一定会变。新旧结果对应的文本、属性和节点身份都一样的话，提交阶段可能根本不用动这个 DOM 节点。

## 3. 协调与虚拟 DOM

"虚拟 DOM"一般指运行时用来描述界面的 React 元素和相关的树状结果。真正决定怎么从旧结果走到新结果的过程叫 reconciliation，也就是协调。平时说的 React Diff，多半是这套协调过程的简称，不是哪个公开的 API。

```text
previous element result
          +
next element result
          ↓
reconciliation
          ↓
reuse / update / insert / remove
```

虚拟 DOM 并不保证"任何时候都比手写 DOM 快"。它的价值主要在：

- 给声明式组件提供统一的运行时表示。
- 让 React 有机会批量协调前后的结果。
- 把协调逻辑和浏览器或原生平台的具体操作分开。
- 在通用抽象的成本和可维护性之间做工程上的平衡。

开发者要是确切知道只有一个 DOM 属性要改，直接调一次 DOM API 当然可能更省。React 优化的是复杂应用里持续更新的整体模型，没说过每次比较都没有成本。

### 3.1 位置、类型与 `key`

可以用两条启发式规则理解协调：

1. 不同的元素或组件类型一般代表不同的子树，旧子树会被替换。
2. 同一个父节点下的列表用 `key` 区分稳定的身份。

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

列表重新排序时，`message.id` 还指向同一个业务实体，React 才能正确判断节点该复用、移动、插入还是删除。要是用数组下标，位置一变身份就跟着漂，组件的局部状态和输入状态可能跑到错误的条目上。

`key` 的作用域只在当前这组兄弟节点里。它要稳定、可预测，在这组兄弟之间唯一就行，不用全应用唯一。

### 3.2 同类型复用

旧元素和新元素的类型、身份能对上的话，React 可以复用已有的 Fiber 和宿主节点，但新的 props、文本和子节点还是要比较：

```tsx
// 标签身份可复用，但 className 与文本需要更新。
<button className="idle">保存</button>
<button className="success">已保存</button>
```

类型从 `span` 变成 `p` 的话，一般会创建新的宿主节点、删掉旧节点。对组件来说，类型或 `key` 一变，它的状态边界也会重置。

只按新旧节点顺序和 `type` 比较的简化循环，最多能展示新增、更新、删除这三类动作。真实的协调器还要处理 `key`、组件、Fragment、Suspense、错误边界和各种宿主环境，别把这种循环当成 React 源码里的算法。

## 4. Fiber 工作记录

传统的递归遍历依赖 JavaScript 调用栈。深度递归一旦开始，框架没法把浏览器的调用栈存到一半、再随意恢复。Fiber 把组件树上的工作显式地表示成 JavaScript 对象和它们之间的链接，协调器就能自己决定下一个工作单元是谁。

```text
Parent Fiber
    │ child
    ▼
FirstChild Fiber ── sibling ──▶ SecondChild Fiber
    │ return                         │ return
    └──────────── Parent ◀───────────┘
```

一个 Fiber 可以理解成"某个组件或宿主节点的一份工作记录"。它不是 DOM 节点，不是 Web Worker，更不是操作系统的线程。

### 4.1 Fiber 字段

常见的内部字段能帮忙定位职责，但字段名和组织方式可能随 React 版本变：

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

这些字段不是业务代码能依赖的 API。React DevTools 或源码调试时可能看得到它们，但生产逻辑别去读写。

### 4.2 工作循环

这段简化的伪代码展示了 `child`、`sibling`、`return` 怎么代替一次没法控制的递归：

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

协调器处理完一个 Fiber，显式返回下一个工作单元。并发的工作循环可以在单元之间检查要不要让出主线程。真实的 `beginWork`、`completeWork` 和退出条件比这个版本复杂得多。

### 4.3 双缓冲树

Fiber 用双缓冲的思路维护两套角色：

```text
current tree
已经提交、对应当前屏幕
       │ alternate
       ▼
work-in-progress tree
正在计算下一次结果
```

更新时，React 会复用或创建 work-in-progress Fiber，在上面算子树、收集标记。整棵要提交的工作都完成了，才提交结果，并把这棵完成的树变成新的 current。

如果有更高优先级的更新让当前的计算过时了，还没提交的 work-in-progress 可以被丢掉或重新算。因为 Render 阶段 DOM 还没变，屏幕上显示的仍然是 current 树。

## 5. Lanes 与更新优先级

现代 React 内部用 lanes 表示一个更新属于哪些待处理的工作集合。可以把 lane 想成位掩码里的一位或一组位：

```text
000001  某类紧急工作
000100  某类普通工作
010000  某个 transition 工作
100000  某类空闲工作
```

真实的位分配、lane 的名字、合并规则和选择算法都是内部实现。业务代码别存 lane 数字，也别假设某个事件永远对应某个固定的 bit。

Lanes 主要回答这几个问题：

- 这个根上还有哪些更新没处理？
- 这一轮渲染该选哪些更新？
- 某个子树里有没有这一轮相关的工作？
- 来了一个更紧急的新更新，当前的工作要不要重新安排？

### 5.1 Lanes 与 Scheduler

两者都讲"优先级"，但在不同的层：

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

Lanes 管 React 的更新集合和渲染选择；Scheduler 管 JavaScript 回调什么时候运行、什么时候协作式地让出主线程。把两者都简单写成"数字越小越优先"，会把边界弄模糊。

### 5.2 可中断边界

"有了 Fiber，React 所有的更新都能中断"这个说法不准确。更稳妥的说法：

- 在支持并发的渲染路径上，部分 Render 工作可以让出、恢复、重启或丢弃。
- 同步或高紧急度的更新可能直接做完，不一定有能观察到的让出。
- 工作量很小时，就算允许让出，也可能在一个时间片里就做完了。
- Transition 这类低紧急度的工作，更适合在紧急更新到来时被重新安排。
- Commit 阶段不会当成普通的并发渲染工作，被切成好几个能中断的片段。

并发渲染主要还是跑在同一个 JavaScript 主线程上。它是协作式调度，不是把组件自动并行到多个 CPU 核心上。

## 6. Scheduler

浏览器主线程同时要干 JavaScript、用户事件、样式计算、布局和绘制这些活。一个很久不返回的 JavaScript 任务，会推迟输入响应和页面绘制。

```text
长任务：
[---------------- JavaScript ----------------]
用户输入和绘制只能等待

协作式切片：
[JS work][让出][输入/绘制][JS work][让出]...
```

React 没法在任意一条 JavaScript 指令中间强行抢占自己。它得把工作拆成单元，在安全的边界主动检查要不要让出。

### 6.1 `requestIdleCallback` 不是 Scheduler

`requestIdleCallback` 能在浏览器报告有空闲时间时执行低优先级的回调，并通过 deadline 查剩余时间。它表达的是"有空就做一点，没空下次接着做"的协作模型。

React Scheduler 并不是直接靠原生的 `requestIdleCallback` 完成全部调度，它的兼容性、触发时机和优先级控制都满足不了 React 的完整需求。浏览器环境里的宿主回调常借助 `MessageChannel` 安排任务，再由 Scheduler 自己维护时间片、优先级和过期策略；具体的宿主实现可能随版本和环境变化。

`MessageChannel` 也不会神奇地把任务变成多线程。它只是让后续的回调进入宿主的事件循环，React 由此拿到下一段执行的机会。

### 6.2 优先级与过期时间

Scheduler 的基本心智模型：

1. 给回调记下优先级、开始时间和过期时间。
2. 从能执行的任务里挑最该处理的那个。
3. 在时间片里调用回调。
4. 回调返回 continuation 的话，就保留剩下的工作，稍后接着做。
5. 时间片用完、任务又没过期时，主动把控制权还给宿主。

来了高优先级的任务，正在跑的 JavaScript 回调也不会在任意一条指令中间被强行掐断。只有当前工作走到协作检查点、主动让出了，调度器才能先处理新任务。

### 6.3 最小协作调度器

这段代码只保留了 `MessageChannel`、过期时间、时间片和 continuation。它不是 React Scheduler 的源码，也没实现延迟任务、取消、错误恢复和真正的最小堆：

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

一个能接着执行的任务：

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

这里能"接着做"，靠的不是 `MessageChannel` 本身，而是任务把进度存在 `cursor` 里，并返回了 continuation。Fiber 也提供了能保存、恢复工作位置的数据结构，只是真实实现复杂得多。

## 7. Render 与 Commit

简化的渲染器可以先给 Fiber 标上"新增、更新、删除"，等所有工作单元都完成了，再统一操作 DOM：

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

现代 React 内部用 `flags` 和 `subtreeFlags` 这类结构收集提交工作。旧资料里常见的 `effectTag`、独立的 effect list 这些名字可能已经变了。稳定的边界是"Render 负责计算和标记，Commit 负责执行宿主变化"，不是某个具体的字段名。

### 7.1 先计算再提交

要是边比较边把每个中间结果马上写进 DOM：

- 工作被打断时，页面可能停在一个不一致的半成品上。
- 后来的高优先级更新很难丢掉前面那份计算。
- 渲染逻辑容易混进没法回滚的副作用。

把能丢弃的计算放在 Render，把不能随便撤回的宿主修改集中到 Commit，React 才能安全地重试、重新安排渲染工作。

## 8. 简化模型与真实实现

| 简化模型 | 应如何理解 |
| --- | --- |
| 手写 `createElement` 返回 `{ type, props, children }` | 用于理解元素描述；真实元素格式和开发字段不要依赖 |
| `requestIdleCallback` 驱动工作循环 | 用于演示空闲切片；React Scheduler 不等同于原生该 API |
| 新旧节点按顺序比较 `type` | 只展示协调基本动作；真实逻辑还依赖 `key`、组件类型和多种边界 |
| 数组排序模拟优先队列 | 便于学习；真实 Scheduler 使用更合适的数据结构和更多队列 |
| `effectTag` 标记新增、更新、删除 | 对应“Render 标记、Commit 执行”的思路，字段名不是稳定 API |
| Fiber 让任务“可中断” | 仅部分 Render 路径可协作让出，不代表每次更新、每个阶段都可中断 |

原理代码是为了讲清职责，不是要做一个兼容 React 19 的替代实现。真实的协调器还要处理 Hooks、Context、Suspense、错误边界、hydration、服务端组件和不同的宿主渲染器。

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

这条链路也说明三组概念不能互换：

- React 元素描述"想要什么"。
- Fiber 记录"这份渲染工作做到哪了、还要做什么"。
- Scheduler 决定"什么时候接着执行回调"。

## 10. 常见误区

### 虚拟 DOM 就是 AST

不是。AST 是 Babel、SWC 这些编译器解析源码的结果；React 元素是编译后的 JavaScript 执行时产生的运行时值。

### Fiber 就是虚拟 DOM 节点

不准确。React 元素描述这一次期望的结果，Fiber 是跨渲染保存组件状态、更新队列和工作信息的内部记录。

### 有 Fiber 就一定不会卡

不对。超长的事件处理函数、同步循环、Commit 阶段的 DOM 操作、布局抖动和第三方脚本，照样能堵住主线程。协作调度只能在框架能控制的工作边界让出。

### Scheduler 会抢占正在执行的 JavaScript

不会。浏览器里的 JavaScript 还是 run-to-completion。所谓中断，是 React 主动检查并让出之后才发生的。

### 每个 state 更新都能被中断

不能。更新的紧急度、渲染路径和所在的阶段都会影响行为；同步工作和 Commit 不能一句"都能中断"概括。

### `MessageChannel` 就是多线程

不是。它能用来在上下文之间通信，也能用来安排后续任务；React 在浏览器里的调度主要还是在主线程上协作执行。

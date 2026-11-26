---
title: React 渲染原理：虚拟 DOM、Fiber 架构与并发调度
slug: react-fiber-and-reconciliation
date: 2026-07-13
categories:
  - 前端开发
tags:
  - React 19
  - Fiber
  - Virtual DOM
  - Reconciliation
  - Scheduler
---

谈 React 底层原理时，最常被混为一谈的是三组概念：编译器生成的 AST、渲染函数吐出的 React 元素，以及协调器长期维护的 Fiber 节点。把这三层彻底拆开，再顺着 `Trigger -> Render -> Commit` 三阶段模型往下追，就能真正看懂为什么 Fiber 能做到协作式中断，而 DOM 提交阶段却绝不允许只更新半棵树。

## 三棵树与 Render / Commit 两阶段铁律

先划清运行期与编译期的四份数据结构边界：

| 结构 | 所属阶段 | 真实职责 |
| --- | --- | --- |
| JS / JSX AST | 构建编译期 | Babel / SWC 解析源码语法树，转换完成后即丢弃 |
| React 元素树（Element） | 运行期每次 Render | 组件返回轻量不可变描述对象（`type`、`key`、`props`），代表“这次希望长什么样” |
| Fiber 树 | 运行期跨渲染持久保留 | 协调器的工作记录单元，保存组件状态、更新队列、变更标记与双缓冲指针 |
| 宿主树（DOM / Native） | 运行期 Commit 后 | 浏览器或原生视图层的真实节点 |

**虚实对比的重点在于：React 元素是每次渲染新算出来的短期描述，Fiber 才是跨多次更新复用的持久工作记录；跨平台渲染之所以成立，依靠的是协调计算与宿主 DOM 操作的彻底分离。**

React 处理任何一次界面更新都遵循严格的三阶段流水线：

```text
Trigger（首次 root.render 或 setState 提交更新）
  ↓
Render（调用组件函数，协调新旧树，计算 work-in-progress Fiber 与变更 flags）
  ↓
Commit（一次性把变更写入宿主 DOM，切换 current 指针，执行 LayoutEffect）
  ↓
Browser Paint（浏览器绘制像素，随后调度普通 useEffect）
```

**Render 阶段是纯计算，允许被高优先级更新打断、重启甚至整体作废，因为此时真实 DOM 纹丝未动；一旦进入 Commit 阶段，操作就必须原子性地跑完，绝不能把更新了一半的残缺画面暴露给用户。** 这也是为什么组件函数里允许重跑多次，却绝对禁止在渲染体中直接发起网络请求或修改外部可变状态。

## Reconciliation 协调规则与 `key` 的身份作用域

虚拟 DOM 并不是因为“比直接操作单个 DOM 节点更快”才存在——当你确切知道只改一个按钮文字时，原生 DOM API 当然更省开销。虚拟 DOM 的价值在于给复杂持续变化的声明式 UI 提供统一中间层，让框架有机会批量协调差异并屏蔽宿主平台细节。

协调器（Reconciler）在比较前后两次结果时依赖两条核心启发式规则，将一般树对比从高复杂度降到线性级别：

1. **不同元素类型直接整棵替换**：当同一个位置的节点从 `<span>` 变成 `<p>`，或从 `<ComponentA />` 换成 `<ComponentB />`，React 不会尝试比对子节点，而是直接销毁旧子树并重建新子树（连带重置组件局部状态）。
2. **同级列表靠 `key` 识别稳定实体**：在同组兄弟节点下，同类型标签若能对上 `key`，就复用现有 Fiber 与宿主 DOM 节点，仅对比并更新变化的 `props`；一旦 `key` 变化或顺序错位（例如用数组下标 `index` 当 `key` 并在头部插入元素），React 会把旧实例的状态错误复用到新条目上。`key` 只需在当前这组兄弟节点内唯一且稳定，无需全应用唯一。

## Fiber 链表架构与双缓冲工作循环

React 15 及以前的同步递归协调直接依赖 JavaScript 引擎调用栈，一旦组件树很深、递归跑起来，浏览器主线程就被死死占住，没法中途停下来响应用户的点击或输入。

Fiber 把树形递归拆成了一个用对象指针串联的链表工作图，每一份节点记录包含 `child`（第一个子节点）、`sibling`（下一个兄弟节点）和 `return`（父节点）：

```text
Parent Fiber
    │ child
    ▼
FirstChild Fiber ── sibling ──▶ SecondChild Fiber
    │ return                         │ return
    └──────────── Parent ◀───────────┘
```

借助这三个指针，遍历整棵树变成了一个由 `while` 循环控制的扁平任务，工作循环在每个节点执行完 `performUnitOfWork` 后都能自己决定是继续向下还是暂时交出主线程：

```ts
interface TeachingFiber {
  child: TeachingFiber | null
  sibling: TeachingFiber | null
  return: TeachingFiber | null
}

declare function beginWork(fiber: TeachingFiber): TeachingFiber | null
declare function completeWork(fiber: TeachingFiber): void

function performUnitOfWork(fiber: TeachingFiber): TeachingFiber | null {
  // 1. 向下展开子节点
  const child = beginWork(fiber)
  if (child) return child

  // 2. 没有子节点时收尾当前节点，并横向找兄弟或向上回溯到父节点
  let node: TeachingFiber | null = fiber
  while (node) {
    completeWork(node)
    if (node.sibling) return node.sibling
    node = node.return
  }
  return null
}
```

### 双缓冲树（Current 与 Work-In-Progress）

为了确保中断计算时不破坏屏幕上正在展示的内容，React 内部同时维护两棵通过 `alternate` 指针互指的树：

```text
current tree（已经提交、正在屏幕显示的画面）
       │ alternate
       ▼
work-in-progress tree（正在后台计算下一次更新）
```

状态更新发生时，React 复用现有节点的 `alternate` 或新建 `work-in-progress` Fiber，在后台逐步推进 `beginWork`、`completeWork` 并把需要操作的 DOM 标记汇总到 `flags` / `subtreeFlags` 上。只有当整棵待提交子树计算完成、进入 Commit 阶段并落盘到真实 DOM 后，根节点才会把指针切换过去，让刚刚完成的树成为新的 `current`。如果半路来了一个更紧急的输入事件，没提交的 `work-in-progress` 可以被直接丢弃重算，屏幕画面始终保持完整一致。

（注意：`Fiber`、`lanes`、`flags`、`alternate` 均属于 React 内部实现机制，字段与调度策略会随版本迭代演进，业务代码只应依赖 React 公开 API。）

## Lanes 优先级模型与 Scheduler 协作调度

React 内部的调度涉及两个配合层：**Lanes** 负责“选哪些更新这一轮一起算”，**Scheduler** 负责“什么时候向浏览器要时间片执行 JS 回调”。

```text
事件/状态变更产生 update
  ↓ 分配内部 lane 位掩码（区分紧急输入、普通更新、Transition、空闲任务）
Reconciler 挑出本轮需要渲染的 lanes
  ↓
向 Scheduler 提交调度任务
  ↓
Scheduler 在浏览器宏任务时间片内推进 Fiber 工作循环
  ↓
时间片耗尽且任务未过期 → 主动让出主线程给用户输入与浏览器绘制
  ↓
全部 Render 单元完成 → 原子 Commit 到 DOM
```

### 为什么不用原生的 `requestIdleCallback`

很多人误以为 React 的时间切片底层直接调了 `requestIdleCallback`。实际上原生的 `requestIdleCallback` 在浏览器兼容性、后台标签页限频以及高帧率下的触发稳定性上都达不到框架需求，也没有内置多层优先级队列。浏览器环境中，React Scheduler 通常借用 `MessageChannel` 派发宏任务回调，自己用 `performance.now()` 划分 5ms 左右的时间片并计算任务过期时间，防止低优先级任务一直被插队饿死：

```ts
type Priority = 'user-blocking' | 'normal' | 'idle'
type TaskCallback = () => TaskCallback | void

interface Task {
  id: number
  expiresAt: number
  callback: TaskCallback
}

const timeoutByPriority: Record<Priority, number> = {
  'user-blocking': 250,
  normal: 5000,
  idle: Number.POSITIVE_INFINITY,
}

const tasks: Task[] = []
const channel = new MessageChannel()
let nextId = 1
let hostCallbackScheduled = false

function sortTasks() {
  tasks.sort((a, b) => a.expiresAt - b.expiresAt)
}

function requestHostCallback() {
  if (hostCallbackScheduled) return
  hostCallbackScheduled = true
  channel.port2.postMessage(null)
}

export function schedule(priority: Priority, callback: TaskCallback) {
  tasks.push({
    id: nextId++,
    expiresAt: performance.now() + timeoutByPriority[priority],
    callback,
  })
  sortTasks()
  requestHostCallback()
}

channel.port1.onmessage = () => {
  hostCallbackScheduled = false
  const sliceDeadline = performance.now() + 5

  while (tasks.length > 0) {
    const now = performance.now()
    const task = tasks[0]!
    const didTimeout = task.expiresAt <= now

    // 任务未过期且当前 5ms 时间片已满，立刻跳出循环归还主线程
    if (!didTimeout && now >= sliceDeadline) break

    tasks.shift()
    const continuation = task.callback()
    if (continuation) {
      task.callback = continuation
      tasks.push(task)
      sortTasks()
    }
  }

  if (tasks.length > 0) requestHostCallback()
}
```

## 破解关于并发调度的四个常见误区

1. **误区：有了 Fiber，所有状态更新都会自动中断拆片。** 事实是只有走并发路径（如 `useTransition`、`useDeferredValue` 或并发 Suspense）的更新才会被降级并在工作单元边界让出；用户直接触发的同步高优更新往往在单次调度内一口气跑完。
2. **误区：Scheduler 能强行抢占正在跑的同步函数。** 浏览器里的 JS 依然遵守 run-to-completion，如果某个组件渲染函数里自己写了死循环或 300ms 的同步计算，Scheduler 根本插不进来——所谓的“可中断”，只能发生在每个 Fiber 工作单元完成之后框架主动检查时间片的那一刻。
3. **误区：`MessageChannel` 把组件渲染变成了多线程并行。** `MessageChannel` 在这里只是为了绕过 `setTimeout(..., 0)` 的 4ms 最小嵌套延迟，高效安排下一轮宏任务，所有并发渲染依然跑在同一个 JS 主线程上协作切片。
4. **误区：有了 Fiber 页面就绝对不会卡顿。** 巨型事件回调、Commit 阶段大量真实 DOM 插入以及强制同步布局（Layout Thrashing）都不受 Render 切片保护，性能瓶颈依然要靠组件边界优化与结构拆分解决。

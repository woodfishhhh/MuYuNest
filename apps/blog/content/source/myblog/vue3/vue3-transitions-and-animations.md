---
title: Vue 3 过渡动画、列表重排与 GSAP 协作
slug: vue3-transitions-and-animations
date: 2026-07-13
categories:
  - 前端开发
tags:
  - Vue 3
  - Transition
  - GSAP
  - FLIP
  - CSS 动画
---

前端动画最容易翻车的地方在于把视觉效果和 DOM 状态搅在一起：节点还没等离场动画播完就被卸载、快速连点开关导致两个动画互相抢属性，或者列表排序时元素生硬瞬移。先把状态、稳定的 `key` 与生命周期钩子对齐，再按场景选择 CSS 过渡、`<Transition>`、`<TransitionGroup>` 还是 GSAP 编排。

## 先选对动画实现工具与性能边界

不同交互形态对应不同的 Vue 与浏览器能力边界：

| 交互需求 | 首选方案 |
| --- | --- |
| 单个元素或组件进入、离开 | `<Transition>` + CSS 过渡 |
| 列表项新增、删除、重排 | `<TransitionGroup>` + `.move` 类 |
| 常驻元素切换强调状态 | 动态 `class` + CSS `animation` |
| 进度条、颜色等连续状态变化 | 响应式状态绑定 `style` + CSS `transition` |
| 时间线编排、可中断数字补间 | GSAP 等 JS 动画库 + `:css="false"` |

**动画属性默认只动 `transform` 和 `opacity`，频繁修改 `width`、`height`、`top` 或 `margin` 会反复触发布局重排（Reflow），在低端设备或长列表里直接掉帧。** 同时，在 CSS 过渡里补上 `@media (prefers-reduced-motion: reduce)` 尊重系统级的减弱动态效果偏好，几乎没有额外成本。

## `<Transition>` 的六个 CSS 阶段与切换模式

`<Transition>` 本身不会自动制造动画，它只是在元素插入或移除的生命周期节点，按约定顺序自动增减六个 CSS 类名（以 `name="fade"` 为例）：

| 阶段 | 类名 | 作用时机 |
| --- | --- | --- |
| Enter | `fade-enter-from` | 插入前第一帧的初始状态 |
| Enter | `fade-enter-active` | 整个进场过程，用于声明 `transition` 曲线与时长 |
| Enter | `fade-enter-to` | 进场终点状态（通常插入后下一帧加上） |
| Leave | `fade-leave-from` | 离场第一帧的起始状态 |
| Leave | `fade-leave-active` | 整个离场过程，用于声明离场 `transition` |
| Leave | `fade-leave-to` | 离场终点状态，动画结束后节点才被移除 |

```vue
<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(true)
</script>

<template>
  <button type="button" @click="visible = !visible">切换</button>

  <Transition name="fade-slide">
    <section v-if="visible" class="panel">
      内容区域
    </section>
  </Transition>
</template>

<style scoped>
.panel {
  padding: 1rem;
  border: 1px solid #d9dce1;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: none;
  }
}
</style>
```

`v-if` 与 `v-show` 都能触发 `<Transition>`，区别在于 `v-if` 会真正在 DOM 树中挂载和卸载节点，而 `v-show` 仅切换 `display` 属性、组件实例不会销毁。若希望组件首次挂载时也播放进场动画，加上 `appear` 属性即可。

### 同标签切换的 `key` 与 `mode`

**在两个相同 HTML 标签（例如两个 `<p>` 或两个 `<button>`）之间切换时，必须绑定不同的 `key`，否则 Vue 的虚拟 DOM 复用策略会原地替换文本内容而直接跳过 `<Transition>` 过渡。**

默认情况下进场和离场会同时进行，经常造成新旧两个面板在页面上短暂并排挤在一起。Tab 或页面内容切换一般加上 `mode="out-in"`，强制先等旧节点彻底退场，再让新节点进场：

```vue
<Transition name="fade" mode="out-in">
  <p :key="status">{{ status }}</p>
</Transition>
```

需要对接 Animate.css 等第三方 CSS 动画库时，可以通过 `enter-active-class`、`leave-active-class` 显式映射类名，并指定 `:duration="{ enter: 300, leave: 180 }"`。显式填写的 `duration` 必须与真实 CSS 动画时长完全一致，否则 Vue 要么提前清理类名把动画截断，要么死等很久才卸载节点。

## JavaScript 钩子与 GSAP 中断控制

当动画涉及弹性曲线、多阶段串行或者需要精确打断时，改用 JS 钩子配合 GSAP 更稳妥。**使用 JS 动画库驱动 `<Transition>` 时务必加上 `:css="false"`，跳过 Vue 对 CSS `transitionend` 的探测等待，并在 `@enter` 与 `@leave` 结束时调用 `done()` 通知框架继续推进生命周期。**

```vue
<script setup lang="ts">
import gsap from 'gsap'
import { ref } from 'vue'

const visible = ref(true)

function onBeforeEnter(element: Element) {
  gsap.set(element, { opacity: 0, y: 12 })
}

function onEnter(element: Element, done: () => void) {
  gsap.to(element, {
    opacity: 1,
    y: 0,
    duration: 0.24,
    ease: 'power2.out',
    onComplete: done,
  })
}

function onLeave(element: Element, done: () => void) {
  gsap.to(element, {
    opacity: 0,
    y: -12,
    duration: 0.18,
    ease: 'power2.in',
    onComplete: done,
  })
}

function onCancelled(element: Element) {
  gsap.killTweensOf(element)
}
</script>

<template>
  <Transition
    :css="false"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @leave="onLeave"
    @enter-cancelled="onCancelled"
    @leave-cancelled="onCancelled"
  >
    <div v-if="visible">内容</div>
  </Transition>
</template>
```

切勿遗漏 `@enter-cancelled` 和 `@leave-cancelled`（尤其在配合 `v-show` 使用时）：用户快速连点切换时，旧的 GSAP tween 若没有通过 `gsap.killTweensOf(element)` 终止，新旧两个补间会同时篡改同一个元素的 `opacity` 和 `transform`，画面就会闪烁卡死。

## `<TransitionGroup>` 与 FLIP 列表重排原理

`<Transition>` 一次只能包一个直接子节点，列表多项增删与排序移动需要用 `<TransitionGroup>`。它默认不渲染包裹标签，生产中一般通过 `tag="ul"` 指定语义化的父容器，且每个直接子节点都必须带唯一的业务 `key`（禁止使用数组下标）。

```vue
<script setup lang="ts">
import { ref } from 'vue'

interface Task {
  id: number
  title: string
}

const nextId = ref(3)
const tasks = ref<Task[]>([
  { id: 1, title: '理解进入动画' },
  { id: 2, title: '理解移动动画' },
])

function addTask() {
  tasks.value.push({ id: nextId.value, title: `任务 ${nextId.value}` })
  nextId.value++
}

function removeTask(id: number) {
  tasks.value = tasks.value.filter(task => task.id !== id)
}
</script>

<template>
  <button type="button" @click="addTask">新增</button>

  <TransitionGroup name="task" tag="ul" class="task-list">
    <li v-for="task in tasks" :key="task.id">
      {{ task.title }}
      <button type="button" @click="removeTask(task.id)">删除</button>
    </li>
  </TransitionGroup>
</template>

<style scoped>
.task-list {
  position: relative;
}

.task-enter-active,
.task-leave-active,
.task-move {
  transition: opacity 180ms ease, transform 180ms ease;
}

.task-enter-from,
.task-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

/* 离场元素脱离文档流，其余节点才能触发平滑位移动画 */
.task-leave-active {
  position: absolute;
}
</style>
```

**删掉一项时，其余列表项之所以能平滑滑到新位置，核心在于两点：一是给离场项加上 `.task-leave-active { position: absolute; }` 让它立刻脱离文档流释放空间，二是 Vue 内部对留存项执行了 FLIP 算法。**

FLIP 由四个步骤组成：

```text
First   在 DOM 更新前记录每个留存节点的位置矩形（getBoundingClientRect）
Last    应用新列表顺序后，读取每个节点的新位置矩形
Invert  计算位置差，用反向 transform 把节点视觉上瞬移回旧位置
Play    下一帧移除反向 transform，并加上 *-move 类靠 CSS transition 滑到新位置
```

由此也能看出为什么不能拿 `index` 当 `key`：一旦排序或插入发生，`index` 对不上原有的节点实例，First 和 Last 的坐标配对就会全部错乱，FLIP 彻底失效。

## 响应式数字补间与滚动衔接

数字跳变、仪表盘读数这类变化不涉及 DOM 的插拔，只需监听目标数值变化，让 GSAP 去平滑修改一个中间响应式状态即可：

```vue
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import gsap from 'gsap'

const target = ref(0)
const tweened = reactive({ value: 0 })

watch(target, (value) => {
  gsap.to(tweened, {
    value,
    duration: 0.45,
    ease: 'power2.out',
    overwrite: true,
  })
})
</script>

<template>
  <input v-model.number="target" type="number" />
  <output>{{ tweened.value.toFixed(0) }}</output>
</template>
```

这里的 `overwrite: true` 与前文的 `killTweensOf` 起到相同作用：用户在 0.45 秒内连续改目标值时，新动画会自动接管并覆盖未完成的旧动画，数字永远平滑朝最新目标收敛。

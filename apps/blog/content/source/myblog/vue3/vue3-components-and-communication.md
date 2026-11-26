---
title: Vue 3 组件边界、通信机制与插槽设计
slug: vue3-components-and-communication
date: 2026-07-13
categories:
  - 前端开发
tags:
  - Vue 3
  - 组件通信
  - Slots
  - TypeScript
  - Teleport
---

拆分组件的核心目的是划清状态所有权与对外契约，避免把整个页面塞进一个上千行的单文件里。只要边界划清了——谁拥有状态、谁负责触发动作、谁提供结构、谁填充内容——组件通信的方案选型自然就收敛了，不需要在 Props、Emits、`v-model`、`provide/inject`、事件总线和 Pinia 之间反复摇摆。

## 组件边界与通信选型矩阵

一个典型的后台壳层布局可以按职责拆成四层：

```text
App.vue                 应用壳层与全局 Provider
└─ AppLayout.vue        页面结构编排
   ├─ AppSidebar.vue    导航展示与选择事件
   ├─ AppHeader.vue     当前用户与页面命令
   └─ MainContent.vue   页面内容出口
```

默认的单向数据流约束非常直接：父组件通过 `props` 向下传只读输入，子组件通过 `emits` 向上汇报意图，父组件再通过 `slots` 决定子组件预留区域里的具体内容。不同通信方式各自覆盖的场景如下：

| 场景 | 首选方案 | 选用依据 |
| --- | --- | --- |
| 父传子只读数据 | `defineProps` | 输入显式，支持完整 TypeScript 校验 |
| 子请求父更新状态 | `defineEmits` | 状态所有权留在父组件，变更链路可追踪 |
| 表单控件双向契约 | `defineModel` / `v-model` | 统一 `modelValue` 与 `update:modelValue` 协议 |
| 父控制子内部视图结构 | 插槽（Slots / 作用域插槽） | 结构骨架归子组件，业务内容归父组件 |
| 跨多层级上下文共享 | `provide` / `inject` | 避免中间层无意义地透传大量 Props |
| 聚焦、校验等命令式操作 | 模板 ref + `defineExpose` | 仅对外暴露最小受控接口 |
| 跨路由、全应用共享状态 | [Pinia Store](/posts/vue3-pinia-state) | 具备统一 Action、Devtools 追踪与持久化能力 |

**布局容器里使用 Flex 搭建侧栏与内容区时，别忘了给可滚动子项加上 `min-width: 0` 和 `min-height: 0`。** Flex 子项默认最小尺寸是 `auto`，一旦内部出现长文本或宽表格，没有这两个属性就会直接把父容器撑破，导致横向溢出或内部滚动失效。配合 Sass 编写 BEM 样式时，只有在多处复用同一规则（如滚动区域限制）时才抽成 `@mixin`，日常类名直接写全反而更方便全局搜索定位。

```vue
<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
</script>

<template>
  <div class="app-layout">
    <AppSidebar class="app-layout__sidebar" />

    <div class="app-layout__right">
      <AppHeader class="app-layout__header" />
      <main class="app-layout__content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  height: 100%;
  overflow: hidden;

  &__sidebar {
    flex: 0 0 14rem;
    border-right: 1px solid #d9dce1;
  }

  &__right {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    flex-direction: column;
  }

  &__header {
    flex: 0 0 auto;
  }

  &__content {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }
}
</style>
```

## Props 向下、Emits 向上与 `defineExpose`

在 `<script setup lang="ts">` 中，使用类型参数配合 `withDefaults` 声明 Props 与 Emits，就能在编译期卡住大部分契约错误：

```vue
<!-- UserCard.vue -->
<script setup lang="ts">
interface User {
  id: number
  name: string
  role: 'admin' | 'member'
}

interface Props {
  user: User
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
})

const emit = defineEmits<{
  select: [userId: number]
  remove: [userId: number]
}>()

function selectUser() {
  if (props.selectable) emit('select', props.user.id)
}
</script>

<template>
  <article class="user-card" @click="selectUser">
    <strong>{{ props.user.name }}</strong>
    <span>{{ props.user.role }}</span>
    <button type="button" @click.stop="emit('remove', props.user.id)">
      删除
    </button>
  </article>
</template>
```

父组件持有 `users` 列表的所有权，监听 `@remove` 后生成新数组，子组件全程不直接改动 `props.user`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import UserCard from './UserCard.vue'

interface User {
  id: number
  name: string
  role: 'admin' | 'member'
}

const users = ref<User[]>([])
const selectedId = ref<number | null>(null)

function removeUser(userId: number) {
  users.value = users.value.filter(user => user.id !== userId)
}
</script>

<template>
  <UserCard
    v-for="user in users"
    :key="user.id"
    :user="user"
    selectable
    @select="selectedId = $event"
    @remove="removeUser"
  />
</template>
```

**Props 是只读输入，子组件绝不能直接修改 `prop` 本身，也不要顺手去改 `prop` 内部嵌套对象的字段。** 需要持久化引用类型的默认值时（如默认数组或对象），`withDefaults` 里必须写成工厂函数 `() => []`，避免所有组件实例共享同一个对象引用。如果是 Vue 3.5+ 项目，也可以直接对 `defineProps` 做响应式解构并提供 JS 原生默认值。

还有两点常被忽略的细节：

1. **组件自定义事件不会冒泡**：原生 DOM 事件会沿着 DOM 树冒泡，Vue 的 `emit` 事件只会发给直接父组件。孙子组件触发的事件如果需要跨层传递，要么中间层显式转发，要么改用 `provide/inject` 或 Pinia。
2. **`defineExpose` 仅用于命令式边界**：`<script setup>` 默认对父组件封闭，只有表单校验、输入框聚焦、弹窗打开这类天然命令式的动作，才通过 `defineExpose` 暴露极少数方法给父组件的模板引用调用，切勿把内部数据 Ref 整个敞开。

```vue
<!-- SearchInput.vue -->
<script setup lang="ts">
import { useTemplateRef } from 'vue'

const input = useTemplateRef<HTMLInputElement>('input')

function focus() {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <input ref="input" type="search" />
</template>
```

遇到瀑布流卡片布局等需要由子组件计算坐标的场景，也同样坚持“只读计算、不改入参”的原则：根据容器宽度算出列数，维护每列高度数组，将下一张卡片放进当前最矮列并返回带有 `x`、`y` 坐标的新对象数组，同时在组件内部用 `ResizeObserver` 监听容器变化并在卸载时 `disconnect()`。

## 双向绑定协议：`v-model` 与 `defineModel`

组件上的 `v-model` 本质是 `modelValue` 属性加上 `update:modelValue` 事件的语法糖：

```vue
<Editor
  :model-value="content"
  @update:model-value="content = $event"
/>
```

从 Vue 3.4 开始，`defineModel` 宏把繁琐的 `defineProps` + `defineEmits` 样板代码收成一行，返回值本身就是一个与父组件双向同步的 Ref：

```vue
<!-- SearchInput.vue -->
<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>

<template>
  <input v-model="model" type="search" />
</template>
```

需要同时绑定多个字段或自定义修饰符时，给 `defineModel` 传入具名参数和修饰符解构即可：

```vue
<!-- CapitalizeInput.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const firstName = defineModel<string>('firstName', { required: true })
const [keyword, modifiers] = defineModel<string, 'capitalize'>('keyword', {
  default: '',
})

const normalizedKeyword = computed({
  get: () => keyword.value,
  set: (value) => {
    keyword.value = modifiers.capitalize
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value
  },
})
</script>

<template>
  <input v-model="firstName" />
  <input v-model="normalizedKeyword" />
</template>
```

**使用 `defineModel({ default })` 时，如果父组件传入 `undefined`，子组件内部读到的是默认值而父组件仍是 `undefined`，极易造成父子状态失同步；公共表单组件优先使用 `{ required: true }` 或要求父组件显式赋初值。** 若需兼容 Vue 3.4 以前的项目，写回标准的 `defineProps<{ modelValue: string }>()` 与 `emit('update:modelValue', nextValue)` 即可。

## 跨层上下文与兄弟通信：`provide/inject` 与 `mitt`

当状态需要穿过三四层结构中间组件时，层层透传 Props 会让中间层充满无关字段。`provide/inject` 允许祖先组件把只读状态和受控修改方法直接提供给后代树。

**`provide` 必须结合 `Symbol` 类型的 `InjectionKey` 和 `readonly()` 包装状态：只向下暴露读取视图和显式修改方法，把数据变更权牢牢锁在 Provider 自己手里。**

```ts
// theme-context.ts
import type { InjectionKey, Ref } from 'vue'

export type Theme = 'light' | 'dark'

export interface ThemeContext {
  theme: Readonly<Ref<Theme>>
  setTheme(theme: Theme): void
}

export const themeKey: InjectionKey<ThemeContext> = Symbol('theme')
```

Provider 与 Consumer 的配合如下：

```vue
<!-- ThemeProvider.vue -->
<script setup lang="ts">
import { provide, readonly, ref } from 'vue'
import { themeKey, type Theme } from './theme-context'

const theme = ref<Theme>('light')

function setTheme(next: Theme) {
  theme.value = next
}

provide(themeKey, {
  theme: readonly(theme),
  setTheme,
})
</script>

<template>
  <slot />
</template>
```

后代组件调用 `inject(themeKey)` 后应当显式判空，在缺少 Provider 时直接抛出清晰错误：

```vue
<script setup lang="ts">
import { inject } from 'vue'
import { themeKey } from './theme-context'

const themeContext = inject(themeKey)
if (!themeContext) {
  throw new Error('ThemeToggle 必须位于 ThemeProvider 内')
}
</script>
```

### 兄弟组件之间怎么传值

大多数兄弟组件通信场景，只需要把共享状态提升到最近的共同父组件即可（`SiblingA --emit--> Parent --prop--> SiblingB`）。只有在两个不相关组件分支之间需要发送一次性无状态通知（如全局 Toast 或刷新信号）时，才考虑轻量级事件总线 `mitt`：

```ts
// bus.ts
import mitt from 'mitt'

export type AppEvents = {
  'user:selected': { id: number }
  'notification:show': { message: string; level: 'info' | 'error' }
}

export const bus = mitt<AppEvents>()
```

在组件里直接导入这个带类型约束的单例，不要挂到 `globalProperties` 上再去调 `getCurrentInstance()`。**使用 `mitt` 最容易漏掉的坑是组件卸载时忘了调用 `bus.off()`，导致组件多次挂载后同一事件被重复触发并引发内存泄漏。**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { bus } from './bus'

function onUserSelected(payload: { id: number }) {
  console.log('selected:', payload.id)
}

onMounted(() => bus.on('user:selected', onUserSelected))
onUnmounted(() => bus.off('user:selected', onUserSelected))
</script>
```

## 插槽与作用域插槽：把内容权交回父组件

插槽把“组件负责结构与状态循环”和“父组件负责具体渲染长相”彻底解耦。除了默认插槽和具名插槽（`#header`、`#empty`），当列表、表格组件需要把每一行的遍历上下文传给外部模板时，就要用到作用域插槽。

配合 Vue 3.3+ 的泛型组件 `generic="T"` 与 `defineSlots`，外部使用插槽时能拿到完整的属性类型提示：

```vue
<!-- DataList.vue -->
<script setup lang="ts" generic="T extends { id: string | number }">
const props = defineProps<{
  items: T[]
}>()

defineSlots<{
  header(): unknown
  default(props: { item: T; index: number }): unknown
  empty(): unknown
}>()
</script>

<template>
  <section class="data-list">
    <header v-if="$slots.header" class="data-list__header">
      <slot name="header" />
    </header>

    <ul v-if="props.items.length">
      <li v-for="(item, index) in props.items" :key="item.id">
        <slot :item="item" :index="index" />
      </li>
    </ul>

    <slot v-else name="empty">暂无数据</slot>
  </section>
</template>
```

如果可选插槽外面包着带 `padding` 或 `border` 的容器标签，记得加上 `v-if="$slots.header"` 判空，避免父组件未传插槽时页面上渲染出一个空壳边框。同时，**纯逻辑复用优先抽成 Composable，不要为了向模板传几个响应式变量而硬写没有 UI 的无渲染组件（Renderless Component）。**

## 递归、动态、异步与内置传输组件

### 局部注册、全局注册与递归组件

业务组件一律在 `<script setup>` 中局部导入，让构建工具准确做按路由分包与 Tree-shaking；只有全站高频使用且几乎不变的基础按钮、图标组件，才通过 `app.component()` 全局注册。

编写树形菜单等递归组件时，用 `defineOptions({ name: 'TreeNode' })` 声明稳定的组件名（同时也服务于 DevTools 与 `KeepAlive`），并在模板中确保存在终止条件与稳定的 `:key`：

```vue
<!-- TreeNode.vue -->
<script setup lang="ts">
interface TreeItem {
  id: string
  label: string
  children?: TreeItem[]
}

defineOptions({ name: 'TreeNode' })

const props = defineProps<{ node: TreeItem }>()
const emit = defineEmits<{ select: [node: TreeItem] }>()
</script>

<template>
  <li>
    <button type="button" @click="emit('select', props.node)">
      {{ props.node.label }}
    </button>

    <ul v-if="props.node.children?.length">
      <TreeNode
        v-for="child in props.node.children"
        :key="child.id"
        :node="child"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>
```

### 动态组件 `<component :is>` 与 `KeepAlive`

同页面多标签页切换适合用 `<component :is>`。**保存动态组件定义时务必使用 `shallowRef` 或 `markRaw`，防止 Vue 对整个组件配置对象做无意义的深层 `Proxy` 代理。**

默认情况下切换走动态组件会立刻销毁旧实例。若需要保留 Tab 内的表单输入或滚动位置，在外层套上 `<KeepAlive :max="5" include="ProfileTab,SecurityTab">`，并用 `onActivated` 和 `onDeactivated` 替代 `onMounted`/`onUnmounted` 管理轮询和陈旧数据刷新：

- `include`/`exclude` 匹配的是组件 `name`（如 `defineOptions({ name })`），必须写对。
- 一定要设置 `:max` 上限启用 LRU 淘汰，防止地图、大表格等高内存组件无限累积拖垮页面。
- 涉及每次进入必须清空的敏感流程表单，禁止放进 `KeepAlive`。

### 异步组件、`Suspense` 与 `Teleport`

重型低频面板（如图表弹窗、富文本编辑器）可以用 `defineAsyncComponent` 拆出独立 chunk，延迟到真正展示时再加载：

```ts
import { defineAsyncComponent } from 'vue'
import ErrorPanel from './ErrorPanel.vue'
import LoadingPanel from './LoadingPanel.vue'

export const AsyncReport = defineAsyncComponent({
  loader: () => import('./ReportPanel.vue'),
  loadingComponent: LoadingPanel,
  errorComponent: ErrorPanel,
  delay: 200,
  timeout: 30_000,
})
```

如果组件在 `<script setup>` 顶层直接使用了 `await fetch(...)`，外层可以用 `<Suspense>` 统一接管 `#fallback` 骨架屏；需要注意 `Suspense` 仍带实验性质，默认插槽与 `#fallback` 均只允许单一直接根节点，且 `defineAsyncComponent` 自带加载和错误状态时未必需要再套一层 `Suspense`。

遇到模态框、下拉菜单被父容器 `overflow: hidden` 或 `transform` 裁切错位时，用 `<Teleport to="#modals">` 把真实 DOM 渲染到外层挂载节点。**`Teleport` 只改变最终生成的 DOM 位置，逻辑上的父子关系——包括 Props、Emits、Slots 以及 `provide/inject` 上下文——全部原样保留。** 目标节点 `#modals` 通常需要在挂载时已存在于 HTML 中，Vue 3.5+ 额外提供了 `defer` 属性允许延迟到同周期挂载完成后再解析目标。

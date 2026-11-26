---
title: Vue 3 逻辑复用：Composables、自定义指令与插件
slug: vue3-composables-directives-and-plugins
date: 2026-07-13
categories:
  - 前端开发
tags:
  - Vue 3
  - Composables
  - 自定义指令
  - 插件
  - TypeScript
---

Vue 3 里可供复用的手段很多，但选错层次往往比不复用更难维护：纯业务逻辑被硬塞进自定义指令、原本只需要一个 Composable 的状态被包装成了全局插件，或者为了复用几行计算去写空 UI 的包装组件。先划清各自的操作边界，再决定写到哪一层。

## 五种复用机制的适用边界

按影响范围从小到大排序，合理的技术阶梯是：**纯工具函数 -> Composable -> 组件 -> 自定义指令 -> 应用插件**。

| 机制 | 擅长解决的问题 | 常见误用 |
| --- | --- | --- |
| 纯 TS/JS 函数 | 无状态格式化、校验、算法计算 | 把响应式 `ref` 硬塞进普通工具里 |
| Composable | 带响应式状态、生命周期和副作用清理的业务/浏览器能力 | 直接在里面写死全局 `document.querySelector` |
| 组件 | 复用的 UI 结构、交互事件与公开插槽契约 | 只为传响应式值而写无界面渲染组件 |
| 自定义指令 | 必须直接操作底层真实 DOM（聚焦、观察器、指针拖拽） | 拿按钮权限指令当作前端安全边界 |
| 插件 | 应用级全局注入、跨模块服务安装或全局组件/指令注册 | 单页临时业务塞进全局安装流程 |

## Composables：封装有状态逻辑与副作用

Composable 是以 `use` 开头的组合式函数，彻底取代了 Vue 2 时期容易产生命名冲突、依赖来源不明的 `mixins`。一个合格的 Composable 应当具备四项特征：入参兼容普通值/Ref/Getter、返回装着 Refs 的普通对象（方便调用方直接解构不丢响应性）、内部自行清理副作用、不依赖隐式全局选择器。

下面以 `ResizeObserver` 监听元素尺寸为例，利用 `MaybeRefOrGetter` 和 `toValue()` 统一处理入参，并用 `watchEffect` 的 `onCleanup` 自动断开监听：

```ts
// composables/useElementSize.ts
import {
  readonly,
  shallowRef,
  toValue,
  watchEffect,
  type MaybeRefOrGetter,
} from 'vue'

export function useElementSize(
  target: MaybeRefOrGetter<HTMLElement | null>,
) {
  const width = shallowRef(0)
  const height = shallowRef(0)

  watchEffect((onCleanup) => {
    const element = toValue(target)
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      width.value = entry.contentRect.width
      height.value = entry.contentRect.height
    })

    observer.observe(element)
    onCleanup(() => observer.disconnect())
  })

  return {
    width: readonly(width),
    height: readonly(height),
  }
}
```

组件侧只需把模板引用传进去即可，元素什么时候挂载、什么时候销毁，观测器都会自动跟着切换和释放：

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useElementSize } from '@/composables/useElementSize'

const panel = useTemplateRef<HTMLElement>('panel')
const { width, height } = useElementSize(panel)
</script>

<template>
  <section ref="panel">
    {{ Math.round(width) }} x {{ Math.round(height) }}
  </section>
</template>
```

**向调用方返回状态时，只暴露经过 `readonly()` 包装的 Ref 和有限的操作方法，不要把内部原始状态一锅端出去，否则调用方的随意修改会让状态流向失控。**

如果项目里有图片转 Base64 或压缩上传的 Composable，务必守住三道浏览器限制：先调用 `await image.decode()` 确保像素已解码再绘制；跨域图片必须配置正确的 CORS 头否则 Canvas 会被污染无法导出；上传场景优先使用 `canvas.toBlob()` 生成二进制对象，避免大图调用 `toDataURL()` 产出巨型字符串阻塞主线程。

## 自定义指令：生命周期与底层 DOM 控制

`<script setup>` 中以 `v` 开头的驼峰变量会自动注册为局部指令。指令关注的是绑定的具体 DOM 元素而不是组件实例，常用钩子有 `mounted`、`updated` 和 `unmounted`；只有纯同步改样式且无需释放资源的简单指令才适合用函数简写（同时触发 `mounted` 和 `updated`）。

### 按钮权限指令的真实边界

常见后台系统会写一个 `v-permission` 指令控制按钮显隐：

```ts
import type { Directive } from 'vue'

interface PermissionBinding {
  required: string
  granted: ReadonlySet<string>
}

function syncPermission(
  el: HTMLElement,
  { value }: { value: PermissionBinding },
): void {
  const allowed = value.granted.has(value.required)
  el.hidden = !allowed
  el.setAttribute('aria-hidden', String(!allowed))
}

export const vPermission: Directive<HTMLElement, PermissionBinding> = {
  mounted: syncPermission,
  updated: syncPermission,
}
```

**前端自定义指令控制按钮隐藏仅仅是为了优化交互视图，绝不是权限安全边界；用户随时可以通过控制台改回 `hidden` 属性或直接重放 HTTP 请求，核心接口必须在服务端完成完整的角色与资源鉴权。**

### Pointer Events 拖拽与 `IntersectionObserver` 懒加载

需要绑定事件监听或浏览器观察器的指令，必须用对象写法在 `unmounted` 时彻底清理。因为同一个指令可能被挂在多个 DOM 节点上，用 `WeakMap<HTMLElement, Cleanup>` 按元素实例隔离清理函数是最稳妥的做法：

```ts
import type { Directive } from 'vue'

type Cleanup = () => void
const cleanups = new WeakMap<HTMLElement, Cleanup>()

export const vDrag: Directive<HTMLElement> = {
  mounted(el) {
    const previousTouchAction = el.style.touchAction
    el.style.touchAction = 'none'
    let activeCleanup: Cleanup | undefined

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      activeCleanup?.()

      const rect = el.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top
      const pointerId = event.pointerId

      el.setPointerCapture(pointerId)

      const onPointerMove = (moveEvent: PointerEvent) => {
        el.style.left = `${moveEvent.clientX - offsetX}px`
        el.style.top = `${moveEvent.clientY - offsetY}px`
      }

      const stop = () => {
        el.removeEventListener('pointermove', onPointerMove)
        el.removeEventListener('pointerup', stop)
        el.removeEventListener('pointercancel', stop)
        if (el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId)
        }
        if (activeCleanup === stop) activeCleanup = undefined
      }

      activeCleanup = stop
      el.addEventListener('pointermove', onPointerMove)
      el.addEventListener('pointerup', stop)
      el.addEventListener('pointercancel', stop)
    }

    el.addEventListener('pointerdown', onPointerDown)
    cleanups.set(el, () => {
      activeCleanup?.()
      el.removeEventListener('pointerdown', onPointerDown)
      el.style.touchAction = previousTouchAction
    })
  },
  unmounted(el) {
    cleanups.get(el)?.()
    cleanups.delete(el)
  },
}
```

对于图片懒加载，现代浏览器首选原生属性 `<img loading="lazy" decoding="async" />`。只有需要占位图、提前 200px 预加载或自定义淡入时，才通过 `v-lazy-image` 包装 `IntersectionObserver`（并在 `updated` 钩子里处理动态切换的 `binding.value`，在 `unmounted` 中调用 `observer.disconnect()`）。若需要批量加载本地图库资源，Vite 提供的 `import.meta.glob('./assets/gallery/*.{png,jpg,webp}', { eager: true, import: 'default', query: '?url' })` 可以在编译期收集 URL，注意这是 Vite 专属语法，不能直接搬到 Webpack 项目里。

## 应用插件与 `globalProperties` 的正确打开方式

Vue 插件可以是函数或带有 `install(app, options)` 方法的对象，`app.use()` 会自动去重避免重复安装同一插件对象。

相比在 Vue 2 里滥用 `Vue.prototype`（对应 Vue 3 的 `app.config.globalProperties`），**在 Composition API 项目里编写全局服务插件，首选在 `install` 内通过 `app.provide(key, service)` 注入只读服务并配套导出 `useXxx()` Composable**。这样既省去了对 `getCurrentInstance().proxy` 的隐式依赖，又保留了完整的 TypeScript 推导：

```ts
// plugins/loading.ts
import {
  inject,
  readonly,
  shallowRef,
  type App,
  type InjectionKey,
  type Plugin,
  type Ref,
} from 'vue'

export interface LoadingService {
  visible: Readonly<Ref<boolean>>
  show(): void
  hide(): void
}

const loadingKey: InjectionKey<LoadingService> = Symbol('loading')

export const loadingPlugin: Plugin = {
  install(app: App) {
    const visible = shallowRef(false)
    const service: LoadingService = {
      visible: readonly(visible),
      show: () => { visible.value = true },
      hide: () => { visible.value = false },
    }

    app.provide(loadingKey, service)
  },
}

export function useLoading(): LoadingService {
  const service = inject(loadingKey)
  if (!service) throw new Error('loadingPlugin 尚未安装')
  return service
}
```

根组件里只需放一个声明式的 `<LoadingHost />` 消费 `useLoading().visible`，DOM 的渲染和销毁完全交还给 Vue 自己管理，避开了手写命令式 `render()` 带来的容器清理、继承 `appContext` 和 SSR 适配问题。

如果为了兼容旧 Options API 组件或模板里的高频格式化方法，确实需要挂载少量 `globalProperties`（如 `$formatMoney`），必须同步扩充 `vue` 模块的类型声明：

```ts
// src/types/vue.d.ts
export {}

declare module 'vue' {
  interface ComponentCustomProperties {
    $formatMoney(value: number): string
  }
}
```

## 打包为可发布的 Vue 3 组件/工具库

当一个 Composable 和配套指令（例如 `useElementSize` 与 `v-resize`）成熟到需要跨仓库复用，就需要切换成 Vite 库模式打包发布。打包的核心铁律有三点：

1. **必须把 `vue` 写进 `external` 与 `peerDependencies`**，避免使用方项目里打进两份 Vue 运行时导致响应式系统与实例上下文分裂。
2. **先跑 `vite build` 再跑 `vue-tsc` 生成 `.d.ts`**：Vite 构建启动时会清空输出目录 `dist/`，如果先生成声明再打包 JS bundle，声明文件会被直接删光。
3. **为构建单独准备 `tsconfig.build.json`**，覆盖应用配置里常见的 `noEmit: true`。

```ts
// vite.config.ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'VueElementTools',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es'
          ? 'vue-element-tools.js'
          : 'vue-element-tools.umd.cjs',
    },
    rolldownOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
})
```

```json
// tsconfig.build.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "jsx": "preserve",
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

配合 `package.json` 中的 `exports` 与 `pack:check` 脚本做发包前预检，确认 ESM、UMD 与入口 `.d.ts` 全部存在：

```json
{
  "name": "vue-element-tools",
  "version": "0.1.0",
  "type": "module",
  "files": ["dist"],
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "npm run build:bundle && npm run build:types",
    "build:bundle": "vite build",
    "build:types": "vue-tsc -p tsconfig.build.json",
    "verify:dist": "node --input-type=module -e \"import { existsSync } from 'node:fs'; const files = ['dist/index.d.ts', 'dist/vue-element-tools.js', 'dist/vue-element-tools.umd.cjs']; const missing = files.filter((file) => !existsSync(file)); if (missing.length) throw new Error('missing: ' + missing.join(', '))\"",
    "pack:check": "npm run build && npm run verify:dist && npm pack --dry-run"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/vue-element-tools.js",
      "require": "./dist/vue-element-tools.umd.cjs"
    }
  },
  "peerDependencies": {
    "vue": "^3.5.0"
  }
}
```

（若项目使用的 Vite 版本底层仍是 Rollup 而非 Rolldown，将配置键改为 `rollupOptions` 即可。）

## 附：SFC 样式作用域与选择器穿透

在封装插件配套组件或覆盖第三方 UI 库样式时，`<style scoped>` 会把选择器编译成 `.panel[data-v-xxxx]`。子组件根节点会同时拿到父子双份作用域属性，但深层内部节点拿不到。

调整第三方组件内部样式时，应按脆弱度从低到高依次选用：**官方 Theme/Token API -> CSS 自定义属性 -> `::part`（Web Component） -> `:deep()` 穿透**。

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'

const accent = shallowRef('#0f766e')
</script>

<template>
  <section class="panel">
    <slot />
  </section>
</template>

<style scoped>
.panel {
  color: v-bind(accent);
}

/* 穿透修改子组件内部元素（升级第三方库时需做视觉回归） */
.panel :deep(.el-input__wrapper) {
  box-shadow: none;
}

/* 只命中父组件通过 slot 传入的内容 */
:slotted(.notice) {
  font-weight: 700;
}

/* 在 scoped 块中声明全局选择器 */
:global(body.is-modal-open) {
  overflow: hidden;
}
</style>
```

对于使用 TSX 或渲染函数编写的底层组件，`<style module>` 配合 `useCssModule()` 可以把哈希化后的类名作为对象导入，避免依赖脆弱的标签作用域属性。

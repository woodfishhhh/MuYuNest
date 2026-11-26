---
title: Vue 3 工程化、性能优化与 ECharts 大屏实战
slug: vue3-engineering-and-dataviz
date: 2026-07-13
categories:
  - 前端开发
tags:
  - Vue 3
  - Vite
  - ECharts
  - 性能优化
  - 工程化
---

工程化配置和性能调优经常出现两个极端：要么拿开发期 Vite 代理当线上架构用、把私钥塞进 `VITE_*` 环境变量里打包进客户端；要么写大屏看板时直接让模板绑定一堆未校验的上游嵌套字段，组件卸载时忘记销毁 ECharts 实例和 `ResizeObserver`，导致切换页面几轮后浏览器内存飙升。把构建边界、渲染开销和第三方实例生命周期理顺，这套基础设施才算真正可靠。

## Vite 环境变量、代理与 Webpack 模块图对比

### 环境变量的静态替换与安全红线

Vite 按优先级加载 `.env`、`.env.local`、`.env.[mode]`、`.env.[mode].local`。默认只有带 `VITE_` 前缀的变量会暴露给浏览器代码，且值在**构建期**就会被静态字面量替换进 JS 产物中。

```ts
// src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_ENABLE_FIXTURE: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

**所有注入 `VITE_*` 的变量在生产 JS 产物里对用户完全明文可见，绝不允许写入数据库密码或服务端 API Secret；同时，同一份构建产物如果要部署到多套环境动态切换接口地址，不能依赖改 `.env` 文件，而应由服务器在启动或请求时下发运行时配置。**

开发期前端（5173）和本地 API 服务（3333）不同源时，在 `vite.config.ts` 用 `server.proxy` 转发 `/api`（注意根据后端真实前缀决定是否保留 `rewrite`）。这套代理只在 `vite dev` 内存里有效，线上必须交给 Nginx 反向代理或服务端明确的 Origin 白名单 CORS（带 `credentials: 'include'` 时 `Access-Control-Allow-Origin` 不可为 `*`）。

### Webpack 5 模块图对照

理解 Webpack 5 的构建心智模型有助于排查复杂老项目或定制构建插件：

```text
entry
  ↓ 解析 import / require
module rules + loaders（从右向左把 .vue/.ts/.css 转成 JS 模块）
  ↓
dependency graph（依赖图）
  ↓ plugins（挂载编译钩子，完成 HTML 注入、变量替换、拆包压缩）
output（带 contenthash 的静态产物）
```

Webpack 5 已内置 `output.clean` 和 `type: 'asset'`，不再需要 `clean-webpack-plugin` 或 `file-loader`；使用 `ts-loader` 时需配合 `appendTsSuffixTo: [/\.vue$/]` 并挂载 `VueLoaderPlugin`。需要注意 Vite 与 Webpack 的配置字段和插件生态不能直接互换，外部 CDN（`externals`）也会引入网络可用性、CSP/SRI 和多版本对齐风险，应先做包体积分析再决定是否拆包。

## UnoCSS 原子化与 `h()` 渲染函数边界

### UnoCSS 按需引擎

UnoCSS 按源码中真实出现过的 token 按需生成 CSS（Vite 集成使用 `unocss/vite` 与 `import 'virtual:uno.css'`），相比传统样式表大幅减少了冗余类名，但也带来了静态提取限制：**绝对不要在运行时用模板字符串拼接类名（如 `` `bg-${color}-500` ``），提取器扫描源码时看不到完整类名，生产环境会直接丢失样式。** 动态状态样式必须写成完整类名映射表：

```ts
const statusClass = {
  success: 'text-emerald-700 bg-emerald-50',
  warning: 'text-amber-800 bg-amber-50',
  error: 'text-red-700 bg-red-50',
} as const
```

### `h()` 渲染函数与 Vue 编译宏演进

手写 `h()` 渲染函数跳过模板字符串解析，但单文件组件模板在构建期就已完成编译，还能拿到**静态节点提升和 PatchFlag 靶向更新优化**，因此常规业务 UI 写模板反而比手写 `h()` 更快、更易读。`h()` 与 TSX 只适合表格列渲染器、高度动态结构树或底层无头组件库：

```ts
// components/ActionButton.ts
import { defineComponent, h, type PropType } from 'vue'

type Tone = 'primary' | 'danger'

export const ActionButton = defineComponent({
  name: 'ActionButton',
  props: {
    tone: {
      type: String as PropType<Tone>,
      default: 'primary',
    },
  },
  emits: {
    activate: () => true,
  },
  setup(props, { emit, slots }) {
    return () => h(
      'button',
      {
        type: 'button',
        class: ['action-button', `action-button--${props.tone}`],
        onClick: () => emit('activate'),
      },
      slots.default?.(),
    )
  },
})
```

Vue 3.3–3.5 在 `<script setup>` 编译宏上补齐了类型化组件所需的核心能力，使用时需确保 `vue`、`@vue/compiler-sfc` 与语言服务版本配套：

| 编译宏 / 能力 | 最低版本 | 作用 |
| --- | --- | --- |
| `generic="T"` | Vue 3.3+ | 让 Props 与 Slots 共享泛型参数 |
| `defineOptions` | Vue 3.3+ | 声明组件 `name`、`inheritAttrs` 等选项 |
| `defineSlots` | Vue 3.3+ | 约束具名与作用域插槽类型 |
| `defineModel` | Vue 3.4+ | 一行声明组件双向绑定契约 |
| 响应式 Props 解构 | Vue 3.5+ | 直接解构 `defineProps()` 保留响应性并赋默认值 |

## 渲染性能瓶颈定位与优化准则

优化前先用真实用户监控（RUM）与 Performance / Lighthouse 抓准主要瓶颈（Core Web Vitals 关注第 75 百分位：`LCP <= 2.5s`、`INP <= 200ms`、`CLS <= 0.1`），改完后在相同条件下复测验证。

具体到 Vue 3 运行时，常见的无效更新与主线程阻塞点可以通过四项措施收敛：

1. **保持传给列表行组件的 Props 稳定**：不要让列表里的每一行都去依赖变化频繁的 `activeId`，而是在父组件直接传入布尔值 `:active="user.id === activeId"`，这样切换选中项时只有旧选中行和新选中行两行触发重渲染，其余几百行完全跳过。
2. **用 `shallowRef` 隔离大数据集和外部实例**：不可变整体替换的大型报表数组放进 `shallowRef`，省去深层递归创建 `Proxy` 的启动开销；确需跳过复杂列表局部更新时，先用 Devtools Profiler 确认热点，再有针对性地使用 `v-once` 或 `v-memo`。
3. **重型计算与超长列表卸载主线程**：上万条记录用虚拟列表库（避免自己用 `IntersectionObserver` 粗暴删除 DOM 破坏焦点与无障碍）；CPU 密集型计算丢进 Web Worker（`new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' })`），大数据传输使用 Transferable 避免结构化克隆卡顿。
4. **首屏图片与路由懒加载协同**：业务图片显式写明 `width` 和 `height` 预留宽高比压低 CLS；非首屏图像加 `loading="lazy" decoding="async"`，但**首屏关键 LCP 大图严禁加 `loading="lazy"`**。路由和重型图表面板用动态 `import()` 拆包，不要把所有依赖塞进首屏入口。

## ECharts 三栏数据大屏全链路实战

做一个可长期维护的三栏数据大屏，重点不在把图表配置项背熟，而是把上游清洗、并发竞态防护、Pinia 源状态、派生计算与图表实例生命周期彻底拆开：

```text
上游数据源
  ↓ Node/Express 适配层（超时控制、字段裁剪、结构归一化）
Vue API 层（fetch + AbortSignal）
  ↓ Pinia Store（只存源状态 + latestRequestId 防竞态覆盖）
computed（派生看板指标、Top N 饼图、趋势线与城市明细）
  ↓
ECharts / Vue 组件（shallowRef 持有实例 + ResizeObserver + onBeforeUnmount dispose）
```

### 1. 适配层边界与 Pinia 并发竞态控制

涉及跨域、上游字段混乱或密钥保护时，必须由服务端适配层拦截处理：设定 `AbortSignal.timeout(8_000)`、核对响应状态并通过显式的字段校验函数归一化成干净的 `DashboardPayload`，不要用 TypeScript 类型断言假装外部 JSON 可信。

前端 Pinia Store 只存储原始 `data`、`loading`、`error`，并用递增的 `latestRequestId` 守住并发请求顺序——即便用户快速反复点击刷新，旧请求后返回也绝不会覆盖新请求的结果；组件卸载时通过 `AbortController` 取消在途请求：

```ts
// src/stores/dashboard.ts
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { fetchDashboard } from '@/api/dashboard'
import type { DashboardPayload } from '@/types/dashboard'

export const useDashboardStore = defineStore('dashboard', () => {
  const data = shallowRef<DashboardPayload | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)
  let latestRequestId = 0

  async function load(signal?: AbortSignal): Promise<void> {
    const requestId = ++latestRequestId
    loading.value = true
    error.value = null

    try {
      const nextData = await fetchDashboard(signal)
      if (requestId !== latestRequestId) return
      data.value = nextData
    } catch (cause) {
      if (requestId !== latestRequestId) return
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      error.value = cause instanceof Error ? cause.message : '未知错误'
    } finally {
      if (requestId === latestRequestId) loading.value = false
    }
  }

  return { data, loading, error, load }
})
```

### 2. ECharts 地图组件生命周期与销毁闭环

**ECharts 实例绝对不能放进普通 `ref` 或 `reactive`，必须用 `shallowRef` 保存；同时要在 `onMounted` 确保容器已挂载后再 `init()`，通过 `ResizeObserver` 同步窗口变化，并在 `onBeforeUnmount` 里断开观察器并调用 `chart.value?.dispose()` 释放显存与事件监听器。**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import * as echarts from 'echarts'
import chinaGeoJson from '@/assets/china.json'
import type { Coordinate, ProvinceStat } from '@/types/dashboard'

interface TooltipParam {
  name?: string
  value?: unknown
}

const props = defineProps<{
  provinces: ProvinceStat[]
  coordinates: Readonly<Record<string, Coordinate>>
}>()

const emit = defineEmits<{
  selected: [provinceId: string]
}>()

const container = useTemplateRef<HTMLDivElement>('map')
const chart = shallowRef<echarts.ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

echarts.registerMap(
  'china',
  chinaGeoJson as Parameters<typeof echarts.registerMap>[1],
)

function buildPoints() {
  return props.provinces.flatMap((province) => {
    const coordinate = props.coordinates[province.name]
    if (!coordinate) return []

    return [{
      id: province.id,
      name: province.name,
      value: [
        coordinate.longitude,
        coordinate.latitude,
        province.nowConfirm,
      ],
    }]
  })
}

function render() {
  chart.value?.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (input: TooltipParam | TooltipParam[]) => {
        const params = Array.isArray(input) ? input[0] : input
        const value = Array.isArray(params?.value) ? params.value[2] : 0
        return `${params?.name ?? ''}：${value}`
      },
    },
    geo: {
      map: 'china',
      roam: true,
      label: { show: true, fontSize: 10 },
      itemStyle: {
        areaColor: '#123b5d',
        borderColor: '#7dd3fc',
      },
      emphasis: {
        itemStyle: { areaColor: '#2563eb' },
      },
    },
    series: [{
      type: 'effectScatter',
      coordinateSystem: 'geo',
      symbolSize: (value: unknown) => {
        const count = Array.isArray(value) ? Number(value[2]) : 0
        return Math.max(8, Math.min(30, Math.sqrt(count)))
      },
      data: buildPoints(),
    }],
  })
}

onMounted(() => {
  if (!container.value) return

  chart.value = echarts.init(container.value)
  chart.value.on('click', (params) => {
    const province = props.provinces.find((item) => item.name === params.name)
    if (province) emit('selected', province.id)
  })

  resizeObserver = new ResizeObserver(() => chart.value?.resize())
  resizeObserver.observe(container.value)
  render()
})

watch(() => props.provinces, render)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <section class="map-panel" aria-label="全国数据地图">
    <div ref="map" class="map-canvas" />
  </section>
</template>

<style scoped>
.map-panel,
.map-canvas {
  width: 100%;
  min-height: 38rem;
}
</style>
```

地图点击省份后通过 `emit('selected', province.id)` 通知父容器切换 `selectedProvinceId`，父容器再用 `computed` 算出右侧城市明细表的数据，让图表组件与表格组件彻底解耦。其余派生图表同样直接依赖 `computed`：城市 Top 10 饼图先复制数组再按目标指标降序切片；趋势折线图确保横轴日期数组与纵轴数值数组严格按同一时间序列排列；城市明细表使用 `<TransitionGroup>` 时绑定稳定业务 `item.id` 作为 `:key`，避免切换省份时表格行动画错乱。

### 3. 大屏上线常见故障速查

- **图表容器空白**：依次核查 DOM 是否已挂载、容器宽高是否非零（CSS 是否漏掉 `min-height`）、`registerMap` 是否在 `setOption` 之前完成、GeoJSON 地区名与业务数据 `name` 是否一致。
- **首屏报读取空对象属性错误**：用 `DashboardPayload | null` 区分未加载态，子组件只在 `v-else-if="data"` 分支挂载，不要用空对象凑初始值。
- **窗口缩放后图表比例拉伸变形**：确认容器绑定了 `ResizeObserver` 调用 `chart.resize()`，而非仅靠页面初始化尺寸。

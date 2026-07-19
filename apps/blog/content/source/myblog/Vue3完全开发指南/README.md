---
title: Vue 3 完全开发指南
date: 2026-07-13
updated: 2026-07-13
tags:
  - Vue 3
  - TypeScript
  - Vite
  - Pinia
  - Vue Router
  - 前端工程化
draft: false
---

# Vue 3 完全开发指南

从 Vue 3 响应式原理和组件体系出发，覆盖动画、自定义能力、工程化、Pinia、Vue Router、可视化项目，以及 PM2、Linux、Nginx 和 Web 安全基础。

示例统一采用 Composition API、`<script setup lang="ts">` 和当前通行写法；遇到版本敏感 API 时，以项目 lockfile 与对应官方文档为准。

## 原始链接

- [Vue3 + vite + Ts + pinia + 实战 + 源码 + electron](https://www.bilibili.com/video/BV1dS4y1y7vd/)

## 目录

| 笔记 | 对应页 | 主要内容 |
|---|---:|---|
| [01-Vue 3 基础与响应式系统](./01-Vue3基础与响应式系统.md) | P1-P14 | SFC、模板、虚拟 DOM、Diff、`ref`、`reactive`、`computed`、侦听器与生命周期 |
| [02-组件体系与通信](./02-组件体系与通信.md) | P15-P22 | BEM、Props/Emits、递归与动态组件、插槽、异步组件、Teleport、KeepAlive |
| [03-动画与高级组件模式](./03-动画与高级组件模式.md) | P23-P35 | Transition、TransitionGroup、GSAP、provide/inject、Mitt、TSX 与组件 `v-model` |
| [04-自定义能力与运行时机制](./04-自定义能力与运行时机制.md) | P36-P49 | 自定义指令、Composables、插件、全局能力、样式方案、事件循环与 `nextTick` |
| [05-工程化、跨端与性能优化](./05-工程化跨端与性能优化.md) | P50-P60 | Ionic、移动端适配、UnoCSS、渲染函数、Electron、编译宏、Webpack、性能与跨域 |
| [06-Pinia 状态管理](./06-Pinia状态管理.md) | P61-P67 | Store、State、Getters、Actions、`storeToRefs`、订阅与持久化 |
| [07-数据可视化实战](./07-数据可视化实战.md) | P68-P78 | 项目结构、接口、地图、表格、看板、饼图和折线图 |
| [08-Vue Router 路由系统](./08-VueRouter路由系统.md) | P79-P92 | 路由模式、导航、传参、嵌套与命名视图、守卫、元信息、滚动和动态路由 |
| [09-PM2、Linux 与 Nginx 部署](./09-PM2Linux与Nginx部署.md) | P93-P107 | PM2、Linux 权限、Nginx、反向代理、History 回退、日志与负载均衡 |
| [10-Web 安全与隐私基础](./10-Web安全与隐私基础.md) | P108-P114 | Canvas 指纹、输入窃取风险、EXIF、蜜罐、自动化边界、输入法隐私和网络模型 |

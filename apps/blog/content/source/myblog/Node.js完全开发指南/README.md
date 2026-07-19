---
title: Node.js 后端实战手册
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - 后端开发
  - 分布式系统
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
draft: false
---

# Node.js 后端实战手册

Node.js 项目真正难的不是起一个 HTTP 服务，而是把依赖、I/O、数据、鉴权、消息和部署连成一条可运维的链路。这组笔记可以按问题直接查，不必顺序阅读。

| 技术问题 | 笔记 |
| --- | --- |
| `package.json` 怎么管项目，npm 如何解析依赖，CommonJS 和 ESM 怎么选 | [Node 起步与 npm 模块系统](./01-Node起步与npm模块系统.md) |
| 路径、进程、子进程、文件流、密码学和 CLI 怎么组合 | [Node 运行时与核心工具](./02-Node运行时与核心工具.md) |
| 原生 HTTP、反向代理、缓存、CORS、Express 中间件和 SSE 怎么接起来 | [HTTP 与 Express 服务开发](./03-HTTP与Express服务开发.md) |
| SQL、mysql2、Knex、Prisma、MVC、IoC 和 JWT 各自负责什么 | [MySQL 与后端架构](./04-MySQL与后端架构.md) |
| Redis 数据结构、持久化、主从、Lua 限流和定时任务怎么落地 | [Redis 与自动化任务](./05-Redis与自动化任务.md) |
| TCP、Socket.IO、爬虫、C++ Addon、大文件、HTTP/2 和串口会在哪里炸 | [网络编程与系统能力](./06-网络编程与系统能力.md) |
| SSO、单设备和扫码登录如何建模，Fastify 网关和微服务怎么分边界 | [登录体系与 Fastify 微服务](./07-登录体系与Fastify微服务.md) |
| RabbitMQ、Kafka、Nacos、Elasticsearch、Cluster 和 PM2 如何进入生产链路 | [消息队列与生产部署](./08-消息队列与生产部署.md) |


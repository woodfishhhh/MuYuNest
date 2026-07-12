---
title: NestJS 完全开发指南课程笔记
date: 2026-07-12
updated: 2026-07-12
slug: nestjs-complete-guide
type: Notes
categories:
  - 后端开发
  - NestJS
tags:
  - NestJS
  - TypeScript
  - TypeORM
  - 后端开发
draft: false
---

# NestJS 完全开发指南课程笔记

这套笔记来自两个 Bilibili 合集，共 200 个分 P、约 17 小时 26 分钟。原视频按录课顺序拆得很细，笔记没有照着 200 个标题逐页复述，而是把连续的项目推进合成 6 个主题。

## 课程来源

- [Udemy - NestJS The Complete Developer's Guide part1](https://www.bilibili.com/video/BV1D9MezXExs/)
- [Udemy - NestJS The Complete Developer's Guide part2](https://www.bilibili.com/video/BV139Mez9EnA/)

part2 的 P54-P100 实际上接入了另一套 TypeScript 入门内容，不是 NestJS 项目的后续章节，因此单独整理为第 6 篇。

## 阅读顺序

| 笔记 | 视频覆盖 | 主要内容 |
|---|---|---|
| [01-NestJS 起步与请求链路](./nestjs-request-lifecycle) | part1 P1-P18 | 项目启动、Controller、路由装饰器、DTO、Pipe 和请求校验 |
| [02-Service、模块与依赖注入](./nestjs-services-modules-di) | part1 P19-P38 | Repository、Service、IoC、DI、Module 和跨模块依赖 |
| [03-TypeORM 与用户 CRUD](./nestjs-typeorm-user-crud) | part1 P39-P65 | Entity、Repository、数据库操作、异常、序列化和 Interceptor |
| [04-认证授权与自动化测试](./nestjs-auth-authorization-testing) | part1 P66-P100；part2 P1-P6 | 密码哈希、Session、装饰器、Guard、单元测试和 E2E 测试 |
| [05-配置、关联查询与生产部署](./nestjs-config-relations-deployment) | part2 P7-P53 | Config、环境隔离、关联关系、授权、QueryBuilder、Migration 和部署 |
| [06-TypeScript 类型系统基础](./typescript-type-system-basics) | part2 P54-P100 | 类型注解、推断、函数、对象、数组、元组、接口、类和继承 |

## 素材可信度

课程索引来自 Bilibili 官方视频元数据接口；字幕来自每个分 P 的自动翻译中文字幕轨道。200 个分 P 都成功取得字幕，时间覆盖率为 96.63%-99.96%，平均 99.58%。

自动字幕会把少量库名、函数名和口语停顿识别错，所以它只作为内容线索。笔记中的代码是按课程讲解重新整理的教学示例，不是视频代码的逐字抄录；涉及当前框架行为的部分再用 NestJS、TypeScript 官方文档校正。

原始索引、字幕、逐页文本和主题合并素材保存在：

- `work/BV1D9MezXExs/`
- `work/BV139Mez9EnA/`

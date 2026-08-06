---
title: Next.js 16 + AI + SEO 实战笔记
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - AI SDK
  - SEO
  - Prisma
  - Better Auth
source:
  - https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P1-P36
slug: nextjs16-ai-seo
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 + AI + SEO 实战笔记

这套笔记围绕一个实际的 Next.js 应用展开：先把 App Router 和请求链路弄清楚，再接入 AI、缓存、静态内容、认证、Prisma 与 SEO，最后落到 Vercel 部署。

| 顺序 | 笔记 | 范围 |
| --- | --- | --- |
| 01 | [项目搭建与运行时边界](01-项目搭建与运行时边界.md) | P1-P2 |
| 02 | [App Router 与路由系统](02-App-Router与路由系统.md) | P3-P6 |
| 03 | [Route Handler 与 Cookie 会话](03-Route-Handler与Cookie会话.md) | P7-P8 |
| 04 | [AI SDK、Proxy 与渲染模式](04-AI-SDKProxy与渲染模式.md) | P9-P13 |
| 05 | [Cache Components 与缓存策略](05-Cache-Components与缓存策略.md) | P14-P15 |
| 06 | [Image、Font、Script 与静态资源](06-ImageFontScript与静态资源.md) | P16-P18 |
| 07 | [SSG、MDX 与 Server Actions](07-SSGMDX与Server-Actions.md) | P19-P21 |
| 08 | [环境变量、i18n、配置与 CSS](08-环境变量i18n配置与CSS.md) | P22-P25 |
| 09 | [SEO：抓取、元数据与 Web Vitals](09-SEO抓取元数据与Web-Vitals.md) | P26-P33 |
| 10 | [Prisma、Better Auth 与 Vercel](10-PrismaBetter-Auth与Vercel.md) | P34-P36 |

## 主线

```text
Next.js 项目
  -> 文件系统路由与服务器边界
  -> Route Handler / Cookie
  -> AI SDK 与流式输出
  -> Proxy / RSC / Cache Components
  -> Image / Font / Script / SSG / MDX
  -> Server Actions / 环境变量 / i18n
  -> robots / sitemap / JSON-LD / Open Graph / Web Vitals
  -> Prisma / Better Auth / Vercel
```

这套笔记暂不覆盖具体业务项目源码，而是把每个能力压缩成可迁移的实现骨架、边界和容易出错的地方。

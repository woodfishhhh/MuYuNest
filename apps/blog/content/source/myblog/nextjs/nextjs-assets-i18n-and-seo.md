---
title: Next.js 16 生产配置：静态资源、i18n、SEO 元数据与 Web Vitals
slug: nextjs-assets-i18n-and-seo
date: 2026-08-06
categories:
  - 前端开发
tags:
  - Next.js 16
  - SEO
  - i18n
  - next/image
  - Web Vitals
---

一个面向公网流量的 Next.js 16 站点，在上线前往往要在四块基础设施上踩一遍坑：首屏图片没定宽高导致 CLS 布局跳动、远程图域名没加白名单报错、多语言重定向把 `/api/` 和静态资源也卷进死循环，或者忘记在 `robots.txt` 与 `sitemap.xml` 对齐规范域名。把资源优化、环境变量隔离、国际化路由和搜索引擎元数据收拢进同一套生产规范，上线检查才不会顾此失彼。

## 静态资源优化：`next/image`、`next/font` 与 `next/script`

### 1. `next/image`：消除 CLS 与锁定远程图白名单

使用普通字符串 `src="/hero.png"` 时，必须同时传入 `width` 和 `height` 让浏览器在图像下载完成前预留占位框，彻底消掉 CLS（累积布局偏移）。静态 `import hero from '@/public/hero.png'` 会自动注入原始宽高；若是铺满响应式卡片，外层容器必须先定好 `relative` 与 `aspect-video`（或固定高度），再给 `<Image>` 传 `fill` 和准确的 `sizes`：

```tsx
import Image from 'next/image'

export function PostCover({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative aspect-video overflow-hidden">
      <Image
        src={src}
        alt={title}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover"
      />
    </div>
  )
}
```

**只给首屏真正决定 LCP 的主视觉大图加上 `priority`（或预加载属性），其余列表图片保持默认懒加载；同时 `next.config.ts` 的 `images.remotePatterns` 必须把允许代理的协议、域名与路径前缀收窄到具体白名单，绝不能用宽泛的 `**` 把整站图像优化端点变成开放代理。**

### 2. `next/font` 与 `next/script`

- **`next/font`**：通过 `next/font/google` 或 `next/font/local` 在构建期自托管字体文件并生成无偏移的回退度量。中文全量字库动辄数兆，切忌不加裁剪直接塞进根布局首屏，应按需做子集拆分或配合系统字体回退。
- **`next/script`**：第三方统计、客服或埋点脚本不要硬塞进 `<head>` 阻塞解析，按必要性分别选用 `afterInteractive`（页面可交互后加载统计）或 `lazyOnload`（浏览器空闲时加载低优插件），只在确实依赖页面初始化前生效的场景才考虑 `beforeInteractive`。

## 环境变量隔离、`next.config.ts` 与样式边界

读取配置时严格区分服务端与客户端可见范围：

- 只有带 `NEXT_PUBLIC_` 前缀的变量会在构建期被内联进浏览器 JS Bundle，**数据库密码（`DATABASE_URL`）、AI API Key、OAuth Secret 严禁加 `NEXT_PUBLIC_` 前缀**。
- `.env.local` 留在本地并加入 `.gitignore`，仓库只提交空值模板 `.env.example`；纯服务端配置模块加上 `import 'server-only'` 防止被客户端组件误引用。

在 `next.config.ts` 中保持克制，只放明确审计过的框架级配置：启用 `poweredByHeader: false` 隐藏框架指纹、在大型团队项目开启 `typedRoutes: true` 在编译期拦截拼写错误的站内 `<Link href>` 路径；如果自建 Docker 容器部署，设置 `output: 'standalone'` 生成精简 Node 运行包（注意它与纯静态 `output: 'export'` 是两条完全不同的路线）。样式方面，设计 Token 与 Reset 放进根布局 `globals.css`，局部组件按团队规范选用 Tailwind CSS 或 `*.module.css` 隔离，禁止用全局选择器加 `!important` 到处覆盖。

## 基于 `[lang]` 与 `proxy.ts` 的 i18n 国际化路由

App Router 推荐把语言编码显式放进动态顶层路径段 `src/app/[lang]/`（如 `zh-CN`、`en-US`）：

1. 定义语言白名单与字典加载映射（用静态白名单对象映射到动态 `import('./dictionaries/zh-CN.json')`，禁止拿路由参数直接拼接文件路径导入）。
2. 在 `[lang]/page.tsx` 里 `await params` 后先校验 `locales.includes(lang)`，不匹配直接调 `notFound()`，并配合 `generateStaticParams()` 提前生成各语言静态页面。
3. 借助 `proxy.ts`（配合 `negotiator` 与 `@formatjs/intl-localematcher`）读取请求头 `Accept-Language`，只对**不带语言前缀且非 `/api/`、非 `/_next/`、非静态文件后缀**的首次访问路径执行一次重定向：

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, locales } from './i18n/config'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
  const isAsset = /\.[^/]+$/.test(pathname) || pathname.startsWith('/_next')
  if (hasLocale || isAsset) return NextResponse.next()

  const locale = negotiateLocale(request) ?? defaultLocale
  return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

**i18n `proxy.ts` 的 `matcher` 必须跳过 `/api`、`_next` 和静态文件，否则图片、接口和客户端资源请求全会被重定向到 `/zh-CN/...` 造成全站资源 404 或重定向死循环。**

## SEO 元数据：`robots.ts`、`sitemap.ts`、Metadata API 与 JSON-LD

搜索引擎的核心链路是“发现 URL -> 抓取 HTML -> 理解结构化语义 -> 评估性能体验”。App Router 把全套技术 SEO 能力直接变成了类型化的文件约定：

1. **`app/robots.ts`**：声明通用抓取策略与 `sitemap` 入口。**切记 `disallow: ['/api/', '/admin/']` 只是向守规矩爬虫发出的声明，绝不是访问控制，后台接口与私有页面必须靠服务端认证拦截。**
2. **`app/sitemap.ts`**：从数据库查询已发布文章动态输出规范 URL（单文件数量超限时配合 `generateSitemaps` 拆分）。只放入返回 200 的 Canonical 正规地址，不要把登录页、分页筛选组合塞进去浪费抓取预算。
3. **`Metadata` 与 `generateMetadata`**：在根布局配置 `metadataBase: new URL('https://example.com')` 让相对路径的 Open Graph / Twitter 卡片图自动解析为完整绝对地址；动态文章页通过异步 `generateMetadata({ params })` 查出标题、摘要、封面图与 `alternates.canonical`（与正文共用服务端数据缓存防止重复查库）。
4. **JSON-LD 结构化数据**：把符合 `schema.org` 规范的 `Article`、`BreadcrumbList` 序列化为 `<script type="application/ld+json">`，且序列化时务必对 `<` 做转义防止闭合脚本标签注入：

```tsx
const safeJson = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

return (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: safeJson }}
  />
)
```

结构化数据中的作者、发布时间与摘要必须与页面真实可见内容完全一致，避免被搜索引擎判定为垃圾作弊。

## Web Vitals 真实用户指标采集

上线后除了用 Lighthouse 跑实验室基线，还需要通过 `web-vitals` 在客户端采集真实用户分布（Core Web Vitals 关注第 75 百分位阈值：`LCP <= 2.5s`、`INP <= 200ms`、`CLS <= 0.1`），利用不阻塞页面卸载的 `navigator.sendBeacon` 上报指标：

```tsx
'use client'

import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'

function report(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    path: window.location.pathname,
  })
  navigator.sendBeacon('/api/vitals', body)
}

onCLS(report)
onINP(report)
onLCP(report)
```

接收上报的 `/api/vitals` 端点需要做好字段校验和限频，只记录聚合所需的路径和指标数值，避免将带有敏感 Query 参数的完整 URL 或用户身份标识写入分析日志。

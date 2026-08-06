---
title: Next.js 16 环境变量、国际化、配置与 CSS
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - 环境变量
  - i18n
  - next.config.ts
  - CSS Modules
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P22-P25
slug: nextjs16-env-i18n-css
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 环境变量、国际化、配置与 CSS

环境变量保护运行时配置，国际化组织不同语言的内容和 URL，`next.config.ts` 管理框架级行为，CSS 方案决定样式的隔离和维护方式。它们都属于基础设施，应该集中、明确、可验证。

## 1. 环境变量：秘密只留在服务端

应用代码通过 `process.env` 读取环境变量：

```ts
const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.AI_API_KEY;

if (!databaseUrl || !apiKey) {
  throw new Error('缺少服务端配置');
}
```

本地开发通常使用 `.env.local`：

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/app"
AI_API_KEY="replace-me"
NEXT_PUBLIC_APP_NAME="My App"
```

`.env.local` 不应提交到 Git。可以提交 `.env.example`，但只放变量名和无效示例：

```dotenv
DATABASE_URL=
AI_API_KEY=
NEXT_PUBLIC_APP_NAME="My App"
```

`NEXT_PUBLIC_` 前缀表示变量允许被客户端代码读取。Next.js 会在构建时把它们内联到浏览器 bundle 中，因此下面这种写法会泄露秘密：

```dotenv
NEXT_PUBLIC_DATABASE_PASSWORD="do-not-do-this"
```

数据库密码、私有 API Key、签名密钥、内部服务地址不要使用 `NEXT_PUBLIC_`。服务端模块可以使用 `server-only` 防止被客户端误导入：

```ts
// src/lib/server-config.ts
import 'server-only';

export const serverConfig = {
  databaseUrl: process.env.DATABASE_URL!,
  aiApiKey: process.env.AI_API_KEY!,
};
```

跨平台执行临时变量时，命令语法不同：

```bash
# Linux / macOS / WSL
API_URL=https://api.example.com npm run build

# PowerShell
$env:API_URL = 'https://api.example.com'
npm run build

# Windows CMD
set API_URL=https://api.example.com && npm run build
```

生产环境不要把密钥硬编码在仓库或构建日志里。部署平台的 Environment Variables、密钥管理服务和权限控制才是生产配置的来源。

## 2. i18n 的核心是“语言 URL + 字典”

语言通常由语言代码和地区代码组成，例如 `zh-CN`、`en-US`、`zh-TW`。一个简单的配置：

```ts
// src/i18n/config.ts
export const locales = ['zh-CN', 'en-US'] as const;
export const defaultLocale = 'zh-CN';
export type Locale = (typeof locales)[number];
```

字典按语言拆分：

```json
{
  "home": {
    "title": "欢迎回来",
    "description": "管理你的项目"
  }
}
```

加载字典时使用明确的白名单，不能把用户传入的路径直接拼接进 `import()`：

```ts
import type { Locale } from './config';

const dictionaries = {
  'zh-CN': () => import('./dictionaries/zh-CN.json').then((m) => m.default),
  'en-US': () => import('./dictionaries/en-US.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
```

## 3. 使用 `[lang]` 建立本地化路由

将语言放进路由参数：

```text
app/
  [lang]/
    layout.tsx
    page.tsx
    home/page.tsx
```

```tsx
// app/[lang]/home/page.tsx
import { notFound } from 'next/navigation';
import { getDictionary } from '@/src/i18n/dictionaries';
import { locales, type Locale } from '@/src/i18n/config';

type Props = { params: Promise<{ lang: string }> };

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!locales.includes(lang as Locale)) notFound();

  const dict = await getDictionary(lang as Locale);
  return <h1>{dict.home.title}</h1>;
}
```

可以用 `generateStaticParams` 预生成全部语言页面：

```ts
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}
```

默认语言的 URL 策略要先定下来：所有语言都带前缀最简单；如果要隐藏默认语言，则必须处理 `/home` 与 `/zh-CN/home` 的规范化、重定向和 canonical，避免搜索引擎看到重复页面。

## 4. 根据 `Accept-Language` 做一次性重定向

浏览器会通过 `Accept-Language` 表达偏好，可以使用 `negotiator` 和 `@formatjs/intl-localematcher` 做匹配：

```ts
import Negotiator from 'negotiator';
import { match } from '@formatjs/intl-localematcher';
import { defaultLocale, locales } from './src/i18n/config';

function getLocale(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  const languages = new Negotiator({ headers }).languages();
  return match(languages, locales, defaultLocale);
}
```

Proxy 只负责入口路由选择：

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, locales } from './src/i18n/config';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  const isAsset = /\.[^/]+$/.test(pathname) || pathname.startsWith('/_next');
  if (hasLocale || isAsset) return NextResponse.next();

  const locale = getLocale(request);
  return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

必须跳过 API、静态资源和已经带语言的路径，否则会出现重定向循环，或者让图片、脚本请求被错误改写。语言探测适合做第一次访问的默认选择，用户手动切换后应以明确的 URL、Cookie 或账户设置为准。

客户端语言切换可以只替换当前路径的语言段：

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  function changeLocale(locale: string) {
    const [, , ...rest] = pathname.split('/');
    router.replace(`/${locale}/${rest.join('/')}`);
  }

  return <button onClick={() => changeLocale('en-US')}>English</button>;
}
```

生产实现还要保留查询参数、处理根路径和避免空路径；组件只是展示交互，翻译内容仍由服务端路由决定。

## 5. `next.config.ts` 只放框架级配置

一个可维护的配置文件应该只做框架配置和少量可审计的常量：

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
```

高频选项：

| 选项 | 用途 | 注意 |
| --- | --- | --- |
| `basePath` | 部署在子路径 | 会影响链接和静态资源 URL |
| `assetPrefix` | 指定资源前缀/CDN | 不是通用的站点根路径替换 |
| `trailingSlash` | 统一 URL 斜杠 | 要和托管平台路由匹配 |
| `redirects` | 永久或临时重定向 | 用于迁移旧 URL |
| `rewrites` | 内部改写 | 浏览器地址不变，注意缓存和代理边界 |
| `headers` | 安全头和缓存头 | 先确认是否会覆盖平台默认值 |
| `output: 'standalone'` | 生成精简 Node 部署产物 | 适合自建容器，不等于静态导出 |
| `transpilePackages` | 转译指定依赖 | 只处理确实存在兼容问题的包 |
| `typedRoutes` | 检查内部链接 | 适合大型应用减少拼写错误 |

不要把 API 密钥写进 `env` 配置，也不要为了“看起来高级”把所有实验选项全部打开。每一项配置都应该有明确的运行时需求和回滚方式。

## 6. CSS 方案与边界

全局样式放在根布局引入：

```tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
```

组件局部样式使用 CSS Modules：

```css
/* Button.module.css */
.button {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  background: #111827;
  color: white;
}
```

```tsx
import styles from './Button.module.css';

export function Button({ children }: { children: React.ReactNode }) {
  return <button className={styles.button}>{children}</button>;
}
```

常见方案的取舍：

| 方案 | 优点 | 代价 |
| --- | --- | --- |
| Tailwind / utility | 组合快、约束清晰、适合设计系统 | class 可能变长，需要统一 token |
| CSS Modules | 默认隔离、接近原生 CSS | 动态样式需要额外组织 |
| Global CSS | 适合 reset、变量和全局规则 | 容易发生命名冲突 |
| CSS-in-JS | 动态主题能力强 | SSR、运行时开销和配置更复杂 |

无论采用哪种方案，都要把设计 token、全局 reset 和组件局部样式分开。不要让 `!important` 和全局选择器成为组件之间的隐形通信机制。

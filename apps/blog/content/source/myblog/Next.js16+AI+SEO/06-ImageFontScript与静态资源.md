---
title: Next.js 16 Image、Font、Script 与静态资源
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - Image
  - Font
  - Script
  - Core Web Vitals
  - LCP
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P16-P18
slug: nextjs16-image-font-script
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 Image、Font、Script 与静态资源

图片、字体和第三方脚本都可能在首屏阶段改变布局、阻塞主线程或拖慢 LCP。Next.js 的内置组件不是为了替换 HTML 标签，而是把尺寸、加载优先级、远程来源和缓存策略变成可检查的配置。

## 1. `Image` 先解决布局偏移

静态路径：

```tsx
import Image from 'next/image';

<Image
  src="/hero.png"
  alt="产品首页"
  width={1920}
  height={1080}
  priority
/>;
```

原生字符串 `src` 必须提供 `width` 和 `height`，Next.js 才能在图片下载完成前预留空间，避免 CLS。首屏最大的图片可以使用 `priority`；普通图片默认懒加载，不要给列表里的每一张图都提高优先级。

静态导入会自动带出尺寸：

```tsx
import hero from '@/public/hero.png';

<Image src={hero} alt="产品首页" />;
```

需要铺满容器时使用 `fill`，但父容器必须有定位和稳定尺寸：

```tsx
<div className="relative aspect-video overflow-hidden">
  <Image
    src={post.coverUrl}
    alt={post.title}
    fill
    sizes="(max-width: 768px) 100vw, 50vw"
    className="object-cover"
  />
</div>
```

`fill` 不是“不需要尺寸”，而是把尺寸责任转移给父容器。没有 `aspect-ratio`、固定高度或定位上下文，图片仍会造成布局不稳定。

## 2. 远程图片白名单

远程图片必须在 `next.config.ts` 中显式允许：

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};
```

`protocol`、`hostname`、`pathname` 和端口可以一起限制。不要使用一个过宽的 `**` 允许任意远程来源，否则图片代理会变成不必要的攻击面。开发域名和生产域名不同，也要分别加入配置。

Next.js 会根据浏览器的 `Accept`、`sizes` 和设备宽度选择合适的 `srcset`，并把 PNG/JPEG 转成 WebP 或 AVIF。`deviceSizes` 和 `imageSizes` 控制候选尺寸，但只有配合正确的 `sizes`，浏览器才知道当前布局需要多宽的图。

## 3. 首屏图片和 LCP

LCP 关注首屏最大的文本或图片什么时候完成绘制。判断图片策略：

| 图片位置 | 策略 |
| --- | --- |
| 首屏 Hero / 主要封面 | `priority` 或当前版本推荐的 preload 方式 |
| 首屏以下的文章列表 | 默认懒加载 |
| 装饰背景 | 先判断是否真的需要图片，避免占用主资源 |
| 不确定宽高的远程图 | 先获取元数据，或使用稳定的 `fill` 容器 |

不要用 `priority` 掩盖巨大的原图。压缩、格式和尺寸选择正确，通常比把所有图片都设成高优先级更有效。

## 4. `next/font`

Google 字体：

```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

本地字体：

```tsx
import localFont from 'next/font/local';

const brandFont = localFont({
  src: './fonts/Brand.woff2',
  display: 'swap',
  variable: '--font-brand',
});
```

`next/font` 在构建时处理字体，减少运行时请求和字体切换造成的布局偏移。中文字体体积通常很大，不能不加筛选就把完整字库放进首屏；按产品覆盖范围拆分或选择合适子集。

## 5. `next/script`

第三方统计、聊天或支付脚本要明确加载策略：

```tsx
import Script from 'next/script';

<Script
  src="https://analytics.example.com/script.js"
  strategy="afterInteractive"
  onLoad={() => console.log('analytics ready')}
/>;
```

常见策略：

- `beforeInteractive`：非常少用，只给确实必须在交互前存在的脚本。
- `afterInteractive`：页面开始可交互后加载，适合统计等常规脚本。
- `lazyOnload`：浏览器空闲时加载，适合低优先级资源。
- `worker`：仅在项目和当前 Next.js 支持的情况下使用，先验证第三方脚本兼容性。

不要把第三方脚本直接写进 `<head>`，也不要为一个只在某个页面出现的功能把脚本放进根布局。加载范围越小，首屏越轻。

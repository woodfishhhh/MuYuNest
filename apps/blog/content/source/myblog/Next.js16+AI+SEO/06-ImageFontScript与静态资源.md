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

图片、字体和第三方脚本都可能在首屏阶段改变布局、堵住主线程或拖慢 LCP。Next.js 的内置组件不只是换个标签写法，它们把尺寸、加载优先级、远程来源和缓存策略都变成了能检查的配置。

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

`src` 写成普通字符串时，必须给 `width` 和 `height`，Next.js 才能在图片下载完之前预留位置，避免 CLS。首屏最大的那张图可以加 `priority`；普通图片默认懒加载，别给列表里每一张图都提优先级。

静态导入会自动带上尺寸：

```tsx
import hero from '@/public/hero.png';

<Image src={hero} alt="产品首页" />;
```

要铺满容器就用 `fill`，但父容器必须有定位和稳定的尺寸：

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

`fill` 并不是不要尺寸了，而是把尺寸交给父容器负责。父容器没有 `aspect-ratio`、固定高度或定位上下文的话，图片照样会让布局不稳。

## 2. 远程图片白名单

远程图片要在 `next.config.ts` 里显式允许：

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

`protocol`、`hostname`、`pathname` 和端口可以一起限制。别用一个过宽的 `**` 放行任意远程来源，不然图片代理就成了没必要的攻击面。开发域名和生产域名不一样的话，要分别加进配置。

Next.js 会根据浏览器的 `Accept`、`sizes` 和设备宽度选合适的 `srcset`，并把 PNG/JPEG 转成 WebP 或 AVIF。`deviceSizes` 和 `imageSizes` 控制候选尺寸，但要配上正确的 `sizes`，浏览器才知道当前布局需要多宽的图。

## 3. 首屏图片和 LCP

LCP 看的是首屏最大的文本或图片什么时候画完。判断图片策略：

| 图片位置 | 策略 |
| --- | --- |
| 首屏 Hero / 主要封面 | `priority` 或当前版本推荐的 preload 方式 |
| 首屏以下的文章列表 | 默认懒加载 |
| 装饰背景 | 先判断是否真的需要图片，避免占用主资源 |
| 不确定宽高的远程图 | 先获取元数据，或使用稳定的 `fill` 容器 |

别拿 `priority` 去掩盖巨大的原图。压缩、格式和尺寸选对了，一般比把所有图片都设成高优先级管用。

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

`next/font` 在构建时处理字体，减少运行时请求，也减少字体切换带来的布局偏移。中文字体一般很大，不能不加筛选就把完整字库塞进首屏；按产品的覆盖范围拆分，或者选合适的子集。

## 5. `next/script`

第三方的统计、聊天或支付脚本，要写明加载策略：

```tsx
import Script from 'next/script';

<Script
  src="https://analytics.example.com/script.js"
  strategy="afterInteractive"
  onLoad={() => console.log('analytics ready')}
/>;
```

常见策略：

- `beforeInteractive`：很少用，只给确实必须在交互前就存在的脚本。
- `afterInteractive`：页面开始可交互后加载，适合统计这类常规脚本。
- `lazyOnload`：浏览器空闲时加载，适合低优先级的资源。
- `worker`：只在项目和当前 Next.js 版本支持时用，先验证第三方脚本兼不兼容。

别把第三方脚本直接写进 `<head>`，也别为了某一个页面才有的功能把脚本放进根布局。加载范围越小，首屏越轻。

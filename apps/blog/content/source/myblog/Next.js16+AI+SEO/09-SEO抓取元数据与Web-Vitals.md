---
title: Next.js 16 SEO：抓取、元数据与 Web Vitals
date: 2026-08-06
updated: 2026-08-06
tags:
  - Next.js 16
  - SEO
  - Metadata
  - JSON-LD
  - Open Graph
  - Web Vitals
source: https://www.bilibili.com/video/BV1P9CxBsEUA?p=2
bvid: BV1P9CxBsEUA
pages: P26-P33
slug: nextjs16-seo-web-vitals
categories:
  - 前端开发
  - Next.js
draft: false
---

# Next.js 16 SEO：抓取、元数据与 Web Vitals

SEO 要做的是让搜索引擎能发现、抓取、理解并正确展示内容，同时让真实用户用得稳、用得快，跟往页面里塞关键词没关系。Next.js 能生成 robots、sitemap、Metadata、JSON-LD 和 Open Graph，但最终效果还是看内容质量、链接结构和性能。

## 1. 搜索引擎的基本链路

搜索过程可以拆成四步：

1. 发现 URL：通过站内链接、外部链接或 sitemap 找到页面。
2. 抓取页面：请求 HTML、资源和允许访问的内容。
3. 建立索引：解析正文、标题、结构化数据和页面之间的关系。
4. 排名与展示：按相关性、质量、体验、权威性和搜索意图展示结果。

所以 SEO 的基础不在某个魔法字段，而在这些：页面能访问，内部链接清楚，URL 稳定，内容真实有用，技术信号正确，性能持续有人盯着。隐藏文字、关键词堆砌、诱导跳转、批量生成低质量页面这些做法都别用。

## 2. `robots.txt`：声明抓取边界

在 App Router 里建 `app/robots.ts`：

```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',
    host: 'https://example.com',
  };
}
```

访问 `/robots.txt` 时，Next.js 会生成文本结果。`userAgent: '*'` 是通用规则，也可以给特定爬虫单独写规则。`disallow` 不是访问控制，保护不了密码、后台数据或私有接口；真正敏感的资源要靠认证和服务端权限控制来保护。

`crawlDelay` 不是所有爬虫都支持，别把它当成通用的流量控制手段。生产环境要检查主域名、协议、部署前缀和 sitemap 地址是不是一致。

## 3. `sitemap.xml`：告诉搜索引擎页面在哪里

静态 sitemap：

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://example.com/about',
      lastModified: '2026-08-01',
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
```

数据库驱动的页面用异步函数：

```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await db.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  });

  return posts.map((post) => ({
    url: `https://example.com/posts/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
}
```

单个 sitemap 的 URL 数量和文件大小都有上限。内容规模很大时用 `generateSitemaps` 拆分，或者交给单独的 sitemap 服务生成索引。只放真实、可索引、返回 200 的 canonical URL，别把登录页、筛选组合和重复的 URL 一股脑塞进去。

## 4. Metadata：标题和描述要反映页面内容

静态页面直接导出 `metadata`：

```ts
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next.js 学习笔记',
  description: '记录 App Router、缓存、认证与部署实践。',
  keywords: ['Next.js', 'React', '全栈开发'],
  alternates: {
    canonical: 'https://example.com/notes',
  },
};
```

动态页面用 `generateMetadata`：

```tsx
import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return { title: '文章不存在' };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `https://example.com/posts/${post.slug}`,
      images: [{ url: post.coverUrl, alt: post.title }],
    },
  };
}
```

布局和页面的 metadata 按层级合并，页面级的字段可以覆盖父级。`title` 还支持 `default`、`template` 和 `absolute`，先定好标题策略，免得出现重复的后缀或者标题太长。生成 metadata 的数据请求要在服务端完成，并和页面数据共用缓存策略。

## 5. JSON-LD：给机器看的结构化语义

结构化数据能帮搜索引擎理解文章、作者、面包屑和产品这些实体。以博客文章为例：

```tsx
type ArticleJsonLdProps = {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  updatedAt: string;
};

export function ArticleJsonLd(props: ArticleJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${props.url}#article`,
    headline: props.title,
    description: props.description,
    url: props.url,
    image: [props.image],
    datePublished: props.publishedAt,
    dateModified: props.updatedAt,
  };

  const safeJson = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
```

这里的 `dangerouslySetInnerHTML` 是把 JSON 放进 script 文本，不是渲染用户的 HTML；动态字符串照样要安全地序列化。别直接拼接 JSON，也别为了搜索结果编造作者、评分、价格或日期。结构化数据要和用户实际看到的页面内容一致，用符合 schema.org 的类型和字段。

## 6. Open Graph 与 Twitter/X 卡片

社交分享需要明确的标题、描述、URL 和图片：

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  openGraph: {
    type: 'website',
    title: 'Next.js 学习笔记',
    description: '从路由到部署的实践记录。',
    url: '/',
    siteName: 'Example Notes',
    images: [
      {
        url: '/og/nextjs.png',
        width: 1200,
        height: 630,
        alt: 'Next.js 学习笔记',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Next.js 学习笔记',
    description: '从路由到部署的实践记录。',
    images: ['/og/nextjs.png'],
  },
};
```

文章页可以用 `type: 'article'`，再补上作者和发布时间。`metadataBase` 让相对的图片路径能解析成绝对 URL；生产域名、协议和图片尺寸都要按真实部署验证。Twitter/X 一般能复用 Open Graph 的信息，要不同的卡片效果时再显式设置 `twitter`。

## 7. Web Vitals：用真实用户体验校验 SEO 基础

常用指标和参考阈值：

| 指标 | 衡量内容 | 良好 |
| --- | --- | --- |
| LCP | 最大内容绘制速度 | 不超过 2.5 秒 |
| INP | 交互响应延迟 | 不超过 200 毫秒 |
| CLS | 累积布局偏移 | 不超过 0.1 |

超过"良好"阈值不代表页面不能用，只是说明还要继续优化；指标要结合设备、网络和真实用户的分布来看。可以用 `web-vitals` 采集浏览器数据：

```tsx
'use client';

import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

function report(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    path: window.location.pathname,
  });

  navigator.sendBeacon('/api/vitals', body);
}

onCLS(report);
onINP(report);
onLCP(report);
```

接收数据的接口要限频、校验字段，别把完整 URL、用户输入或身份信息不加筛选地写进分析系统。实验室工具和真实用户数据各有用处：

- Lighthouse、PageSpeed Insights 适合定位问题
- CrUX 或自建的 RUM 适合观察真实设备
- Search Console 适合检查索引和搜索表现

## 8. 发布前检查清单

- 每个重要页面都有唯一、准确的 title 和 description。
- canonical、语言 URL、站点域名和 Open Graph URL 用同一套规范。
- `robots.txt` 没有误禁首页、CSS、JS 或需要被抓取的公开内容。
- sitemap 只包含公开、规范、能访问的 URL。
- JSON-LD 和页面可见内容一致，并通过了结构化数据测试。
- 首屏图片有稳定的尺寸，字体和第三方脚本不会造成明显的布局偏移。
- 在真实设备上检查 LCP、INP、CLS，不要只看本地开发环境。

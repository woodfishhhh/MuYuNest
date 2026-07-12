---
title: "CSS 学习笔记（6）：小兔鲜儿项目搭建及基础配置（目录结构、SEO 标签、版心设置）"
date: 2025-09-21 23:32:03
tags:
  - "前端开发"
  - "小兔鲜儿项目搭建"
  - "SEO 标签"
  - "版心设置"
  - "HTML"
categories:
  - "前端开发"
  - "CSS"
---


## 01-搭建项目目录

![1680342815532](D:\BaiduNetdiskDownload\Day01-10基础班课程资料\基础班课程资料\笔记\day09\assets\1680342815532.png)

* xtx-pc
  * images 文件夹：存放固定使用的图片素材，例如：logo、样式修饰图等等
  * uploads 文件夹：存放非固定使用的图片素材，例如：商品图、宣传图需要上传的图片
  * iconfont 文件夹：字体图标素材
  * css 文件夹：存放 CSS 文件（link 标签引入）
    * base.css：基础公共样式
    * common.css：各个网页相同模块的重复样式，例如：头部、底部
    * index.css：首页 CSS 样式
  * index.html：首页 HTML 文件

### 引入样式表

```html
<link rel="stylesheet" href="./iconfont/iconfont.css">
<link rel="stylesheet" href="./css/base.css">
<link rel="stylesheet" href="./css/common.css">
<link rel="stylesheet" href="./css/index.css">
```

## 02-网页头部SEO三大标签

SEO：搜索引擎优化，提升网站百度搜索排名

提升SEO的常见方法：

1. 竞价排名
2. 将网页制作成html后缀
3. 标签语义化（在合适的地方使用合适的标签）
4. ……

网页头部 SEO 标签：

* title：网页标题标签
* description：网页描述
* keywords：网页关键词

![1680342859110](D:\BaiduNetdiskDownload\Day01-10基础班课程资料\基础班课程资料\笔记\day09\assets\1680342859110.png)

```html
<!-- meta:desc -->
<meta name="description" content="小兔鲜儿官网，致力于打造全球最大的食品、生鲜电商购物平台。">
<!-- meta:kw -->
<meta name="keywords" content="小兔鲜儿,食品,生鲜,服装,家电,电商,购物">
<title>小兔鲜儿-新鲜、惠民、快捷！</title>
```

## 03-Favicon图标

![1680342897355](D:\BaiduNetdiskDownload\Day01-10基础班课程资料\基础班课程资料\笔记\day09\assets\1680342897355.png)

Favicon 图标：网页图标，出现在浏览器标题栏，增加网站辨识度。

图标：**favicon.ico**，一般存放到网站的**根目录**里面

![1680342907910](D:\BaiduNetdiskDownload\Day01-10基础班课程资料\基础班课程资料\笔记\day09\assets\1680342907910.png)

```html
<!-- link:favicon -->
<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
```

## 04-版心

> common.css

```css
/* 版心 */
.wrapper {
  margin: 0 auto;
  width: 1240px;
}
```

##
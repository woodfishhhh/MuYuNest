---
title: "CSS 学习笔记（7）：CSS 优先级叠加计算规则详解"
date: 2025-09-21 23:32:09
tags:
  - "前端开发"
  - "CSS"
  - "选择器"
  - "前端基础"
categories:
  - "前端开发"
  - "CSS"
---


### 一、权重计算规则

**公式：行内样式 (1,0,0,0) > ID 选择器 (0,1,0,0) > 类选择器 (0,0,1,0) > 标签选择器 (0,0,0,1)**
每一级之间不存在进位，例如 10 个类选择器的权重仍低于 1 个 ID 选择器。

### 二、示例：不同选择器组合的优先级比较

```html
<style>
  /* 选择器1：权重 (0,1,0,0) */
  #title {
    color: red;
  }

  /* 选择器2：权重 (0,0,2,0) */
  .section .heading {
    color: blue;
  }

  /* 选择器3：权重 (0,0,1,1) */
  div.content {
    color: green;
  }

  /* 选择器4：权重 (0,0,0,2) */
  div p {
    color: purple;
  }
</style>

<div class="section">
  <h1 id="title" class="heading">标题</h1> <!-- 应用选择器1 (红色) -->
  <div class="content">
    <p>段落内容</p> <!-- 应用选择器3 (绿色) -->
  </div>
</div>
```

### 三、优先级比较步骤

1. **比较行内样式**：若存在行内样式，则直接胜出。
2. **比较 ID 选择器数量**：数量多的优先级高。
3. **比较类选择器数量**：若 ID 数量相同，则比较类选择器数量。
4. **比较标签选择器数量**：若类数量也相同，则比较标签选择器数量。

### 四、复合选择器的权重计算

```html
<style>
  /* 选择器A：权重 (0,1,1,1) */
  div#main.container {
    background-color: yellow;
  }

  /* 选择器B：权重 (0,0,3,0) */
  .header .nav .link {
    color: cyan;
  }

  /* 选择器C：权重 (0,0,2,2) */
  div.container p.text {
    font-size: 18px;
  }
</style>

<div id="main" class="container header">
  <nav class="nav">
    <a href="#" class="link">链接</a> <!-- 应用选择器B (青色) -->
  </nav>
  <p class="text">内容</p> <!-- 应用选择器C (18px) -->
</div>
```

### 五、!important 和 继承的特殊规则

1. **!important**：

   ```css
   p {
     color: orange !important; /* 覆盖所有其他规则，即使权重更低 */
   }
   ```

2. **继承**：

   ```html
   <body style="color: gray;">
     <p>继承的文本颜色 (权重最低)</p>
     <p class="local">应用类样式 (优先于继承)</p>
   </body>
   <style>
     .local {
       color: black;
     }
   </style>
   ```
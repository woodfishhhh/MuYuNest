---
title: "CSS 选择器、层叠优先级与盒模型"
slug: "css-selectors-cascade-and-box-model"
date: 2025-11-03 13:13:52
categories:
  - "前端开发"
tags:
  - "CSS"
  - "选择器"
  - "优先级"
  - "盒模型"
  - "BFC"
---

样式写上去却不生效、多写一个空格选中了完全不同的节点、给盒子加完 `padding` 页面直接撑爆换行——这些问题几乎都卡在选择器匹配规则、层叠权重和盒模型计算上。把这三块底层规则拆清楚，写样式和排查覆盖冲突都会直接得多。

## 选择器类型与空格差异

基础选择器包括通配符 `*`、标签选择器（如 `p`）、类选择器（`.card`）和 ID 选择器（`#header`）。实际页面里很少裸用标签选择器（容易误伤全局同名标签），大多用复合选择器收窄命中范围：

| 选择器类型 | 语法示例 | 匹配范围 |
| --- | --- | --- |
| 后代选择器 | `.banner p` | `.banner` 内部所有层级的 `<p>`（含子级、孙级） |
| 子代选择器 | `.banner > p` | 仅 `.banner` 的直接子元素 `<p>` |
| 并集选择器 | `h1, h2, .title` | 同时选中多组元素，共享同一套声明 |
| 交集选择器 | `a.modify` | 同时满足“是 `<a>` 标签”且“带有 `modify` 类”的元素 |

**复合选择器中，“有没有空格”会直接改变整个匹配语义，是最常见的手误来源。**

| 写法 | 含义 | 命中的 HTML 结构 |
| --- | --- | --- |
| `.recommend a.modify` | 选中自身带有 `modify` 类的 `<a>` | `<div class="recommend"><a class="modify">修改</a></div>` |
| `.recommend a .modify` | 选中 `<a>` 内部带有 `modify` 类的后代 | `<div class="recommend"><a><span class="modify">修改</span></a></div>` |

写伪类选择器时也要留意状态顺序。`:hover` 可用于任何元素，若同时给超链接配置四种状态，必须严格遵守 **LVHA 顺序**（`:link` → `:visited` → `:hover` → `:active`），否则后面相同权重的规则会覆盖前面；日常业务里通常只写默认 `a` 样式加 `a:hover`。

结构伪类（`:first-child`、`:last-child`、`:nth-child(An+B)`）按父容器下所有子元素的总序号匹配：

- `2n` / `even`：偶数项；`2n+1` / `odd`：奇数项
- `n+5`：第 5 个及之后；`-n+5`：前 5 个

伪元素 `::before` 与 `::after` 会在宿主元素内部首尾插入虚拟行内节点，用来放小图标、清除浮动或绘制装饰角标：

```css
.badge::before {
  content: ""; /* 必须声明 content（哪怕为空字符串），否则伪元素不会渲染 */
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background-color: #10b981;
}
```

## CSS 三大特性与权重叠加计算

CSS（层叠样式表）通过**继承性**、**层叠性**和**优先级**共同决定每个属性的最终取值：

1. **继承性**：文字控制属性（`color`、`font-size`、`font-weight`、`line-height`、`text-align` 等）默认由子元素继承自父级；盒模型尺寸与边框属性（`width`、`margin`、`padding`、`border`）不继承。如果标签本身带有浏览器默认样式（如 `<h1>` 的字号、`<a>` 的颜色），优先应用自身样式而非继承值。
2. **层叠性**：同一元素命中多条规则时，不同属性相互叠加，相同属性在权重相等时“后者覆盖前者”。

当多个选择器同时命中同一个元素时，浏览器按 4 元组 `(行内样式, ID 选择器个数, 类/伪类/属性选择器个数, 标签/伪元素选择器个数)` 从左到右逐位比较优先级：

| 选择器写法 | 权重元组 `(行内, ID, 类/伪类, 标签/伪元素)` | 说明 |
| --- | --- | --- |
| `*` / 继承样式 | `(0, 0, 0, 0)` | 继承权重最低，低于任何直接选中规则 |
| `div p` | `(0, 0, 0, 2)` | 2 个标签选择器 |
| `div.content` | `(0, 0, 1, 1)` | 1 个类 + 1 个标签 |
| `.header .nav .link` | `(0, 0, 3, 0)` | 3 个类选择器 |
| `div#main.container` | `(0, 1, 1, 1)` | 1 个 ID + 1 个类 + 1 个标签 |
| `style="..."` | `(1, 0, 0, 0)` | 行内样式 |

**权重比较采用“逐位对比、永不进位”规则：100 个类选择器 `(0, 0, 100, 0)` 的权重依然低于 1 个 ID 选择器 `(0, 1, 0, 0)`。**

`!important` 会直接覆盖所有常规选择器声明（除同样带 `!important` 且权重更高的声明外）。工程实践里应避免用 `#id` 写样式，也尽量不要滥用 `!important`，保持类选择器的扁平组合（如 BEM 或原子类）才容易维护。

## 文本排版与背景控制要点

文字控制与背景配置里有几条直接影响页面对齐和渲染的细节：

- **无单位 `line-height`**：优先写 `line-height: 1.5` 这类无单位倍数（相对当前元素 `font-size` 计算），避免子元素继承固定 `px` 行高后出现文字重叠。单行文字垂直居中可令 `line-height` 等于盒子高度。
- **`text-align` 作用对象**：`text-align: center` 设在块级父容器上，控制内部文本和行内/行内块元素的水平对齐；块级元素自身水平居中需要设置明确宽度并配合 `margin: 0 auto`。
- **`font` 与 `background` 简写重置陷阱**：复合属性会重置所有未显式声明的子属性。例如 `font` 简写必须包含 `font-size` 和 `font-family` 才生效；`background` 简写中 `background-position / background-size` 必须用斜杠 `/` 连接：

```css
.hero-card {
  width: 400px;
  height: 240px;
  background: #0f172a url("./banner.webp") no-repeat center center / cover;
}
```

其中 `background-size: cover` 按比例缩放直到填满整个容器（图片边缘可能被裁切），`contain` 则保证整张图片完整显示在容器内（容器边缘可能留白）。

## 盒模型、外边距折叠与 BFC

每个 HTML 元素在布局时都被抽象为一个矩形盒子，由内向外依次是：**内容区（content）**、**内边距（padding）**、**边框（border）** 和 **外边距（margin）**。

**默认 `content-box` 下，设置的 `width`/`height` 仅代表内容区尺寸；只要追加了 `padding` 或 `border`，盒子实际占位就会变大，极易挤乱固定宽度的多列布局。**

统一在全局 Reset 中启用 `box-sizing: border-box`（内减模式），浏览器会自动从设定的总宽高中扣除 `padding` 和 `border`，确保盒子对外尺寸严格受控：

```css
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

多值简写规则统一遵循“从上开始顺时针（上 → 右 → 下 → 左），缺边取对边”：

- 1 个值：四边相同（`padding: 16px`）
- 2 个值：上下 / 左右（`margin: 12px auto`）
- 3 个值：上 / 左右 / 下（`padding: 10px 20px 16px`）
- 4 个值：上 / 右 / 下 / 左

实际布局中还要处理三类常见盒模型边界问题：

1. **相邻块元素垂直 `margin` 合并**：垂直排列的兄弟盒子，上面设 `margin-bottom: 30px`、下面设 `margin-top: 20px`，最终间距不会叠加为 `50px`，直接合并取较大值 `30px`（水平方向不合并）。
2. **父子元素垂直 `margin` 塌陷**：当父容器没有上边框和上内边距时，第一个子元素设置 `margin-top: 40px` 会直接“穿透”父容器，带着父容器一起向下偏移 `40px`。
3. **行内元素垂直边距不撑开布局**：给 `span`、`a` 设置 `margin-top/bottom` 或 `padding-top/bottom` 无法改变它在垂直方向上的占位高度（视觉背景可能溢出），需改用 `line-height` 或转为 `inline-block` / `block`。

解决父子 `margin` 塌陷与相邻边距干扰，工程上依赖 **BFC（块级格式化上下文，Block Formatting Context）**——BFC 是一块独立的渲染区域，内部元素的布局不会影响外部。常用触发 BFC 的方式包括：

- 给父容器设置 `overflow: hidden` 或 `overflow: auto`（注意 `hidden` 会裁掉溢出内容，有下拉浮层或阴影时慎用）
- 给父容器设置 `display: flow-root`（现代 CSS 中专为触发 BFC 设计、且完全无裁剪副作用的首选属性）
- 给父容器加 `border-top` 或改用父级 `padding-top` 替代子级 `margin-top`
- 父容器本身为 Flex 或 Grid 容器（子元素自动进入独立的 Flex/Grid 格式化上下文，不再触发外边距塌陷）

```css
/* 现代无副作用隔离塌陷与清浮：display: flow-root */
.card-group {
  display: flow-root;
  background-color: #f8fafc;
}

.card-group .first-item {
  margin-top: 24px; /* 不会穿透带动 .card-group 整体下移 */
}
```

圆角与阴影也依附在盒模型边界上：`border-radius: 50%` 可将正方形裁成正圆，将圆角设为长方形高度的一半可得胶囊按钮；`box-shadow: x偏移 y偏移 模糊半径 扩散半径 颜色 [inset]` 中前两个偏移量必填，加上 `inset` 则变为内阴影。

## 溢出控制与基础样式初始化

当内容超出固定容器尺寸时，通过 `overflow` 控制裁剪或滚动行为：

| 属性值 | 表现行为 | 适用场景 |
| --- | --- | --- |
| `visible` | 默认值，内容溢出容器框外正常渲染 | 允许角标、阴影、浮层超出边界 |
| `hidden` | 裁掉超出部分，不出现滚动条 | 图片裁切、轮播容器遮罩、阻止内容撑破布局 |
| `scroll` | 无论是否溢出，始终显示滚动条轨道 | 需要固定滚动条占位的特殊区域 |
| `auto` | 仅在内容真正溢出时显示滚动条 | 弹窗正文、代码框、侧边栏列表 |

在接手或初始化原生样式项目时，除了统一 `box-sizing: border-box`、清除列表符号 `li { list-style: none; }` 与链接下划线 `a { text-decoration: none; }`，使用 `overflow: hidden` 搭配定宽和 `border-radius` 就能安全控制大多数卡片边界。如果同时需要单行省略号，则应组合 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` 并确保元素拥有明确宽度（或处于 `flex: 1; min-width: 0;` 约束下）。

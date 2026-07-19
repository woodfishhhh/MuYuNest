---
title: "CSS 学习笔记（1）：引入方式、选择器及文字样式控制"
date: 2025-09-21 23:32:52
tags:
  - "前端开发"
  - "引入方式"
  - "选择器"
  - "文字样式控制"
  - "HTML"
categories:
  - "前端开发"
  - "CSS"
---


层叠样式表 (Cascading Style Sheets, 缩写为 CSS) ，是一种 样式表 语言，用来描述 HTML 文档的呈现（美化内容）。

书写位置：title 标签下方添加 style 双标签，style 标签里面书写 CSS 代码。

```html
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>初识CSS</title>
		<style>
			/* css代码 */
			/* 属性名字和属性值成对出现，键值对 */
			p {
				/* 选择器 */
				color: red;
				/* 颜色 */
				font-size: 90px;
				/* 字体大小 */
			}
		</style>
	</head>
```

### CSS引入方式

- 内部样式表：学习使用
  - CSS 代码写在 `style` 标签里面
- 外部样式表：开发使用
  - CSS 代码写在单独的 CSS 文件中（`.css`）
  - 在 HTML 使用 `link` 标签引入

```html
<link rel="stylesheet" href="./my.css">s
```

- 行内样式：配合JavaScript使用

```html
<div style="color: red; font-size:20px;">这是 div 标签</div>
```

```html
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>Document</title>
		<link
			rel="stylesheet"
			href="./02.css" />
	</head>
	<body>
		<!-- 这里是外部样式表 -->
		<p>我是木鱼</p>
		<!-- 这里是行内样式 -->
		<div style="color: yellow; font-size: larger">this is woodfish</div>
	</body>
```

```css
/* 这里是css代码 */
/* 选择器，空格，大括号 */
p {
	color: teal;
}
```


### 选择器

作用：查找标签，设置样式

#### 基础选择器

- 标签选择器
- 类选择器
- id 选择器
- 通配符选择器


##### 标签选择器

使用**标签名**作为选择器 -> 选中**同名标签**设置相同样式

例如上面的代码，所有的p标签都会被设置成蓝绿色

特点：选中同名标签设置相同的样式，无法差异化同名标签的样式

##### 类选择器

作用：查找标签，**差异化**设置标签的显示效果

步骤：

- 定义类选择器  -> **.类名**
- 使用类选择器  -> 标签添加class="类名"

```html
		<style>
			.red {
				color: red;
			}
			.size {
				font-size: 50px;
			}
		</style>
	</head>
	<body>
        <!-- 一个类选择器可以给多个标签使用 -->
        <!-- 一个标签可以用多个类，class写多个类名，空格隔开 -->
		<p class="size">nihao</p>
		<p class="red size">qwerty</p>
		<div class="red">this is div</div>
	</body>
```

开发时，类名需要见名直意，多个单词用 **-** 链接

##### id选择器

作用：查找标签，差异化设置标签的显示效果。
场景：id 选择器一般配合 JavaScript 使用，很少用来设置 CSS 样式

步骤：

- 定义 id 选择器 → `#id名`
- 使用 id 选择器 → 标签添加 `id="id名"`

```html
<style> 
  /* 定义 id 选择器 */
  #red {
    color: red;
  }
</style>

<!-- 使用 id 选择器 -->
<div id="red">这是 div 标签</div>
```

规则：

- 同一个 id 选择器在一个页面只能使用一次

##### 通配符选择器

作用：查找页面**所有标签**，设置相同样式

语法与特性：

通配符选择器为 `*` ，无需手动调用，浏览器会**自动遍历页面所有标签**并应用样式

```css
* {  
  color: red;  
}  
```

上述代码会让页面中所有 HTML 标签（如 `<div>`、`<p>`、`<h1>` 等）的文字颜色变为红色，常用于初始化全局样式（如统一内外边距 `margin`/`padding` 等场景，把文字间距样式去掉 ）

### 画盒子

目标：使用合适的选择器画盒子

| 属性名           | 作用   |
| ---------------- | ------ |
| width            | 宽度   |
| height           | 高度   |
| background-color | 背景色 |

```html
		<style>
			.red {
				background-color: red; /*背景颜色*/
				width: 100px; /*宽度*/
				height: 100px; /*高度*/
			}
			.blue {
				background-color: blue;
				width: 200px;
				height: 200px;
			}
		</style>
	</head>
	<body>
		<div class="red">div1</div>
		<div class="blue">div2</div>
		<div>div3</div>
	</body>
```

### 文字控制属性

![](https://www.woodfishhhh.xyz/images/67b9f8350206642c4f5109aee39f403.png?_t=1750746827875)

| 属性                            | 作用                   | 属性值（常见）                                               | 示例代码                                                    | 注意事项                                                     |
| ------------------------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| `font-size`（字体大小）         | 控制字体大小           | `px`（像素，如 `16px` ）、`em`（相对父元素，如 `1.2em` ）、`rem`（相对根元素，如 `1.5rem` ）、`%`（百分比，如 `120%` ）等 | `font-size: 16px;`                                          | 不同单位适配场景不同，`rem` 常用于响应式；避免字体过小影响可读性 |
| `font-weight`（字体粗细）       | 控制字体粗细           | `normal`（正常，相当于 `400` ）、`bold`（加粗，相当于 `700` ）、`100`-`900`（数值，数值越大越粗 ） | `font-weight: bold;` / `font-weight: 700;`                  | 并非所有字体都支持全范围数值，需搭配实际字体文件；`bold` 兼容性更普适 |
| `font-style`（字体倾斜）        | 控制字体倾斜           | `normal`（正常）、`italic`（斜体，基于字体的倾斜样式 ）、`oblique`（强制倾斜，无对应字体时模拟 ） | `font-style: italic;`                                       | `italic` 依赖字体本身，`oblique` 是 “假倾斜”，优先用 `italic` |
| `line-height`（行高）           | 控制行高（行间距）     | `px`（固定值，如 `24px` ）、`em`（相对字体大小，如 `1.5em` ）、`%`（百分比，如 `150%` ）、`normal`（默认，由浏览器计算 ） | `line-height: 1.5;`（无单位时，相对于 `font-size` ）        | 无单位值（如 `1.5` ）更灵活，适配字体变化；行高影响多行文本垂直居中效果 |
| `font-family`（字体族）         | 设置字体族（优先顺序） | 字体名称（如 `'Microsoft YaHei'` ）、通用字体（`serif` 衬线、`sans-serif` 无衬线、`monospace` 等宽 ） | `font-family: 'Microsoft YaHei', sans-serif;`               | 多字体 fallback 设计，避免字体缺失；中文字体名含空格需加引号 |
| `font`（字体复合属性）          | 字体复合属性（简写）   | 按顺序：`font-style font-weight font-size/line-height font-family`（可省略部分值，保留 `size` 和 `family` 必传 ） | `font: italic bold 16px/1.5 'Microsoft YaHei', sans-serif;` | 简写需遵循顺序；省略的值会重置为默认，如需保留原样式，建议单独写属性 |
| `text-indent`（文本缩进）       | 控制文本首行缩进       | `px`（如 `20px` ）、`em`（如 `2em` ，常用，缩进 2 个字符宽度 ）、`%`（相对父元素宽度 ） | `text-indent: 2em;`                                         | 仅对块级元素（如 `p` `div` ）生效；`em` 单位适配字体变化更自然 |
| `text-align`（文本对齐）        | 控制文本水平对齐       | `left`（左对齐 ）、`center`（居中 ）、`right`（右对齐 ）、`justify`（两端对齐，需多行文本 ） | `text-align: center;`                                       | 作用于块级元素，控制内部**行内元素 / 文本**的水平对齐；`justify` 需文本足够长才明显 |
| `text-decoration`（文本装饰线） | 控制文本装饰线         | `none`（无装饰 ）、`underline`（下划线 ）、`overline`（上划线 ）、`line-through`（删除线 ） | `text-decoration: underline;`                               | 可组合使用（如 `underline overline` ）；`a` 标签默认 `underline` ，常需 `none` 清除 |
| `color`（颜色）                 | 控制文本颜色           | 颜色关键字（如 `red` ）、十六进制（如 `#ff0000` ）、`rgb/rgba`（如 `rgb(255,0,0)` 、`rgba(255,0,0,0.5)` ） | `color: #ff0000;` / `color: rgba(255,0,0,0.5);`             | `rgba` 含透明度通道，需考虑浏览器兼容性（现代浏览器基本支持 ）；区分文本色与背景色对比，保障可读性 |

#### 行高

如果有单位px时，按照像素值来

没有单位时，表示是当前标签字体大小(font-size)的倍数

标签`line-height`

```html
		<style>
			p {
				line-height: 2;
			}
		</style>
	</head>
	<body>
		<p>
			白宫确认伊朗三处核设施已被彻底摧毁，包括福尔多、纳坦兹和伊斯法罕的关键核设施。美方动用 7架B-2轰炸机执行此次行动，创下该机型最大规模出战纪录。白宫强调对袭击结果高度确信，并称特朗普仍寻求通过外交途径解决伊朗问题，但未放弃政权更迭的言论。特朗普在社交媒体公开质疑伊朗现政权，暗示支持政权更迭的可能性。
		</p>
	</body>
```

![](https://www.woodfishhhh.xyz/images/3ec27e0bfc041922a79738708c33fd1.png?_t=1750750291761)

测量行高：从一行文字的最顶(最底)测量到下一行文字的最顶(最底)

垂直居中技巧：行高属性值等于盒子高度属性值（只适用于单行文字）

#### font复合字体属性

能看懂别人写的什么玩意就行，自己少写

字号和字体必须写，否则不生效

font 属性 : 是否倾斜，是否加粗，字号/行高，字体

```html
		<style>
			div {
				/* font 属性 : 是否倾斜，是否加粗，字号/行高，字体 */
				font: normal normal 16px/1.5 "Courier New", Courier, monospace;
			}
		</style>
	</head>
	<body>
		<div>qwertyuiopasdfghjklzxcvbnm</div>
	</body>
```

用来在网页开发初期，设置网页公共样式

#### 缩进

```html
		<style>
			p {
				text-indent: 2em;
			}
		</style>
```

#### 文本对齐

控制对齐方式

属性名字：text-align

| 属性值     | 效果           |
| ---------- | -------------- |
| left       | 左对齐（默认） |
| **center** | 居中对齐       |
| right      | 右对齐         |

```html
		<style>
			h1 {
				text-align: center;
				color: beige;
			}
			p {
				text-align: center; /*居中了*/
				text-indent: 2em;
			}
		</style>
	</head>
	<body>
		<h1>我是木鱼！</h1>
		<p>qwertyuiopasdfghjklzxcvbnm</p>
	</body>
```

text-align本质是控制内容的对齐方式，属性要设置给内容的父级

所以可以以此给图片等物品居中(使需要的元素包裹在div中之后使用居中)

```html
		<style>
			.to_center {
				text-align: center;
			}
		</style>
	</head>
	<body>
		<div class="to_center">
			<img
				src="../pic/头像.jpg"alt="" />
		</div>
	</body>
```

#### 文本装饰线

text-decoration

可以去掉网页 a 的下划线

```html
		<style>
			a {
				/* 无，去掉修饰线 */
				text-decoration: none;
			}
			div {
				/* 下划线 */
				text-decoration: underline;
			}
			p {
				text-decoration: line-through;
			}
			span {
				text-decoration: overline;
			}
		</style>
	</head>
	<body>
		<a href="#">a 标签，去掉下划线</a>
		<div>div 标签，添加下划线</div>
		<p>p 标签，添加删除线</p>
		<span>span 标签，添加顶划线</span>
	</body>
```

#### 颜色

属性名：color

属性值

| 颜色表示方式   | 属性值             | 说明                                       | 使用场景                 |
| -------------- | ------------------ | ------------------------------------------ | ------------------------ |
| 颜色关键字     | 颜色英文单词       | **red**、**green**、**blue**...            | 学习测试                 |
| rgb 表示法     | `rgb(r, g, b)`     | r,g,b 表示红绿蓝三原色，取值：**0 - 255**  | 了解                     |
| rgba 表示法    | `rgba(r, g, b, a)` | a 表示**透明度**，取值：**0 - 1**          | 开发使用，实现透明色     |
| 十六进制表示法 | `#RRGGBB`          | `#000000`，`#ffcc00`，简写：`#000`，`#fc0` | 开发使用（从设计稿复制） |

```html
		<style>
			h1 {
				background-color: cadetblue;
				/* color: rgba(0, 0, 255, 0.2); */
				/* color:cadetblue; */
				/* color: rgb(0, 255, 0); */
				color: #00ff80;
				text-align: center;
			}
		</style>
	</head>
	<body>
		<h1>我是木鱼!</h1>
	</body>
```


### 案例

#### 新闻稿

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>Document</title>
		<style>
			h1 {
				text-align: center;
				font-weight: 400;
				font-size: 30px;
				color: #333333;
			}
			div {
				font-size: 14px;
				color: #999999;
			}
			p {
				font-size: 18px;
				color: #333333;
				text-indent: 2em;
			}
			.pic {
				width: 100%;
				height: auto;
				display: block;
				text-align: center;
			}
		</style>
	</head>
	<body>
		<h1>在希望的田野上|湖北秋收开镰</h1>
		<div>来源：央视网|2022年5月6日 12:12:12</div>
		<p>
			<strong>央视网消息</strong>
			：眼下，湖北省秋收开镰已有一周多的时间。水稻收割已经超过四成，玉米收割七成。湖北省通过大力推广新品种水稻，建设高标准农田等一系列措施，为秋粮稳产提供有力支撑。
		</p>
		<p>中稻占据了湖北全年粮食产量的一半以上。在湖北的主产区荆门市，370万亩中稻已经收割四成以上。</p>
		<div class="pic">
			<img
				src="../pic/2022092014091982314.jpg"
				alt="" />
		</div>
		<p>
			王化林说的新品种，是湖北省研发的杂交水稻“华夏香丝”，不仅产量高，还具有抗病、抗倒、抗高温的特性。在荆门漳河镇的一工程示范田内，像“华夏香丝”这样抗旱节水的品种还有20多个，这些水稻新品将在荆门全面推广，确保来年增产增收。
		</p>
		<p>
			此外，湖北还大力推进高标准农田建设。截至今年6月，已建成3980万亩高标准农田。目前，湖北全省仍有1800多万亩中稻正在有序收割中，预计10月中旬收割完毕。
		</p>
	</body>
</html>

```

#### CSS简介

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>Document</title>
		<style>
			h1 {
				color: #333333;
			}
			p {
				color: #444444;
			}
			div {
				font-size: 14px;
				line-height: 30px;
			}

			.link_color {
				color: #0069c2;
			}
		</style>
	</head>
	<body>
		<h1>CSS（层叠样式表）</h1>
		<div>
			<p>
				层叠样式表（Cascading Style Sheets，缩写为 CSS），是一种
				<a
					href="#"
					class="link_color"
					>样式表</a
				>
				语言，用来描述 HTML 或 XML（包括如 SVG、MathML、XHTML 之类的 XML 分支语言）文档的呈现。CSS
				描述了在屏幕、纸质、音频等其它媒体上的元素应该如何被渲染的问题。
			</p>
			<p>
				<strong>CSS 是开放网络的核心语言之一</strong>，由 W3C 规范
				实现跨浏览器的标准化。CSS节省了大量的工作。样式可以通过定义保存在外部.css文件中，同时控制多个网页的布局，这意味着开发者不必经历在所有网页上编辑布局的麻烦。CSS被分为不同等级：CSS1
				现已废弃，CSS2.1 是推荐标准，CSS3 分成多个小模块且正在标准化中。
			</p>
			<ul>
				<li>
					CSS 介绍 如果你是 Web 开发的新手，请务必阅读我们的 CSS 基础文章以学习 CSS 的含义和用法。
				</li>
				<li>
					CSS 教程 我们的 CSS 学习区 包含了丰富的教程，它们覆盖了全部基础知识，能使你在 CSS
					之路上从初出茅庐到游刃有余。
				</li>
				<li>
					CSS 参考 针对资深 Web 开发者的
					<a
						href="#"
						class="link_color"
						>详细参考手册</a
					>，描述了 CSS 的各个属性与概念。
				</li>
			</ul>
		</div>
	</body>
</html>

```

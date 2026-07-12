---
title: "CSS 学习笔记（5）：定位模式、CSS 精灵、字体图标及过渡效果应用"
date: 2025-09-21 23:32:47
tags:
  - "前端开发"
  - "定位模式"
  - "CSS 精灵"
  - "字体图标"
  - "过渡效果应用"
categories:
  - "前端开发"
  - "CSS"
---


### 定位

作用：灵活改变盒子在网页的位置

实现：
1. 定位模式：**position**
2. 边偏移：设置盒子的位置
- left
- right
- top
- bottom

### 相对定位 relative

```css
			div {
				position: relative;
				bottom: 100px;
				left: 100px;
			}
			div img {
				width: 200px;
				height: 200px;
			}
```

**！修改位置的参照物是自己原来的位置**

**不脱标，而且占位，而且不改变原来的显示模式**

可以看到div的横方向非常大，导致屏幕最下方出现滑动条


### 绝对定位 absolute

使用场景：子级绝对定位，父级相对定位（子绝父相）（子级的位置无论怎么改变都在父级里面，不超出父级范围）

**特点：**

1. 脱标，不占位
2. 参照物：先找最近的已经定位的祖先元素；如果所有祖先元素都没有定位，参照浏览器可视区改位置
3. 显示模式特点改变：宽高生效（**具备了行内块的特点**）

![](https://www.woodfishhhh.xyz/images/b979955eb5f83d7d47b802455908fdd.png?_t=1751419656537)

```html
		<style>
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}
			img {
				width: 400px;
			}
			.news {
				margin: 100px auto;
				width: 400px;
				height: 350px;
				background-color: #f8f8f8;

				position: relative; /* 相对定位 */
			}
			.news span {
				display: block;
				width: 92px;
				height: 32px;
				background-color: rgba(0, 0, 0, 0.6);
				text-align: center;
				line-height: 32px;
				color: #fff;

				position: absolute; /* 绝对定位 */
				top: 0px; /* 相对于父元素*/
				right: 0px;
			}
		</style>
	</head>
	<body>
		<div class="news">
			<img
				src="../pic/头像.jpg"
				alt="" />
			<span>展会活动</span>
			<h4>2025世界移动大会</h4>
		</div>
	</body>
```

注意，如果父级没有设置position ：relative，那么会去找爷爷级等更高级设置top等距离。如果还没有的话会相对于浏览器设置。


#### 定位居中

实现步骤：

1. 绝对定位
2. 水平、垂直边偏移为 50%
3. 子级向左、上移动自身尺寸的一半
   - 左、上的外边距为 - 尺寸的一半
   - `transform: translate(-50%, -50%)`

```html
		<style>
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
				width: 1200px;
			}
			.so {
				position: absolute;
				left: 50%;
				top: 50%; /* 现在可以正常生效 */

				transform: translate(-50%, -50%);
				/*
                transform: translate(-50%, -50%);
                这句话的意思是：把元素向左和上移动自身宽度和高度的 50%。
                这样就把原本以“左上角”为基准的定位，调整为以“中心点”为基准的定位。
                */

				width: 400px;
				height: 400px;
				background-color: grey;
			}
		</style>
	</head>
	<body>
		<div class="so"></div>
	</body>
```

### 固定定位 fixed

position：fixed

场景：元素的位置在网页滚动时不会改变（广告栏，头部栏）

```css
/*
1. 脱标，不占位 
2. 参照物：浏览器窗口 
3. 显示模式特点 具备行内块特点 
*/
div {
  position: fixed;
    
  top: 0;
  right: 0;
  width: 500px;
}
```

###

### 堆叠层级 z-index

默认效果：按照标签书写顺序，后来者居上

作用：设置定位元素的层级顺序，改变定位元素的显示顺序

**z-index的值越大，就越优先显示**

```html
		<style>
			.box1 {
				background-color: red;
				width: 200px;
				height: 200px;
				position: absolute;
				top: 50px;
				left: 50px;
				z-index: 1;
			}

			.box2 {
				background-color: blue;
				width: 200px;
				height: 200px;
				position: absolute;
			}
		</style>
	</head>
	<body>
		<div class="box1"></div>
		<div class="box2"></div>
```


### 定位-总结

| 定位模式 | 属性值   | 是否脱标 | 显示模式             | 参照物                                |
| -------- | -------- | -------- | -------------------- | ------------------------------------- |
| 相对定位 | relative | 否       | 保持标签原有显示模式 | 自己原来位置                          |
| 绝对定位 | absolute | 是       | 行内块特点           | 1. 已经定位的祖先元素 2. 浏览器可视区 |
| 固定定位 | fixed    | 是       | 行内块特点           | 浏览器窗口                            |


### CSS精灵

CSS 精灵，也叫 CSS Sprites，是一种网页图片应用处理方式。把网页中一些背景图片整合到一张图片文件中，再用 background-position 精确的定位出背景图片的位置。

优点：减少服务器被请求次数，减轻服务器的压力，提高页面加载速度

实现步骤:
1. 创建盒子，盒子尺寸与小图尺寸相同
2. 设置盒子背景图为精灵图
3. 添加 background-position 属性，改变背景图位置
    3.1 使用 PxCook 测量小图片左上角坐标
    3.2 取负数坐标为 background-position 属性值（向左上移动图片位置）

#### 样例：京东服务

```html
		<style>
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}
			li {
				list-style: none;
			}

			.service {
				width: 1188px;
				height: 42px;
				margin: 100px auto;
			}

			.service ul {
				display: flex;
			}

			.service li {
				flex: 1;
				text-align: center;
				display: flex;
				padding-left: 40px;
			}

			.service li h5 {
				width: 36px;
				height: 42px;
				background-image: url(./images/sprite.png);
				background-repeat: no-repeat;

				font-size: 0px;
			}
			.icon-1 {
				background-position: 0 -192px;
			}

			.icon-2 {
				background-position: -41px -192px;
			}

			.icon-3 {
				background-position: -82px -192px;
			}

			.icon-4 {
				background-position: -123px -192px;
			}
			.service li p {
				margin-left: 9px;
				height: 42px;
				line-height: 42px;
				font-size: 18px;
				font-weight: 700;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: #444;
			}
		</style>
	</head>
	<body>
		<div class="service">
			<ul>
				<li>
					<h5 class="icon-1">1</h5>
					<p>品类齐全，轻松购物</p>
				</li>
				<li>
					<h5 class="icon-2">1</h5>
					<p>品类齐全，轻松购物</p>
				</li>
				<li>
					<h5 class="icon-3">1</h5>
					<p>品类齐全，轻松购物</p>
				</li>
				<li>
					<h5 class="icon-4">1</h5>
					<p>品类齐全，轻松购物</p>
				</li>
			</ul>
		</div>
	</body>
```


### 字体图标

- 定义：展示的是图标，本质是字体
- 作用：在网页中添加**简单的、颜色单一**的小图标
- 优点
  - 灵活性：灵活地修改样式，例如：尺寸、颜色等
  - 轻量级：体积小、渲染快、降低服务器请求次数
  - 兼容性：几乎兼容所有主流浏览器
  - 使用方便：先下载再使用

#### 下载字体

iconfont 图标库：<https://www.iconfont.cn/>

登录 → 素材库 → 官方图标库 → 进入图标库 → 选图标，加入购物车 → 购物车，添加至项目，确定 → 下载至本地

![](https://www.woodfishhhh.xyz/images/1680340665988_1751961522006.png?_t=1751961531702)

#### 使用字体

1. 引入字体样式表（iconfont.css）

![](https://www.woodfishhhh.xyz/images/1680340697011.png?_t=1751961531702)

2. 标签使用字体图标类名
   * iconfont：字体图标基本样式（字体名，字体大小等等）
   * icon-xxx：图标对应的类名

![](https://www.woodfishhhh.xyz/images/1680340718890.png?_t=1751961531702)

#### 上传矢量图

作用：项目特有的图标上传到 iconfont 图标库，生成字体

![](https://www.woodfishhhh.xyz/images/1680340665988.png?_t=1751961531702)

上传步骤：上传 → 上传图标 → 选择 svg 矢量图，打开 → 提交 → 系统审核


### 垂直对齐方式  vertical-align

属性名：vertical-align

属性值

| 属性值     | 效果             |
| ---------- | ---------------- |
| baseline   | 基线对齐（默认） |
| top        | 顶部对齐         |
| **middle** | 居中对齐         |
| bottom     | 底部对齐         |

注意，基线对齐的时候，图片的底部会有一块小空白，可能影响排版。使用其他属性值就可以避免

因为浏览器把行内块、行内标签当做文字处理,默认按基线对齐效果

图片img的底下有空白,转块级不按基线对齐,空白就消失了


### 过渡  transition

作用：可以为**一个元素**在不同状态之间切换的时候添加**过渡效果**

属性名

`transition`（复合属性）

属性值

过渡的属性 花费时间 (s)

提示

- 过渡的属性可以是具体的 CSS 属性
- 也可以为 `all`（两个状态属性值不同的所有属性，都产生过渡效果）
- `transition` 设置给元素本身

```css
img {
  width: 200px;
  height: 200px;
  transition: all 1s;
}
img:hover {
  width: 500px;
  height: 500px;
}
```


### 透明度 opacity
- **作用**：设置整个元素的透明度（包含背景和内容 ）
- **属性名**：opacity
- **属性值**：0 - 1
  - 0：完全透明（元素不可见）
  - 1：不透明
  - 0 - 1之间小数：半透明


### 光标类型 cursor
- **作用**：鼠标悬停在元素上时指针显示样式
- **属性名**：cursor
- **属性值**

| 属性值   | 效果                     |
| -------- | ------------------------ |
| default  | 默认值，通常是箭头       |
| pointer  | 小手效果，提示用户可以点击 |
| text     | 工字型，提示用户可以选择文字 |
| move     | 十字光标，提示用户可以移动 |


### 样例 - 淘宝轮播图

![](https://www.woodfishhhh.xyz/images/9e00ad4af95ae1936eba0c983c24267.png?_t=1751509699397)

```html
		<style>
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}
			li {
				list-style: none;
			}

			.banner {
				margin: 100px auto;
				width: 564px;
				height: 315px;

				overflow: hidden;
				position: relative;
			}
			.banner img {
				width: 564px;
				border-radius: 12px;
				vertical-align: middle;
			}
			.banner ul {
				display: flex;
			}

			.banner .prev,
			.banner .next {
				display: none;

				width: 20px;
				height: 30px;
				background-color: rgba(0, 0, 0, 0.3);
				color: white;
				top: 50%;
				transform: translateY(-50%);

				position: absolute;

				text-decoration: none;
				line-height: 30px;
			}

			/* 重要用法 */ /* 鼠标移入banner时，显示左右按钮 */
			.banner:hover .prev,
			.banner:hover .next {
				display: block;
			}

			.banner .prev {
				left: 0;
				border-radius: 0 15px 15px 0;
			}
			.banner .next {
				right: 0;
				border-radius: 15px 0 0 15px;
				text-align: right;
			}

			.banner ol {
				position: absolute;

				bottom: 20px;
				left: 50%;
				transform: translateX(-50%);

				height: 13px;
				background-color: rgba(255, 255, 255, 0.3);
				border-radius: 10px;

				display: flex;
			}

			.banner ol li {
				margin: 3px;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background-color: #fff;

				cursor: pointer;
			}

			.banner ol li.active {
				background-color: #ff5000;
			}
		</style>
	</head>
	<body>
		<div class="banner">
			<!-- 图片列表 -->
			<ul>
				<li>
					<img
						src="./14-综合案例-轮播图/images/banner1.jpg"
						alt="" />
				</li>
				<li>
					<img
						src="./14-综合案例-轮播图/images/banner2.jpg"
						alt="" />
				</li>
				<li>
					<img
						src="./14-综合案例-轮播图/images/banner3.jpg"
						alt="" />
				</li>
			</ul>
			<!-- 箭头 -->
			<!-- 上一张 -->
			<a
				href="#"
				class="prev"
				>❮</a
			>
			<!-- 下一张 -->
			<a
				href="#"
				class="next"
				>❯</a
			>
			<!-- 点 -->
			<ol>
				<li></li>
				<li class="active"></li>
				<li></li>
			</ol>
		</div>
	</body>
```

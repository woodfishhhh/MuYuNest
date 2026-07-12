---
title: "CSS 学习笔记（3）：伪类与伪元素选择器、盒子模型及相关特性详解"
date: 2025-09-21 23:32:14
tags:
  - "前端开发"
  - "伪类"
  - "伪元素选择器"
  - "盒子模型"
  - "CSS"
categories:
  - "前端开发"
  - "CSS"
---


## 结构伪类选择器

作用：根据元素的结构关系查找元素（序号查找）

E代表某种选择器

| 选择器         | 说明                                      |
| -------------- | ----------------------------------------- |
| E:first-child  | 查找第一个 E 元素                         |
| E:last-child   | 查找最后一个 E 元素                       |
| E:nth-child(N) | 查找第 N 个 E 元素（第一个元素 N 值为 1） |

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
			li:first-child {
				color: aqua;
			}
			li:last-child {
				color: bisque;
			}
			li:nth-child(3) {
				text-align: center;
			}
		</style>
	</head>
	<ul>
		<li>qwer</li>
		<li>qwer</li>
		<li>qwer</li>
		<li>qwer</li>
		<li>qwer</li>
		<li>qwer</li>
		<li>qwer</li>
	</ul>
	<body></body>
</html>
```

### nth-child(公式)

作用根据元素结构关系查找多个元素

| 功能                  | 公式       |
| --------------------- | ---------- |
| 偶数标签              | 2n         |
| 奇数标签              | 2n+1；2n-1 |
| 找到 5 的倍数的标签   | 5n         |
| 找到第 5 个以后的标签 | n+5        |
| 找到第 5 个以前的标签 | -n+5       |

##

## 伪元素选择器

作用：创建虚拟元素（伪元素），用来摆放装饰性的内容

（伪元素选择器的用途一般在哪？：解决溢出隐藏，经常用的）

| 选择器    | 说明                              |
| --------- | --------------------------------- |
| E::before | 在 E 元素里面最前面添加一个伪元素 |
| E::after  | 在 E 元素里面最后面添加一个伪元素 |

注意点：
- 必须设置 `content: ""` 属性，用来设置伪元素的内容，如果没有内容，则引号留空即可.
- 如果没有设置`content`属性，那么选择器不生效
- 伪元素默认是行内显示模式
- 权重和标签选择器相同

```html
		<style>
			div {
				width: 500px;
				height: 500px;
				background-color: pink;
			}
			div::before {
				content: "老鼠";
				/* width: 100px;
				height: 100px; */
				/* 此时注释内容不生效，因为伪元素选择器是行内元素 */
				/* 可以用display修改 */
				background-color: brown;
			}
			div::after {
				background-color: blue;
				display: inline-block;
				width: 100px;
				height: 100px;
                /*必须设置content*/
				content: "大米";
			}
		</style>
	</head>
	<body>
		<div>爱</div>
	</body>
```


## PxCook

PxCook（像素大厨） 是一款切图设计工具软件。支持PSD文件的文字、颜色、距离自动智能识别。 - 开发面板（自动智能识别） - 设计面板（手动测量尺寸和颜色）

不便多说，自己学


## 盒子模型

### 盒子模型 - 组成

**作用：布局网页，摆放盒子和内容**

![盒子](https://www.woodfishhhh.xyz/images/20a2d336060fc1abe7aff76cb04f776.png?_t=1751159117237)

盒子模型重要组成部分：
- 内容区域 - width & height

- 内边距 - **padding**（出现在内容与盒子边缘之间）

- 边框线 - **border**

- 外边距 - **margin**（出现在盒子外面）

  ```css
  			div {
  				width: 500px;
  				height: 500px;
  				background-color: pink;
  
  				/* 内边距， 盒子与内容之间的距离 */
  				padding: 20px;
  				/* 边框，位于内边距和外边距之间，围绕内容 */
  				border: 1px solid #000;
  				/* 外边距， 盒子与盒子之间的距离 */
  				margin: 50px;
  			}
  ```

### 盒子模型 - 边框线

属性名：border （ bd ）

属性值：边框线粗细  线条样式  颜色  （不区分顺序）

常用线条样式

| 属性值 | 线条样式 |
| ------ | -------- |
| solid  | 实线     |
| dashed | 虚线     |
| dotted | 点线     |

#### 设置单方向边框线

属性名：border-方向  （bd+方向首字母 ，例如bdl）

属性值同上

```css
			div {
				width: 500px;
				height: 500px;
				background-color: pink;

				border-left: 5px solid black;
				border-top: 10px dotted #000;
				border-bottom: 10px dotted #000;
				border-right: 10px dotted #000;
			}
```

### 盒子模型 - 内边距

作用：设置**内容**和**盒子边缘**之间的距离

属性名：padding / padding-方向

```css
div {
			width: 700px;
			height: 10px;
			background-color: #fff;
			border: 2px solid red;
			line-height: 10px;
			
    		padding-left: 40px;
			padding-top: 20px;
			padding-bottom: 20px;
			padding-right: 20px;
}
```

#### 盒子模型 - 内边距 - 多值写法

```css
padding: 20px 20px 20px 40px;
```

| 取值个数 | 示例                            | 含义                                              |
| -------- | ------------------------------- | ------------------------------------------------- |
| 一个值   | `padding: 10px;`                | 四个方向内边距均为 10px                           |
| 四个值   | `padding: 10px 20px 40px 80px;` | 上：10px；右：20px；下：40px；左：80px **顺时针** |
| 三个值   | `padding: 10px 40px 80px;`      | 上：10px；左右：40px；下：80px                    |
| 两个值   | `padding: 10px 80px;`           | 上下：10px；左右：80px                            |

记忆：从上开始顺时针转一圈，如果当前方向没有值，就和对面一样

### 盒子模型 - 尺寸计算

![盒子](https://www.woodfishhhh.xyz/images/b080d3a0fec3f076752551c885946d0.png?_t=1751163179428)

- 默认情况：盒子尺寸 = 内容尺寸 + border尺寸 + 内间距尺寸
- 结论：给盒子加 border 和 padding 会撑大盒子
- 解决方法
  - 手动做减法，剪掉 border / padding 的尺寸
  - **内减模式：box-sizing：border-box**

```css
			div {
				width: 200px;
				height: 200px;
				background-color: pink;

				padding: 20px;
				box-sizing: border-box;
                /* 内减模式，不需要手动减法 */
			}
```

### 盒子模型 - 外边距

作用：拉开两个盒子之间的距离

属性名：margin

提示：与 padding 属性值写法，含义相同

```css
div {
    width: 700px;
    height: 10px;
    background-color: #fff;
    border: 2px solid red;
    line-height: 10px;
    
    /* 使用 margin 替代 padding */
    margin-left: 40px;
    margin-top: 20px;
    margin-bottom: 20px;
    margin-right: 20px;
}
```

#### 盒子模型 - 外边距 - 多值写法

```css
margin: 20px 20px 20px 40px;
```

| 取值个数 | 示例                           | 含义                                              |
| -------- | ------------------------------ | ------------------------------------------------- |
| 一个值   | `margin: 10px;`                | 四个方向外边距均为 10px                           |
| 四个值   | `margin: 10px 20px 40px 80px;` | 上：10px；右：20px；下：40px；左：80px **顺时针** |
| 三个值   | `margin: 10px 40px 80px;`      | 上：10px；左右：40px；下：80px                    |
| 两个值   | `margin: 10px 80px;`           | 上下：10px；左右：80px                            |

**注意**：

1. 内边距（padding）影响的是内容与边框之间的距离，而外边距（margin）影响的是元素与其他元素之间的距离。
2. 当使用 margin 时，可能需要注意相邻元素 margin 合并的情况（两个垂直方向的 margin 相遇时会合并为较大的一个）。

#### 浏览器版心居中

**实现方法：使用 `margin: 0 auto`**

给盒子设置左右 margin 为 `auto`，上下 margin 为 `0`，示例代码如下：

```css
.box {
  width: 800px; /* 必须指定宽度 */
  margin: 0 auto;
}原理说明
```

1. **计算逻辑**：浏览器会用窗口宽度减去盒子宽度，将剩余距离平分到左右两侧，实现水平居中。
2. **关键前提**：盒子必须设置明确的**宽度**（如 `width: 固定值` 或 `width: 百分比`），否则无法生效。


### 清除默认样式

清除默认样式，例如：默认的内外边距离

两种常用方法：

```css
通配符
*{
	margin:0;
	padding:0;
}
```

```css
blockquote, body, button, dd, dl, dt, fieldset, form, h1, h2, h3, h4, h5, h6, hr, input, legend, li, ol, p, pre, td, textarea, th, ul {
    margin: 0;
    padding: 0;
}
```

还可以加个box-sizing: border-box（内减模式），可以防止撑大盒子

#### list去掉列表的项目符号

可以用以下代码：

```css
li{
    list-style: none;	
}
```


### 盒子模型 - 元素溢出

作用：控制**溢出**元素的内容的**显示方式**

属性名：overflow

| 属性值     | 效果                                       |
| ---------- | ------------------------------------------ |
| **hidden** | 溢出隐藏                                   |
| scroll     | 溢出滚动（无论是否溢出，都显示滚动条位置） |
| auto       | 溢出滚动（溢出才显示滚动条位置）           |


### 外边距问题 - 合并现象

- 场景：垂直排列的兄弟元素，上下 margin 会合并

- 现象：取两个 margin 中的较大值生效

下图，两个方块，更大的margin间距把更小的那个吞掉了，显示出来的样子就像只生效了更大的那个，但是其实都生效了，就是说50覆盖了20

![图](https://www.woodfishhhh.xyz/images/e11977b74c589d28f5b26f637a553aa.png?_t=1751179133573)


### 外边距问题 - 塌陷问题 - bug
- **场景**：父子级的标签，子级的添加上外边距会产生塌陷问题
- **现象**：导致父级一起向下移动

下图，原因其实是第一个的上外边距溢出，把父级顶下去了

![图](https://www.woodfishhhh.xyz/images/b080d3a0fec3f076752551c885946d0_1751179388705.png?_t=1751179389124)

```css
/*问题代码*/
.father {
    width: 300px;
    height: 300px;
    background-color: pink;
}
.son {
    width: 100px;
    height: 100px;
    background-color: orange;
    margin-top: 50px;
}
```

**解决方法**
- 取消子级margin,父级设置padding
- 父级设置 overflow:hidden  （刷新浏览器对父级的定位，就是让父亲回到他应在的位置）
- 父级设置border-top

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
			/* 问题代码 */
			.father {
				width: 300px;
				height: 300px;
				background-color: pink;
			}
			.son {
				width: 100px;
				height: 100px;
				background-color: orange;
				margin-top: 50px; /* 子级外边距导致塌陷 */
			}
			/* 解决方法1：取消子级 margin，父级设置 padding */
			.father.padding-fix {
				padding-top: 50px;
			}
			.son.no-margin {
				margin-top: 0;
			}
			/* 解决方法2：父级设置 overflow: hidden */
			.father.overflow-fix {
				overflow: hidden;
			}
			/* 解决方法3：父级设置 border-top */
			.father.border-fix {
				border-top: 50px solid transparent;
			}
		</style>
	</head>
	<body>
		<hr />
		<hr />
		<!-- 原始问题 -->
		<div class="father">
			<div class="son"></div>
		</div>
		<hr />
		<hr />
		<!-- 解决方法1：取消子级 margin，父级设置 padding -->
		<div class="father padding-fix">
			<div class="son no-margin"></div>
		</div>
		<hr />
		<hr />
		<!-- 解决方法2：父级设置 overflow: hidden -->
		<div class="father overflow-fix">
			<div class="son"></div>
		</div>
		<hr />
		<hr />
		<!-- 解决方法3：父级设置 border-top -->
		<div class="father border-fix">
			<div class="son"></div>
		</div>
	</body>
</html>
```


### 行内元素 - 内外边距问题

场景：行内元素添加 `margin` 和 `padding`，无法改变元素**垂直位置**，只能改变水平位置

**解决方法**：给行内元素添加 `line-height` 可以改变垂直位置

```css
span {
  /* margin 和 padding 属性，无法改变垂直位置 */
  margin: 50px;
  padding: 20px;

  /* 行高可以改变垂直位置 */
  line-height: 100px;
}
```


### 盒子模型 - 圆角

作用：设置元素的外边框为圆角。
属性名：border-radius
属性值：数字 + px / 百分比

提示：属性值是圆角半径

```css
div{
    //四个角
    border-radius: 20px;
    //也可以多个取值，没有赋值的和对角相同，从左上角开始负责，顺时针
    border-radius: 20px 30px 40px 50px;
}
```


- 正圆形状

  给正方形盒子设置圆角属性值为  **宽高的一半** 或者 **50%**

  ![头像](https://www.woodfishhhh.xyz/images/b9c9d11eb488c00fcbed8c056113cd5.png?_t=1751181018752)

- 胶囊形状

  给长方形盒子设置圆角属性值为  **盒子高度的一半**

  ![胶囊](https://www.woodfishhhh.xyz/images/31dff1808e091d119bfb94c92fd55cf.png?_t=1751181115201)


### 盒子模型 - 阴影（拓展）
作用：给元素设置阴影效果

属性名：`box-shadow`

属性值：`x轴偏移量` `y轴偏移量` `模糊半径` `扩散半径` `颜色` `内外阴影`

注意：
- X 轴偏移量 和 Y 轴偏移量 **必须** 书写
- 默认是外阴影，内阴影需要添加 `inset`


## 案例

### 产品卡片

![产品卡片](https://www.woodfishhhh.xyz/images/9090a2d576d52cd8bf428e54503423f.png?_t=1751184653871)

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
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}

			body {
				background-color: #f1f1f1;
			}
			.product {
				width: 300px;
				height: 200px;
				background-color: #ffffff;
				margin: 100px auto;
				border-radius: 20px;
				padding-top: 5px;

				text-align: center;
				text-decoration: none;
			}
			.product img {
				width: 70px;
				object-fit: cover;
				display: block;
				border-radius: 50%;
				margin: 20px auto;
			}

			.product h4 {
				font-size: 30x;
				margin-top: 20px;
				margin-bottom: 12px;
				font-weight: normal;
				color: #333333;
			}
			.product p {
				color: #555555;
			}
		</style>
	</head>
	<body>
		<div class="product">
			<img
				src="../pic/头像.jpg"
				alt="touxiang" />
			<h4>woodfish</h4>
			<p>Hola!This Is Woodfish!</p>
		</div>
	</body>
</html>
```

### 新闻列表

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
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}
			body {
				background-color: #fefefe;
			}
			li {
				list-style: none;
			}
			a {
				text-decoration: none;
			}
			.news {
				width: 360px;
				height: 200px;
				margin: 100px auto;
				background-color: #ffffff;
			}
			.news .hd {
				height: 34px;
				background-color: #eee;
				border: 1px solid #dbdee1;
				border-left: none;
			}
			.news .hd .title {
				width: 48px;
				height: 34px;
				background-color: #fff;
				display: inline-block;
				border-top: 3px solid orange;
				border-right: 1px solid #dbdee1;
				margin: -1px;

				color: black;
				text-align: center;
				font-size: 14px;
				line-height: 33px;
			}
			.news .bd {
				width: 100%;
				height: 100%;
				padding: 5px;
			}
			.news .bd a::before {
				content: "";
				background-image: url(../pic/头像.jpg);
				background-size: cover;
				width: 12px;
				display: inline-block;
				height: 12px;
				margin: 5px;
				margin-top: 3px;
				vertical-align: middle;
			}
			.news .bd a {
				display: block;
				color: #666;
				line-height: 24px;
				font-size: 12px;
			}
			.news .bd a:hover {
				color: orange;
			}
		</style>
	</head>
	<body>
		<div class="news">
			<div class="hd">
				<a
					href="#"
					class="title"
					>新闻</a
				>
			</div>
			<div class="bd">
				<ul>
					<li>
						<a
							href="#"
							class="lst"
							>点赞"新农人"温暖的伸手</a
						>
					</li>
					<li>
						<a
							href="#"
							class="lst"
							>在希望的田野上...</a
						>
					</li>
					<li>
						<a
							href="#"
							class="lst"
							>"中国天眼"又有新发现 已在《自然》杂志发表</a
						>
					</li>
					<li>
						<a
							href="#"
							class="lst"
							>急!这个领域,缺人!月薪4万元还不好招!啥情况?</a
						>
					</li>
					<li>
						<a
							href="#"
							class="lst"
							>G9"带货"背后:亏损面持续扩大,竞争环境激烈</a
						>
					</li>
					<li>
						<a
							href="#"
							class="lst"
							>多地力推二手房"带押过户",有什么好处?</a
						>
					</li>
				</ul>
			</div>
		</div>
	</body>
</html>
```

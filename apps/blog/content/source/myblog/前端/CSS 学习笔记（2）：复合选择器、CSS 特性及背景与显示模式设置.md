---
title: "CSS 学习笔记（2）：复合选择器、CSS 特性及背景与显示模式设置"
date: 2025-09-21 23:31:43
tags:
  - "前端开发"
  - "复合选择器"
  - "CSS 特性"
  - "背景"
  - "显示模式设置"
categories:
  - "前端开发"
  - "CSS"
---


### 复合选择器

定义：由两个以上的的基础选择器，通过不同的方式组合而成

作用：更准确，高效的选择目标元素（标签）

#### 后代选择器

作用：选中某元素的后代元素

写法：父选择器  子选择器 { css选择器 } ，父子选择器之间用**空格**隔开

```html
		<style>
			div span {
				color: red;
			}
			div strong {
				color: blue;
			}
			div div {
				color: green;
			}
		</style>
	</head>
	<body>
		<div>
			<span>span11111111111111</span>
			<span>span2222222222222</span>
			<span>span333333333333333</span>
			<strong>strong111111</strong>
			<div>div555555555555555555</div>
			<div>
				<div>
					<span> span孙子级别 </span>
					<!-- 这里依然是红色 -->
				</div>
			</div>
		</div>
	</body>
```

当使用后代选择器时，举例div span，在div里的所有span，包括子类，孙类，等等等等，都会受到后代选择器影响

但是我们可以这样写：

```css
			div div div span {
				color: red;
			}
```

就可以一步一步缩小范围


#### 子代选择器

子代选择器：选中某元素的**子代**元素 (最近的子级)。
选择器写法：**父选择器 > 子选择器** {CSS 属性}, 父子选择器之间用 **>** 隔开。

```html
		<style>
			div > span {
				color: red;
			}
		</style>
	</head>
	<body>
		<div>
			<span>儿子span1</span>
			<!-- 红了 -->
			<p><span>孙子span2 </span></p>
			<!-- 原样显示 -->
		</div>
	</body>
```


#### 并集选择器

并集选择器：选中多组标签设置相同的样式。
选择器写法：选择器 1, 选择器 2,..., 选择器 N {CSS 属性}, 选择器之间用`，`隔开。

```html
		<style>
			div,
			span,
			p,
			h1 {
				color: red;
			}
		</style>
	</head>
	<body>
		<div>div标签</div>
		<span>span标签</span>
		<p>p标签</p>
		<h1>h1标签</h1>
	</body>
```


#### 交集选择器（看懂就行）

交集选择器:选中同时满足多个条件的元素。

选择器写法:选择器1选择器2{CSS属性},选择器之间连写,没有任何符号。

```html
		<style>
			p.p1 {
				color: red;
			}
		</style>
	</head>
	<body>
		<p>我是段落</p>
		<p class="p1">我是段落</p>
		<p class="p2">我是段落</p>
	</body>
```

这个.p1是类选择器，就是拍p标签+类的写法


### 伪类选择器

伪类为元素状态，选中元素的某个状态设置样式

鼠标悬停状态：选择器：hover{ CSS样式 }

```html
		<style>
			a:hover {
				color: red;
			}
			p:hover {
				color: green;
				background-color: yellow;
				text-decoration: underline;
			}
		</style>
	</head>
	<body>
		<a href="#">我是 a </a>
		<p>我是p</p>
	</body>
```

任何标签都可以设置鼠标悬停状态，hover冒号前换成对应的选择器即可

#### 扩展：伪类-超链接

超链接有四种状态

| 选择器   | 作用           |
| -------- | -------------- |
| :link    | 访问前         |
| :visited | 访问后         |
| :hover   | 鼠标悬停       |
| :active  | 点击时（激活） |

如果要给超链接设置以上四个状态，需要按`LVHA`的顺序书写。

```html
		<style>
			a:link {
				color: red;
			}
			a:visited {
				color: green;
			}
			a:hover {
				color: blue;
			}
			a:active {
				color: yellow;
			}
		</style>
```

但是工作时不这样用，一般这样：

```html
		<style>
			a {
				color: red;
			}
			a:hover {
				color: blue;
			}
		</style>
```


### CSS 特性

- 继承性
- 层叠性
- 优先级

#### **继承性**

作用：子集标签默认继承父级标签的文字控制属性，如 font-size、color、font-weight 等。将文字控制属性设置给父级标签（如 body），可使子集标签继承从而统一文字风格，节省代码量。

**若标签自身有样式，则生效自身样式，不继承父级。**

```html
		<style>
			body {
				font-size: 30px;
				font-weight: 700;
				color: red;
			}
		</style>
	</head>
	<body>
		<div>div标签</div>
		<span>span标签</span>
		<p>p标签</p>
        <!-- 这里h1标题的字体大小照旧，因为h1有自己的字体大小样式 -->
		<h1>h1标签</h1>
        <!-- 如果标签有自己的样式，则不继承，生效自己的样式 -->
		<a href="#">a标签</a>
	</body>
```


#### 层叠性

- 相同的属性会**覆盖**：后面的 CSS 属性覆盖**前面**的 CSS 属性
- 不同的属性会叠加：不同的 CSS 属性都生效

（就进原则）也就是说所有属性取个并集，并且把只取相同属性的最后一个

```html
		<style>
			div {
				color: green;
				background-color: yellow;
				font-weight: 700;
			}
			div {
				color: red;
				font-size: 30px;
			}
		</style>
	</head>
	<body>
		<div>woodfish</div>
        <!-- 这里字是红色的，背景黄，字重700，大小30px -->
	</body>
```


#### 优先级

优先级：也叫权重，当一个标签使用了**多种**选择器时，基于不同种类的选择器的**匹配规则**

规则：**选择器优先级高的样式生效**
公式：通配符选择器 < 标签选择器 < 类选择器 < id 选择器 < 行内样式 < !important
记忆：**选中标签的范围越大，优先级越低**

```html
<style>
    /* 通配符选择器 */
    * {
        color: gray;
    }

    /* 标签选择器 */
    p {
        color: blue;
    }

    /* 类选择器 */
    .highlight {
        color: red;
    }

    /* ID选择器 */
    #special {
        color: green;
    }

    /* !important声明 */
    .override {
        color: purple !important;
    }
</style>

<p>普通段落（蓝色）</p>
<p class="highlight">带类的段落（红色）</p>
<p id="special">带ID的段落（绿色）</p>
<p class="highlight" id="special">带ID和类的段落（绿色，ID优先级更高）</p>
<p style="color: orange;">带行内样式的段落（橙色）</p>
<p class="override" style="color: orange;">带!important的段落（紫色，!important优先级最高）</p>
```

##### 优先级 - 叠加计算规则

叠加计算：如果是复合选择器，则需要权重叠加计算。
公式：**行内样式，id 选择器个数，类选择器个数，标签选择器个数**(每一级之间不存在进位)

规则:

- 从左向右依次比较选个数，同一级个数多的优先级高，如果个数相同，则向后比较
- !important 权重最高
- 继承权重最低

详情见博客：CSS-优先级-叠加计算规则


### Emmet写法

Emmet 写法：代码的**简写方式**，**输入缩写 VS Code 会自动生成**对应的代码。

| 说明         | 标签结构                                     | Emmet         |
| ------------ | -------------------------------------------- | ------------- |
| 类选择器     | `<div class="box"></div>`                    | 标签名。类名  |
| id 选择器    | `<div id="box"></div>`                       | 标签名 #id 名 |
| 同级标签     | `<div></div><p></p>`                         | `div+p`       |
| 父子级标签   | `<div><p></p></div>`                         | `div>p`       |
| 多个相同标签 | `<span>1</span><span>2</span><span>3</span>` | `span*3`      |
| 有内容的标签 | `<div>内容</div>`                            | `div{内容}`   |

CSS：大多数简写方式为属性单词的**首字母**

```html
<style>
			div {
                /* 点击w */
                width: 300;
                /* 点击h */
                height: 300;
                
            }
		</style>
	</head>
	<body>
		<!-- 类选择器  -->
		<!-- 输入 .qwe  生成 -->
		<div class="qwe">div</div>
		<!-- 输入 p.qwe  生成 p -->
		<p class="qwe"></p>

		<!-- id选择器  -->
		<!-- 输入p#qwe -->
		<p id="qwe"></p>
		<!-- 输入div#fff -->
		<div id="fff"></div>

		<!-- 同级标签 div+p  -->
		<div></div>
		<p></p>

		<!-- 子标签 div>p  -->
		<div>
			<p></p>
		</div>

		<!-- 多个同级标签 div*3 -->
		<div></div>
		<div></div>
		<div></div>

		<!-- 有内容的标签 p{内容}  -->
		<p>qweqwrewtarGadsdgzg</p>
	</body>
```


### 背景属性

| 描述           | 属性                    |
| -------------- | ----------------------- |
| 背景色         | `background-color`      |
| 背景图         | `background-image`      |
| 背景图平铺方式 | `background-repeat`     |
| 背景图位置     | `background-position`   |
| 背景图缩放     | `background-size`       |
| 背景图固定     | `background-attachment` |
| 背景复合属性   | `background`            |

在网页中，使用背景图实现装饰性的图片效果

#### 背景图

属性名：background-image ( bgi )
属性值：url (背景图 URL 路径)

```html
		<style>
			div {
				width: 500px;
				height: 500px;
				/* 背景图默认是平铺的 */
				background-image: url(../pic/彩云.jpg);
			}
		</style>
	</head>
	<body>
		<div>
			<p>
				<a href="http:woodfishhhh.xyz">点这朵彩云可以进入木鱼网站</a>
			</p>
		</div>
	</body>
```

#### 背景图平铺方式

属性名：background-repeat ( bgr )

| 属性值        | 效果             |
| ------------- | ---------------- |
| **no-repeat** | 不平铺           |
| repeat        | 平铺（默认效果） |
| repeat-x      | 水平方向平铺     |
| repeat-y      | 垂直方向平铺     |

```html
			div {
				width: 1080px;
				height: 1080px;
				background-color: red;
				background-image: url(../pic/头像.jpg);
				background-repeat: no-repeat;
			}
```


#### 背景图位置

属性名：background-position ( bgp )

属性值：水平方向位置  垂直方向位置

- 关键字

- | 关键字 | 位置 |
  | ------ | ---- |
  | left   | 左侧 |
  | right  | 右侧 |
  | center | 居中 |
  | top    | 顶部 |
  | bottom | 底部 |

- 坐标（数字+px，正负皆可）

需要知道，如果图片被移动出了盒子，那么就不会显示（背景图的字面意思）

水平方向：负数向左，正数向右

竖直方向：负数向上，正数向下

提示:

- 关键字取值方式写法，可以颠倒取值顺序
- 可以只写一个关键字，另一个方向默认为居中
- 数字只写一个直表示水平方向，垂直方向为居中


#### 背景图缩放

属性名：background-size （ bgz ）

**关键字：**

  - `cover`：等比例缩放背景图片以完全覆盖背景区，**可能背景图片部分看不见**
  - `contain`：等比例缩放背景图片以完全装入背景区，**可能背景区部分空白**

**百分比**：根据盒子尺寸计算图片大小

数字 + 单位（例如：px）


#### 背景图固定

属性名：background-attachment	( bga )

属性值：fixed

可使背景图相对于视口固定，滚动页面时背景图位置不变。


### background复合属性写法

类似`font`写法

**属性值: 背景色 背景图 背景图平铺方式 背景图位置/背景图缩放 背景图固定 (空格隔开各个属性值, 不区分顺序)**

```css
div {
  width: 400px;
  height: 400px;

  background: pink url(./images/1.png) no-repeat right center/cover;
}
```

```html
		<style>
			div {
				width: 1000px;
				height: 1000px;
				background: pink url(../pic/头像.jpg) no-repeat center bottom/cover;
			}
		</style>
```


### 显示模式

标签（元素）的显示模式

作用：布局网页时，根据标签的显示模式选择合适的标签摆放内容

  - #### 块级元素

    - 独占一行
    - 宽度默认是父级的100%
    - 添加宽高属性生效
    - 比如：div标签
  - #### 行内元素

    - 一行可以显示多个
    - 设置宽高属性不生效
    - 宽高尺寸由内容撑开
    - 比如：span标签
  - #### 行内块元素

    - 一行可以显示多个
    - 设置宽高属性生效
    - 宽高尺寸也可以由内容撑开
    - 比如：img标签


### 转换显示模式

属性名：display

属性值：

| 属性值           | 效果   |
| ---------------- | ------ |
| **block**        | 块级   |
| **inline-block** | 行内块 |
| inline           | 行内   |

块级没办法右对齐，因为是独占一行


### 习惯

用选择器找标签的时候，尽量不要直接用标签选择器，因为以后，网页内容多，直接标签选择器容易冲突

最好用后代关系找对应标签，明确要查找的标签具体是哪个，这样不容易错。

错误示范：banner

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document</title>
  <style>
    body {
      color: #333333;
      text-align: right;
    }
    div {
      height: 500px;
      background-color: #f3f3f4;
      background-image: url(../pic/左下角大图.jpg);
      background-repeat: no-repeat;
      background-position: bottom left;
    }
    h1 {
      font-size: 36px;
      line-height: 100px;
    }
    p {
      font-size: 20px;
    }

    .btn {
      display: inline-block;
      background-color: #f06b1f;
      width: 125px;
      height: 40px;
      color: white;
      text-decoration: none;
      text-align: center;
      line-height: 40px;
    }
  </style>
</head>
<body>
  <div>
    <h1>让创造产生价值</h1>
    <p>我们希望小游戏平台可以提供无限可能，让每一个创作者都可以将他们的才华和创意传递给用户</p>
    <a href="#" class="btn">我要报名</a>
  </div>
</body>
</html>
```

正确示范：

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
			.banner {
				background-image: url(../pic/左下角大图.jpg);
				background-color: #f3f3f4;
				height: 500px;
				text-align: right;
				background-repeat: no-repeat;
				background-position: bottom left;
			}
			.banner h2 {
				line-height: 100px;
				font-size: 36px;
				color: #333333;
			}
			.banner p {
				color: #333333;
				font-size: 20px;
			}
			.banner a {
				display: inline-block;
				height: 40px;
				width: 125px;
				color: #ffffff;
				background-color: #f06b1f;
				line-height: 40px;
				text-decoration: none;
                text-align: center;
			}
		</style>
	</head>
	<body>
		<div class="banner">
			<h2>让创造产生价值</h2>
			<p>我们希望小游戏平台可以提供无限可能，让每一个创作者都可以将他们的才华和创意传递给用户</p>
			<a href="#">我要报名</a>
		</div>
	</body>
</html>

```



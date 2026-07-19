---
title: "CSS 学习笔记（4）：浮动布局与 Flex 弹性布局详解及应用案例"
date: 2025-09-21 23:32:42
tags:
  - "前端开发"
  - "浮动布局"
  - "应用案例"
  - "CSS"
  - "Flex"
categories:
  - "前端开发"
  - "CSS"
---


## 标准流

标准流也叫文档流，指的是标签在页面中默认的排布规则，例如块元素独占一行，行内元素可以一行显示多个。


## 浮动（了解，看懂就行）

### 一、浮动属性的基本概念

#### 1. 浮动的作用

- 让块级标签在一行显示，实现灵活的页面布局
- 常见应用场景：横向导航栏、多列布局、图文混排

#### 2. 浮动属性的语法

```css
selector {
  float: left | right | none;
}
```

- **left**：元素向左浮动，出现在父级左侧
- **right**：元素向右浮动，出现在父级右侧
- **none**：默认值，元素不浮动

### 二、浮动属性测试演示

#### 1. 案例 1：两个 div 左浮动

```html
<div style="float: left; width: 100px; height: 50px; background: red;">1</div>
<div style="float: left; width: 100px; height: 80px; background: blue;">2</div>
```

- 显示效果：两个 div 在一行从左向右排列，高度不同但顶对齐

#### 2. 案例 2：左右浮动混合

```html
<div style="float: left; width: 100px; height: 50px; background: red;">左</div>
<div style="float: right; width: 100px; height: 50px; background: blue;">右</div>
```

- 显示效果：两个 div 分别位于父级左右两侧，仍在一行显示

### 三、浮动盒子的三大特点

1. **顶对齐特性**

   - 无论盒子高度是否一致，垂直方向始终顶部对齐

     ```html
     <div style="float: left; height: 100px;">高盒子</div>
     <div style="float: left; height: 50px;">矮盒子</div>
     ```

     （显示效果：两个盒子顶部对齐）

2. **行内块显示模式**

   - 具备行内块元素特点：
     - 可在一行显示
     - 宽高属性生效
     - 保留空格和换行符间距

3. **脱标特性（脱离标准流）**

   - 浮动元素不再占用标准流位置
   - 导致问题：
     - 父级无法被撑开高度
     - 后续标准流元素会覆盖浮动元素位置
   - 最佳实践：同一容器内元素要么全浮动，要么全不浮动

### 四、浮动布局应用案例：小米产品区布局

#### 1. 实现步骤

1. 清除浏览器默认样式

2. 创建版心容器并居中

3. 左右结构布局：

   - 左侧 div：float:left
   - 右侧产品区：float:right

4. 产品列表处理：

   - 给 li 标签添加 float:left

   - 解决间距溢出：

     ```css
     .product li:nth-child(4), 
     .product li:nth-child(8) {
       margin-right: 0; /* 去掉第4、8个产品右间距 */
     }
     ```

#### 2. 关键代码示例

```html
<div class="container">
  <div class="left" style="float: left; width: 200px; height: 300px;">左侧栏</div>
  <div class="right" style="float: right; width: 800px;">
    <ul class="product">
      <li style="float: left; width: 180px; margin-right: 10px;">产品1</li>
      <!-- 省略其他产品 -->
    </ul>
  </div>
</div>
```

### 五、浮动布局注意事项

- 父级宽度不足问题
  - 现象：子元素浮动后超出父级宽度时，部分元素会 "掉" 到下一行
  - 解决方案：
    1. 检查父级宽度是否足够容纳所有子元素
    2. 调整子元素宽度或间距
    3. 使用响应式布局适配不同屏幕

### 六、浮动产生的影响及清除方法

#### 1. 浮动导致的核心问题

- 父级高度塌陷：浮动子元素无法撑开父级高度
- 布局错乱：后续元素占据浮动元素位置

#### 2. 四种清除浮动的方法

##### （1）额外标签法（不推荐）

```html
<div class="parent">
  <div style="float: left;">浮动元素</div>
  <div style="clear: both;"></div> <!-- 额外添加的清除标签 -->
</div>
```

- 缺点：增加无意义标签，破坏页面结构

##### （2）单伪元素法（推荐）

```css
.clearfix:after {
  content: "";
  display: block;
  clear: both;
}
```

```html
<div class="parent clearfix">
  <div style="float: left;">浮动元素</div>
</div>
```

- 原理：通过:after 伪元素模拟额外标签

##### （3）双伪元素法（完整方案）

```css
.clearfix:before,
.clearfix:after {
  content: "";
  display: table;
}
.clearfix:after {
  clear: both;
}
```

- 优势：**同时解决浮动塌陷和 margin 塌陷问题**

##### （4）overflow 法（简洁方案）

```css
.parent {
  overflow: hidden;
}
```

- 原理：修剪超出父级的内容，触发 BFC 机制
- 注意：会隐藏超出内容，慎用在有滚动需求的容器

### 七、浮动属性的起源与发展

1. 最初用途，实现图文混排效果

   ```html
   <img src="img.jpg" style="float: left;">
   <p>文字会围绕图片排列...</p>
   ```

2. 现代布局趋势

   - 浮动布局逐渐被 Flexbox 和 Grid 布局取代
   - 企业项目中 Flex 布局更常用
   - 学习浮动是理解传统布局的基础

### 八、知识点总结

| 知识点   | 关键点                           |
| -------- | -------------------------------- |
| 浮动作用 | 使块级元素一行显示，实现多列布局 |
| 浮动特点 | 顶对齐、行内块特性、脱离标准流   |
| 清除浮动 | 推荐双伪元素法或 overflow:hidden |
| 常见问题 | 父级宽度不足、高度塌陷           |

> 提示：实际开发中建议优先使用 Flex 布局，但浮动仍是前端必学的基础技能


## FLEX布局

Flex布局也叫弹性布局，是浏览器提倡的布局模型，非常适合结构化布局，提供了强大的空间分布和对齐能力
Flex模型不会产生浮动布局中脱标现象，布局网页更简单、更灵活

### Flex组成

设置方式：给**父**元素设置 `display : flex` ，子元素可以**自动挤压或压缩**
组成部分：

- 弹性容器
- 弹性盒子
- 主轴：默认在水平方向
- 侧轴 / 交叉轴：默认在垂直方向

![](https://www.woodfishhhh.xyz/images/1680335870554.png?_t=1751211068630)


### Flex布局

| 描述                     | 属性            | 使用说明                                                     |
| ------------------------ | --------------- | ------------------------------------------------------------ |
| 创建 flex 容器           | display: flex   | 在父元素上设置，使其子元素成为弹性项目                       |
| 主轴对齐方式             | justify-content | 取值如 flex-start（默认）、center、space-between 等，控制主轴排列方式 |
| 侧轴对齐方式             | align-items     | 取值如 stretch（默认）、center、flex-start 等，控制侧轴排列方式 |
| 某个弹性盒子侧轴对齐方式 | align-self      | 用于单独设置某个子元素的侧轴对齐方式，覆盖 align-items 的设置 |
| 修改主轴方向             | flex-direction  | 取值如 row（默认）、column、row-reverse 等，改变主轴方向     |
| 弹性伸缩比               | flex            | 如 flex: 1 表示平均分配空间，flex: 2 占双倍空间，用于子元素设置 |
| 弹性盒子换行             | flex-wrap       | 取值如 nowrap（默认）、wrap，控制子元素超出容器时是否换行    |
| 行对齐方式               | align-content   | 取值如 stretch（默认）、center、space-between 等，控制多行之间的对齐方式 |


### 主轴对齐方式

属性值：`justify-content`

| 属性值            | 效果                                                   |
| ----------------- | ------------------------------------------------------ |
| flex-start        | **默认值**，弹性盒子从**起点**开始依次排列             |
| flex-end          | 弹性盒子从**终点**开始依次排列                         |
| **center**        | 弹性盒子沿主轴**居中**排列                             |
| **space-between** | 弹性盒子沿主轴均匀排列，空白间距均分在**弹性盒子之间** |
| **space-around**  | 弹性盒子沿主轴均匀排列，空白间距均分在**弹性盒子两侧** |
| **space-evenly**  | 弹性盒子沿主轴均匀排列，弹性盒子与容器之间**间距相等** |


### 侧轴对齐方式

#### 属性名

- `align-items`：当前弹性容器内**所有**弹性盒子的侧轴对齐方式（给弹性**容器**设置 ）
- `align-self`：单独控制**某个**弹性盒子的侧轴对齐方式（给弹性**盒子**设置 ）

| 属性值      | 效果                                                         |
| ----------- | ------------------------------------------------------------ |
| **stretch** | 弹性盒子沿着侧轴线被**拉伸至铺满容器**（弹性盒子没有设置侧轴方向尺寸则默认拉伸） |
| **center**  | 弹性盒子沿侧轴**居中**排列                                   |
| flex-start  | 弹性盒子从起点开始依次排列                                   |
| flex-end    | 弹性盒子从终点开始依次排列                                   |


### 修改主轴方向

主轴默认在水平方向，侧轴默认在垂直方向

改变了主轴方向后，侧轴就会变成对应的垂直方向

#### 属性名：`flex-direction`

| 属性值           | 效果                       |
| ---------------- | -------------------------- |
| `row`            | 水平方向，从左向右（默认） |
| **`column`**     | 垂直方向，从上向下         |
| `row-reverse`    | 水平方向，从右向左         |
| `column-reverse` | 垂直方向，从下向上         |


### 弹性伸缩比
**作用**：控制弹性盒子的主轴方向的尺寸。

**属性名**：`flex`

**属性值**：整数数字，表示占用父级剩余尺寸的份数。

默认情况，主轴方向尺寸靠内容撑开，侧轴默认拉伸

***Flex就是占比权重***

![占比1234](https://www.woodfishhhh.xyz/images/66df46ea9933c303904e7dec72f66d7.png?_t=1751249910249)

```html
		<style>
			.box {
				display: flex;

				height: 300px;
				border: 1px solid #000;
			}
			.item:nth-child(1) {
				flex: 1;
				background-color: skyblue;
			}
			.item:nth-child(2) {
				flex: 2;
				background-color: pink;
			}
			.item:nth-child(3) {
				flex: 3;
				background-color: yellow;
			}
			.item:nth-child(4) {
				flex: 4;
				background-color: orange;
			}
		</style>
	</head>
	<body>
		<div class="box">
			<div class="item">1</div>
			<div class="item">2</div>
			<div class="item">3</div>
			<div class="item">4</div>
		</div>
	</body>
```


### 弹性盒子换行

弹性盒子可以**自动挤压或拉伸**，默认情况下，所有弹性盒子**都在一行显示**。

#### 属性名：flex-wrap

#### 属性值

- `wrap`：换行
- `nowrap`：不换行（默认）


### 行对齐方式 ( 类似主轴对齐方式的模式 )
属性名：`align-content`

| 属性值        | 效果                                                   |
| ------------- | ------------------------------------------------------ |
| flex-start    | 默认值，弹性盒子从起点开始依次排列                     |
| flex-end      | 弹性盒子从终点开始依次排列                             |
| center        | 弹性盒子沿主轴居中排列                                 |
| space-between | 弹性盒子沿主轴均匀排列，空白间距均分在弹性盒子之间     |
| space-around  | 弹性盒子沿主轴均匀排列，空白间距均分在弹性盒子两侧     |
| space-evenly  | 弹性盒子沿主轴均匀排列，弹性盒子与容器之间间距相等     |

此属性对单行盒子无效（前置条件：有flex-wrap:wrap）


## 案例-抖音解决方案

![案例](https://www.woodfishhhh.xyz/images/b2d150994d81a1a20fafc9365c81745.png?_t=1751263372777)

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
			.box {
				width: 1200px;
				height: 420px;
				background-color: white;
				margin: 100px auto;

				border-radius: 40px;
				border: 1px solid black;

				display: flex;
				justify-content: space-around;
				align-content: space-around;
				flex-wrap: wrap;
			}
			.box .car {
				width: 500px;
				height: 200px;
				background-color: white;
				border-radius: 40px;

				display: flex;
				flex-direction: row; /* 图片和文字整体横向排列 */
				justify-content: flex-start; /* 左对齐 */
				align-items: center; /* 垂直居中 */
			}
			.box .car img {
				width: 88px;
				height: 88px;
				margin: 40px;
			}
			/* 为 h3 和 p 包裹一个容器，便于控制布局 */
			.box .car .text-container {
				display: flex;
				flex-direction: column; /* 让 h3 在 p 上方 */
				justify-content: center;
				margin-left: 20px; /* 文字与图片之间留出间距 */
			}
			.box .car .text h3 {
				margin-bottom: 10px;
				font-size: 20px;
			}
			.box .car .text p {
				font-size: 14px;
			}
		</style>
	</head>
	<body>
		<div class="box">
			<div class="car">
				<img src="./pic/1.svg" />
				<div class="text">
					<h3>一键发布多端</h3>
					<p>发布视频到抖音短视频、西瓜视频及今日头条</p>
				</div>
			</div>
			<div class="car">
				<img src="./pic/2.svg" />
				<div class="text">
					<h3>管理视频内容</h3>
					<p>实时查询视频审核状态，支持修改已发布稿件状态</p>
				</div>
			</div>
			<div class="car">
				<img src="./pic/3.svg" />
				<div class="text">
					<h3>发布携带组件</h3>
					<p>支持分享内容携带小程序、地理位置信息等组件，扩展内容及实现互动</p>
				</div>
			</div>
			<div class="car">
				<img src="./pic/4.svg" />
				<div class="text">
					<h3>数据评估分析</h3>
					<p>获取视频在对应产品内的数据表现、获取抖音热点，及时进行表现评估出地域性</p>
				</div>
			</div>
		</div>
	</body>
</html>
```

---
title: "HTML 学习笔记（1）：核心标签、文档结构及多媒体应用"
date: 2025-09-29 11:31:16
tags:
  - "前端开发"
  - "文档结构"
  - "多媒体应用"
  - "HTML"
  - "前端基础"
categories:
  - "前端开发"
  - "HTML"
---


### HTML入门

#### 1. 保存 HTML 标签的文件扩展名是什么？

- 扩展名：`.html` 或 `.htm`（常用 `.html`）

#### 2. HTML 标签名要放到什么括号里面？

- 需放在 **尖括号 `<>`** 中，例如：`<div>`、`<p>`

#### 3. 结束标签比开始标签多什么？

- 结束标签比开始标签多一个

  斜杠（/）

  ，例如：

  - 开始标签：`<strong>`
  - 结束标签：`</strong>`

#### 4. 标签包裹的内容放在什么位置？

- 内容需放在开始标签与结束标签之间，例如：

  ```html
  <strong>文字内容</strong> <!-- 文字内容位于标签中间 -->
  ```

### HTML 文档结构基础

#### 简单理解

| 结构名称 | 对应标签  | 说明                       |
| -------- | --------- | -------------------------- |
| 整个网页 | `<html>`  | 定义 HTML 文档的根元素     |
| 网页头部 | `<head>`  | 包含元数据（如标题、样式） |
| 网页标题 | `<title>` | 定义网页在浏览器的标题     |
| 网页主体 | `<body>`  | 包含网页可见内容           |

#### 标签之间的关系

1. **嵌套（父子）关系**

   - 一个标签完全包含另一个标签，例如：

     ```html
     <html>
       <head>
         <title>网页标题</title> <!-- <title> 是 <head> 的子标签 -->
       </head>
     </html>
     ```

2. **并列（兄弟）关系**

   - 多个标签位于同一层级，互不包含，例如：

     ```html
     <html>
       <head></head> <!-- <head> 与 <body> 是兄弟标签 -->
       <body></body>
     </html>
     ```

### HTML 注释方法

- 语法：使用

  ```
  <!-- 注释内容 -->
  ```

  注释内容不会在浏览器中显示，例如：

  ```html
  <!-- 这是一段注释，用于说明代码功能 -->
  <p>可见的正文内容</p>
  ```


### 标题

- 标题标签一共有 6 级别？标签名分别是什么？

  h1 ~ h6

- 在浏览器中，各个标题标签的显示效果有什么特点？

  文字加粗,字号逐渐减小,独占一行

- 哪个标题标签有使用次数的限制？

  h1：一个网页就用一次，用来放新闻标题或网页 Logo

  ```html
  <body>
  	<h1>我是木鱼</h1>
  	<h2>I'm woodfish</h2>
  </body>
  ```

### 段落

标签名p（双标签）

独占一行，而且段落之间有空行

`<p>hola</p>`

### 换行和水平线标签

换行：`<br>`单标签

水平线：`<hr>`单标签

### 文本格式化标签

| 效果   | 标签名 |      |
| ------ | ------ | ---- |
| 加粗   | strong | b    |
| 倾斜   | em     | i    |
| 下划线 | ins    | u    |
| 删除线 | del    | s    |


```html
	<body>
		<p>
			<strong>我喜欢你</strong>//加粗
			<br />
			<del>你喜欢我</del>//删除线
			<br />
			<ins> 我也喜欢你 </ins>//下划线
			<br />
			<em> 你也喜欢我 </em>//斜体
		</p>
	</body>
```

### 图片标签

```html
<img src="图片的url">
```

src指定图片位置和名称

vscode可以用 ./ 来选择路径选择图片

| 属性   | 作用       | 说明                               |
| ------ | ---------- | ---------------------------------- |
| alt    | 替换文本   | 图片无法显示的时候显示的文字       |
| title  | 提示文本   | 鼠标悬停在图片上面的时候显示的文字 |
| width  | 图片的宽度 | 值为数字，没有单位                 |
| height | 图片的高度 | 值为数字，没有单位                 |

```html
	<body>
		<img
			src="./pic/彩云.jpg"
			title="我最喜欢的彩云"
			height="100" />
		<img
			src="./pic/彩云.jpg"
			title="我最喜欢的彩云"
			width="100" />
	</body>
```


### 路径

#### 相对路径

用 / 表示进入某个文件夹

用 .  表示当前文件所在文件夹

用 . .表示上一级文件夹  . . .表示上上一级文件夹（以此类推）

vscode中可以用./来写相对路径

#### 绝对路径（少用）

```html
<img src="C:/images/cat.gif">
```

少用 反斜杠 \    多用斜杠 /

如果文件是网页链接，可以使用网址来指代图片链接（图床应用）

```html
<img src="https://www.woodfishhhh.xyz/images/.png">
```

### 超链接

**作用：点击跳转到其他页面**
可以跳转到其他网站，也可以是本地文件

```html
	<body>
		<a href="https://www.woodfishhhh.xyz/">跳转到woodfish的个人网站</a>
		<a href="./05-标题.html">标题的demo</a>
	</body>
```

这里点击对应的就是本窗口打开
如果要实现新窗口打开，就在第一个a里面加上*target = "_blank"*

```html
		<br />
		<a
			href="./05-标题.html"
			target="_blank"		<!-- 就是开一个新窗口 -->
			>标题的demo</a
		>
```

开发初期不知道跳转到哪个链接，就用 # 指代空连接

### 多媒体标签 --- 音频和视频

#### 音频标签

```html
<audio src="音频的 URL"></audio>
```

#### 常见属性

| 属性            | 作用             | 特殊说明                                       |
| --------------- | ---------------- | ---------------------------------------------- |
| src（必须属性） | 音频 URL         | 支持格式：mp3、Ogg、wav                        |
| controls        | 显示音频控制面板 |                                                |
| loop            | 循环播放         |                                                |
| autoplay        | 自动播放         | 为了提升用户体验，浏览器一般会禁用自动播放功能 |

```html
	<body>
		<!-- 在html5里，如果属性名和属性值完全一样，可以简写为一个单词 -->
		<audio
			src="./media/imsad.mp3"
			controls
			loop></audio>
	</body>
```

#### 视频标签

```html
<video src="视频的 URL"></video>
```

#### 常见属性

| 属性            | 作用             | 特殊说明                                       |
| --------------- | ---------------- | ---------------------------------------------- |
| src（必须属性） | 视频 URL         | 支持格式：mp4、WebM、Ogg                       |
| controls        | 显示视频控制面板 |                                                |
| loop            | 循环播放         |                                                |
| muted           | 静音播放         |                                                |
| autoplay        | 自动播放         | 为了提升用户体验，浏览器支持在静音状态自动播放 |

```html
	<body>
		<video
			src="./media/lilililalila.mp4"
			controls
			loop
			muted
			autoplay></video>
		<!-- 如果要自动播放，必须要有muted -->
	</body>
```

#### 视频控件出错时：onerror

```html
    <video
      src="#"
      onerror="()=>{
        console.log(error)
    }"></video>
```


### 综合小案例

#### 个人简历

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>个人简介</title>
	</head>
	<body>
		<h1>木鱼</h1>
		<hr />
		<h2>
			基本信息<br />
			姓名：木鱼<br />
			出生年份：2006 年 <br />
			居住地：中国<a href="#">南昌市</a><br />
			当前身份：大一学生，就读于<a href="#">江西财经大学</a>计算机科学与技术专业<br />
		</h2>
		<img
			src="./pic/头像.jpg"
			alt="muyu"
			title="我喜欢你"
			width="400" />
		<p>
			作为学生、电子音乐制作人、算法爱好者的木鱼，<del>
				拥有探险家（Adventurer）般的性格与 ISFP-T 人格特质，</del
			>以<strong> “如果没有天赋，那就一直重复”</strong> 为座右铭，擅长突发奇想制定有趣计划，热衷 CS2
			游戏与特摄、动漫作品，持续关注人工智能与编程领域，钟情<ins>
				ColorBass、Progressive House 及凯尔特音乐。</ins
			>
		</p>
		<hr />
		<a
			href="https:woodfishhhh.xyz.about"
			target="_blank"
			>这里是我的详细简介网站，同时是我的个人博客网站</a
		>
		<h2>我的歌</h2>
		<audio
			src="./media/imsad.mp3"
			controls
			loop></audio>
		<h2>随便放点抽象小视频</h2>
		<video
			src="./media/boomba.mp4"
			controls
			width="400"></video>

		<h2>
			刚刚做的Vue介绍 <br>
			<a href="./Vue介绍.html" target="_blank">点我</a>
	</body>
</html>

```

#### Vue简介

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>Vue介绍</title>
	</head>
	<body>
		<h1>Vue.js</h1>
		<p>
			Vue (读音 /vju:/, 类似于 view) 是一套用于构建用户界面的渐进式 avascript 框架。[5]
			与其它大型框架不同的是，Vue 被设计为可 以自底向上逐层应用。Vue
			的核心库只关注视图层，不仅易于上手，还便于与第三方库或既有项目整合。另一方面，当与现代化的工
			具链以及各种支持类库结合使用时，Vue 也完全能够为复杂的单页应用 (SPA) 提供驱动。<br />
			网页介绍为<a
				href="./个人简介.html"
				target="_blank"
				>木鱼</a
			>制作
		</p>
		<hr />
		<p>
			主要功能 Vue,js 是一套构建用户界面的渐进式框架。与其他重量级框架不同的是，Vue
			采用自底向上增量开发的设计。Vue 的核心库只关注视图
			层，并且非常容易学习，非常容易与其它库或已有项目整合。<br />
			另一方面，Vue 完全有能力驱动采用单文件组件和 Vue 生态系统支持的 库开发的复杂单页应用。<br />
			Vue.js 的目标是通过尽可能简单的 API 实现响应的数据绑定和组合的视图组件。<br />
			Vue.js 自身不是一个全能框架 --
			它只聚焦于视图层。因此它非常容易学习，非常容易与其它库或已有项目整合。另一方面，在与相
			关工具和支持库一起使用时 [2],Vuejs 也能驱动复杂的单页应用。
		</p>
		<video
			src="./media/tungtungtung.mp4"
			width="400"
			controls></video>
	</body>
</html>

```

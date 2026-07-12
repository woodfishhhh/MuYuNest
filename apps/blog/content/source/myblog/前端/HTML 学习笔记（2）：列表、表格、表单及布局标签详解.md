---
title: "HTML 学习笔记（2）：列表、表格、表单及布局标签详解"
date: 2025-09-29 11:17:38
tags:
  - "前端开发"
  - "列表"
  - "表格"
  - "表单"
  - "HTML"
categories:
  - "前端开发"
  - "HTML"
---


### 列表

**作用：布局内容排列整齐的区域**

![](https://www.woodfishhhh.xyz/images/c1a78af288f8795cd2bc9434ad10f3b.png?_t=1750580182476)

#### 分类：无序列表，有序列表，定义列表

### 无序列表

作用：布局不需要规定顺序的区域

标签：ul嵌套li，ul是无序列表，li是列表条目

```html
		<ul>
			<li>表1</li>
			<li>表2</li>
			<li>表3</li>
			<li>表4</li>
		</ul>
```

ul;里只能包裹li标签（不能写段落p，标题h），li中可以包括任何内容

### 有序列表

作用：布局需要规定顺序的区域

标签：ol嵌套li，ol是有序列表，li是列表条目

```html
	<ol>
		<li>表1</li>
		<li>表2</li>
		<li>表3</li>
		<li>表4</li>
	</ol>
```

### 定义列表

标签：dl嵌套dt和dd，dl是定义列表，dt是定义列表的标题，dd是定义列表的描述 / 详情

```html
		<dl>
			<dt>我是定义列表标题</dt>
			<dd>表1</dd>
			<dd>表2</dd>
            <!-- more -->
		</dl>
```

dt和dd里可以包含任何内容


## 表格

**标签: table 嵌套 tr, tr 嵌套 td /th**

| 标签名                  | 说明       |
| ----------------------- | ---------- |
| table                   | 表格       |
| tr--------table row     | 行         |
| th----------table head  | 表头单元格 |
| td-----------table data | 内容单元格 |

提示，网页中默认没有边框线，使用border可以添加

```html
<body>
		<table border="1">
			<tr>
				<th>姓名</th>
				<th>语文</th>
				<th>数学</th>
				<th>总分</th>
			</tr>
			<tr>
				<td>张三</td>
				<td>90</td>
				<td>80</td>
				<td>170</td>
			</tr>
			<tr>
				<td>李四</td>
				<td>90</td>
				<td>80</td>
				<td>170</td>
			</tr>
			<tr>
				<td>总结</td>
				<td>全市第一</td>
				<td>全市第一</td>
				<td>全市第一</td>
			</tr>
		</table>
	</body>
```

### 表格结构标签


caption是表格标题

```html
    <table>
      <!-- 补全代码 -->
      <caption>
        nowcoder
      </caption>
      <tr>
        <td>1</td>
        <td>1</td>
        <td>1</td>
      </tr>
      <tr>
        <td>1</td>
        <td>1</td>
        <td>1</td>
      </tr>
    </table>
```

**作用：用表格结构标签把内容划分区域，让表格结构更清晰，语义更清晰。**

| 标签名 | 含义     | 特殊说明     |
| ------ | -------- | ------------ |
| thead  | 表格头部 | 表格头部内容 |
| tbody  | 表格主体 | 主要内容区域 |
| tfoot  | 表格底部 | 汇总信息区域 |

看不见说是，但是以后用的上，可以弄多层表头什么的

```html
	<body>
		<table border="1">
			<thead>
				<tr>
					<th>姓名</th>
					<th>语文</th>
					<th>数学</th>
					<th>总分</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>张三</td>
					<td>90</td>
					<td>80</td>
					<td>170</td>
				</tr>
				<tr>
					<td>李四</td>
					<td>90</td>
					<td>80</td>
					<td>170</td>
				</tr>
			</tbody>
			<tfoot>
				<tr>
					<td>总结</td>
					<td>全市第一</td>
					<td>全市第一</td>
					<td>全市第一</td>
				</tr>
			</tfoot>
		</table>
	</body>
```

### 合并单元格

作用：将**多**个单元格合并成一个单元格，以合并同类信息

有跨行合并和跨列合并

合并单元格的步骤：
1：明确合并的目标
2：保留**最左最上**的单元格，添加属性 (取值是**数字**，表示需要合并的单元格数量)
			跨行合并，保留最上单元格，添加属性 rowspan
			跨列合并，保留最左单元格，添加属性 colspan
3：删除其他单元格

https://www.woodfishhhh.xyz/images/27d21dbd5962aff747a0ed4976199fee.png?_t=1750656646982

```html
				<tr>
					<td>总结</td>
					<td colspan="3">全市第一</td>
				</tr>
				<tr>
					<td>张三</td>
					<td>70</td>
					<td rowspan="2">80</td>
					<td>150</td>
				</tr>
```

## 表单

作用：收集用户信息
使用场景：登录页面，注册页面，搜索区域

### input标签

input标签的type属性值不同，则功能不同
```html
<input type="...">
```

| type 属性值 | 说明                     |
| ----------- | ------------------------ |
| text        | 文本框，用于输入单行文本 |
| password    | 密码框                   |
| radio       | 单选框                   |
| checkbox    | 多选框                   |
| file        | 上传文件                 |

#### input标签占位符

占位文本，提示信息

```html
<input type="..." placeholder="输入提示信息">
```

在placeholder写文字即提示信息

### 单选框radio

| 常用属性 |          |                                        |
| -------- | -------- | -------------------------------------- |
| 属性名   | 作用     | 特殊说明                               |
| name     | 控件名称 | 控件分组，同组只能选中一个（单选功能） |
| checked  | 默认选中 | 属性名和属性值相同，简写为一个单词     |

名字一样的，就是划分为一组，就只能选一个

```html
	<body>
		性别<input
			type="radio"
			name="性别" />男
		<input
			type="radio"
			name="性别" />女
		<input
			type="radio"
			name="性别"
			checked />武装直升机
	</body>
```

### 上传文件file

默认情况，只能选中上传一个文件，添加**multiple**标签可以实现**文件多选**

```html
<input type="file" mulitple>
```

### 多选框checkbox

默认选中**checked**

```html
	<body>
		<input type="checkbox" />我同意遵守<a href="#">班规</a>
		<br />
		<input
			type="checkbox"
			checked />我同意遵守<a href="#">校规</a>
		<br />
	</body>
```

### 下拉菜单

标签：select嵌套option，select是下拉菜单整体，option是菜单的每一项

```html
<select>
  <option>选项 1</option>
  <option>选项 2</option>
  <option>选项 3</option>
</select>
```

### 文本域

作用：多行输入文本的表单控件

标签：

```html
<textarea>默认提示文字</textarea>
```

### Label标签

作用：网页中，某个标签的提示文本

经验：用label标签绑定文字和表单控件的关系，**增大表单控件的点击范围**

##### 写法一
- label 标签只包裹内容，不包裹表单控件
- 设置 label 标签的 `for` 属性值 和表单控件的 `id` 属性值相同

```html
<input type="radio" id="man">
<label for="man">男</label>
```

##### 写法二

- 使用 label 标签包裹文字和表单控件，不需要属性

```html
<label><input type="radio"> 女</label>
```

**支持 label 标签增大点击范围的表单控件：文本框、密码框、上传文件、单选框、多选框、下拉菜单、文本域等等。**


### 按钮 - button

```html
<button type="">按钮</botton>
```

| type 属性值 | 说明                                             |
| ----------- | ------------------------------------------------ |
| submit      | 提交按钮，点击后可以提交数据到后台（默认功能）   |
| reset       | 重置按钮，点击后将表单控件恢复默认值             |
| button      | 普通按钮，默认没有功能，一般配合 JavaScript 使用 |

### 表单区域

使用form标签，圈住你的表单对应文本框，这样子才可以使用reset

```html
	<body>
		<!-- form表单区域 -->
		<!-- action 发送数据的地址 -->
		<form action="">
			名字 <input type="text" /> <br />
			密码 <input type="password" />
			<br />
			<!-- 如果没有指定type，那么默认就是submit -->
			<button type="submit">提交</button>
			<button type="reset">重置</button>
			<button type="button">普通按钮</button>
		</form>
	</body>
```

### 布局标签

作用：布局网页（划分网页区域，拜访内容）

- div：独占一行
- span：不换行

```html
	<body>
		<div>这是一个div标签</div>
		<!-- div大盒子，独占一行 -->
		<div>这是一个div标签</div>
		<span>这是一个span标签</span>
		<!-- span小盒子，不独占一行 -->
		<span>这是一个span标签</span>
	</body>
```

### 字符实体

作用：在网页中**显示预留字符**

https://www.woodfishhhh.xyz/images/bfcf79c826f54306b080b85223eae114.png?_t=1750666282312

```html
	<body>
		<!-- 在代码里敲的键盘的空格，网页只会识别一个 -->
		<!-- 解决方法：把空格换成&nbsp; -->
		<p>泥嚎，我是&nbsp;&nbsp;木鱼</p>

		还有，其他的符号也可以用实体符号来表示 <br />
		小于号：&lt; 大于号：&gt;
	</body>
```


### 小例子

#### 注册网站

```html
	<body>
		<form action="#">
			<h1>注册木鱼网站</h1>
			<h2>个人信息</h2>

			名字<input
				type="text"
				placeholder="name" />
			<br />
			手机号<input
				type="text"
				placeholder="phone number" />
			<br />
			邮箱<input
				type="text"
				placeholder="email" />
			<br />
			密码<input
				type="password"
				placeholder="password" />
			<br />
			再次输入密码<input
				type="password"
				placeholder="password" />
			<br />

			<label>
				<input
					type="radio"
					name="性别" />男</label
			>
			<label
				><input
					type="radio"
					name="性别" />女</label
			><label>
				<input
					type="radio"
					name="性别" />保密</label
			>
			<br />

			所属城市<select
				name="#"
				id="#">
				<option>北京</option>
				<option>上海</option>
				<option>广东</option>
				<option selected>深圳</option>
				<option>南昌</option>
			</select>
			<h2>教育经历</h2>
			最高学历<select>
				<option>小学</option>
				<option>初中</option>
				<option>高中</option>
				<option>中专</option>
				<option>大专</option>
				<option selected>大学</option>
				<option>研究生</option>
				<option>博士</option>
				<option>博士后</option>
				<option>其他</option>
			</select>
			<br />
			学校名字<input type="text" /> <br />
			所学专业<input type="text" /> <br />

			在校时间<select>
				<option>2010</option>
				<option>2011</option>
				<option>2012</option>
				<option>2013</option>
				<option>2014</option>
				<option>2015</option>
				<option>2016</option>
				<option>2017</option>
				<option>2018</option>
				<option>2019</option>
				<option>2020</option>
				<option>2021</option>
				<option>2022</option>
				<option>2023</option>
				<option>2024</option>
				<option>2025</option></select
			>到<select>
				<option>2020</option>
				<option>2021</option>
				<option>2022</option>
				<option>2023</option>
				<option>2024</option>
				<option>2025</option>
				<option>2026</option>
				<option>2027</option>
				<option>2028</option>
				<option>2029</option>
				<option>2030</option>
				<option>2031</option>
				<option>2032</option>
			</select>

			<h2>工作经历</h2>
			公司名字<input type="text" /> <br />
			职位<input type="text" /> <br />
			工作时间<select>
				<option>2010</option>
				<option>2011</option>
				<option>2012</option>
				<option>2013</option>
				<option>2014</option>
				<option>2015</option>
				<option>2016</option>
				<option>2017</option>
				<option>2018</option>
				<option>2019</option>
				<option>2020</option>
				<option>2021</option>
				<option>2022</option>
				<option>2023</option>
				<option>2024</option>
				<option>2025</option></select
			><br /><br />
			工作内容<textarea>这里</textarea> <br /><br />
			<input type="checkbox" />我已经同意<a href="#">木鱼用户服务协议</a><br />
			<input type="checkbox" />我已经同意<a href="#">此生服务于我</a> <br /><br /><br />
			<button type="submit">免费注册</button>
			<button type="reset">重新填写</button>
		</form>
	</body>
```

#### 新闻列表

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta
			name="viewport"
			content="width=device-width, initial-scale=1.0" />
		<title>Document</title>
	</head>
	<body>
		<ul>
			<li>
				<img
					src="../media/MAIN1735549925357FZCLO9LLDR.jpg"
					alt="1"
					width="400" />
				<br />
				<strong>高质量发展故事汇</strong>
			</li>
			<li>
				<img
					src="../media/MAIN1750638935935QOF7UAUNAA.jpg"
					alt="2"
					width="400" />
				<br />
				<strong>银河浩瀚，西藏进入观星季</strong>
			</li>
			<li>
				<img
					src="../media/MAIN175064234075633OUVU15JP.jpg"
					alt="3"
					width="400" />
				<br />
				<strong>让咸蛋丰富民众菜篮子</strong>
			</li>
		</ul>
	</body>
</html>

```

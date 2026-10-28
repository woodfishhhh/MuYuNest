---
title: "Web API 学习笔记（1）：DOM 基础操作"
date: 2025-11-03 12:39:05
tags:
  - "前端开发"
  - "HTML"
  - "JavaScript"
  - "Web API"
  - "Java"
categories:
  - "前端开发"
  - "Web API"
---

# Web API 学习笔记（1）：DOM 基础操作

复习：

splice() 用来添加或删除数组里的元素。

**注意：**它会改变原数组。

1. **删除数组：**

splice(起始位置， 删除的个数)

比如：1

~~~javascript
let arr = ['red', 'green', 'blue']
arr.splice(1,1) // 删除green元素
console.log(arr) // ['red, 'blue']
~~~

2. **添加元素**

splice(起始位置，删除个数，添加数组元素)

~~~javascript
let arr = ['red', 'green', 'blue']
//arr.splice(1, 0, 'pink') // 在索引号是1的位置添加 pink
//console.log(arr) // ['red', 'pink', 'green', 'blue']
arr.splice(1, 0, 'pink', 'hotpink') // 在索引号是1的位置添加 pink  hotpink
console.log(arr) // ['red', 'pink', 'hotpink', 'green', 'blue']
~~~

> 了解 DOM 的结构，掌握基本操作，体会 DOM 在开发中的作用

- 知道 ECMAScript 与 JavaScript 的关系
- 了解 DOM 的相关概念，DOM 本质是一个对象
- 掌握查找节点的基本方法
- 掌握节点属性和文本的操作
- 会用间歇函数创建定时任务

## 介绍

> 知道 ECMAScript 与 JavaScript 的关系，Web APIs 是浏览器扩展的功能。

前面 JavaScript 阶段学的基本都是 ECMAScript（简称 ES）。ES 是一套语言标准规范，变量、数据类型、表达式、语句、函数这些语法规则都是它规定的。浏览器实现了 ES 的大部分规范，又在此基础上扩展了一些实用功能，扩展出来的这部分就叫 Web APIs。

![guide](https://www.woodfishhhh.xyz/images/guide.png?_t=1753076439587)

ECMAScript 跑在浏览器里，再加上 Web APIs，才是真正的 JavaScript。Web APIs 的核心是 DOM 和 BOM。

扩展阅读：ECMAScript 一直在更新，有多个版本。早期按数字编号，如 ECMAScript3、ECMAScript5；后来更新太快，改用年份当版本号，如 ECMAScript2017、ECMAScript2018。ECMAScript6 是 2015 年发布的，常叫做 ECMAScript2015。

关于 JavaScript 历史的[扩展阅读](https://javascript.ruanyifeng.com/introduction/history.html)。

> 知道 DOM 相关概念，学习 DOM 基本操作，体会 DOM 的作用

DOM（Document Object Model）把 HTML 文档里的每个标签都当成一个对象，对象上有很多属性和方法。改这些属性、调这些方法，就能动态更新 HTML。

简单说，DOM 就是用来动态修改 HTML 的，网页特效和用户交互都靠它。

看个小例子：

![demo](https://www.woodfishhhh.xyz/images/demo.gif?_t=1753076439587)

分别点【开始】或【结束】按钮，右侧调试窗口里 html 标签的内容一直在变，这就是 DOM 做的。

### 概念

#### DOM 树

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>标题</title>
</head>
<body>
  文本
  <a href="">链接名</a>
  <div id="" class="">文本</div>
</body>
</html>
```

把 HTML 文档画成树状结构，就是文档树，也叫 DOM 树（见下图）。**文档树体现了标签之间的关系。**

![dom](https://www.woodfishhhh.xyz/images/web-api.jpg.jpeg?_t=1753076439587)

#### DOM 节点

文档树由节点组成，**每个节点都是一个 DOM 对象**。主要有元素节点、属性节点、文本节点等：

1. 【元素节点】就是 HTML 标签，比如上图的 `head`、`div`、`body`。
2. 【属性节点】标签上的属性，比如上图 `a` 标签的 `href`、`div` 标签的 `class`。
3. 【文本节点】标签里的文字，比如 `title` 标签中的文字。
4. 【根节点】特指 `html` 标签。
5. 其它...

#### document

`document` 是 JavaScript 内置的、专门操作 DOM 的对象，上面有很多属性和方法，是学 DOM 的核心。

```html
<script>
  // document 是内置的对象
  // console.log(typeof document);

  // 1. 通过 document 获取根节点
  console.log(document.documentElement); // 对应 html 标签

  // 2. 通过 document 节取 body 节点
  console.log(document.body); // 对应 body 标签

  // 3. 通过 document.write 方法向网页输出内容
  document.write('Hello World!');
</script>
```

上面列了 `document` 的部分属性和方法，先有个整体印象就行。

## 获取DOM对象

1. querySelector   满足条件的第一个元素
2. querySelectorAll  满足条件的元素集合 返回伪数组
3. 了解其他方式
   1. getElementById
   2. getElementsByTagName

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DOM - 查找节点</title>
</head>
<body>
  <h3>查找元素类型节点</h3>
  <p>从整个 DOM 树中查找 DOM 节点是学习 DOM 的第一个步骤。</p>
  <ul>
      <li>元素</li>
      <li>元素</li>
      <li>元素</li>
      <li>元素</li>
  </ul>
  <script>
  	const p = document.querySelector('p')  // 获取第一个p元素
  	const lis = document.querySelectorAll('li')  // 获取第一个p元素
  </script>
</body>
</html>
```

总结：

### 1. 获取页面标签的常用方式

常用的就这两个：

- `querySelectorAll()`
- `querySelector()`

### 2. 两者的区别

- `querySelector()`：只取匹配的第一个元素，返回单个 DOM 节点，拿到就能直接操作。
- `querySelectorAll()`：取匹配的所有元素，返回**伪数组**（`NodeList`），要遍历（`for`、`forEach`）才能操作每个元素。

### 3. 参数注意事项

- 括号里写 CSS 选择器，比如 `#id`、`.class`、`tag`。
- 选择器是字符串，要用引号包起来（单双引号都行），不然会报语法错误。

## 操作元素内容

改 DOM 的文本内容，就能动态改网页内容。

1. `innerText`：把文本内容添加/更新到任意标签位置，**文本里的标签不会被解析。**

```html
<script>
  // innerText 将文本内容添加/更新到任意标签位置
  const intro = document.querySelector('.intro')
  // intro.innerText = '嗨~ 我叫李雷！'
  // intro.innerText = '<h4>嗨~ 我叫李雷！</h4>'
</script>
```

2. `innerHTML`：把文本内容添加/更新到任意标签位置，**文本里的标签会被解析。**

```html
<script>
  // innerHTML 将文本内容添加/更新到任意标签位置
  const intro = document.querySelector('.intro')
  intro.innerHTML = '嗨~ 我叫韩梅梅！'
  intro.innerHTML = '<h4>嗨~ 我叫韩梅梅！</h4>'
</script>
```

总结：文本里有 `html` 标签就用 `innerHTML`，没有就用 `innerText`。

##操作元素属性 

改属性有3种方式：

#### 常用属性修改

1. 直接通过属性名修改，写法最简洁

```html
<script>
  // 1. 获取 img 对应的 DOM 元素
  const pic = document.querySelector('.pic')
	// 2. 修改属性
  pic.src = './images/lion.webp'
  pic.width = 400;
  pic.alt = '图片不见了...'
</script>
```

#### 控制样式属性

1. 【修改样式】改行内样式 `style` 属性，动态修改样式。

元素节点的 `style` 属性本身也是对象，`box.style.color`、`box.style.width` 分别拿到 CSS 样式里 `color` 和 `width` 的值。

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>练习 - 修改样式</title>
</head>
<body>
  <div class="box">随便一些文本内容</div>
  <script>
    // 获取 DOM 节点
    const box = document.querySelector('.intro')
    box.style.color = 'red'
    box.style.width = '300px'
    // css 属性的 - 连接符与 JavaScript 的 减运算符
    // 冲突，所以要改成驼峰法
    box.style.backgroundColor = 'pink'
  </script>
</body>
</html>
```

任何标签都有 `style` 属性，用它就能动态改样式。注意 `css` 属性名里带 `-` 的，要去掉 `-` 并把后面的字母大写，比如 `background-color` 要写成 `box.style.backgroundColor`。

2. 操作类名(className) 操作CSS

要改的样式多时，一条条用 style 改太繁琐，可以借助 css 类名。

~~~html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>练习 - 修改样式</title>
    <style>
        .pink {
            background: pink;
            color: hotpink;
        }
    </style>
</head>
<body>
  <div class="box">随便一些文本内容</div>
  <script>
    // 获取 DOM 节点
    const box = document.querySelector('.intro')
    box.className = 'pink'
  </script>
</body>
</html>
~~~

>注意：
>
>1.class 是关键字，所以用 className 代替
>
>2.className 是用新值换旧值，要添加一个类的话，得把之前的类名也保留下来

3. 通过 classList 操作类控制CSS

className 容易把以前的类名覆盖掉，用 classList 可以单独追加和删除类名。

~~~html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        div {
            width: 200px;
            height: 200px;
            background-color: pink;
        }

        .active {
            width: 300px;
            height: 300px;
            background-color: hotpink;
            margin-left: 100px;
        }
    </style>
</head>

<body>

    <div class="one"></div>
    <script>
        // 1.获取元素
        // let box = document.querySelector('css选择器')
        let box = document.querySelector('div')
        // add是个方法 添加  追加
        // box.classList.add('active')
        // remove() 移除 类
        // box.classList.remove('one')
        // 切换类
        box.classList.toggle('one')
    </script>
</body>

</html>
~~~

#### 操作表单元素属性

表单很多时候也要改属性。比如点眼睛图标显示密码，其实就是把表单类型改成文本框。

有属性值的属性，用法跟其他标签属性一样：

获取:DOM对象.属性名

设置:DOM对象.属性名= 新值

~~~html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>

</head>

<body>
    <input type="text" value="请输入">
    <button disabled>按钮</button>
    <input type="checkbox" name="" id="" class="agree">
    <script>
        // 1. 获取元素
        let input = document.querySelector('input')
        // 2. 取值或者设置值  得到input里面的值可以用 value
        // console.log(input.value)
        input.value = '小米手机'
        input.type = 'password'

        // 2. 启用按钮
        let btn = document.querySelector('button')
        // disabled 不可用   =  false  这样可以让按钮启用
        btn.disabled = false
        // 3. 勾选复选框
        let checkbox = document.querySelector('.agree')
        checkbox.checked = false
    </script>
</body>

</html>
~~~

#### 自定义属性

标准属性：标签天生自带的属性，比如 class、id、title 等，可以直接用点语法操作，比如：disabled、checked、selected

自定义属性：

html5 推出了专门的 data- 自定义属性：

- 在标签上一律以 data- 开头
- 在 DOM 对象上一律用 dataset 对象获取

~~~html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>

</head>

<body>
   <div data-id="1"> 自定义属性 </div>
    <script>
        // 1. 获取元素
        let div = document.querySelector('div')
        // 2. 获取自定义属性值
         console.log(div.dataset.id)
      
    </script>
</body>

</html>
~~~

## 间歇函数

> 知道间歇函数的作用，利用间歇函数创建定时任务。

`setInterval` 是 JavaScript 内置函数，每隔固定时间自动重复执行另一个函数，也叫定时器函数。

```html
<script>
  // 1. 定义一个普通函数
  function repeat() {
    console.log('不知疲倦的执行下去....')
  }

  // 2. 使用 setInterval 调用 repeat 函数
  // 间隔 1000 毫秒，重复调用 repeat
  setInterval(repeat, 1000)
</script>
```

**返回值与清除定时器**
`setInterval` 会返回一个唯一标识（timerID），用 `clearInterval` 停止定时器：

`let 变量名 = setInterval(函数，间隔时间)`

`clearInterval(变量名)`

```javascript

let timer = setInterval(function() {
  console.log('正在执行...');
}, 1000);


setTimeout(function() {
  clearInterval(timer);
  console.log('定时器已停止');
}, 5000);
```

**直接传入函数**
不用单独定义函数，直接传匿名函数也行：

```javascript
// 直接传入匿名函数
setInterval(function() {
  console.log('每2秒执行一次');
}, 2000);
```

**传递参数**
要给被调用的函数传参，这样写：

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

// 传递参数
setInterval(greet, 3000, 'John'); // 每3秒输出 "Hello, John!"
```

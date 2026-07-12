---
title: "Web API 学习笔记（2）：事件处理与 this 指向"
date: 2025-09-22 00:49:49
tags:
  - "前端开发"
  - "事件处理"
  - "this 指向"
  - "Web API"
  - "List"
categories:
  - "前端开发"
  - "Web API"
---


## 要解决的问题

- 能够判断函数运行的环境并确定 `this` 所指代的对象。
- 理解事件的作用，掌握应用事件的基本步骤。

---

## 事件

### 定义与用途

事件是编程语言中的术语，用来描述程序的行为或状态。当行为或状态发生改变时，会立即调用一个相应的函数。

#### 示例：

- 用户使用鼠标点击网页中的按钮
- 用户拖拽网页中的一张图片

### 事件监听

为了实现DOM元素的交互功能，需要为DOM对象添加事件监听器，等待事件触发时执行特定函数。

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>事件监听示例</title>
</head>
<body>
    <h3>事件监听</h3>
    <p id="text">点击按钮改变文字颜色</p>
    <button id="btn">点击我</button>
    <script>
        const btn = document.querySelector('#btn');
        btn.addEventListener('click', function() {
            const text = document.getElementById('text');
            text.style.color = 'red';
        });
    </script>
</body>
</html>
```

**步骤总结：**

1. 获取DOM元素。
2. 使用`addEventListener`方法为DOM节点添加事件监听。
3. 等待事件触发，并在回调函数中编写相应逻辑。

---

## 事件类型

事件可以分为多种类型，包括但不限于：

| 类型         | 描述           |
| ------------ | -------------- |
| `click`      | 鼠标单击       |
| `dblclick`   | 鼠标双击       |
| `mouseenter` | 鼠标移入       |
| `mouseleave` | 鼠标移出       |
| `keydown`    | 键盘按下       |
| `keyup`      | 键盘抬起       |
| `focus`      | 获得焦点       |
| `blur`       | 失去焦点       |
| `input`      | 文本框输入变化 |

### 示例代码：鼠标移入和移出事件

```javascript
const box = document.querySelector('.box');
box.addEventListener('mouseenter', function() {
    this.innerText = '鼠标移入了...';
    this.style.cursor = 'move';
});
box.addEventListener('mouseleave', function() {
    this.innerText = '鼠标移出了...';
});
```

---

## 事件对象

每当事件被触发时，都会生成一个包含相关事件信息的对象，这个对象称为事件对象。可以通过回调函数的第一个参数访问该对象。

```javascript
const box = document.querySelector('.box');
box.addEventListener('click', function(event) {
    console.log(event.type); // 输出事件类型
    console.log(event.clientX, event.clientY); // 输出光标位置相对于视窗的位置
});
```

**有用的属性：**

- `event.type`: 当前事件的类型。
- `event.clientX/Y`: 光标相对浏览器窗口的位置。
- `event.offsetX/Y`: 光标相对于当前DOM元素的位置。

---

## 环境对象（`this`）

`this` 是函数内部的一个特殊变量，它代表当前函数运行时所处的上下文环境。

```javascript
function sayHi() {
    console.log(this);
}

let user = { name: '张三', sayHi: sayHi };
let person = { name: '李四', sayHi: sayHi };

sayHi(); // 输出 window 对象
user.sayHi(); // 输出 user 对象
person.sayHi(); // 输出 person 对象
```

**结论：**

1. `this` 的值取决于函数如何被调用。
2. 直接调用函数时，`this` 指向全局对象（如浏览器中的 `window`）。
3. 作为对象的方法调用时，`this` 指向该对象。

---

## 回调函数

将一个函数作为参数传递给另一个函数时，前者被称为回调函数。

```javascript
function foo(callback) {
    callback();
}

foo(function() {
    console.log('这是一个回调函数');
});

// setInterval 示例
setInterval(function() {
    console.log('定时任务');
}, 1000);
```

**结论：**

- 回调函数本质上还是函数，只是以参数的形式传递给其他函数。
- 匿名函数常用于作为回调函数。
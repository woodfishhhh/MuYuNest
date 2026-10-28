---
title: "Web API 学习笔记（4）：Date 对象与 DOM 节点操作要点"
date: 2025-09-23 02:48:21
tags:
  - "前端开发"
  - "Date 对象"
  - "DOM 节点操作要点"
  - "Web API"
  - "对象"
categories:
  - "前端开发"
  - "Web API"
---


![](https://www.woodfishhhh.xyz/images/5ba36430ed24eb0ddce808e101bd6cae.png?_t=1753598894432)

## 一、日期对象

用 Date 日期对象动态获取当前计算机的时间。

ECMAScript 内置了获取系统时间的对象 Date。和 console、Math 这些内置对象不一样，用 Date 时要加 `new` 关键字。

### （一）实例化

```javascript
// 1. 实例化
// const date = new Date(); // 获取系统默认时间
const date = new Date('2020-05-01'); // 指定时间
// date 变量即所谓的时间对象
console.log(typeof date);
```

### （二）方法

```javascript
// 1. 实例化
const date = new Date();
// 2. 调用时间对象方法
// 通过方法分别获取年、月、日，时、分、秒
const year = date.getFullYear(); // 四位年份
const month = date.getMonth(); // 0 ~ 11
```

- `getFullYear`：四位年份。
- `getMonth`：月份，0（一月）到 11（十二月）。
- `getDate`：一个月里的第几天，不同月份范围不一样。
- `getDay`：星期，0（星期日）到 6（星期六）。
- `getHours`：小时，0 到 23。
- `getMinutes`：分钟，0 到 59。
- `getSeconds`：秒，0 到 59。

### （三）时间戳

时间戳是从 1970 年 01 月 01 日 00 时 00 分 00 秒到现在的总秒数或毫秒数，ECMAScript 里的时间戳按毫秒算。

```javascript
// 1. 实例化
const date = new Date();
// 2. 获取时间戳
console.log(date.getTime());

console.log(+new Date());

console.log(Date.now());
```

获取时间戳的几种方法：

- `getTime`：调 `Date` 对象的 `getTime` 方法。
- `+new Date()`：对 `new Date()` 做一元加法。
- `Date.now()`：调 `Date` 的静态方法 `now`。

## 二、DOM 节点

1. DOM 节点：DOM 树里的每一个内容都叫节点
2. DOM 节点分类
   - 元素节点，如 `div` 标签
   - 属性节点，如 `class` 属性
   - 文本节点，如标签里的文字
3. 重点是元素节点，能更好地理清标签之间的关系

### （一）插入节点

往已有的 DOM 节点里插入新节点，要解决两件事：拿到新的 DOM 节点，确定插在哪。

1. `appendChild` 方法
   代码演示：

```html
<body>
  <h3>插入节点</h3>
  <p>在现有 dom 结构基础上插入新的元素节点</p>
  <hr>
  <!-- 普通盒子 -->
  <div class="box"></div>
  <!-- 点击按钮向 box 盒子插入节点 -->
  <button class="btn">插入节点</button>
  <script>
    // 点击按钮，在网页中插入节点
    const btn = document.querySelector('.btn');
    btn.addEventListener('click', function () {
      // 1. 获得一个 DOM 元素节点
      const p = document.createElement('p');
      p.innerText = '创建的新的p标签';
      p.className = 'info';
      
      // 复制原有的 DOM 节点
      const p2 = document.querySelector('p').cloneNode(true);
      p2.style.color = 'red';

      // 2. 插入盒子 box 盒子
      document.querySelector('.box').appendChild(p);
      document.querySelector('.box').appendChild(p2);
    });
  </script>
</body>
```

结论：

- `createElement`：动态创建任意 DOM 节点。
- `cloneNode`：复制现有的 DOM 节点，传 `true` 会连所有子节点一起复制。
- `appendChild`：在末尾（结束标签前）插入节点。


1. `insertBefore` 方法
   再看另一种情况：

```html
<body>
  <h3>插入节点</h3>
  <p>在现有 dom 结构基础上插入新的元素节点</p>
  <hr>
  <button class="btn1">在任意节点前插入</button>
  <ul>
    <li>HTML</li>
    <li>CSS</li>
    <li>JavaScript</li>
  </ul>
  <script>
    // 点击按钮，在已有 DOM 中插入新节点
    const btn1 = document.querySelector('.btn1');
    btn1.addEventListener('click', function () {

      // 第 2 个 li 元素
      const relative = document.querySelector('li:nth-child(2)');

      // 1. 动态创建新的节点
      const li1 = document.createElement('li');
      li1.style.color = 'red';
      li1.innerText = 'Web APIs';

      // 复制现有的节点
      const li2 = document.querySelector('li:first-child').cloneNode(true);
      li2.style.color = 'blue';

      // 2. 在 relative 节点前插入
      document.querySelector('ul').insertBefore(li1, relative);
      document.querySelector('ul').insertBefore(li2, relative);
    });
  </script>
</body>
```

结论：

- `createElement`：动态创建任意 DOM 节点。
- `cloneNode`：复制现有的 DOM 节点，传 `true` 会连所有子节点一起复制。
- `insertBefore`：在父节点的任意一个子节点前面插入新节点。

### （二）删除节点

删除现有的 DOM 节点，也是两件事：由父节点来删子节点，并且要明确删哪一个。

```html
<body>
  <!-- 点击按钮删除节点 -->
  <button>删除节点</button>
  <ul>
    <li>HTML</li>
    <li>CSS</li>
    <li>Web APIs</li>
  </ul>

  <script>
    const btn = document.querySelector('button');
    btn.addEventListener('click', function () {
      // 获取 ul 父节点
      let ul = document.querySelector('ul');
      // 待删除的子节点
      let lis = document.querySelectorAll('li');

      // 删除节点
      ul.removeChild(lis[0]);
    });
  </script>
</body>
```

结论：用 `removeChild` 删节点，要基于父子关系来操作。

### （三）查找节点

DOM 树里的节点都不是孤立的，不是父子关系就是兄弟关系，可以按节点之间的关系来查找节点。

1. 父子关系
   - `childNodes` 和 `children`

```html
<body>
  <button class="btn1">所有的子节点</button>
  <!-- 获取 ul 的子节点 -->
  <ul>
    <li>HTML</li>
    <li>CSS</li>
    <li>JavaScript 基础</li>
    <li>Web APIs</li>
  </ul>
  <script>
    const btn1 = document.querySelector('.btn1');
    btn1.addEventListener('click', function () {
      // 父节点
      const ul = document.querySelector('ul');

      // 所有的子节点
      console.log(ul.childNodes);
      // 只包含元素子节点
      console.log(ul.children);
    });
  </script>
</body>
```

结论：

- `childNodes`：获取全部子节点，回车换行会被当成空白文本节点。

- `children`：只获取元素类型的节点。


  ##### childNodes

  - 功能：获取所有子节点，涵盖文本节点（如空格、换行 ）、注释节点等各类节点
  - 特点：返回结果包含 DOM 树里该节点下的全部子内容，类型多样

  ##### children 属性（重点）

  - 功能：仅获取所有元素节点
  - 特点：返回伪数组，能像数组一样按索引访问，写法是 `父元素.children`，方便精准操作元素子节点


  `parentNode`

```html
<body>
  <table>
    <tr>
      <td width="60">序号</td>
      <td>课程名</td>
      <td>难度</td>
      <td width="80">操作</td>
    </tr>
    <tr>
      <td>1</td>
      <td><span>HTML</span></td>
      <td>初级</td>
      <td><button>变色</button></td>
    </tr>
    <tr>
      <td>2</td>
      <td><span>CSS</span></td>
      <td>初级</td>
      <td><button>变色</button></td>
    </tr>
    <tr>
      <td>3</td>
      <td><span>Web APIs</span></td>
      <td>中级</td>
      <td><button>变色</button></td>
    </tr>
  </table>
  <script>
    // 获取所有 button 节点，并添加事件监听
    const buttons = document.querySelectorAll('table button');
    for(let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        // console.log(this.parentNode); // 父节点 td
        // console.log(this.parentNode.parentNode); // 爷爷节点 tr
        this.parentNode.parentNode.style.color = 'red';
      });
    }
  </script>
</body>
```

结论：`parentNode` 获取父节点，按相对位置查找，实际用起来很灵活。

1. 兄弟关系

```html
<body>
  <ul>
    <li>HTML</li>
    <li>CSS</li>
    <li>JavaScript 基础</li>
    <li>Web APIs</li>
  </ul>
  <script>
    // 获取所有 li 节点
    const lis = document.querySelectorAll('ul li');

    // 对所有的 li 节点添加事件监听
    for(let i = 0; i < lis.length; i++) {
      lis[i].addEventListener('click', function () {
        // 前一个节点
        console.log(this.previousSibling);
        // 下一下节点
        console.log(this.nextSibling);
      });
    }
  </script>
</body>
```

结论：

- `previousSibling`：获取前一个节点，按相对位置查找
- `nextSibling`：获取后一个节点，按相对位置查找，实际用起来很灵活。

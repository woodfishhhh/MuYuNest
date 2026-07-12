---
title: "JavaScript 易错点：prototype、__proto__ 与原型链"
date: 2025-11-03 12:38:11
tags:
  - "JavaScript"
  - "prototype"
  - "__proto__"
  - "原型链"
  - "易错点"
categories:
  - "前端开发"
  - "JavaScript"
---


## 理清 `prototype` 和 `__proto__` 的关系

### 先看一个比喻：「图纸」和「产品」

- **`prototype`（原型对象）** = 工厂里的「图纸」
  图纸上规定了所有产品共有的特性（比如手机图纸规定所有手机都有屏幕、按键）。
- **`__proto__`** = 每个产品身上的「溯源码」
  扫一下就能找到它是根据哪张图纸造出来的（通过这个码能找到对应的 `prototype`）。

### 具体到 JavaScript 中：

假设我们要造一批「人」（对象），步骤如下：

#### 1. 先画图纸（定义构造函数 + prototype）

```javascript
// 构造函数 = 生产线（用来造对象的工具）
function Person(name) {
  this.name = name; // 每个实例独有的属性（比如每个人名字不同）
}

// 图纸（prototype）：所有实例共享的特性
Person.prototype.sayHi = function() {
  console.log(`我叫${this.name}`); // 所有人都会打招呼
};
Person.prototype.legs = 2; // 所有人都有2条腿
```

#### 2. 用图纸造产品（创建实例）

```javascript
const xiaoming = new Person("小明"); // 造一个人
const xiaohong = new Person("小红"); // 再造一个人
```

#### 3. 产品的「溯源码」（**proto**）

每个造出来的「人」（实例）都有一个 `__proto__`，指向它的「图纸」（`Person.prototype`）：

```javascript
console.log(xiaoming.__proto__ === Person.prototype); // true（小明的图纸是Person的prototype）
console.log(xiaohong.__proto__ === Person.prototype); // true（小红的图纸也是这张）
```

#### 4. 为什么需要这两个东西？

- **`prototype` 是「公共仓库」**：
  把所有实例都需要的属性 / 方法（比如 `sayHi`、`legs`）放在这里，避免每个实例都复制一份（节省内存）。

- **`__proto__` 是「查找路径」**：
  当你访问一个对象的属性时，JS 会先找对象自己有没有；如果没有，就通过 `__proto__` 去「图纸」（`prototype`）里找。

  比如：

  ```javascript
  xiaoming.sayHi(); // 小明自己没有sayHi，但__proto__指向的图纸里有，所以能调用
  console.log(xiaohong.legs); // 小红自己没有legs，去图纸里找到2
  ```

### 一句话总结

- `prototype` 是**构造函数的属性**，存放所有实例共享的东西（像图纸）。
- `__proto__` 是**实例的属性**，指向它对应的「图纸」（即构造函数的 `prototype`）。


它们的关系：`实例.__proto__ === 构造函数.prototype`（这是 JS 自动建立的联系）。


再举个极端例子：
如果有一天你改了图纸（`Person.prototype.legs = 3`），那么所有已经造出来的人（`xiaoming`、`xiaohong`）的 `legs` 都会变成 3—— 因为它们都通过 `__proto__` 指向这张图纸！


## DOM（Document Object Model）级别

DOM是由W3C制定的标准，用于表示和操作HTML和XML文档。DOM标准分为不同级别：

### DOM0级（DOM Level 0）

- **不是W3C标准**，而是浏览器厂商早期实现的非标准集合
- 包括早期的事件处理和DOM操作方式
- 特点：
  - 事件处理：直接通过元素属性赋值，如 `element.onclick = function(){}`
  - 事件会相互覆盖（同一事件只能绑定一个处理函数）
  - 浏览器兼容性好

```
javascript// DOM0级事件绑定示例
element.onclick = function() {
    console.log("点击事件");
};

element.onchange = function() {
    console.log("值改变事件");
};
```

### DOM1级（DOM Level 1）

- 1998年发布
- 主要定义了HTML和XML文档的底层结构
- 提供了基本的文档对象模型API

### DOM2级（DOM Level 2）

- 2000年发布
- 增加了事件处理、样式对象和API
- 引入了 `addEventListener` 方法

```
javascript// DOM2级事件绑定示例
element.addEventListener('click', function() {
    console.log("点击事件");
}, false);
```

### DOM3级（DOM Level 3）

- 2004年发布
- 进一步扩展了DOM API
- 增加了更多事件类型和方法

```
javascript// DOM3级继续使用addEventListener，但增加了更多事件类型
element.addEventListener('keyup', function(e) {
    console.log("键盘事件");
}, false);
```

### 事件绑定方式对比

### DOM0级事件绑定

```
javascript// 方式1：直接赋值
element.onclick = function() { alert('Hello'); };

// 方式2：通过HTML属性
// <button onclick="alert('Hello')">点击</button>
```

### DOM2级事件绑定

```
javascript// 可以绑定多个事件处理函数
element.addEventListener('click', function() { alert('Hello1'); });
element.addEventListener('click', function() { alert('Hello2'); });
```

### 实际应用区别

```
javascriptlet button = document.querySelector('#button');

// DOM0级 - 后一个会覆盖前一个
button.onclick = function() { console.log('first'); };
button.onclick = function() { console.log('second'); }; 
// 只会输出 'second'

// DOM2级 - 两个都会执行
button.addEventListener('click', function() { console.log('first'); });
button.addEventListener('click', function() { console.log('second'); });
// 会依次输出 'first' 和 'second'
```
---
title: "JavaScript 异步与原型链：事件循环、Promise 和继承"
date: 2026-04-22 21:30:00
tags:
  - "前端八股"
  - "JavaScript"
  - "事件循环"
  - "Promise"
  - "原型链"
categories:
  - "前端开发"
  - "前端八股"
---


定时器为什么比同步代码晚，`async / await` 为什么还是受事件循环调度，`new` 出来的实例怎么沿原型链找属性，`instanceof`、`Object.create` 和 `class` 又各自操作的是哪一层关系——这些问题可以分成异步执行和对象继承两条线来理解。

## 一、为什么 JavaScript 需要事件循环

JavaScript 是单线程的，同一时刻只执行一段 JavaScript 代码。

单线程就意味着同一时刻只能干一件事。那问题来了：

- 网络请求怎么办
- 定时器怎么办
- DOM 事件怎么办
- Promise 回调怎么办

事件循环就是用来在单线程下协调这些异步任务的。

它的价值主要有三点：

1. 实现非阻塞 I/O
2. 保证界面的响应性
3. 支持异步编程模型

## 二、事件循环的核心组成

一般从这几块来理解：

- 调用栈（Call Stack）
- 堆（Heap）
- 宏任务队列
- 微任务队列
- 事件循环本身

### 1. 宏任务

常见的宏任务：

- `setTimeout`
- `setInterval`
- DOM 事件回调
- I/O 回调
- UI 渲染

### 2. 微任务

常见的微任务：

- `Promise.then / catch / finally`
- `queueMicrotask`
- `MutationObserver`
- `process.nextTick`（Node 环境）

### 3. 一轮事件循环大致做什么

简化地说：

1. 先执行同步代码，清空当前的调用栈
2. 执行这一轮产生的所有微任务
3. 可能会渲染一次页面
4. 再从宏任务队列里取下一个任务执行

所以常说：

"微任务优先于下一轮宏任务。"

## 三、经典异步题为什么总考

因为它能同时考到这几件事：

- 同步与异步
- 宏任务与微任务
- `async / await` 的本质
- Promise 回调的调度时机

比如这段代码：

```js
console.log("script start");

setTimeout(() => {
  console.log("setTimeout");
}, 0);

Promise.resolve().then(() => {
  console.log("promise then");
});

console.log("script end");
```

输出顺序是：

```js
script start
script end
promise then
setTimeout
```

原因：

- 同步代码先跑完
- 先清空微任务队列
- 然后才轮到定时器这个宏任务

## 四、Promise 到底解决了什么问题

Promise 把异步结果包装成一个"将来能用的值"，并提供统一的状态流转和链式调用。

### 1. 三种状态

- `pending`
- `fulfilled`
- `rejected`

### 2. 状态不可逆

状态变化有明确的边界：

- 一旦从 `pending` 变成成功或失败
- 就不会再变回去了

### 3. `executor` 是同步执行的

```js
const p = new Promise((resolve, reject) => {
  console.log("executor");
  resolve(1);
});
```

很多人以为 Promise 一创建就是异步的，其实不对。Promise 构造器里的执行器函数本身是同步执行的，异步的是后面回调的调度。

## 五、Promise 的常用实例方法

### 1. `.then`

处理成功的结果，也可以接收失败的处理函数。

```js
promise.then(onFulfilled, onRejected);
```

### 2. `.catch`

集中处理失败的分支。

### 3. `.finally`

不管成功还是失败，只在最后收尾时执行。

## 六、`.then().catch()` 和 `.then(success, fail)` 的区别

两种写法的错误边界不一样。

更推荐：

```js
promise.then(success).catch(fail);
```

因为第二种写法只处理 Promise 本身的拒绝；`success` 回调里要是又抛了错，`then(success, fail)` 没法像链式的 `catch` 那样把后面的错误都兜住。

## 七、`async / await` 为什么更好用

### 1. 可读性更强

它把异步流程写出了同步代码的结构感。

### 2. 错误处理更自然

可以直接配合 `try...catch`。

### 3. 调试体验更好

Promise 链写长了，调用栈和分支都不好跟；`async / await` 一般更清楚。

### 4. 本质并没有改变事件循环规则

`await` 不会阻塞主线程，它只是把后面的逻辑放到 Promise resolve 之后再接着执行。

## 八、`await` 默认是串行的，想并发要主动设计

这一点很关键。

### 1. 串行写法

```js
const a = await fetchA();
const b = await fetchB();
```

两个请求互不依赖的话，这样写会让第二个请求白白等第一个请求结束。

### 2. 并发写法

```js
const pa = fetchA();
const pb = fetchB();

const [a, b] = await Promise.all([pa, pb]);
```

优化异步请求时，先判断依赖关系：

- 该串行的就串行
- 能并发的就并发
- 注意失败策略和兜底逻辑

## 九、Promise 并发工具怎么选

### 1. `Promise.all`

- 全成功才算成功
- 有一个失败就整体失败

适合"必须全部完成"的场景。

### 2. `Promise.allSettled`

- 不要求全成功
- 会告诉你每一项最后是 fulfilled 还是 rejected

适合批量任务统计结果。

### 3. `Promise.race`

- 谁先结束就用谁

适合超时控制、抢第一个结果。

### 4. `Promise.any`

- 谁先成功就返回谁
- 全失败才整体失败

适合多个来源互相兜底。

## 十、手写 Promise 该抓哪些核心点

简化实现先保留四个必要的部分：

1. Promise 有状态
2. 状态只能从 `pending` 变一次
3. `then` 要收集成功和失败的回调
4. 状态变了以后要触发对应的回调

简化版的思路一般是这样：

```js
class MyPromise {
  constructor(executor) {
    this.state = "pending";
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.state !== "pending") return;
      this.state = "fulfilled";
      this.value = value;
      this.onFulfilledCallbacks.forEach((fn) => fn());
    };

    const reject = (reason) => {
      if (this.state !== "pending") return;
      this.state = "rejected";
      this.reason = reason;
      this.onRejectedCallbacks.forEach((fn) => fn());
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
}
```

完整实现还要遵守 Promises/A+ 的解析过程；这个简化版只覆盖了状态、回调队列、链式返回和异常捕获的大方向。

## 十一、构造函数和 `new` 到底发生了什么

### 1. 构造函数是什么

本质上还是普通函数，只是按约定用来创建同一类的对象实例。

### 2. `new` 的执行机制

`new Foo()` 大致做了这几步：

1. 创建一个新对象
2. 把新对象的隐式原型指向 `Foo.prototype`
3. 用新对象当 `this` 执行构造函数
4. 构造函数没有显式返回对象的话，就返回这个新对象

很多手写 `new` 的题就是从这来的。

## 十二、原型、`__proto__` 和原型链

这部分是 JavaScript 面向对象的底层基础。

### 1. `prototype`

函数对象才有显式的 `prototype` 属性，一般用来放实例共享的方法。

### 2. `__proto__`

对象实例一般可以通过 `__proto__` 访问它的隐式原型。平时业务代码不推荐依赖它，但理解它很重要。

### 3. 原型链

读对象的属性时：

1. 先找对象自己身上的
2. 没找到就沿着原型往上找
3. 一直找到 `null` 为止

这条查找的链路就是原型链。

### 4. 两个很重要的特性

- 共享：方法挂在原型上，实例共享，省内存
- 动态：原型上新加的方法，已有的实例一般也能访问到

## 十三、`instanceof` 的原理

一句话：

沿着左边对象的原型链，看右边构造函数的 `prototype` 有没有出现过。

所以它的局限也很明显：

- 判断不了原始类型
- 跨 iframe / realm 可能不准
- 原型链被改过以后，结果也可能跟着变

## 十四、`Object.create` 为什么重要

`Object.create(proto)` 的作用：创建一个新对象，让它的原型指向 `proto`。

常用在：

- 更纯粹的原型继承
- 创建没有原型的对象
- 组合继承里当中间的桥梁

这也是"寄生组合式继承"里常见的关键一步。

## 十五、`class` 本质上还是原型链

ES6 的 `class` 是语法糖，不是一套完全不同的机制。

### 1. 它带来了更清晰的写法

```js
class Person {
  constructor(name) {
    this.name = name;
  }

  sayHi() {
    return `Hi, ${this.name}`;
  }
}
```

### 2. 但底层仍然是原型

- 实例方法还是挂在原型上
- 继承还是建立在原型链上

### 3. `super()` 为什么必须先调

子类构造函数里必须先调 `super()`，本质上是先完成父类的初始化，才能接着用子类实例的 `this`。

## 十六、常见继承方式怎么理解

### 1. 原型链继承

让子类实例通过原型链访问父类的方法，但引用类型的属性容易被共享。

### 2. 构造函数继承

在子类构造函数里调父类构造函数，能拿到独立的实例属性，但复用不了父类原型上的方法。

### 3. 组合继承

把上面两种拼起来，能用，但父类构造函数可能会执行两次。

### 4. 寄生组合式继承

ES5 时代比较推荐的写法，实例属性独立，原型方法也能复用。

### 5. ES6 `extends`

现代开发里最推荐的写法，本质上是对原型链继承的语法糖封装。

## 十七、几个容易混淆的边界

### 1. 宏任务和微任务要按轮次分析

一轮同步代码结束后会先清空微任务队列，所以 `Promise.then` 比下一轮的 `setTimeout` 早。

### 2. Promise 的三个状态约束

- executor 是同步的
- 状态不可逆
- `then` 返回新的 Promise，能链式调用

### 3. `async / await` 没有改变调度模型

它改善的是顺序代码的写法，后面的逻辑还是由 Promise 和微任务接着调度。

### 4. new、原型链与继承是一组连续操作

`instanceof` 沿原型链判断关系，继承负责把这条关系建起来，`Object.create` 则直接指定新对象的原型。

### 5. 执行时机与属性来源分开判断

事件循环、Promise 和 `async / await` 决定代码什么时候接着执行；构造函数、原型链、`class` 和继承决定对象从哪拿到属性和方法。碰到混在一起的题，先判断它属于哪一条线。

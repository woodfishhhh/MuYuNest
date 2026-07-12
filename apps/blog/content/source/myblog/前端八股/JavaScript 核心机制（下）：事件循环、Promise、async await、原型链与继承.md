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


定时器为什么晚于同步代码，`async / await` 为什么仍受事件循环调度，调用 `new` 后实例如何沿原型链查找属性，`instanceof`、`Object.create` 和 `class` 又分别操作哪一层关系，这些问题可以分成异步执行与对象继承两条线来理解。

## 一、为什么 JavaScript 需要事件循环

JavaScript 是单线程，同一时刻只执行一段 JavaScript 代码。

单线程意味着同一时刻只能做一件事。那么问题来了：

- 网络请求怎么办
- 定时器怎么办
- DOM 事件怎么办
- Promise 回调怎么办

事件循环就是为了解决单线程下的异步协调问题。

它的价值主要体现在三点：

1. 实现非阻塞 I/O
2. 保证界面响应性
3. 支持异步编程模型

## 二、事件循环的核心组成

通常可以从这几个部分理解：

- 调用栈（Call Stack）
- 堆（Heap）
- 宏任务队列
- 微任务队列
- 事件循环本身

### 1. 宏任务

常见宏任务有：

- `setTimeout`
- `setInterval`
- DOM 事件回调
- I/O 回调
- UI 渲染

### 2. 微任务

常见微任务有：

- `Promise.then / catch / finally`
- `queueMicrotask`
- `MutationObserver`
- `process.nextTick`（Node 环境）

### 3. 一轮事件循环大致做什么

简化理解：

1. 先执行同步代码，清空当前调用栈
2. 执行当前轮次产生的所有微任务
3. 可能进行页面渲染
4. 再从宏任务队列中取下一个任务执行

这就是为什么大家常说：

“微任务优先于下一轮宏任务。”

## 三、经典异步题为什么总考

因为它能同时检查你对这几件事的理解：

- 同步与异步
- 宏任务与微任务
- `async / await` 本质
- Promise 回调调度时机

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

原因就在于：

- 同步代码先跑完
- 微任务队列先清空
- 然后才轮到定时器宏任务

## 四、Promise 到底解决了什么问题

Promise 的作用是把异步结果包装成“未来可用的值”，并提供统一的状态流转和链式调用能力。

### 1. 三种状态

- `pending`
- `fulfilled`
- `rejected`

### 2. 状态不可逆

状态变化有明确边界：

- 一旦从 `pending` 变成成功或失败
- 状态就不会再变回去

### 3. `executor` 是同步执行的

```js
const p = new Promise((resolve, reject) => {
  console.log("executor");
  resolve(1);
});
```

很多人以为 Promise 一创建就是异步，这不对。Promise 构造器里的执行器函数本身是同步执行的，异步的是后续回调调度。

## 五、Promise 的常用实例方法

### 1. `.then`

用于处理成功结果，也可以接收失败处理函数。

```js
promise.then(onFulfilled, onRejected);
```

### 2. `.catch`

用于集中处理失败分支。

### 3. `.finally`

不关心成功还是失败，只在最终收尾时执行。

## 六、`.then().catch()` 和 `.then(success, fail)` 的区别

两种写法的错误边界不同。

更推荐：

```js
promise.then(success).catch(fail);
```

原因是第二种写法只会处理 Promise 本身的拒绝，而 `success` 回调里如果再抛错，`then(success, fail)` 并不能像链式 `catch` 那样自然兜住所有后续错误。

## 七、`async / await` 为什么更好用

### 1. 可读性更强

它把异步流程写出了同步代码的结构感。

### 2. 错误处理更自然

可以直接配合 `try...catch`。

### 3. 调试体验更好

链式 Promise 写长了之后，栈和分支都不好跟；`async / await` 通常更清晰。

### 4. 本质并没有改变事件循环规则

`await` 不是阻塞主线程，它只是把后续逻辑放到 Promise resolve 之后继续执行。

## 八、`await` 默认是串行的，想并发要主动设计

这点非常关键。

### 1. 串行写法

```js
const a = await fetchA();
const b = await fetchB();
```

如果两个请求彼此独立，上面这样会让第二个请求白白等待第一个请求结束。

### 2. 并发写法

```js
const pa = fetchA();
const pb = fetchB();

const [a, b] = await Promise.all([pa, pb]);
```

优化异步请求时要先判断依赖关系：

- 能串行就串行
- 能并发就并发
- 注意失败策略和兜底逻辑

## 九、Promise 并发工具怎么选

### 1. `Promise.all`

- 全成功才成功
- 任何一个失败就整体失败

适合“必须全部完成”的场景。

### 2. `Promise.allSettled`

- 不要求全成功
- 会告诉你每一项最终是 fulfilled 还是 rejected

适合批量任务统计结果。

### 3. `Promise.race`

- 谁先结束就用谁

适合超时控制、抢首个结果。

### 4. `Promise.any`

- 谁先成功就返回谁
- 全失败才整体失败

适合多源兜底。

## 十、手写 Promise 该抓哪些核心点

简化实现先保留四个必要部分：

1. Promise 有状态
2. 状态只能从 `pending` 变一次
3. `then` 需要收集成功和失败回调
4. 状态改变后要触发对应回调

简化版思路通常如下：

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

完整实现还要遵守 Promises/A+ 的解析过程；这个简化版本只覆盖状态、回调队列、链式返回和异常捕获的基本方向。

## 十一、构造函数和 `new` 到底发生了什么

### 1. 构造函数是什么

本质上还是普通函数，只不过约定俗成用来创建同类对象实例。

### 2. `new` 的执行机制

`new Foo()` 大致会做这几步：

1. 创建一个新对象
2. 把新对象的隐式原型指向 `Foo.prototype`
3. 用新对象作为 `this` 执行构造函数
4. 如果构造函数没有显式返回对象，则返回这个新对象

这就是很多手写 `new` 题的来源。

## 十二、原型、`__proto__` 和原型链

这部分是 JavaScript 面向对象的底层基础。

### 1. `prototype`

函数对象才有显式的 `prototype` 属性，它通常用来放实例共享的方法。

### 2. `__proto__`

对象实例通常可以通过 `__proto__` 访问其隐式原型。虽然平时不推荐业务代码依赖它，但理解它非常重要。

### 3. 原型链

当你读取对象属性时：

1. 先找对象自身
2. 没找到就沿着原型向上找
3. 一直找到 `null` 为止

这条查找链路就是原型链。

### 4. 两个很重要的特性

- 共享性：方法挂原型上，实例共享，节省内存
- 动态性：原型上新增方法，已有实例通常也能访问到

## 十三、`instanceof` 的原理

一句话概括：

它是沿着左侧对象的原型链，去找右侧构造函数的 `prototype` 是否出现过。

所以它的局限也很明显：

- 不能正确判断原始类型
- 跨 iframe / realm 可能失真
- 原型链被改动后结果也可能变化

## 十四、`Object.create` 为什么重要

`Object.create(proto)` 的作用是：创建一个新对象，并让它的原型指向 `proto`。

它常用于：

- 更纯粹的原型继承
- 创建无原型对象
- 组合继承里的中间桥梁

这也是“寄生组合式继承”常见的关键步骤。

## 十五、`class` 本质上还是原型链

ES6 的 `class` 是语法糖，不是完全不同的一套机制。

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

- 实例方法仍然挂在原型上
- 继承仍然建立在原型链之上

### 3. `super()` 为什么必须先调

在子类构造函数里，必须先调用 `super()`，本质上是先完成父类初始化，才能继续使用子类实例的 `this`。

## 十六、常见继承方式怎么理解

### 1. 原型链继承

让子类实例通过原型链访问父类方法，但容易共享引用属性。

### 2. 构造函数继承

在子类构造函数中调用父类构造函数，能拿到独立实例属性，但拿不到父类原型方法复用。

### 3. 组合继承

把上面两种拼起来，能用，但父类构造函数可能执行两次。

### 4. 寄生组合式继承

ES5 时代比较推荐的写法，兼顾实例属性独立与原型方法复用。

### 5. ES6 `extends`

现代开发里最推荐的写法，本质上是对原型链继承的语法糖封装。

## 十七、几个容易混淆的边界

### 1. 宏任务和微任务要按轮次分析

一轮同步代码结束后会先清空微任务队列，所以 `Promise.then` 早于下一轮 `setTimeout`。

### 2. Promise 的三个状态约束

- executor 是同步的
- 状态不可逆
- `then` 返回新 Promise，可链式调用

### 3. `async / await` 没有改变调度模型

它改善了顺序代码的表达方式，后续逻辑仍由 Promise 和微任务继续调度。

### 4. new、原型链与继承是一组连续操作

`instanceof` 沿原型链判断关系，继承负责建立这条关系，`Object.create` 则直接指定新对象的原型。

### 5. 执行时机与属性来源分开判断

事件循环、Promise 和 `async / await` 决定代码何时继续执行；构造函数、原型链、`class` 和继承决定对象从哪里取得属性与方法。遇到混合题时，先判断它属于哪一条线。

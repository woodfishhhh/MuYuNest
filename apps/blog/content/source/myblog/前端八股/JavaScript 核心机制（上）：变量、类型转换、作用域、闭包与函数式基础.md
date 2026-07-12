---
title: "JavaScript 变量、类型转换、作用域与闭包"
date: 2026-04-22 21:20:00
tags:
  - "前端八股"
  - "JavaScript"
  - "作用域"
  - "闭包"
  - "this"
categories:
  - "前端开发"
  - "前端八股"
---


`var / let / const` 的提升规则不同，隐式转换会改变运算结果，`this` 又取决于调用方式。`call / apply / bind`、闭包和防抖节流看似分散，实际都依赖变量如何绑定、函数如何创建和执行。

## 一、`var`、`let`、`const` 到底区别在哪

### 1. `var` 的特点

判断变量声明行为时，先看下面几个维度：

- 函数作用域
- 变量提升
- 可以重复声明
- 可以重新赋值

它最大的问题有两个：

#### 变量提升

```js
function varExample() {
  console.log(a); // undefined
  var a = 10;
  console.log(a); // 10
}
```

`var` 的声明会提升到作用域顶部，初始化值是 `undefined`，所以不会立刻报错，但非常容易制造认知偏差。

#### 缺乏块级作用域

```js
function varExample() {
  var a = 10;

  if (true) {
    var a = 20;
  }

  console.log(a); // 20
}
```

`if`、`for` 这种块不会隔离 `var`，变量会“泄露”出来，这也是很多老代码 bug 的来源。

### 2. `let`

`let` 的核心优势是：

- 块级作用域
- 不允许同一作用域重复声明
- 存在暂时性死区
- 可以重新赋值

```js
let b = 10;

if (true) {
  let b = 20;
  console.log(b); // 20
}

console.log(b); // 10
```

### 3. `const`

`const` 和 `let` 一样拥有块级作用域和暂时性死区，不同点在于它声明后不能重新赋值。

但要特别注意：

- `const` 不能改“绑定关系”
- 不等于内部数据完全不可变

```js
const obj = { count: 1 };
obj.count = 2; // 可以

// obj = {} // 报错
```

### 4. 什么是暂时性死区（TDZ）

从作用域开始到变量声明完成之前，这段区域就叫暂时性死区。

```js
{
  // console.log(x); // ReferenceError
  let x = 1;
}
```

TDZ 让声明前访问直接抛错，避免 `var` 在提升后先得到 undefined 所造成的隐蔽问题。

### 5. 和全局对象的关系

全局作用域还要区分变量是否成为全局对象的属性：

- 用 `var` 在全局作用域声明的变量，通常会挂到全局对象上
- `let` 和 `const` 不会以同样方式挂到全局对象

## 二、数据类型和 `typeof` 的常见陷阱

### 1. JavaScript 的类型划分

JavaScript 的类型可以先分成：

- 7 种原始类型
- 1 种对象类型

常见原始类型包括：

- `string`
- `number`
- `boolean`
- `undefined`
- `null`
- `symbol`
- `bigint`

除此之外，剩下的大部分复杂结构都属于对象。

### 2. `typeof` 能做什么

`typeof` 适合做基础类型快速判断，例如：

```js
typeof 123; // "number"
typeof "abc"; // "string"
typeof true; // "boolean"
typeof undefined; // "undefined"
typeof Symbol(); // "symbol"
typeof 10n; // "bigint"
```

### 3. `typeof` 的两个经典坑

#### 坑一：`typeof null === "object"`

这是语言历史遗留问题，不能拿来判断 `null`。

#### 坑二：数组、对象、日期、正则都会得到 `"object"`

因此，精确判断对象类型时不能只用 `typeof`。

更稳妥的方式是：

```js
Object.prototype.toString.call([]);
// "[object Array]"
```

## 三、隐式类型转换为什么总是容易错

### 1. 本质：JavaScript 会自动做类型转换

尤其在运算和比较时，JavaScript 会尝试把不同类型转成某个可比较的形式。

核心入口通常是 `ToPrimitive`。

### 2. `+` 的规则

- 只要一边是字符串，就更容易走字符串拼接
- 否则更多是数字加法

```js
console.log(1 + "2"); // "12"
console.log(true + true); // 2
console.log(1 + null); // 1
console.log(1 + undefined); // NaN
```

### 3. `==` 的规则为什么危险

`==` 允许隐式转换，所以容易出现看起来“违反直觉”的结果。

比如：

```js
console.log(null == undefined); // true
console.log("123" == 123); // true
console.log(true == 1); // true
```

最经典的经验是：

- 业务代码优先用 `===`
- 还要知道 `==` 为什么会产生这些结果

### 4. Truthy 和 Falsy

Truthy 和 Falsy 也属于隐式转换的一部分。

常见 Falsy 值：

- `false`
- `0`
- `""`
- `null`
- `undefined`
- `NaN`

除这些之外，大多数值都是真值。

## 四、数组方法先区分是否修改原数组

### 1. `map`

- 核心：转换
- 返回：新数组
- 不改原数组

```js
const numbers = [1, 4, 9];
const doubles = numbers.map((num) => num * 2);
```

### 2. `filter`

- 核心：筛选
- 返回：新数组
- 不改原数组

### 3. `reduce`

- 核心：汇总、累加、折叠
- 返回：一个最终结果
- 不改原数组

```js
const nums = [1, 2, 3, 4];
const total = nums.reduce((acc, cur) => acc + cur, 0);
```

### 4. `splice`

- 核心：原地增删改
- 会修改原数组
- 是典型的 mutating 方法

### 5. `slice`

- 核心：切片
- 返回新数组
- 不改原数组

### 6. `map` 和 `forEach` 区别

两者都能遍历，但用途不同。

- `map` 用于“基于原数组生成新数组”
- `forEach` 更适合“只是做副作用操作”

### 7. `for...in` 和 `for...of`

这是对象和可迭代协议的分界线。

- `for...in` 遍历键名，适合对象属性枚举
- `for...of` 遍历值，适合数组、字符串、Map、Set 等可迭代对象

普通对象不能直接 `for...of`，除非你自己实现 `Symbol.iterator`。

## 五、执行上下文和作用域链是理解闭包的前提

### 1. 什么是执行上下文

JavaScript 代码运行时会进入不同的执行上下文，例如：

- 全局执行上下文
- 函数执行上下文

它们会被组织在调用栈中。

### 2. 什么是作用域链

函数在定义时就决定了它能访问哪些外层变量，这就是词法作用域。多个词法环境串起来，就是作用域链。

这句话非常关键：

“函数能访问什么变量，不取决于它在哪里调用，而取决于它在哪里定义。”

## 六、`this` 指向必须按规则判断

`this` 不是写函数时就固定的，它通常取决于调用方式。

最常见的几条规则：

### 1. 默认绑定

普通函数直接调用，`this` 在非严格模式下通常指向全局对象。

### 2. 隐式绑定

对象方法调用时，`this` 指向调用它的对象。

### 3. 显式绑定

`call`、`apply`、`bind` 可以显式指定 `this`。

### 4. `new` 绑定

使用 `new` 调用函数时，`this` 会绑定到新创建的实例对象上。

## 七、`call`、`apply`、`bind` 怎么区分

### 1. `call`

立即执行，参数逐个传。

```js
fn.call(obj, arg1, arg2);
```

### 2. `apply`

立即执行，参数以数组形式传。

```js
fn.apply(obj, [arg1, arg2]);
```

### 3. `bind`

不立即执行，返回一个新函数，并永久绑定 `this`。

```js
const newFn = fn.bind(obj);
newFn();
```

### 4. `bind` 和 `new` 的关系

即使事先 `bind` 了某个对象，后面用 `new` 调用绑定函数时，`new` 的优先级仍然更高，`this` 会指向新实例。

## 八、IIFE 为什么曾经特别重要

IIFE 就是立即执行函数表达式。

```js
(function () {
  var privateVariable = "我是私有的";
  console.log(privateVariable);
})();
```

它的作用有两个：

- 隔离作用域，避免污染全局
- 在 `var` 时代解决循环异步捕获问题

例如：

```js
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
```

在 `let` 出现之前，IIFE 常用来为每次循环创建独立作用域。

## 九、闭包到底是什么

闭包不是一个“特殊语法”，而是一种现象：

一个函数可以访问并持续持有其外层作用域中的变量，即使外层函数已经执行结束。

### 1. 典型例子

```js
function createCounter() {
  let count = 0;
  return function () {
    count++;
    return count;
  };
}

const counter = createCounter();
counter(); // 1
counter(); // 2
```

这里返回的内部函数就形成了闭包。

### 2. 闭包的价值

- 封装私有状态
- 延长变量生命周期
- 实现函数工厂
- 实现防抖、节流、once 等工具函数

### 3. 闭包的注意事项

使用闭包时要注意四个边界：

- 闭包会带来额外内存开销
- 捕获的是“变量引用”，不是快照值
- 它建立在词法作用域之上
- 在异步回调里尤其常见

## 十、高阶函数与柯里化

### 1. 什么是高阶函数

满足任一条件就可以称为高阶函数：

- 接收函数作为参数
- 返回函数作为结果

比如 `map`、`filter`、`reduce` 都是高阶函数。

### 2. 什么是柯里化

柯里化是把“接收多个参数的函数”拆成“多次接收单个参数的函数”。

```js
function add(a) {
  return function (b) {
    return a + b;
  };
}
```

它的常见价值包括：

- 参数复用
- 延迟执行
- 配置化封装

## 十一、防抖与节流

### 1. 节流（throttle）

节流强调“固定频率执行”，保证一段时间内最多执行一次。

典型场景：

- `scroll`
- `resize`
- `mousemove`

```js
function throttle(fn, delay) {
  let lastTime = 0;

  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}
```

### 2. 防抖（debounce）

防抖强调“停止触发后再执行”，保证连续触发期间只执行最后一次。

典型场景：

- 搜索框输入联想
- 按钮重复点击
- 表单校验

```js
function debounce(fn, delay) {
  let timer = null;

  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
```

### 3. 核心区别

- 节流：控制频率，定期执行
- 防抖：等到安静下来，只执行最后一次

## 十二、纯函数和副作用

### 1. 纯函数

纯函数满足两点：

- 相同输入一定得到相同输出
- 不依赖外部可变状态，也不修改外部状态

### 2. 副作用

副作用指函数执行时，除了返回值之外，还对外部世界产生了影响，例如：

- 修改全局变量
- 改 DOM
- 发请求
- 写日志
- 写本地存储

在工程实践里，纯函数更容易测试和推理，而副作用通常需要被集中管理和隔离。

## 十三、几个容易混淆的边界

### 1. `var / let / const` 不只差在能否重新赋值

还要同时检查作用域、变量提升、TDZ 和全局对象关系。

### 2. 闭包同时影响封装和内存

闭包让函数持有定义时词法环境中的变量引用，可用于封装私有状态，也会延长相关变量的生命周期。

### 3. `call / apply / bind` 都在改变调用关系

理解绑定过程后，再看手写实现会更清楚：把函数临时放到对象上执行，然后删除临时属性。

### 4. 防抖和节流取决于触发策略

节流保证一段时间内最多执行一次，防抖则等待连续触发停止后再执行。选哪一种，要看业务是需要持续反馈还是只关心最终结果。

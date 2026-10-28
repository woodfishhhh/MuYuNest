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


`var / let / const` 的提升规则不一样，隐式转换会改掉运算结果，`this` 又看调用方式。`call / apply / bind`、闭包和防抖节流看着很散，其实都跟变量怎么绑定、函数怎么创建和执行有关。

## 一、`var`、`let`、`const` 到底区别在哪

### 1. `var` 的特点

判断变量的声明行为，先看这几项：

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

`var` 的声明会被提到作用域顶部，初始值是 `undefined`，所以不会马上报错，但特别容易让人理解错。

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

`if`、`for` 这种块隔不住 `var`，变量会"漏"出来，很多老代码的 bug 就是这么来的。

### 2. `let`

`let` 的好处：

- 块级作用域
- 同一个作用域里不能重复声明
- 有暂时性死区
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

`const` 和 `let` 一样有块级作用域和暂时性死区，区别是声明以后不能重新赋值。

但要注意：

- `const` 不能改的是"绑定关系"
- 里面的数据不一定完全不可变

```js
const obj = { count: 1 };
obj.count = 2; // 可以

// obj = {} // 报错
```

### 4. 什么是暂时性死区（TDZ）

从作用域开始到变量声明完成之前的这一段，就叫暂时性死区。

```js
{
  // console.log(x); // ReferenceError
  let x = 1;
}
```

TDZ 让声明之前的访问直接抛错，避免了 `var` 提升后先拿到 undefined 带来的隐蔽问题。

### 5. 和全局对象的关系

全局作用域里还要看变量会不会变成全局对象的属性：

- 在全局作用域用 `var` 声明的变量，一般会挂到全局对象上
- `let` 和 `const` 不会这样挂到全局对象上

## 二、数据类型和 `typeof` 的常见陷阱

### 1. JavaScript 的类型划分

JavaScript 的类型可以先分成：

- 7 种原始类型
- 1 种对象类型

常见的原始类型：

- `string`
- `number`
- `boolean`
- `undefined`
- `null`
- `symbol`
- `bigint`

除了这些，剩下的大部分复杂结构都是对象。

### 2. `typeof` 能做什么

`typeof` 适合快速判断基础类型，比如：

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

这是语言的历史遗留问题，不能拿它判断 `null`。

#### 坑二：数组、对象、日期、正则都会得到 `"object"`

所以要精确判断对象的类型，光用 `typeof` 不行。

更稳的办法：

```js
Object.prototype.toString.call([]);
// "[object Array]"
```

## 三、隐式类型转换为什么总是容易错

### 1. 本质：JavaScript 会自动做类型转换

特别是在运算和比较时，JavaScript 会试着把不同的类型转成能比较的形式。

入口一般是 `ToPrimitive`。

### 2. `+` 的规则

- 只要有一边是字符串，一般就走字符串拼接
- 否则多半是数字加法

```js
console.log(1 + "2"); // "12"
console.log(true + true); // 2
console.log(1 + null); // 1
console.log(1 + undefined); // NaN
```

### 3. `==` 的规则为什么危险

`==` 允许隐式转换，所以容易出现看着"不合常理"的结果。

比如：

```js
console.log(null == undefined); // true
console.log("123" == 123); // true
console.log(true == 1); // true
```

经验是：

- 业务代码优先用 `===`
- 但也要知道 `==` 为什么会得出这些结果

### 4. Truthy 和 Falsy

Truthy 和 Falsy 也属于隐式转换。

常见的 Falsy 值：

- `false`
- `0`
- `""`
- `null`
- `undefined`
- `NaN`

除了这些，大多数值都是真值。

## 四、数组方法先区分是否修改原数组

### 1. `map`

- 干什么：转换
- 返回：新数组
- 不改原数组

```js
const numbers = [1, 4, 9];
const doubles = numbers.map((num) => num * 2);
```

### 2. `filter`

- 干什么：筛选
- 返回：新数组
- 不改原数组

### 3. `reduce`

- 干什么：汇总、累加、折叠
- 返回：一个最终结果
- 不改原数组

```js
const nums = [1, 2, 3, 4];
const total = nums.reduce((acc, cur) => acc + cur, 0);
```

### 4. `splice`

- 干什么：原地增删改
- 会改原数组
- 典型的 mutating 方法

### 5. `slice`

- 干什么：切片
- 返回新数组
- 不改原数组

### 6. `map` 和 `forEach` 区别

两个都能遍历，但用途不一样。

- `map` 用来"基于原数组生成一个新数组"
- `forEach` 更适合"只做副作用操作"

### 7. `for...in` 和 `for...of`

这是对象和可迭代协议的分界线。

- `for...in` 遍历键名，适合枚举对象属性
- `for...of` 遍历值，适合数组、字符串、Map、Set 这些可迭代对象

普通对象不能直接 `for...of`，除非自己实现 `Symbol.iterator`。

## 五、执行上下文和作用域链是理解闭包的前提

### 1. 什么是执行上下文

JavaScript 代码运行时会进入不同的执行上下文，比如：

- 全局执行上下文
- 函数执行上下文

它们按调用栈组织起来。

### 2. 什么是作用域链

函数在定义时就决定了能访问哪些外层变量，这就是词法作用域。好几层词法环境串起来，就是作用域链。

记住这句：

"函数能访问什么变量，不看它在哪里调用，而看它在哪里定义。"

## 六、`this` 指向必须按规则判断

`this` 不是写函数时就定死的，一般看调用方式。

最常见的几条规则：

### 1. 默认绑定

普通函数直接调用，非严格模式下 `this` 一般指向全局对象。

### 2. 隐式绑定

作为对象方法调用时，`this` 指向调用它的那个对象。

### 3. 显式绑定

`call`、`apply`、`bind` 能显式指定 `this`。

### 4. `new` 绑定

用 `new` 调用函数时，`this` 绑定到新创建的实例对象上。

## 七、`call`、`apply`、`bind` 怎么区分

### 1. `call`

马上执行，参数一个个传。

```js
fn.call(obj, arg1, arg2);
```

### 2. `apply`

马上执行，参数用数组传。

```js
fn.apply(obj, [arg1, arg2]);
```

### 3. `bind`

不马上执行，返回一个新函数，`this` 被永久绑定。

```js
const newFn = fn.bind(obj);
newFn();
```

### 4. `bind` 和 `new` 的关系

就算事先 `bind` 了某个对象，之后用 `new` 调这个绑定函数时，`new` 的优先级还是更高，`this` 会指向新实例。

## 八、IIFE 为什么曾经特别重要

IIFE 就是立即执行函数表达式。

```js
(function () {
  var privateVariable = "我是私有的";
  console.log(privateVariable);
})();
```

它有两个作用：

- 隔离作用域，不污染全局
- 在 `var` 时代解决循环里异步回调捕获变量的问题

比如：

```js
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
```

`let` 出现之前，IIFE 常用来给每一次循环建一个独立的作用域。

## 九、闭包到底是什么

闭包不是什么"特殊语法"，而是一种现象：

一个函数能访问并一直持有外层作用域里的变量，就算外层函数已经执行完了。

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
- 延长变量的生命周期
- 实现函数工厂
- 实现防抖、节流、once 这类工具函数

### 3. 闭包的注意事项

用闭包时注意四点：

- 闭包会带来额外的内存开销
- 捕获的是"变量的引用"，不是值的快照
- 它建立在词法作用域之上
- 在异步回调里特别常见

## 十、高阶函数与柯里化

### 1. 什么是高阶函数

满足下面任意一条就算高阶函数：

- 接收函数当参数
- 返回一个函数

比如 `map`、`filter`、`reduce` 都是高阶函数。

### 2. 什么是柯里化

柯里化是把"一次接收多个参数的函数"，拆成"分多次、每次接收一个参数的函数"。

```js
function add(a) {
  return function (b) {
    return a + b;
  };
}
```

常见的用处：

- 参数复用
- 延迟执行
- 配置化封装

## 十一、防抖与节流

### 1. 节流（throttle）

节流是"固定频率执行"，保证一段时间里最多执行一次。

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

防抖是"停止触发以后再执行"，保证连续触发期间只执行最后一次。

典型场景：

- 搜索框的输入联想
- 防按钮重复点击
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
- 防抖：等安静下来，只执行最后一次

## 十二、纯函数和副作用

### 1. 纯函数

纯函数满足两点：

- 同样的输入一定得到同样的输出
- 不依赖外部的可变状态，也不改外部状态

### 2. 副作用

副作用是函数执行时，除了返回值以外，还对外部世界产生了影响，比如：

- 改全局变量
- 改 DOM
- 发请求
- 写日志
- 写本地存储

实际工程里，纯函数更好测、更好推理，副作用一般要集中管理、隔离起来。

## 十三、几个容易混淆的边界

### 1. `var / let / const` 不只差在能否重新赋值

还要一起看作用域、变量提升、TDZ 以及和全局对象的关系。

### 2. 闭包同时影响封装和内存

闭包让函数持有定义时词法环境里变量的引用，能用来封装私有状态，也会延长相关变量的生命周期。

### 3. `call / apply / bind` 都在改变调用关系

弄懂绑定过程以后，再看手写实现会更清楚：把函数临时挂到对象上执行，执行完再删掉这个临时属性。

### 4. 防抖和节流取决于触发策略

节流保证一段时间里最多执行一次，防抖则是等连续触发停下来以后再执行。选哪个，看业务要的是持续的反馈，还是只关心最后的结果。

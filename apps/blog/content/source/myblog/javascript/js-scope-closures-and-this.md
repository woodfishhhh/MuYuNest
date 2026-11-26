---
title: "JavaScript 作用域、闭包、函数与 this 绑定"
slug: "js-scope-closures-and-this"
date: 2026-04-22 21:20:00
categories:
  - "前端开发"
tags:
  - "JavaScript"
  - "作用域"
  - "闭包"
  - "this"
  - "函数式编程"
---

`var` 声明的变量跑出了 `if` 代码块、定时回调里打印出来的对象属性突然变成 `undefined`、在对象方法里套了一层普通函数结果 `this` 整个丢失——这些问题都牵涉同一套运行机制：**词法作用域在定义时确定变量查找链，`this` 在调用时才绑定执行上下文**。把这两条线彻底拆开，闭包、高阶函数和箭头函数才不会互相打架。

## 变量声明、提升与暂时性死区（TDZ）

判断变量声明行为，先对比 `var`、`let` 和 `const` 的四条边界：

| 声明关键字 | 作用域范围 | 变量提升与初始状态 | 重复声明 | 全局声明是否挂载到 `window` |
| --- | --- | --- | --- | --- |
| `var` | 全局作用域 / 函数作用域（无块级隔离） | 声明提升到作用域顶部，初始化为 `undefined` | 允许（后覆盖前） | 是（浏览器全局下） |
| `let` | 块级作用域（`{}`、`if`、`for`） | 存在创建提升，但处于**暂时性死区** | 同作用域禁止 | 否 |
| `const` | 块级作用域 | 存在创建提升，处于**暂时性死区** | 同作用域禁止 | 否 |

**从进入块级作用域开始到 `let`/`const` 声明语句执行完成之前，该变量处于暂时性死区（TDZ），任何读写都会直接抛出 `ReferenceError`。**

```javascript
function demoScope() {
  // var 没有块级作用域，且会提升为 undefined
  console.log(legacy); // undefined
  if (true) {
    var legacy = "leaked";
    let modern = "scoped";
  }
  console.log(legacy); // "leaked"
  // console.log(modern); // ReferenceError: modern is not defined
}
```

同理，函数声明 `function foo() {}` 会整体提升到作用域顶部（声明前即可调用），而函数表达式 `const bar = function() {}` 与箭头函数 `const baz = () => {}` 遵循变量声明的规则，无法在赋值前调用。现代代码一律使用 `const` 优先、需要重绑再用 `let`，彻底淘汰 `var`。

## 执行上下文、词法作用域与闭包

每当 JavaScript 执行全局代码或进入函数调用，都会压入一个新的**执行上下文**到调用栈中。函数查找变量沿用的是**作用域链**。

**函数能访问哪些外层变量，取决于它“在哪里定义”（词法作用域），而完全不看它“在哪里调用”。**

### 闭包的形成与工程价值

当一个内层函数被返回或传递到外层函数外部，且它内部引用了外层作用域的变量时，外层函数执行完毕出栈后，这些被引用的变量并不会被垃圾回收，而是连同内层函数一起形成**闭包（Closure）**。

```javascript
function createCounter(initial = 0) {
  let count = initial; // 私有状态，外部无法直接篡改

  return {
    inc() {
      count += 1;
      return count;
    },
    value() {
      return count;
    },
  };
}

const counter = createCounter(10);
console.log(counter.inc());   // 11
console.log(counter.value()); // 11
```

工程中闭包主要服务于三类需求：封装模块私有状态（早期 IIFE 模块模式的核心）、构建参数复用的函数工厂与柯里化，以及保存定时器或事件回调中的上下文状态（如防抖、节流与 `once`）。

### 闭包的两条常见陷阱

1. **捕获的是变量引用而非值快照**：经典 `for (var i = 0; i < 3; i++)` 循环里挂 `setTimeout`，因为 `var` 共享同一个函数级 `i`，回调触发时全打印 `3`。改用 `let` 后每次迭代都会创建独立块级绑定（或以前用 IIFE 传参隔离）。
2. **意外持有大对象导致内存驻留**：闭包会延长外层词法环境中被引用对象的生命周期。长期存活的事件监听器、全局定时器里如果引用了大体积 DOM 节点或缓存数组，卸载组件时务必解绑回调或清理引用，避免内存持续增长。

## `this` 的四条绑定规则与箭头函数

和词法作用域不同，**普通函数的 `this` 在函数被调用的那一刻才确定**，判定顺序按优先级从高到低依次为：

1. **`new` 绑定**：用 `new Fn()` 调用时，`this` 绑定到新创建的实例对象（优先级高于 `bind`）。
2. **显式绑定**：通过 `fn.call(ctx, a, b)`、`fn.apply(ctx, [a, b])` 或 `fn.bind(ctx)` 强制指定 `this`。其中 `call`/`apply` 立即执行（传参分别是逐个列举与数组形式），`bind` 返回一个永久绑定了 `this` 的新函数供后续调用。
3. **隐式绑定**：作为对象方法调用 `obj.fn()` 时，`this` 指向调用点前最近的那个对象 `obj`。把方法赋值给临时变量再直接调用（`const f = obj.fn; f()`）会丢失隐式绑定。
4. **默认绑定**：独立直接调用 `fn()` 时，严格模式下 `this` 为 `undefined`，非严格模式下浏览器指向 `window`。

### 普通函数 vs 箭头函数

箭头函数和普通函数的核心区别全部围绕“是否拥有独立执行上下文绑定”展开：

| 对比项 | 普通函数（含对象方法简写） | 箭头函数 |
| --- | --- | --- |
| `this` 来源 | 动态绑定调用者 | **无自身 `this`，继承定义时外层词法作用域的 `this`** |
| `arguments` 对象 | 存在（类数组对象） | **无**（访问报错，一律改用 `...rest` 剩余参数） |
| 能否用 `new` 实例化 | 可以（拥有 `prototype`） | **不能**（无 `prototype`，调用 `new` 直接抛 `TypeError`） |
| `call` / `apply` / `bind` | 可改写 `this` 指向 | **无法改写 `this`**（仅传参有效） |

**永远不要用箭头函数作为对象方法或原型方法，也不要用在需要 `this` 指向触发元素的 DOM 事件回调里；但在对象方法内部嵌套异步回调（`setTimeout`、`map`、`Promise.then`）时，箭头函数恰恰能顺着外层方法完美保留对象 `this`。**

```javascript
const user = {
  name: "Jonas",
  year: 1990,
  // 正确：对象方法用普通函数简写，保证 this 指向 user
  delayCheck() {
    // 正确：内部回调使用箭头函数，继承 delayCheck 的 this
    setTimeout(() => {
      console.log(`${this.name}: ${this.year >= 1981 && this.year < 1996}`);
    }, 100);
  },
  // 错误示例：对象字面量不形成作用域，箭头函数 greet 捕获到的是外层全局 this
  brokenGreet: () => {
    console.log(this?.name); // undefined
  },
};

user.delayCheck(); // "Jonas: true"
```

## 高阶函数、柯里化与纯函数边界

满足“接收函数作为参数”或“返回一个新函数”之一的函数就是高阶函数（例如数组 `map`/`filter`/`reduce`、事件监听、装饰器包装）。配合闭包，高阶函数衍生出两项实用的抽象手法：

1. **柯里化（Currying）**：把一次接收多参数的函数拆成多次传参的函数链，方便预设公共配置并延迟执行：

```javascript
const formatLog = (level) => (moduleName) => (message) =>
  `[${level}] [${moduleName}] ${message}`;

const authError = formatLog("ERROR")("Auth");
console.log(authError("token expired")); // "[ERROR] [Auth] token expired"
```

2. **纯函数与副作用隔离**：纯函数保证“相同输入永远产出相同输出，且不读取或修改外部可变状态”（如计算总价、数据格式化）；而修改 DOM、发起请求、写入 `localStorage`、打日志都属于**副作用（Side Effect）**。工程里尽量把业务转换逻辑写成易于单测的纯函数，把副作用收口到专门的边界层统一调度和清理。

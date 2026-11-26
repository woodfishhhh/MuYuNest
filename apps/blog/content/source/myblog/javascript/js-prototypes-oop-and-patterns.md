---
title: "JavaScript 原型链、继承与常用手写模式"
slug: "js-prototypes-oop-and-patterns"
date: 2025-11-03 12:39:11
categories:
  - "前端开发"
tags:
  - "JavaScript"
  - "原型链"
  - "面向对象"
  - "手写实现"
  - "防抖节流"
---

直接把方法写在构造函数里，每 `new` 一个实例就多复制一份函数内存；用字面量重写了 `prototype`，结果实例的 `constructor` 指向全乱了；用 `{ ...obj }` 拷贝带嵌套配置的对象，改新对象把原对象也一并污染——这些面向对象与工具编码里的高频问题，核心都落在原型链结构、`new`/`call`/`apply`/`bind` 机制，以及引用拷贝和频率控制边界上。

## 构造函数、`new` 与原型链查找机制

在 JavaScript 中，实例的属性各自独立，所有实例共享的方法放在构造函数的 `prototype`（原型对象）上，两者通过实例内部的 `[[Prototype]]`（标准访问方式是 `Object.getPrototypeOf(obj)`，浏览器历史上暴露为 `__proto__`）串联起来：

- **构造函数与 `prototype`**：每个普通函数（箭头函数除外）都天生自带 `prototype` 属性，指向供实例共享方法的原型对象；该原型对象默认带有 `constructor` 属性指回构造函数自身。
- **实例与 `__proto__`**：通过 `new Person()` 创建的每个实例，其隐式原型指向 `Person.prototype`（即 `Object.getPrototypeOf(p) === Person.prototype`）。

**使用 `new Foo(...args)` 创建实例时，引擎内部按固定四步完成绑定；手写实现 `myNew` 就是把这四步显式写出来。**

1. 创建一个空对象 `obj`。
2. 把 `obj` 的隐式原型链接到 `Foo.prototype`（等价于 `Object.create(Foo.prototype)`）。
3. 将 `Foo` 的 `this` 绑定到 `obj` 并传入参数执行构造函数。
4. 如果构造函数显式返回了一个非 `null` 的对象（或函数），则返回该对象；否则返回新创建的 `obj`。

```javascript
function myNew(Ctor, ...args) {
  const instance = Object.create(Ctor.prototype);
  const result = Ctor.apply(instance, args);
  const isObjectReturn =
    result !== null && (typeof result === "object" || typeof result === "function");
  return isObjectReturn ? result : instance;
}
```

### 原型链查找与常见判定

读取对象属性 `obj.prop` 时，JavaScript 引擎按以下链路逐级向上查找：

```text
obj 自身属性 -> obj.[[Prototype]] (Ctor.prototype) -> ... -> Object.prototype -> null
```

找到第一个同名属性即返回；整条链查到 `null` 仍未命中则返回 `undefined`。

**如果用字面量直接覆盖重写 `Person.prototype = { ... }`，会丢掉原有的 `constructor` 指向，必须手动补回 `constructor: Person`。**

几个关键操作和判定方法的边界如下：

- **`instanceof` 原理**：沿着左操作数的原型链向上排查，判断右操作数的 `prototype` 是否出现在链上。它无法检测原始类型（`123 instanceof Number` 为 `false`），跨 `iframe` / Realm 环境也会因构造函数引用不同而失效。
- **静态成员 vs 实例成员**：挂在构造函数本身上的属性/方法（如 `Array.from`、`Object.keys`）属于静态成员，实例无法直接调用；挂在 `this` 或 `prototype` 上的属于实例成员。
- **不要直接依赖 `__proto__`**：业务代码中读写原型应使用标准的 `Object.getPrototypeOf(obj)` 和 `Object.create(proto)`；用 `Object.create(null)` 可创建没有原型链的纯净字典对象，避免键名与 `toString` 等原型方法冲突。

## 继承演进：从寄生组合继承到 ES6 `class`

早期 ES5 围绕原型链发展出几种继承写法，理解它们的缺陷就能看懂为什么最终收敛到寄生组合继承和 ES6 `class`：

| 继承模式 | 实现要点 | 遗留缺陷或工程结论 |
| --- | --- | --- |
| 原型链继承 | `Child.prototype = new Parent()` | 父类实例上的引用类型属性会被所有子类实例共享，互相篡改 |
| 构造函数继承 | 子类内 `Parent.call(this, ...args)` | 实例属性独立，但完全继承不到 `Parent.prototype` 上的共享方法 |
| 组合继承 | 原型链 + 构造函数 | `Parent` 构造函数会被执行两次（一次 `new Parent()`，一次 `Parent.call`） |
| **寄生组合继承（ES5 最佳实践）** | 子类调 `Parent.call(this)`，原型用 `Object.create(Parent.prototype)` 桥接并修正 `constructor` | 只调用一次父类构造函数，原型链干净 |
| **ES6 `class extends`（现代首选）** | 语法糖封装寄生组合模式 | 语义清晰；**子类 `constructor` 必须先调用 `super()` 完成父类初始化，才能访问 `this`** |

```javascript
// ES5 寄生组合式继承核心写法
function Person(name) {
  this.name = name;
}
Person.prototype.sayHi = function () {
  return `Hi, ${this.name}`;
};

function Engineer(name, stack) {
  Person.call(this, name);
  this.stack = stack;
}
Engineer.prototype = Object.create(Person.prototype);
Engineer.prototype.constructor = Engineer;

// 现代等价写法：ES6 class
class ModernEngineer extends Person {
  constructor(name, stack) {
    super(name); // 必须先于 this.stack 执行
    this.stack = stack;
  }
}
```

## 手写 `call`、`apply`、`bind`

理解 `this` 绑定规则后，实现 `call`、`apply`、`bind` 的核心思路非常统一：**把待执行函数临时挂到目标上下文对象上作为一个方法调用，再清理临时属性**（用 `Symbol` 当临时键可防止覆盖目标对象已有同名属性）。

```javascript
Function.prototype.myCall = function (context, ...args) {
  const ctx = context == null ? globalThis : Object(context);
  const fnKey = Symbol("tempFn");
  ctx[fnKey] = this;
  const result = ctx[fnKey](...args);
  delete ctx[fnKey];
  return result;
};

Function.prototype.myApply = function (context, args = []) {
  const ctx = context == null ? globalThis : Object(context);
  const fnKey = Symbol("tempFn");
  ctx[fnKey] = this;
  const result = ctx[fnKey](...(args ?? []));
  delete ctx[fnKey];
  return result;
};

Function.prototype.myBind = function (context, ...presetArgs) {
  const self = this;
  return function boundFn(...callArgs) {
    // 若被 new 调用，this 是新实例，忽略预设 context（new 绑定优先级高于 bind）
    const targetThis = this instanceof boundFn ? this : context;
    return self.apply(targetThis, [...presetArgs, ...callArgs]);
  };
};
```

## 深浅拷贝的工程边界

浅拷贝（`{ ...obj }`、`Object.assign({}, obj)`、`[...arr]`、`arr.slice()`）只复制第一层属性或引用地址；一旦出现嵌套对象，修改副本深层字段依然会同步修改原对象。

深拷贝用于彻底切断嵌套引用关联，工程上有三种主要实现与各自边界：

| 方案 | 能力与局限 | 适用建议 |
| --- | --- | --- |
| `JSON.parse(JSON.stringify(obj))` | 简单快速；**会丢失 `undefined`、`Symbol`、函数，把 `Date` 变成字符串、`RegExp` 变成空对象，且遇到循环引用直接抛错** | 仅限纯 JSON 配置数据 |
| `structuredClone(obj)`（原生现代 API） | 原生支持循环引用、`Date`、`RegExp`、`Map`/`Set`、`ArrayBuffer`；**不支持克隆函数、DOM 节点** | 现代浏览器与 Node 17+ 默认首选 |
| 手写递归 `deepClone`（带 `WeakMap` 环检测） | 完全可控，可同时兼容函数引用保留、特殊内置对象与循环引用 | 需要深度定制或面试手写场景 |

```javascript
function deepClone(target, seen = new WeakMap()) {
  if (target === null || typeof target !== "object") return target;
  if (target instanceof Date) return new Date(target.getTime());
  if (target instanceof RegExp) return new RegExp(target.source, target.flags);

  // 解决循环引用导致的无限递归爆栈
  if (seen.has(target)) return seen.get(target);

  const clone = Array.isArray(target) ? [] : {};
  seen.set(target, clone);

  // Reflect.ownKeys 可同时覆盖普通字符串键与 Symbol 键
  for (const key of Reflect.ownKeys(target)) {
    clone[key] = deepClone(target[key], seen);
  }
  return clone;
}
```

## 异常边界与防抖节流实战实现

### 运行时异常捕获

`throw new Error(msg)` 用于在非法参数或业务前置条件不满足时立即中断执行；`try...catch...finally` 只负责捕获**同步执行或 `await` 等待中的运行时异常**（无法捕获解析期语法错误，也不能直接包住未 `await` 的异步定时器回调）。`finally` 无论是否异常都会运行，适合关闭弹窗 Loading、释放文件句柄等清理动作。

### 防抖（Debounce）与节流（Throttle）

两者都借助闭包保存状态并限制高频事件回调执行次数，触发策略截然不同：

- **防抖（Debounce）**：连续触发期间不断重置定时器，**等触发停止 `delay` 毫秒后只执行最后一次**。适合搜索框联想输入、窗口停止拖拽后重算布局、防止按钮连续连点。
- **节流（Throttle）**：在高频触发期间按固定时间周期执行，**每 `interval` 毫秒最多执行一次**。适合页面 `scroll` 滚动进度监听、拖拽元素位置更新。

**手写防抖与节流必须用普通函数返回包装器，并通过 `fn.apply(this, args)` 透传事件触发时的 `this` 与事件参数，否则 DOM 事件里的 `this` 和事件对象会丢失。**

```javascript
function debounce(fn, delay = 300) {
  let timer = null;
  const debounced = function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

// 时间戳 + 尾部定时器双保险节流：既保证首次立即响应，也确保最后一次触发不丢失
function throttle(fn, interval = 200) {
  let lastTime = 0;
  let trailingTimer = null;

  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    if (remaining <= 0) {
      if (trailingTimer) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      lastTime = now;
      fn.apply(this, args);
    } else if (!trailingTimer) {
      trailingTimer = setTimeout(() => {
        lastTime = Date.now();
        trailingTimer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

如果需求只是“按钮点击防连点”希望首次点击立刻触发、之后冷却 `delay` 毫秒再响应，可以给防抖增加 `immediate` 标志位或直接使用节流实现。

---
title: "JavaScript 数组方法、不可变操作与迭代协议"
slug: "js-arrays-and-iteration"
date: 2025-12-25 18:28:57
categories:
  - "前端开发"
tags:
  - "JavaScript"
  - "数组方法"
  - "不可变性"
  - "迭代器"
  - "函数式编程"
---

在状态管理和组件渲染里，改了一行数组排序结果整个列表跟着乱序、在 `forEach` 里写 `return` 却发现根本跳不出循环、想汇总数组却因为忘了给 `reduce` 传初始值导致空列表直接抛异常——这些问题都是因为没有分清数组方法的**可变性边界**与**迭代协议**。

## 原地修改方法 vs 不可变方法

JavaScript 数组实例方法可以按“是否改变原数组”划出一条硬边界。在 React、Vue 这类依赖引用变化触发视图更新的框架中，误用原地修改（Mutating）方法往往会导致状态对比失效或视图不刷新。

| 方法类别 | 代表方法 | 返回值 | 是否修改原数组 |
| --- | --- | --- | --- |
| 首尾/任意位置增删 | `push` / `pop` / `unshift` / `shift` / `splice` | 新长度或被删元素数组 | **是** |
| 排序与反转 | `sort` / `reverse` | 原数组自身引用 | **是** |
| 不可变排序与替身（ES2023+） | `toSorted` / `toReversed` / `toSpliced` / `with` | **全新的副本数组** | 否 |
| 切片与合并 | `slice` / `concat` / `[...arr]` | 新数组 | 否 |
| 转换与筛选 | `map` / `filter` / `flat` / `flatMap` | 新数组 | 否 |
| 查找与断言 | `find` / `findIndex` / `some` / `every` / `includes` | 目标项、索引或布尔值 | 否 |
| 聚合折叠 | `reduce` / `reduceRight` | 任意类型单一累积结果 | 否 |

**`sort()` 与 `reverse()` 会直接篡改原数组；需要保留原始数据时，要么先用 `[...arr].sort()` 浅拷贝，要么直接使用 ES2023 提供的 `toSorted()`、`toReversed()` 和 `toSpliced()`。**

### 原地增删与 `splice` 细节

`push`/`pop` 操作尾部（均摊 $O(1)$），`unshift`/`shift` 操作头部（需移动后续元素索引，$O(n)$），`splice(start, deleteCount, ...items)` 则可以同时完成删除、替换和插入：

```javascript
const stack = ["html", "css", "javascript"];

stack.push("vue");        // 尾部追加 -> ["html", "css", "javascript", "vue"]
stack.unshift("vscode");  // 头部插入 -> ["vscode", "html", "css", "javascript", "vue"]
stack.splice(1, 2, "ts"); // 从索引 1 删除 2 项并插入 "ts" -> ["vscode", "ts", "javascript", "vue"]

// 若不改原数组执行同款操作，改用 ES2023 toSpliced：
const nextStack = stack.toSpliced(1, 1, "rust"); // stack 本身不受影响
```

另外注意 `sort()` 不传比较函数时，默认按**元素转成字符串后的 UTF-16 码元顺序**排列，`[10, 2, 1].sort()` 会得到 `[1, 10, 2]`；数值排序务必显式传入 `(a, b) => a - b`。

## 高阶转换：`map`、`filter`、`reduce` 与链式取舍

高阶数组方法把循环模板封装成纯函数声明，每个方法专注一种变换语义：

### `map` 与 `filter` 的返回契约

- **`map(fn)`**：一对一映射，返回长度严格等于原数组的新数组。**回调里忘记写 `return` 会产出一整排 `undefined`。**
- **`filter(fn)`**：按条件过滤，回调返回真值（建议明确返回布尔表达式）的元素被保留进新数组。

```javascript
const dishes = [
  { name: "凯撒沙拉", price: 15, vegetarian: true },
  { name: "菲力牛排", price: 28, vegetarian: false },
  { name: "烤蔬菜汤", price: 18, vegetarian: true },
  { name: "波士顿龙虾", price: 45, vegetarian: false },
];

// 链式组合原则：先 filter 收窄规模，再 map 提取字段，减少无效对象分配
const priceyNames = dishes
  .filter((dish) => dish.price > 20)
  .map((dish) => dish.name); // ["菲力牛排", "波士顿龙虾"]
```

### `reduce` 的初始值陷阱

`reduce(fn, initialValue)` 依次把每项归并进累加器 `acc`：

**调用 `reduce` 时永远显式传入第二个参数 `initialValue`；对空数组不传初始值会直接抛出 `TypeError: Reduce of empty array with no initial value`。**

```javascript
const transactions = [
  { type: "deposit", amount: 100 },
  { type: "withdrawal", amount: 50 },
  { type: "deposit", amount: 200 },
];

// 既可以累加数字，也可以用对象作初始值做分类统计
const summary = transactions.reduce(
  (acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + item.amount;
    return acc;
  },
  { deposit: 0, withdrawal: 0 }
);
// { deposit: 300, withdrawal: 50 }
```

数据量达到数万条且需要连续多步 `filter().map().reduce()` 时，链式调用会多次遍历并创建多个中间数组；此时应合并成单次 `reduce` 或原生 `for...of` 循环，把多次遍历和中间数组分配压成一遍。

## 查找、断言与扁平化

日常业务中最常用于代替手写 `for` + `flag` 的方法：

- **`find` / `findIndex`**：命中第一个满足条件的元素后**立即短路停止**，分别返回元素本身（未找到为 `undefined`）或索引（未找到为 `-1`）。
- **`some` / `every`**：`some` 只要有一项满足即返回 `true` 并短路；`every` 全部满足返回 `true`，遇到第一项不满足即短路返回 `false`。
- **`flat(depth)` 与 `flatMap(fn)`**：`flat(Infinity)` 可展平任意嵌套层级；`flatMap(fn)` 等价于先 `map` 再 `flat(1)`，适合一条记录拆成零条或多条输出的场景。

```javascript
const orders = [
  { id: 1, items: ["咖啡", "贝果"], paid: true },
  { id: 2, items: ["意面"], paid: false },
];

const hasUnpaid = orders.some((o) => !o.paid); // true
const allItems = orders.flatMap((o) => (o.paid ? o.items : [])); // ["咖啡", "贝果"]
```

## 迭代协议与循环控制选型

面对集合遍历，JavaScript 提供了传统 `for`、`forEach`、`for...of` 与 `for...in`，它们的边界非常清晰：

| 循环方式 | 遍历对象 | 是否支持 `break`/`continue` | 是否支持 `await` 串行等待 | 核心适用场景 |
| --- | --- | --- | --- | --- |
| `for (let i = 0; ...)` | 索引结构 | 支持 | 支持 | 需要步长控制、倒序遍历或高频性能热点 |
| `arr.forEach(fn)` | 数组 | **不支持**（`return` 仅跳出当前回调） | **不支持**（并行触发不等待） | 无中断需求的简单遍历副作用 |
| `for (const v of iter)` | **可迭代对象**（Array、String、Map、Set、DOM NodeList） | **支持** | **支持** | 遍历元素值、中途需 `break` 或串行 `await` |
| `for (const k in obj)` | 普通对象的可枚举字符串键（含原型链） | 支持 | 支持 | 枚举对象键名（不建议用于数组） |

**`forEach` 无法使用 `break` 或 `continue`，也无法等待回调里的 `async/await`；需要提前终止循环或按顺序 `await` 异步请求时，必须改用 `for...of`。**

### 用 `entries()` 在 `for...of` 中同时拿索引与值

`for...of` 默认只返回元素值，需要索引编号时配合数组的 `.entries()` 迭代器与解构赋值即可：

```javascript
const menu = ["凯撒沙拉", "法式洋葱汤", "菲力牛排", "香煎三文鱼"];

for (const [index, dish] of menu.entries()) {
  if (dish.includes("沙拉")) continue; // 跳过当前项
  console.log(`${index + 1}. ${dish}`);
  if (dish === "菲力牛排") break;    // 命中目标立即中止循环
}
```

### 为什么 `for...of` 不能直接遍历普通对象

`for...of` 消费的是 ES6 **迭代协议（Iterable Protocol）**，即对象必须部署 `[Symbol.iterator]()` 方法并返回带 `.next()` 的迭代器。数组、字符串、`Set`、`Map` 和 DOM 集合原生实现了该协议，而普通字面量对象 `{ a: 1, b: 2 }` 默认没有。

遍历普通对象应使用 `Object.keys(obj)`、`Object.values(obj)` 或 `Object.entries(obj)` 转为数组后再交给 `for...of`：

```javascript
const scores = { alice: 95, bob: 88, carol: 92 };

for (const [name, score] of Object.entries(scores)) {
  console.log(`${name}: ${score}`);
}
```

如果要统计对象键名或使用 `for...in`，切记 `for...in` 会把原型链上可枚举属性一并扫出来，通常需要加 `Object.hasOwn(obj, key)` 过滤自有属性；相比之下，`Object.entries(obj)` 只返回自身可枚举属性，语义更安全。

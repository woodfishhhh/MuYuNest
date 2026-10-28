---
title: "109 Logical Assignment Operators（逻辑赋值运算符）"
date: 2025-12-25 18:20:45
tags:
  - "JavaScript"
  - "逻辑赋值运算符"
  - "ES2021"
  - "Udemy"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、知识背景与前置准备

### 1.1 逻辑赋值运算符的来源

- ES 2021（ECMAScript 2021）新增的语法，一共 3 个运算符，用来简化"逻辑判断 + 赋值"这种组合写法。

- 前置知识：JavaScript 里的真值（truthy）和假值（falsy），以及下面三个运算符的短路求值（前两个是逻辑运算符，第三个是空值合并运算符）：

  ```
  ||
  ```

  ```
  &&
  ```

  ```
  ??
  ```

  - 假值：一共 6 个，`false`、`0`、`""`（空字符串）、`null`、`undefined`、`NaN`；
  - 真值：除了假值以外的所有值（非零数字、非空字符串、对象等）；
  - 短路求值：逻辑运算里，前一个操作数已经能决定结果时，后面的操作数就不再计算。

### 1.2 示例对象创建

演示用的两个餐厅对象（模拟从 API 拿到的数据），后面的操作都基于它们：

```javascript
// 餐厅1：含name和numGuests（来宾人数）属性
const restaurant1 = {
  name: "Restaurant One",
  numGuests: 20, // 真值（非零数字）
};

// 餐厅2：含name和owner（所有者）属性，无numGuests属性
const restaurant2 = {
  name: "La Piazza",
  owner: "Giovanni Rossi", // 真值（非空字符串）
};
```

## 二、OR 赋值运算符（`||=`）

### 2.1 功能定义

- 语法：`变量 ||= 赋值值`
- 等价于：`变量 = 变量 || 赋值值`
- 规则：变量是假值，就把赋值值赋给它；变量是真值，就保持原值（短路求值，赋值值不会被处理）。

### 2.2 应用场景：设置属性默认值

需求：给所有餐厅对象补上 `numGuests` 属性，对象本来没有这个属性（值是 `undefined`，属于假值）或者值是假值时，默认设成 10。

#### 2.2.1 传统写法（逻辑运算符`||`）

```js
// 为restaurant1设置numGuests默认值
restaurant1.numGuests = restaurant1.numGuests || 10;
// 结果：restaurant1.numGuests = 20（原有值20是真值，短路不执行10）

// 为restaurant2设置numGuests默认值
restaurant2.numGuests = restaurant2.numGuests || 10;
// 结果：restaurant2.numGuests = 10（原有值undefined是假值，执行赋值）
```

#### 2.2.2 简化写法（`||=`运算符）

```javascript
// 等价于上述传统写法，代码更简洁
restaurant1.numGuests ||= 10; // 结果：20
restaurant2.numGuests ||= 10; // 结果：10
```

### 2.3 局限性：假值误判问题

- 问题：变量的合理取值本身就是假值时，会被错误覆盖。比如餐厅实际来宾人数是 0（合理，但 0 是假值），用 `||=` 会被改成 10。
- 示例：

```javascript
// 模拟餐厅1来宾人数为0（合理假值）
const restaurant3 = {
  name: "Restaurant Three",
  numGuests: 0,
};

// 使用||=设置默认值，出现错误
restaurant3.numGuests ||= 10;
console.log(restaurant3.numGuests); // 结果：10（错误覆盖了合理的0）
```

## 三、空值赋值运算符（`??=`）

### 3.1 功能定义

- 语法：`变量 ??= 赋值值`
- 等价于：`变量 = 变量 ?? 赋值值`
- 规则：只有变量是 `null` 或 `undefined`（"空值"）时，才把赋值值赋给它；其他值（包括 `0`、`""` 这些假值）都保持原样。
- 和 `||=` 的区别：`||=` 判断的是假值，`??=` 只判断空值，所以合理的假值不会被误判。

### 3.2 应用场景：修复默认值设置的假值误判

需求：还是给餐厅设置 `numGuests` 的默认值，但 `numGuests=0` 这种合理情况要保留。

#### 3.2.1 传统写法（空值合并运算符`??`）

```javascript
// 为restaurant3（numGuests=0）设置默认值
restaurant3.numGuests = restaurant3.numGuests ?? 10;
// 结果：0（0不是null/undefined，不执行赋值）

// 为restaurant2（numGuests=undefined）设置默认值
restaurant2.numGuests = restaurant2.numGuests ?? 10;
// 结果：10（undefined是空值，执行赋值）
```

#### 3.2.2 简化写法（`??=`运算符）

```javascript
// 修复restaurant3的误判问题
restaurant3.numGuests ??= 10;
console.log(restaurant3.numGuests); // 结果：0（正确保留合理值）

// 为restaurant2补充默认值
restaurant2.numGuests ??= 10;
console.log(restaurant2.numGuests); // 结果：10（正确赋值）
```

### 3.3 例题：区分`||=`与`??=`的使用场景

题目：定义一个用户对象 `user`，有 `username` 和 `age` 两个属性，给 `age` 设默认值 18，规则：

1. `age` 没定义（`undefined`）或者是 `null`，就设成 18；
2. `age` 是 0（婴儿用户，合理值）的话，保留 0。

解答：

```javascript
// 案例1：user无age属性（undefined）
const user1 = { username: "Alice" };
user1.age ??= 18; // 正确：age=18

// 案例2：user.age=0（合理假值）
const user2 = { username: "Bob", age: 0 };
user2.age ??= 18; // 正确：age=0（不覆盖）

// 案例3：若误用||=，会出现错误
user2.age ||= 18;
console.log(user2.age); // 错误：18（覆盖了合理的0）
```

## 四、AND 赋值运算符（`&&=`）

### 4.1 功能定义

- 语法：`变量 &&= 赋值值`
- 等价于：`变量 = 变量 && 赋值值`
- 规则：变量是真值，就把赋值值赋给它；变量是假值（包括 `null`、`undefined` 等），就保持原值（短路求值，赋值值不会被处理）。
- 和前两个的区别：`||=` 和 `??=` 用来补默认值，`&&=` 用来改已有的真值。

### 4.2 应用场景：修改对象的已有属性（如数据匿名化）

需求：把餐厅的 `owner` 属性做匿名化处理：

1. 餐厅有 `owner` 属性（真值，比如非空字符串），就改成"匿名"；
2. 餐厅没有 `owner` 属性（`undefined`，假值），就不加这个属性（免得多出一个值为 `undefined` 的无效属性）。

#### 4.2.1 传统写法（逻辑运算符`&&`）

```javascript
// 为restaurant2（有owner属性，真值）匿名化
restaurant2.owner = restaurant2.owner && "匿名";
// 结果：owner="匿名"（原有值是真值，执行赋值）

// 为restaurant1（无owner属性，undefined）匿名化
restaurant1.owner = restaurant1.owner && "匿名";
// 结果：owner=undefined（原有值是假值，不执行赋值，保持undefined）
```

#### 4.2.2 简化写法（`&&=`运算符）

```javascript
// 匿名化restaurant2的owner
restaurant2.owner &&= "匿名";
console.log(restaurant2.owner); // 结果："匿名"（正确修改）

// 处理restaurant1的owner（无该属性）
restaurant1.owner &&= "匿名";
console.log(restaurant1.owner); // 结果：undefined（正确不添加无效属性）
```

### 4.3 例题：筛选并修改有效数据

题目：定义一个商品数组 `products`，每个商品有 `name` 和 `price`。价格大于 100 的打 9 折，价格小于等于 100 或者没定义价格的不改。

解答：

```javascript
const products = [
  { name: "手机", price: 5999 }, // 真值，需打折
  { name: "笔记本", price: 99 }, // 真值，但≤100，不打折
  { name: "耳机" }, // 无price属性，undefined，不打折
];

// 使用&&=实现需求：仅当price>100（真值）时，执行price*0.9
products.forEach((product) => {
  product.price > 100 && (product.price *= 0.9);
});

console.log(products);
// 结果：
// 手机：price=5399.1（9折）
// 笔记本：price=99（未修改）
// 耳机：price=undefined（未修改）
```

| 运算符 | 语法      | 等价逻辑     | 判断条件            | 核心用途                   | 典型场景             |
| ------ | --------- | ------------ | ------------------- | -------------------------- | -------------------- | -------- | -------------------------- | ---------------------- |
| `      | =`        | `a           | = b`                | `a = a                     | b`                   | a 是假值 | 补全默认值（容忍假值覆盖） | 非数值属性的默认值设置 |
| `??=`  | `a ??= b` | `a = a ?? b` | a 是 null/undefined | 补全默认值（保留合理假值） | 数值属性的默认值设置 |
| `&&=`  | `a &&= b` | `a = a && b` | a 是真值            | 修改已有真值（不处理假值） | 数据匿名化、条件修改 |

### 5.1 记忆口诀

- `||=`：假值才赋值，默认值常用；
- `??=`：空值才赋值，数值不坑；
- `&&=`：真值才赋值，修改有保证。

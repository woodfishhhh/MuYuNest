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

- 属于 ES 2021（ECMAScript 2021）标准中新增的语法特性，共包含 3 个运算符，核心作用是简化 “逻辑判断 + 赋值” 的组合操作，提升代码简洁性与可读性。

- 前置依赖知识：需理解 JavaScript 中的 “真值（truthy）” 与 “假值（falsy）” 概念，以及逻辑运算符（

  ```
  ||
  ```

  、

  ```
  &&
  ```

  ）和空值合并运算符（

  ```
  ??
  ```

  ）的 “短路求值” 特性。
  - 假值：共 6 个，分别是`false`、`0`、`""`（空字符串）、`null`、`undefined`、`NaN`；
  - 真值：除假值外的所有值（如非零数字、非空字符串、对象等）；
  - 短路求值：逻辑运算中，若前一个操作数已能确定最终结果，后续操作数将不再计算。

### 1.2 示例对象创建

为演示运算符用法，定义两个餐厅对象（模拟从 API 获取的数据场景），后续所有操作均基于这两个对象：

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
- 等价逻辑：`变量 = 变量 || 赋值值`
- 核心规则：若 “变量” 为**假值**，则将 “赋值值” 赋给变量；若 “变量” 为真值，则保持变量原有值（因短路求值，不处理赋值值）。

### 2.2 应用场景：设置属性默认值

需求：为所有餐厅对象补充`numGuests`属性，若对象本身无该属性（值为`undefined`，属于假值）或属性值为假值，则默认设为 10。

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

- 问题：当变量的 “合理值” 属于假值时，会被错误覆盖。例如餐厅实际来宾人数为 0（合理场景，但 0 是假值），使用`||=`会将其改为 10。
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
- 等价逻辑：`变量 = 变量 ?? 赋值值`
- 核心规则：仅当 “变量” 为 **`null`或`undefined`**（即 “空值”）时，才将 “赋值值” 赋给变量；若变量为其他值（包括`0`、`""`等假值），则保持原有值。
- 与`||=`的区别：`||=`判断 “假值”，`??=`仅判断 “空值”，解决了`||=`对合理假值的误判问题。

### 3.2 应用场景：修复默认值设置的假值误判

需求：延续 “设置餐厅`numGuests`默认值” 的场景，但保留`numGuests=0`的合理情况。

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

题目：定义一个用户对象`user`，包含`username`和`age`属性，需为`age`设置默认值 18，规则如下：

1. 若`age`未定义（`undefined`）或为`null`，则设为 18；
2. 若`age`为 0（婴儿用户，合理值），则保留 0。

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
- 等价逻辑：`变量 = 变量 && 赋值值`
- 核心规则：若 “变量” 为**真值**，则将 “赋值值” 赋给变量；若 “变量” 为假值（包括`null`、`undefined`等），则保持变量原有值（短路求值，不处理赋值值）。
- 与前两个运算符的区别：`||=`和`??=`用于 “补全默认值”，`&&=`用于 “修改已有真值”。

### 4.2 应用场景：修改对象的已有属性（如数据匿名化）

需求：对餐厅的`owner`属性进行匿名化处理，规则如下：

1. 若餐厅有`owner`属性（值为真值，如非空字符串），则将其改为 “匿名”；
2. 若餐厅无`owner`属性（值为`undefined`，假值），则不添加该属性（避免产生`undefined`的无效属性）。

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

题目：定义一个商品数组`products`，每个商品含`name`和`price`属性，需将 “价格大于 100” 的商品价格打 9 折，“价格小于等于 100” 或 “价格未定义” 的商品不修改。

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

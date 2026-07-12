---
title: "103 Destructuring Arrays（数组解构）笔记"
date: 2025-12-25 17:54:42
tags:
  - "JavaScript"
  - "数组解构"
  - "ES6"
  - "Udemy"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、课程背景与学习说明

1. **所属模块**：现代 JavaScript 语法学习，聚焦 “内置数据结构与高级运算符”，是后续实战项目的基础铺垫
2. **案例载体**：以意大利餐厅 “Classico Italiano” 模拟配送应用为案例，仅关注 JavaScript 逻辑，不构建 UI（下一节将通过带优质 UI 的项目学习数组方法）
3. **要解决的问题**：掌握数组解构的概念、基础语法、进阶技巧及实际应用场景，替代传统数组元素提取方式，提升代码简洁性

## 二、数组解构概念

### 2.1 定义

- 是 ES6 新增特性，用于将**数组或对象中的值 “解包” 到单独变量**，本质是将复杂数据结构分解为更小的变量结构
- 作用：简化数组元素提取流程，避免重复使用`数组[索引]`的繁琐写法

### 2.2 传统提取方式 vs 解构方式对比（例题 1）

#### 传统方式（通过索引提取）

```javascript
// 定义一个简单数组
const arr = [2, 3, 4];
// 逐个提取元素到变量
const A = arr[0];
const B = arr[1];
const C = arr[2];
console.log(A, B, C); // 输出：2 3 4
```

**问题**：若需提取多个元素，需重复写`arr[索引]`，代码冗余。

#### 解构方式（一次性提取）

```javascript
// 定义数组
const arr = [2, 3, 4];
// 解构语法：左侧方括号不是数组，而是解构赋值标识
const [X, Y, Z] = arr;
console.log(X, Y, Z); // 输出：2 3 4
```

**注意**：解构不会修改原数组，仅通过 “模式匹配” 将数组元素映射到对应变量。

## 三、数组解构基础用法

### 3.1 提取指定位置元素（跳过中间元素）

#### 场景

只需提取数组中部分元素，无需创建无用变量。

#### 例题 2

```javascript
// 餐厅分类数组（包含3个元素）
const restaurant = {
  categories: ["意大利菜", "披萨", "素食"],
};
// 需求1：仅提取前2个分类
const [mainCat, secondaryCat] = restaurant.categories;
console.log(mainCat, secondaryCat); // 输出：意大利菜 披萨

// 需求2：提取第1个和第3个分类（跳过第2个）
const [firstCat, , thirdCat] = restaurant.categories;
console.log(firstCat, thirdCat); // 输出：意大利菜 素食
```

**关键**：通过在解构位置留 “空位”（即两个逗号之间不写变量），实现跳过中间元素。

### 3.2 解构时设置默认值（例题 3）

#### 场景

当数组长度未知（如从 API 获取数据），避免提取不存在的元素时得到`undefined`。

#### 语法

```
const [变量1 = 默认值, 变量2 = 默认值, ...] = 数组
```

#### 代码示例

```javascript
// 情况1：数组元素数量少于变量数量
const arr1 = [8, 9];
// 为第3个变量设置默认值1
const [P = 1, Q = 1, R = 1] = arr1;
console.log(P, Q, R); // 输出：8 9 1（R取默认值）

// 情况2：数组元素数量足够
const arr2 = [8, 9, 10];
const [P2 = 1, Q2 = 1, R2 = 1] = arr2;
console.log(P2, Q2, R2); // 输出：8 9 10（默认值不生效）
```

## 四、数组解构进阶技巧

### 4.1 实现变量快速交换（例题 4）

#### 传统方式（需临时变量）

```javascript
let a = 10;
let b = 20;
// 交换需临时变量temp
const temp = a;
a = b;
b = temp;
console.log(a, b); // 输出：20 10
```

#### 解构方式（无需临时变量）

```javascript
let a = 10;
let b = 20;
// 解构语法直接交换
[a, b] = [b, a];
console.log(a, b); // 输出：20 10
```

**关键**：右侧创建包含待交换变量（顺序倒置）的临时数组，左侧通过解构重新赋值。

### 4.2 接收函数返回的 “多值”（例题 5）

#### 场景

函数本质只能返回一个值，但可通过返回数组 + 解构，实现 “模拟多值返回”。

#### 代码示例

```javascript
// 为餐厅对象添加order方法：接收两个索引，返回对应菜单元素
const restaurant = {
  starterMenu: ["蒜香面包", "沙拉", "意式浓汤"],
  mainMenu: ["披萨", "意面", "牛排"],
  // 方法：接收前菜索引和主菜索引
  order(starterIndex, mainIndex) {
    return [this.starterMenu[starterIndex], this.mainMenu[mainIndex]];
  },
};

// 调用方法并解构返回的数组
const [starter, mainCourse] = restaurant.order(2, 0);
console.log(starter, mainCourse); // 输出：意式浓汤 披萨
```

### 4.3 嵌套数组解构（例题 6）

#### 场景

数组中包含子数组，需提取子数组内的元素。

#### 语法

```
const [外层变量1, [内层变量1, 内层变量2], ...] = 嵌套数组
```

#### 代码示例

```javascript
// 定义嵌套数组：[外层元素1, 外层元素2, [内层元素1, 内层元素2]]
const nestedArr = [2, 4, [5, 6]];

// 需求1：提取外层第1个元素和整个子数组
const [i, , j] = nestedArr;
console.log(i, j); // 输出：2 [5, 6]

// 需求2：提取外层第1个元素和子数组的两个元素
const [x, , [y, z]] = nestedArr;
console.log(x, y, z); // 输出：2 5 6
```

## 五、总结：数组解构的核心应用场景

| 场景             | 传统方式问题              | 解构优势                 |
| ---------------- | ------------------------- | ------------------------ |
| 提取数组指定元素 | 重复写`arr[索引]`，冗余   | 一行代码完成多元素提取   |
| 变量交换         | 需临时变量，逻辑繁琐      | 无临时变量，代码简洁     |
| 函数 “多值返回”  | 需手动拆解返回的数组      | 直接映射到变量，可读性高 |
| 嵌套数组元素提取 | 需多层`arr[索引][子索引]` | 模式匹配，层级清晰       |
| 处理未知长度数组 | 易得到`undefined`         | 可设置默认值，避免异常   |

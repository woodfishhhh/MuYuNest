---
title: "for-of循环"
date: 2025-12-25 18:24:13
tags:
  - "JavaScript"
  - "for-of循环"
  - "定位"
  - "数组"
  - "for...of"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、for-of 循环基础（对应视频知识点）

### 1.1 背景与定位

- 属于 ES6（2015 年）推出的数组遍历新语法，核心作用是简化传统 for 循环的代码逻辑，降低数组遍历的 “模板代码” 成本。
- 适用场景：需直接访问数组元素、无需手动控制循环计数器的场景（如遍历菜单、商品列表等）。

### 1.2 基本语法与执行逻辑

#### 1.2.1 语法结构

javascript

```javascript
// 语法格式
for (const 元素变量 of 数组) {
  // 循环体：对当前元素的操作
}
```

- 关键说明：
  - `元素变量`：每次循环时自动接收数组的 “当前元素”，变量名可自定义（如 item、el、value 等，建议语义化命名）。
  - `of`：关键字，用于连接 “元素变量” 和 “目标数组”，表示 “从数组中逐个取出元素”。
  - 无需手动声明计数器（如 let i = 0）、循环条件（如 i < arr.length）和计数器更新（如 i++），底层逻辑由 JS 引擎自动处理。

#### 1.2.2 例题：遍历餐厅菜单数组

需求：定义包含 “启动菜单” 和 “主菜单” 的数组，使用 for-of 循环打印所有菜品。

javascript

```javascript
// 1. 定义数组（模拟餐厅菜单）
const starterMenu = ["凯撒沙拉", "法式洋葱汤", "奶油蘑菇汤"];
const mainMenu = ["菲力牛排", "香煎三文鱼", "松露意面"];
const fullMenu = [...starterMenu, ...mainMenu]; // 合并两个菜单（扩展运算符）

// 2. 使用 for-of 循环遍历
for (const dish of fullMenu) {
  console.log("菜品：", dish);
}

// 输出结果：
// 菜品： 凯撒沙拉
// 菜品： 法式洋葱汤
// 菜品： 奶油蘑菇汤
// 菜品： 菲力牛排
// 菜品： 香煎三文鱼
// 菜品： 松露意面
```

## 二、for-of 循环 vs 传统 for 循环（对应视频对比知识点）

### 2.1 核心差异对比

| 对比维度   | 传统 for 循环                                    | for-of 循环                          |
| ---------- | ------------------------------------------------ | ------------------------------------ |
| 代码复杂度 | 需手动写计数器、条件、更新逻辑（3 部分）         | 仅需声明元素变量和目标数组（1 部分） |
| 可读性     | 需关注 “循环控制细节”，语义较模糊                | 直接体现 “遍历元素”，语义更清晰      |
| 出错风险   | 易因计数器逻辑错误（如 i <= arr.length）导致越界 | 无计数器，底层自动控制，无越界风险   |
| 适用场景   | 需手动控制索引（如反向遍历、间隔遍历）           | 仅需访问元素，无需控制索引           |

#### 2.1.1 例题：两种循环实现 “打印菜单” 对比

javascript

```javascript
const fullMenu = ["凯撒沙拉", "法式洋葱汤", "菲力牛排", "香煎三文鱼"];

// 1. 传统 for 循环
console.log("传统 for 循环输出：");
for (let i = 0; i < fullMenu.length; i++) {
  // 计数器、条件、更新需手动写
  console.log("菜品：", fullMenu[i]);
}

// 2. for-of 循环
console.log("\nfor-of 循环输出：");
for (const dish of fullMenu) {
  // 无需关注计数器
  console.log("菜品：", dish);
}

// 两种方式输出结果一致，但 for-of 代码更简洁
```

### 2.2 for-of 循环的独特优势：支持 continue/break

- 特点：虽然 for-of 简化了逻辑，但仍保留传统 for 循环的 “流程控制能力”，可使用 `continue`（跳过当前循环）和 `break`（终止整个循环）。
- 注意：后续将学习的 `forEach` 方法不支持 `continue/break`，这是 for-of 循环的重要优势场景。

#### 2.2.1 例题：使用 break 终止菜单遍历（找到目标菜品即停止）

需求：遍历菜单，找到 “菲力牛排” 后打印并停止循环，不再输出后续菜品。

javascript

```javascript
const fullMenu = [
  "凯撒沙拉",
  "法式洋葱汤",
  "菲力牛排",
  "香煎三文鱼",
  "松露意面",
];

for (const dish of fullMenu) {
  if (dish === "菲力牛排") {
    console.log("找到目标菜品：", dish);
    break; // 终止循环，后续菜品不再遍历
  }
  console.log("当前遍历菜品：", dish);
}

// 输出结果：
// 当前遍历菜品： 凯撒沙拉
// 当前遍历菜品： 法式洋葱汤
// 找到目标菜品： 菲力牛排
// （“香煎三文鱼”“松露意面”未被遍历）
```

#### 2.2.2 例题：使用 continue 跳过指定菜品（不打印素食）

需求：遍历菜单，跳过所有 “沙拉类” 菜品，仅打印非沙拉菜品。

javascript

```javascript
const fullMenu = ["凯撒沙拉", "法式洋葱汤", "蔬菜沙拉", "菲力牛排", "松露意面"];

for (const dish of fullMenu) {
  if (dish.includes("沙拉")) {
    // 判断是否为沙拉类
    continue; // 跳过当前循环，不执行后续 console.log
  }
  console.log("非沙拉菜品：", dish);
}

// 输出结果：
// 非沙拉菜品： 法式洋葱汤
// 非沙拉菜品： 菲力牛排
// 非沙拉菜品： 松露意面
// （两种沙拉被跳过）
```

## 三、for-of 循环获取数组索引（对应视频进阶知识点）

### 3.1 核心方法：数组的 entries  方法

- 背景：for-of 循环默认仅返回 “元素”，若需同时获取 “元素索引”，需借助数组的 `entries()` 方法。
- `entries()` 作用：返回一个 “数组迭代器”，迭代器的每一项是一个 **二维数组**，格式为 `[索引, 元素]`（如 [0, "凯撒沙拉"]、[1, "法式洋葱汤"]）。
- 扩展知识：若需直观查看 `entries()` 的结果，可使用 `[...数组.entries()]`（扩展运算符）将迭代器转为普通数组。

#### 3.1.1 例题：查看 entries  方法的返回结构

javascript

```javascript
const fullMenu = ["凯撒沙拉", "法式洋葱汤", "菲力牛排"];

// 1. 查看 entries() 返回的迭代器（直接打印为迭代器对象，不直观）
console.log(fullMenu.entries()); // 输出：Array Iterator {}

// 2. 使用扩展运算符转为普通数组（直观查看结构）
const menuEntries = [...fullMenu.entries()];
console.log(menuEntries);
// 输出：[[0, "凯撒沙拉"], [1, "法式洋葱汤"], [2, "菲力牛排"]]
```

### 3.2 结合 for-of 循环获取索引与元素（基础方式）

#### 3.2.1 例题：打印带索引的菜单（索引从 0 开始）

javascript

```javascript
const fullMenu = ["凯撒沙拉", "法式洋葱汤", "菲力牛排"];

// 遍历 entries() 返回的迭代器，eachItem 是 [索引, 元素] 二维数组
for (const eachItem of fullMenu.entries()) {
  const index = eachItem[0]; // 手动获取索引（二维数组的第 0 项）
  const dish = eachItem[1]; // 手动获取元素（二维数组的第 1 项）
  console.log(`索引 ${index}：${dish}`);
}

// 输出结果：
// 索引 0：凯撒沙拉
// 索引 1：法式洋葱汤
// 索引 2：菲力牛排
```

### 3.3 优化方案：结合解构赋值获取索引与元素

- 背景：上述 “手动获取 eachItem [0]、eachItem [1]” 的方式较繁琐，可使用 ES6 解构赋值直接拆分二维数组的 “索引” 和 “元素”。
- 解构语法：将 `const eachItem` 替换为 `const [index, dish]`，直接将二维数组的两项分别赋值给 `index` 和 `dish`。

#### 3.3.1 例题：解构赋值优化 “带索引菜单” 打印（索引从 1 开始，模拟真实餐厅菜单）

需求：打印餐厅菜单，编号从 1 开始（而非 0），格式为 “1. 凯撒沙拉”。

javascript

```javascript
const fullMenu = ["凯撒沙拉", "法式洋葱汤", "菲力牛排", "香煎三文鱼"];

// 解构赋值：直接拆分 [索引, 元素]
for (const [index, dish] of fullMenu.entries()) {
  const menuNum = index + 1; // 索引 +1，转为从 1 开始的编号
  console.log(`${menuNum}. ${dish}`);
}

// 输出结果（模拟真实餐厅菜单）：
// 1. 凯撒沙拉
// 2. 法式洋葱汤
// 3. 菲力牛排
// 4. 香煎三文鱼
```

## 四、总结：for-of 循环的核心要点

1. **语法简洁**：无需手动控制计数器，直接遍历数组元素，代码可读性高。

2. **功能保留**：支持 `continue/break`，可灵活控制循环流程（优于 `forEach`）。

3. **索引获取**：需结合 `entries()` 方法，配合解构赋值可高效获取 “索引 + 元素”。

4. 适用场景

   ：
   - 优先用于 “仅需访问元素” 的遍历（如打印列表、统计元素）。
   - 需使用 `continue/break` 控制流程时。
   - 需同时获取索引和元素，且希望代码简洁时（配合解构赋值）。

---
title: "Rest参数和模式"
date: 2025-12-25 18:13:09
tags:
  - "JavaScript"
  - "Rest参数"
  - "模式"
  - "数组"
  - "函数"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、概念：Rest 模式与扩展运算符的对比

### 1.1 语法共性

两者都用 `...`（三个英文句点）表示，很容易搞混，要靠使用场景区分。

### 1.2 功能差异（核心区别）

| 特性         | 扩展运算符（Spread Operator）  | Rest 模式 / 参数（Rest Pattern/Parameters） |
| ------------ | ------------------------------ | ------------------------------------------- |
| 核心作用     | 「拆包」：将数组展开为单个元素 | 「打包」：将多个元素 / 参数收集为数组       |
| 典型使用场景 | 构建新数组、向函数传递多个值   | 解构赋值收集剩余元素、函数接收任意数量参数  |
| 数据流向     | 数组 → 单个元素                | 单个元素 → 数组                             |

示例 1：扩展运算符负责「拆包」

```javascript
// 1. 构建新数组：将arr1、arr2的元素拆包后合并为newArr
const arr1 = [1, 2];
const arr2 = [3, 4];
const newArr = [...arr1, ...arr2];
console.log(newArr); // 输出：[1, 2, 3, 4]

// 2. 向函数传递多个值：将数组拆包为独立参数
function add(a, b) {
  return a + b;
}
const nums = [5, 6];
console.log(add(...nums)); // 输出：11（等价于add(5, 6)）
```

示例 2：Rest 模式负责「打包」

```javascript
// 解构数组时，将剩余元素打包为新数组
const [a, b, ...rest] = [1, 2, 3, 4, 5];
console.log(a); // 输出：1（单独提取第一个元素）
console.log(b); // 输出：2（单独提取第二个元素）
console.log(rest); // 输出：[3, 4, 5]（剩余元素打包为数组）
```

## 二、Rest 模式的应用场景 1：解构赋值（数组 + 对象）

### 2.1 数组解构中的 Rest 模式

#### 2.1.1 基础用法

用 Rest 模式把数组里没被单独取出来的剩余元素收集起来，生成一个新数组。

例题 1：取前两个元素，把剩下的收集起来

```javascript
const fruits = ["apple", "banana", "orange", "grape", "mango"];
// 提取前两个元素，剩余元素用Rest模式收集到others中
const [firstFruit, secondFruit, ...others] = fruits;

console.log(firstFruit); // 输出："apple"
console.log(secondFruit); // 输出："banana"
console.log(others); // 输出：["orange", "grape", "mango"]
```

#### 2.1.2 关键规则（必记）

1. Rest 必须是最后一个元素：Rest 不在末尾的话，JavaScript 判断不了"收集到哪为止"，会报错。

   错误示例：

   ```
   const [a, ...rest, b] = [1,2,3,4];
   ```

   （Uncaught SyntaxError: Rest element must be last in a destructuring pattern）

   正确示例：

   ```
   const [a, b, ...rest] = [1,2,3,4];
   ```

2. 只收集"没被跳过的剩余元素"：解构时跳过的元素，不会进 Rest。

   例题 2：跳过中间的元素，Rest 里没有被跳过的值

   ```javascript
   const [x, , y, ...rest] = [10, 20, 30, 40, 50];
   // 跳过了索引1的20，y对应索引2的30
   console.log(x); // 输出：10
   console.log(y); // 输出：30
   console.log(rest); // 输出：[40, 50]（不包含跳过的20）
   ```

3. 一个解构赋值里只能有一个 Rest：多个 Rest 会语法冲突。

   错误示例：

   ```
   const [a, ...rest1, b, ...rest2] = [1,2,3,4];
   ```

   （语法错误）

### 2.2 对象解构中的 Rest 模式

逻辑和数组解构一样，只是收集的结果是一个新对象（不是数组），用来收集对象里没被单独取出来的剩余属性。

例题 3：取出指定属性，把剩下的属性收集到新对象里

```javascript
const user = {
  name: "Alice",
  age: 25,
  gender: "female",
  city: "Beijing",
};

// 提取name和age，剩余属性用Rest模式收集到userRest中
const { name, age, ...userRest } = user;

console.log(name); // 输出："Alice"
console.log(age); // 输出：25
console.log(userRest); // 输出：{ gender: "female", city: "Beijing" }
```

## 三、Rest 模式的应用场景 2：函数参数（Rest 参数）

函数要接收任意数量的参数时，可以用 Rest 参数（`...参数名`），把传进来的参数都收集成一个数组，方便统一处理。

### 3.1 基础用法：实现 “任意数量参数求和”

例题 4：用 Rest 参数写一个求和函数

```javascript
// 定义求和函数，restParams收集所有传入的参数（数组形式）
function sum(...restParams) {
  let total = 0;
  // 遍历Rest参数数组，累加所有元素
  for (let i = 0; i < restParams.length; i++) {
    total += restParams[i];
  }
  return total;
}

// 测试：传入2个、4个、0个参数
console.log(sum(1, 2)); // 输出：3（restParams = [1,2]）
console.log(sum(3, 4, 5, 6)); // 输出：18（restParams = [3,4,5,6]）
console.log(sum()); // 输出：0（restParams = []，空数组不影响累加）
```

### 3.2 进阶用法 1：结合扩展运算符（拆包 + 打包）

扩展运算符的"拆包"和 Rest 参数的"打包"可以配合着用，灵活处理数组参数。

例题 5：把数组拆包传进函数，Rest 参数再打包处理

```javascript
// 复用上面的sum函数（Rest参数接收参数）
const numbers = [10, 20, 30];

// 1. 直接传数组：sum会将numbers视为1个参数，restParams = [ [10,20,30] ]，求和错误
console.log(sum(numbers)); // 输出：0（数组无法直接与数字累加）

// 2. 用扩展运算符拆包数组：将numbers拆为10、20、30三个独立参数
// Rest参数再将这三个参数打包为[10,20,30]，求和正确
console.log(sum(...numbers)); // 输出：60
```

### 3.3 进阶用法 2：必选参数 + 可选参数（Rest 接收可选参数）

函数可以先定义必选参数，再用 Rest 参数接收后面任意数量的可选参数。核心参数必须传，可选参数可以灵活扩展。

例题 6：披萨订单函数（必选主料 + 可选配料）

```javascript
// mainIngredient：必选参数（主料，如“芝士”）
// ...otherIngredients：Rest参数（可选配料，任意数量）
function orderPizza(mainIngredient, ...otherIngredients) {
  let pizzaDesc = `您点的披萨主料是：${mainIngredient}`;
  if (otherIngredients.length > 0) {
    pizzaDesc += `，可选配料是：${otherIngredients.join("、")}`;
  }
  console.log(pizzaDesc);
}

// 测试：1个必选参数、1个必选+2个可选参数
orderPizza("芝士");
// 输出：您点的披萨主料是：芝士（otherIngredients = []，无配料）

orderPizza("培根", "蘑菇", "洋葱");
// 输出：您点的披萨主料是：培根，可选配料是：蘑菇、洋葱（otherIngredients = ["蘑菇","洋葱"]）
```

## 四、小结：如何区分 Rest 与扩展运算符？

| 使用场景                  | 判定规则                                | 对应语法                         |
| ------------------------- | --------------------------------------- | -------------------------------- |
| 赋值运算符右侧（`=`右边） | 用于 “拆包” 数组 → 扩展运算符           | `const newArr = [...arr];`       |
| 函数调用实参位置          | 用于 “拆包” 数组为独立参数 → 扩展运算符 | `sum(...numbers);`               |
| 解构赋值左侧（`=`左边）   | 用于 “打包” 剩余元素 → Rest 模式        | `const [a, ...rest] = arr;`      |
| 函数形参位置              | 用于 “打包” 多个参数 → Rest 参数        | `function sum(...restParams) {}` |

一句话记：

- `...` 出现在值的位置（数组、函数实参）→ 扩展运算符（拆包）；
- `...` 出现在变量的位置（解构左边、函数形参）→ Rest 模式 / 参数（打包）。

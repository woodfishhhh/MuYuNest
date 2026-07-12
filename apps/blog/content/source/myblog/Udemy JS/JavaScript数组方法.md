---
title: "JavaScript数组方法"
date: 2025-12-25 18:28:57
tags:
  - "JavaScript"
  - "JavaScript数组方法"
  - "Java"
  - "数组"
  - "函数"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、核心主题

本章节聚焦JavaScript中处理数组的现代高阶函数方法,重点讲解`forEach`、`map`、`filter`、`reduce`四大核心数组方法的语法、参数、返回值及典型应用场景,通过对比传统循环方式,掌握函数式编程思想在数组处理中的应用,提升代码简洁性和可维护性。

## 二、forEach方法:遍历数组

### 2.1 基本语法与特点

- **作用**:对数组的每个元素执行一次提供的回调函数
- **返回值**:undefined(无返回值)
- **是否修改原数组**:不会直接修改,但可在回调中修改

```javascript
array.forEach(function (currentValue, index, array) {
  // 执行操作
}, thisArg);
```

**参数说明**:

- `currentValue`:当前元素值
- `index`:当前元素索引(可选)
- `array`:原数组本身(可选)
- `thisArg`:执行回调函数时用作this的值(可选)

### 2.2 例题:打印餐厅菜单

```javascript
const menu = ["凯撒沙拉", "菲力牛排", "松露意面"];

// 使用forEach遍历
menu.forEach(function (dish) {
  console.log("菜品:", dish);
});

// 输出:
// 菜品: 凯撒沙拉
// 菜品: 菲力牛排
// 菜品: 松露意面
```

### 2.3 例题:带索引的菜单打印

```javascript
const menu = ["凯撒沙拉", "菲力牛排", "松露意面"];

menu.forEach(function (dish, index) {
  console.log(`${index + 1}. ${dish}`);
});

// 输出:
// 1. 凯撒沙拉
// 2. 菲力牛排
// 3. 松露意面
```

### 2.4 forEach vs for-of循环

| 特性           | forEach   | for-of |
| -------------- | --------- | ------ |
| 返回值         | undefined | 无     |
| break/continue | 不支持    | 支持   |
| 回调函数       | 需要      | 不需要 |
| 代码简洁度     | 高        | 高     |

**重要提示**:forEach无法使用break或continue中断循环,必须遍历所有元素。

## 三、map方法:转换数组

### 3.1 基本语法与特点

- **作用**:对数组的每个元素执行回调函数,返回由处理结果组成的新数组
- **返回值**:新数组(与原数组长度相同)
- **是否修改原数组**:不修改,返回新数组

```javascript
const newArray = array.map(function (currentValue, index, array) {
  // 返回处理后的结果
}, thisArg);
```

### 3.2 例题:计算菜品价格翻倍

```javascript
const prices = [15, 28, 32, 18];

// 使用map将每个价格翻倍
const doubledPrices = prices.map(function (price) {
  return price * 2;
});

console.log(doubledPrices); // [30, 56, 64, 36]
console.log(prices); // [15, 28, 32, 18] (原数组不变)
```

### 3.3 例题:将菜单名称转为大写

```javascript
const menu = ["caesar salad", "beef steak", "truffle pasta"];

const upperMenu = menu.map(function (dish) {
  return dish.toUpperCase();
});

console.log(upperMenu); // ['CAESAR SALAD', 'BEEF STEAK', 'TRUFFLE PASTA']
```

### 3.4 map的陷阱:必须return

```javascript
const numbers = [1, 2, 3];

const result = numbers.map(function (num) {
  // 忘记return
  num * 2;
});

console.log(result); // [undefined, undefined, undefined]

// 正确写法
const correct = numbers.map(function (num) {
  return num * 2;
});
console.log(correct); // [2, 4, 6]
```

## 四、filter方法:过滤数组

### 4.1 基本语法与特点

- **作用**:根据指定条件过滤数组元素,返回满足条件的新数组
- **返回值**:新数组(包含满足条件的元素)
- **是否修改原数组**:不修改

```javascript
const newArray = array.filter(function (currentValue, index, array) {
  // 返回true或false
}, thisArg);
```

### 4.2 例题:筛选素食菜品

```javascript
const menu = [
  { name: "凯撒沙拉", vegetarian: true },
  { name: "菲力牛排", vegetarian: false },
  { name: "蔬菜汤", vegetarian: true },
  { name: "三文鱼", vegetarian: false },
];

// 筛选素食
const vegetarianDishes = menu.filter(function (dish) {
  return dish.vegetarian === true;
});

console.log(vegetarianDishes);
// [{name: '凯撒沙拉', vegetarian: true}, {name: '蔬菜汤', vegetarian: true}]
```

### 4.3 例题:筛选价格大于20的菜品

```javascript
const dishes = [
  { name: "沙拉", price: 15 },
  { name: "牛排", price: 28 },
  { name: "意面", price: 18 },
  { name: "龙虾", price: 45 },
];

const expensiveDishes = dishes.filter(function (dish) {
  return dish.price > 20;
});

console.log(expensiveDishes);
// [{name: '牛排', price: 28}, {name: '龙虾', price: 45}]
```

### 4.4 filter的回调必须返回布尔值

```javascript
const numbers = [1, 2, 3, 4, 5];

// 正确:返回true/false
const evens = numbers.filter(function (num) {
  return num % 2 === 0; // true或false
});

console.log(evens); // [2, 4]
```

## 五、reduce方法:累积数组

### 5.1 基本语法与特点

- **作用**:对数组的每个元素执行回调函数,将其结果累积为单个返回值
- **返回值**:累积后的单个值(可以是任意类型)
- **是否修改原数组**:不修改

```javascript
const result = array.reduce(function (
  accumulator,
  currentValue,
  currentIndex,
  array,
) {
  // 返回累积结果
}, initialValue);
```

**参数说明**:

- `accumulator`:累积器,存储回调的返回值
- `currentValue`:当前元素值
- `currentIndex`:当前索引(可选)
- `array`:原数组(可选)
- `initialValue`:初始值(可选,重要!)

### 5.2 例题:计算菜单总价

```javascript
const prices = [15, 28, 32, 18];

const total = prices.reduce(function (acc, price) {
  return acc + price;
}, 0); // 初始值为0

console.log(total); // 93

// 过程解析:
// 第1次: acc=0, price=15, return 0+15=15
// 第2次: acc=15, price=28, return 15+28=43
// 第3次: acc=43, price=32, return 43+32=75
// 第4次: acc=75, price=18, return 75+18=93
```

### 5.3 例题:找出最贵菜品

```javascript
const dishes = [
  { name: "沙拉", price: 15 },
  { name: "牛排", price: 28 },
  { name: "意面", price: 18 },
  { name: "龙虾", price: 45 },
];

const mostExpensive = dishes.reduce(function (acc, dish) {
  return dish.price > acc.price ? dish : acc;
});

console.log(mostExpensive); // {name: '龙虾', price: 45}
```

### 5.4 陷阱:忘记初始值

```javascript
const numbers = [1, 2, 3, 4];

// 无初始值,acc第一次为1
const sum1 = numbers.reduce(function (acc, num) {
  return acc + num;
});
console.log(sum1); // 10 (1+2+3+4)

// 有初始值0,acc第一次为0
const sum2 = numbers.reduce(function (acc, num) {
  return acc + num;
}, 0);
console.log(sum2); // 10 (0+1+2+3+4)

// 空数组无初始值会报错
const empty = [];
// empty.reduce((acc, num) => acc + num); // TypeError

// 空数组有初始值返回初始值
const safe = empty.reduce((acc, num) => acc + num, 0); // 0
```

## 六、方法链式调用

### 6.1 链式调用原理

数组方法返回数组(map/filter),可继续调用其他数组方法,形成链式调用,代码更简洁。

### 6.2 例题:筛选、转换、求和

```javascript
const transactions = [
  { type: "deposit", amount: 100 },
  { type: "withdrawal", amount: 50 },
  { type: "deposit", amount: 200 },
  { type: "withdrawal", amount: 30 },
];

// 1. 筛选所有存款
// 2. 提取金额数组
// 3. 计算总金额
const totalDeposits = transactions
  .filter(function (t) {
    return t.type === "deposit";
  })
  .map(function (t) {
    return t.amount;
  })
  .reduce(function (acc, amount) {
    return acc + amount;
  }, 0);

console.log(totalDeposits); // 300

// 箭头函数版本更简洁
const totalDepositsArrow = transactions
  .filter((t) => t.type === "deposit")
  .map((t) => t.amount)
  .reduce((acc, amount) => acc + amount, 0);
```

### 6.3 链式调用顺序的重要性

```javascript
const numbers = [1, 2, 3, 4, 5];

// 先filter再map (高效:只处理偶数)
const result1 = numbers
  .filter((num) => num % 2 === 0) // [2, 4]
  .map((num) => num * 2); // [4, 8]

// 先map再filter (低效:处理所有元素)
const result2 = numbers
  .map((num) => num * 2) // [2, 4, 6, 8, 10]
  .filter((num) => num % 4 === 0); // [4, 8]

// 结果相同,但filter在前更高效
console.log(result1, result2); // [4, 8] [4, 8]
```

## 七、find和findIndex方法

### 7.1 find方法

- **作用**:返回数组中满足条件的第一个元素
- **返回值**:找到的元素或undefined

```javascript
const dishes = [
  { name: "沙拉", price: 15 },
  { name: "牛排", price: 28 },
  { name: "意面", price: 18 },
];

// 找到第一个价格大于20的菜品
const expensiveDish = dishes.find(function (dish) {
  return dish.price > 20;
});

console.log(expensiveDish); // {name: '牛排', price: 28}
```

### 7.2 findIndex方法

- **作用**:返回数组中满足条件的第一个元素的索引
- **返回值**:索引或-1

```javascript
const menu = ["沙拉", "牛排", "意面"];

const index = menu.findIndex(function (dish) {
  return dish === "牛排";
});

console.log(index); // 1
```

## 八、some和every方法

### 8.1 some方法

- **作用**:检查数组中是否至少有一个元素满足条件
- **返回值**:布尔值

```javascript
const dishes = [
  { name: "沙拉", vegetarian: true },
  { name: "牛排", vegetarian: false },
  { name: "意面", vegetarian: false },
];

// 是否有素食菜品
const hasVegetarian = dishes.some(function (dish) {
  return dish.vegetarian === true;
});

console.log(hasVegetarian); // true
```

### 8.2 every方法

- **作用**:检查数组中是否所有元素都满足条件
- **返回值**:布尔值

```javascript
const dishes = [
  { name: "沙拉", vegetarian: true },
  { name: "蔬菜汤", vegetarian: true },
  { name: "水果拼盘", vegetarian: true },
];

// 是否全部为素食
const allVegetarian = dishes.every(function (dish) {
  return dish.vegetarian === true;
});

console.log(allVegetarian); // true
```

## 九、数组方法对比总结

### 9.1 核心方法对比表

| 方法      | 作用       | 返回值         | 是否修改原数组 | 是否支持链式 |
| --------- | ---------- | -------------- | -------------- | ------------ |
| forEach   | 遍历       | undefined      | 否             | 否           |
| map       | 转换       | 新数组         | 否             | 是           |
| filter    | 过滤       | 新数组         | 否             | 是           |
| reduce    | 累积       | 单个值         | 否             | 否           |
| find      | 查找第一个 | 元素/undefined | 否             | 否           |
| findIndex | 查找索引   | 索引/-1        | 否             | 否           |
| some      | 判断存在   | 布尔值         | 否             | 否           |
| every     | 判断全部   | 布尔值         | 否             | 否           |

### 9.2 使用场景决策树

1. **仅需遍历,不返回结果** → forEach
2. **需要转换数组元素** → map
3. **需要筛选满足条件元素** → filter
4. **需要汇总为单个值** → reduce
5. **查找第一个匹配元素** → find/findIndex
6. **判断数组是否满足条件** → some/every
7. **需要中断循环** → for-of

### 9.3 箭头函数简写

```javascript
// 传统函数
const doubled = numbers.map(function (num) {
  return num * 2;
});

// 箭头函数
const doubledArrow = numbers.map((num) => num * 2);

// 多参数
const indexed = menu.map((dish, index) => `${index}: ${dish}`);

// 多行逻辑
const processed = items.map((item) => {
  const tax = item.price * 0.1;
  return {
    ...item,
    priceWithTax: item.price + tax,
  };
});
```

## 十、总结:数组方法的核心要点

1. **不可变性**:map、filter、reduce等方法不修改原数组,返回新数据
2. **函数式编程**:将循环逻辑抽象为函数,代码更声明式
3. **链式调用**:map和filter返回数组,可继续调用其他方法
4. **回调函数**:所有方法都接收回调函数,参数位置固定
5. **箭头函数**:配合箭头函数可大幅简化代码
6. **性能考虑**:大规模数据时,链式调用可能多次遍历数组
7. **选择合适方法**:根据需求选择最匹配的方法,避免滥用forEach

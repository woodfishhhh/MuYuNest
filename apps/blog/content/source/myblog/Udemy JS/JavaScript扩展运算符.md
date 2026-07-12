---
title: "JavaScript扩展运算符"
date: 2025-12-25 18:01:02
tags:
  - "JavaScript"
  - "JavaScript扩展运算符"
  - "Java"
  - "定位"
  - "数组"
categories:
  - "前端开发"
  - "JavaScript"
---


## 1. 扩展运算符基础概念

- **定义**：扩展运算符（`...`）是 ES6 及后续版本新增的语法，功能是 “解包” 可迭代对象（如数组、字符串等）的元素，将其展开为独立的、以逗号分隔的值，且不创建新变量。

- **特点**：仅能用于需要 “逗号分隔值” 的场景（如构建数组、传递函数参数），无法在模板字符串等非逗号分隔场景使用。

- 与解构的区别

  ：

  | 特性           | 扩展运算符（...）                      | 解构（Destructuring）              |
  | -------------- | -------------------------------------- | ---------------------------------- |
  | 元素获取范围   | 提取可迭代对象的**所有元素**           | 可选择性提取指定位置的元素         |
  | 是否创建新变量 | 否                                     | 是（需定义对应变量接收提取的元素） |
  | 使用场景限制   | 仅逗号分隔值场景（数组构建、函数传参） | 数组 / 对象元素提取、变量赋值      |

## 2. 扩展运算符在数组中的应用

### 2.1 数组元素追加（头部 / 尾部 / 中间）

- **场景**：基于现有数组创建新数组，并在指定位置添加新元素，避免手动遍历或逐个索引访问的繁琐操作。

- 例题 1

  ：现有数组

  ```
  arr = [7, 8, 9]
  ```

  ，需创建新数组包含

  ```
  [1, 2] + arr元素 + [10]
  ```

  ，实现代码如下：

  javascript

  ```javascript
  // 传统繁琐方式
  const badNewArray = [1, 2, arr[0], arr[1], arr[2], 10];
  console.log(badNewArray); // [1, 2, 7, 8, 9, 10]

  // 扩展运算符简化方式
  const goodNewArray = [1, 2, ...arr, 10];
  console.log(goodNewArray); // [1, 2, 7, 8, 9, 10]
  ```

- **注意**：若省略`...`直接写`[1, 2, arr, 10]`，会导致数组嵌套（结果为`[1, 2, [7,8,9], 10]`），不符合需求。

### 2.2 数组浅拷贝

- **场景**：创建现有数组的副本，修改副本时不影响原数组（区别于 “引用赋值”，如`let copy = arr`会导致副本与原数组指向同一内存地址）。

- 例题 2

  ：拷贝餐厅主菜单数组

  ```
  restaurant.mainMenu = ['pizza', 'pasta', 'salad']
  ```

  ，并修改副本的第一个元素，验证原数组是否变化：

  javascript

  ```javascript
  // 扩展运算符浅拷贝
  const mainMenuCopy = [...restaurant.mainMenu];
  mainMenuCopy[0] = "cheese pizza"; // 修改副本

  console.log(mainMenuCopy); // ['cheese pizza', 'pasta', 'salad']（副本变化）
  console.log(restaurant.mainMenu); // ['pizza', 'pasta', 'salad']（原数组不变）

  // 对比：引用赋值（修改副本会影响原数组）
  const badCopy = restaurant.mainMenu;
  badCopy[0] = "cheese pizza";
  console.log(restaurant.mainMenu); // ['cheese pizza', 'pasta', 'salad']（原数组被修改）
  ```

### 2.3 多数组合并

- **场景**：将 2 个及以上数组的元素整合到一个新数组中，无需使用`concat()`方法。

- 例题 3

  ：合并餐厅的启动菜单

  ```
  starterMenu = ['garlic bread', 'bruschetta']
  ```

  和主菜单

  ```
  mainMenu
  ```

  ，生成完整菜单：

  javascript

  ```javascript
  const fullMenu = [...restaurant.starterMenu, ...restaurant.mainMenu];
  console.log(fullMenu);
  // ['garlic bread', 'bruschetta', 'pizza', 'pasta', 'salad']
  ```

## 3. 扩展运算符在函数参数中的应用

- **场景**：当函数需要多个独立参数，而参数值存储在数组中时，用`...`直接展开数组作为参数，避免逐个传入`arr[0], arr[1], ...`。

- 例题 4

  ：定义函数

  ```
  orderPasta(ing1, ing2, ing3)
  ```

  ，需接收 3 种意大利面食材，从用户输入（

  ```
  prompt
  ```

  ）获取食材存入数组后，调用函数：

  ```javascript
  // 定义函数：输出带指定食材的意大利面
  function orderPasta(ing1, ing2, ing3) {
    console.log(`您的意大利面已制作，食材：${ing1}、${ing2}、${ing3}`);
  }

  // 从用户输入获取3种食材，存入数组
  const ingredients = [
    prompt("请输入第1种食材："),
    prompt("请输入第2种食材："),
    prompt("请输入第3种食材："),
  ];

  // 传统方式：逐个传参（繁琐，数组长度变化时需修改代码）
  orderPasta(ingredients[0], ingredients[1], ingredients[2]);

  // 扩展运算符方式：直接展开数组（简洁，数组长度匹配即可）
  orderPasta(...ingredients);
  ```

- **运行结果**：若用户输入 “蘑菇”“芦笋”“奶酪”，两种调用方式均输出：`您的意大利面已制作，食材：蘑菇、芦笋、奶酪`。

## 4. 扩展运算符在可迭代对象（非数组）中的应用

### 4.1 适用的可迭代对象范围

- 扩展运算符支持**数组、字符串、Map（映射）、Set（集合）**，不支持普通对象（ES2018 后对象有单独的`...`用法，见第 5 节）。

### 4.2 字符串应用：拆分字符为数组

- **场景**：将字符串的每个字符作为独立元素，构建新数组，可额外添加其他元素。

- 例题 5

  ：将字符串

  ```
  name = 'Jonas'
  ```

  拆分为字符数组，并在开头添加空字符串、结尾添加 'S'：

  ```javascript
  const name = "Jonas";
  const nameArray = ["", ...name, "S"];
  console.log(nameArray); // ['', 'J', 'o', 'n', 'a', 's', 'S']
  ```

- 错误示例

  ：不可在模板字符串中使用

  ```
  ...
  ```

  ，因模板字符串不需要 “逗号分隔值”：

  ```javascript
  // 错误：模板字符串中使用扩展运算符，语法报错
  const badStr = `Hello ${...name}`;
  // Uncaught SyntaxError: Unexpected token '...'
  ```

## 5. 扩展运算符在对象中的应用（ES2018+）

### 5.1 对象属性复制与新增

- **场景**：基于现有对象创建新对象，复制原对象所有属性，并添加新属性（新属性可覆盖原属性，按代码顺序生效）。

- 例题 6

  ：现有餐厅对象

  ```
  restaurant = {name: 'Classico Italiano', category: 'Italian'}
  ```

  ，创建新对象并添加 “创始人”“成立年份” 属性：

  ```javascript
  const restaurant = {
    name: "Classico Italiano",
    category: "Italian",
  };

  // 扩展运算符：复制原对象属性 + 新增属性
  const newRestaurant = {
    foundedIn: 1998, // 新增属性1
    ...restaurant, // 复制原对象所有属性
    founder: "Giuseppe", // 新增属性2
  };

  console.log(newRestaurant);
  // {
  //   foundedIn: 1998,
  //   name: 'Classico Italiano',
  //   category: 'Italian',
  //   founder: 'Giuseppe'
  // }
  ```

### 5.2 对象浅拷贝

- **场景**：创建现有对象的副本，修改副本属性时不影响原对象（区别于 “引用赋值”）。

- 例题 7

  ：拷贝

  ```
  restaurant
  ```

  对象，修改副本的

  ```
  name
  ```

  属性，验证原对象是否变化：

  javascript

  ```javascript
  // 扩展运算符浅拷贝对象
  const restaurantCopy = { ...restaurant };
  restaurantCopy.name = "Ristorante Roma"; // 修改副本名称

  console.log(restaurantCopy.name); // 'Ristorante Roma'（副本变化）
  console.log(restaurant.name); // 'Classico Italiano'（原对象不变）
  ```

## 6. 小结与注意事项

1. 使用场景限制

   ：仅能在 “需要逗号分隔值” 的场景使用，如：
   - 构建数组（`[...arr1, ...arr2]`）
   - 传递函数参数（`func(...arr)`）
   - 构建对象（ES2018+，`{...obj1, ...obj2}`）

2. **浅拷贝特性**：对数组 / 对象的拷贝均为 “浅拷贝”，若原对象包含嵌套数组 / 对象，修改嵌套内容仍会影响原对象（需深拷贝需额外处理，如`JSON.parse(JSON.stringify(obj))`）。

3. **可迭代对象差异**：普通对象不是可迭代对象，但 ES2018 后单独支持`...`语法，需与数组 / 字符串的`...`用法区分。

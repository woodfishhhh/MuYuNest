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

- 定义：扩展运算符（`...`）是 ES6 起新增的语法，把可迭代对象（数组、字符串等）的元素"解包"，展开成一个个用逗号隔开的独立值，不会新建变量。

- 特点：只能用在需要"逗号分隔值"的地方（构建数组、传函数参数），模板字符串这种不是逗号分隔的地方用不了。

- 与解构的区别：

  | 特性           | 扩展运算符（...）                      | 解构（Destructuring）              |
  | -------------- | -------------------------------------- | ---------------------------------- |
  | 元素获取范围   | 提取可迭代对象的**所有元素**           | 可选择性提取指定位置的元素         |
  | 是否创建新变量 | 否                                     | 是（需定义对应变量接收提取的元素） |
  | 使用场景限制   | 仅逗号分隔值场景（数组构建、函数传参） | 数组 / 对象元素提取、变量赋值      |

## 2. 扩展运算符在数组中的应用

### 2.1 数组元素追加（头部 / 尾部 / 中间）

- 场景：基于现有数组建一个新数组，在指定位置加新元素，不用手动遍历或者一个个按索引取。

- 例题 1：现有数组 `arr = [7, 8, 9]`，要建一个新数组，内容是 `[1, 2] + arr元素 + [10]`。代码：

  ```javascript
  // 传统繁琐方式
  const badNewArray = [1, 2, arr[0], arr[1], arr[2], 10];
  console.log(badNewArray); // [1, 2, 7, 8, 9, 10]

  // 扩展运算符简化方式
  const goodNewArray = [1, 2, ...arr, 10];
  console.log(goodNewArray); // [1, 2, 7, 8, 9, 10]
  ```

- 注意：省掉 `...` 直接写 `[1, 2, arr, 10]` 的话，数组会嵌套（结果是 `[1, 2, [7,8,9], 10]`），不是想要的效果。

### 2.2 数组浅拷贝

- 场景：建一个现有数组的副本，改副本不影响原数组（和"引用赋值"不同，`let copy = arr` 会让副本和原数组指向同一块内存）。

- 例题 2：拷贝餐厅的主菜单数组 `restaurant.mainMenu = ['pizza', 'pasta', 'salad']`，改一下副本的第一个元素，看原数组有没有变：

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

- 场景：把两个及以上数组的元素合进一个新数组，不用 `concat()`。

- 例题 3：合并餐厅的开胃菜单 `starterMenu = ['garlic bread', 'bruschetta']` 和主菜单 `mainMenu`，生成完整的菜单：

  ```javascript
  const fullMenu = [...restaurant.starterMenu, ...restaurant.mainMenu];
  console.log(fullMenu);
  // ['garlic bread', 'bruschetta', 'pizza', 'pasta', 'salad']
  ```

## 3. 扩展运算符在函数参数中的应用

- 场景：函数要好几个独立的参数，而参数值存在数组里时，用 `...` 直接把数组展开当参数，不用一个个传 `arr[0], arr[1], ...`。

- 例题 4：定义函数 `orderPasta(ing1, ing2, ing3)`，它接收 3 种意大利面食材。用 `prompt` 从用户输入拿到食材存进数组后，调用这个函数：

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

- 运行结果：用户输入"蘑菇""芦笋""奶酪"的话，两种调用方式都输出：`您的意大利面已制作，食材：蘑菇、芦笋、奶酪`。

## 4. 扩展运算符在可迭代对象（非数组）中的应用

### 4.1 适用的可迭代对象范围

- 扩展运算符支持数组、字符串、Map（映射）、Set（集合），不支持普通对象（ES2018 之后对象有单独的 `...` 用法，见第 5 节）。

### 4.2 字符串应用：拆分字符为数组

- 场景：把字符串的每个字符当成独立的元素建新数组，还能另外加别的元素。

- 例题 5：把字符串 `name = 'Jonas'` 拆成字符数组，开头加一个空字符串、结尾加 'S'：

  ```javascript
  const name = "Jonas";
  const nameArray = ["", ...name, "S"];
  console.log(nameArray); // ['', 'J', 'o', 'n', 'a', 's', 'S']
  ```

- 错误示例：模板字符串里不能用 `...`，因为模板字符串不需要"逗号分隔值"：

  ```javascript
  // 错误：模板字符串中使用扩展运算符，语法报错
  const badStr = `Hello ${...name}`;
  // Uncaught SyntaxError: Unexpected token '...'
  ```

## 5. 扩展运算符在对象中的应用（ES2018+）

### 5.1 对象属性复制与新增

- 场景：基于现有对象建新对象，复制原对象的所有属性，再加新属性（新属性能覆盖原属性，按代码顺序生效）。

- 例题 6：现有餐厅对象

  ```
  restaurant = {name: 'Classico Italiano', category: 'Italian'}
  ```

  建一个新对象，加上"创始人""成立年份"两个属性：

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

- 场景：建一个现有对象的副本，改副本的属性不影响原对象（和"引用赋值"不同）。

- 例题 7：拷贝 `restaurant` 对象，改副本的 `name` 属性，看原对象有没有变：

  ```javascript
  // 扩展运算符浅拷贝对象
  const restaurantCopy = { ...restaurant };
  restaurantCopy.name = "Ristorante Roma"; // 修改副本名称

  console.log(restaurantCopy.name); // 'Ristorante Roma'（副本变化）
  console.log(restaurant.name); // 'Classico Italiano'（原对象不变）
  ```

## 6. 小结与注意事项

1. 使用场景有限制：只能用在需要"逗号分隔值"的地方，比如：
   - 构建数组（`[...arr1, ...arr2]`）
   - 传函数参数（`func(...arr)`）
   - 构建对象（ES2018+，`{...obj1, ...obj2}`）

2. 浅拷贝：对数组 / 对象的拷贝都是浅拷贝，原对象里有嵌套的数组 / 对象的话，改嵌套的内容还是会影响原对象（要深拷贝得另外处理，比如 `JSON.parse(JSON.stringify(obj))`）。

3. 可迭代对象的差别：普通对象不是可迭代对象，但 ES2018 之后单独支持了 `...` 语法，要和数组 / 字符串的 `...` 用法区分开。

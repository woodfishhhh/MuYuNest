---
title: "JavaScript 学习笔记（7）：面向对象与内置构造函数"
date: 2025-09-29 23:58:23
tags:
  - "前端开发"
  - "面向对象"
  - "内置构造函数"
  - "JavaScript"
  - "Java"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、要解决的问题

1. 理解面向对象编程的基础概念，明确构造函数的作用。
2. 体会 JavaScript “一切皆对象” 的语言特性。
3. 熟练掌握常见对象属性和方法的使用。

## 二、知识要点

### （一）深入对象

构造函数

- **概念**：构造函数是用于创建对象的函数，使用`new`关键字调用的函数即为构造函数。
- **用法及案例**

```html
<script>
  function foo() {
    console.log('通过 new 也能调用函数...');
  }
  new foo;
</script>
```

- 总结拓展

  - 使用`new`关键字调用函数称为实例化。
  - 实例化构造函数无参数时可省略`()`。
  - 构造函数返回值为新创建的对象，内部`return`返回值无效。
  - 习惯将构造函数首字母大写以区分普通函数。


实例成员

- **概念**：通过构造函数创建的对象为实例对象，其属性和方法是实例成员。
- **用法及案例**

```html
<script>
  function Person() {
    this.name = '小明';
    this.sayHi = function () {
      console.log('大家好~');
    };
  }
  const p1 = new Person();
  console.log(p1);
  console.log(p1.name); 
  p1.sayHi(); 
</script>
```

- 总结拓展
  - 构造函数内`this`是实例对象，为其添加的属性和方法是实例成员。
  - 可通过传参创建结构相同但值不同的对象，且实例对象相互独立。


静态成员

- **概念**：JavaScript 中函数本质是对象类型，构造函数的属性和方法是静态成员。
- **用法及案例**

```html
<script>
  function Person(name, age) {}
  Person.eyes = 2;
  Person.arms = 2;
  Person.walk = function () {
    console.log('^_^人都会走路...');
    console.log(this.eyes);
  };
</script>
```

- 总结拓展
  - 静态成员是添加到构造函数本身的属性和方法。
  - 一般将具有公共特征的属性或方法设为静态成员。
  - 静态成员方法中`this`指向构造函数本身。

### （二）内置构造函数

1. **概念**：JavaScript 有 6 种主要数据类型，包括字符串、数值、布尔、`undefined`、`null`和对象。其中字符串、数值、布尔、`undefined`、`null`是简单或基础类型，对象是引用类型。JavaScript 内置一些构造函数用于数据处理，如`Date`。


#### JavaScript 中的 Object（对象）

##### 什么是 Object？

`Object` 是 JavaScript 自带的一个 "构造函数"，专门用来创建和操作 "对象"（存储键值对的集合）。

##### 常用创建对象的方式

有两种主要方式可以创建对象：

1. **用 Object 构造函数**（不推荐）

   ```javascript
   // 用 new Object() 创建对象
   const user = new Object({name: '小明', age: 15});
   ```

2. **用对象字面量 `{}`**（推荐）

   ```javascript
   // 直接用 {} 创建对象（更简单直观）
   let student = {name: '杜子腾', age: 21};
   ```

##### 简洁写法示例

当对象的属性名和变量名相同时，可以简写：

```javascript
let name = '小红';
// 等同于 {name: name, walk: function(){...}}
let people = {
  name,  // 简写，等价于 name: name
  walk() {  // 方法简写，等价于 walk: function(){}
    console.log('人都要走路...');
  }
};
```

##### 常用检查方法

1. **查看对象的构造函数**

   ```javascript
   console.log(student.constructor); // 输出：[Function: Object]
   console.log(user.constructor);   // 输出：[Function: Object]
   ```

   说明：无论是用 `{}` 还是 `new Object()` 创建的对象，都是由 `Object` 构造函数创建的。

2. **检查是否是 Object 的实例**

   ```javascript
   console.log(student instanceof Object); // 输出：true
   ```

   说明：所有对象都是 `Object` 的实例。

##### 实用工具（Object 的静态方法）

1. **合并对象（创建新对象）**

   ```javascript
   const obj1 = {a: 1};
   const obj2 = {b: 2};
   const newObj = Object.assign({}, obj1, obj2); // {a:1, b:2}
   ```

2. **获取所有属性名**

   ```javascript
   const obj = {name: '张三', age: 18};
   console.log(Object.keys(obj)); // 输出：['name', 'age']
   ```

3. **获取所有属性值**

   ```javascript
   console.log(Object.values(obj)); // 输出：['张三', 18]
   ```

##### 总结

- 推荐用 `{}` 字面量创建对象，比 `new Object()` 更简单。
- 对象里的属性和方法可以用简洁语法编写。
- `Object` 提供了很多实用工具，方便操作对象。

Array

- **概念**：`Array`是内置构造函数，用于创建数组。
- **用法及案例**

```html
<script>
  let arr = new Array(5, 7, 8);
  let list = ['html', 'css', 'javascript'];
</script>
```

- 总结拓展
  - 推荐用字面量方式声明数组，而非`Array`构造函数。
  - `forEach`实例方法遍历数组，可替代`for`循环。
  - `filter`实例方法过滤数组单元值，生成新数组。
  - `map`实例方法迭代原数组，生成新数组。
  - `join`实例方法将数组元素拼接为字符串并返回。
  - `find`实例方法查找元素，返回符合条件的第一个数组元素值，无则返回`undefined`。
  - `every`实例方法检测数组所有元素是否符合指定条件，全通过返回`true`，否则`false`。
  - `some`实例方法检测数组中是否有元素满足指定条件，有则返回`true`，否则`false`。
  - `concat`实例方法合并两个数组，返回新数组。
  - `sort`实例方法对原数组单元值排序。
  - `splice`实例方法删除或替换原数组单元。
  - `reverse`实例方法反转数组。
  - `findIndex`实例方法查找元素的索引值。


包装类型

- **概念**：JavaScript 中字符串、数值、布尔类型数据具有对象特征，是因为底层用`Object`构造函数 “包装”，被称为包装类型。
- String
  - **概念**：`String`是内置构造函数，用于创建字符串。
  - **用法及案例**

```html
<script>
  let str = new String('hello world!');
  let str2 = '你好，世界！';
  console.log(str.constructor === str2.constructor); 
  console.log(str instanceof String); 
</script>
```

- 总结拓展
  - `length`实例属性获取字符串长度。
  - `split('分隔符')`实例方法将字符串拆分成数组。
  - `substring（需要截取的第一个字符的索引[,结束的索引号]）`实例方法用于字符串截取。
  - `startsWith(检测字符串[, 检测位置索引号])`实例方法检测是否以某字符开头。
  - `includes(搜索的字符串[, 检测位置索引号])`实例方法判断一个字符串是否包含在另一个字符串中，返回`true`或`false`。
  - `toUpperCase`实例方法将字母转换成大写。
  - `toLowerCase`实例方法将字母转换成小写。
  - `indexOf`实例方法检测是否包含某字符。
  - `endsWith`实例方法检测是否以某字符结尾。
  - `replace`实例方法用于替换字符串，支持正则匹配。
  - `match`实例方法用于查找字符串，支持正则匹配。
  - `String`可作普通函数，强制转换为字符串数据类型。


- Number

  - **概念**：`Number`是内置构造函数，用于创建数值。
  - **用法及案例**

```html
<script>
  let x = new Number('10');
  let y = new Number(5);
  let z = 20;
</script>
```

- 总结拓展
  - 推荐用字面量方式声明数值，而非`Number`构造函数。
  - `toFixed`实例方法用于设置保留小数位的长度。
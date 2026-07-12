---
title: "TypeScript 入门到实战笔记：安装、编译与类型系统"
date: 2025-12-31 02:17:14
tags:
  - "TypeScript"
  - "tsc"
  - "类型系统"
  - "编译"
  - "开发环境"
categories:
  - "编程语言"
  - "TypeScript"
---


---

![course-outline.png](notebook-image/course-outline.png)

---

## 安装并使用 TypeScript

- 官网地址：https://www.typescriptlang.org/
- 官方文档：https://www.typescriptlang.org/docs/

![typescript-homepage.png](notebook-image/typescript-homepage.png)

### 环境配置

#### 安装 TypeScript

- 项目开发依赖安装：

```shell
npm install typescript --save-dev
```

- 全局安装：

```shell
npm install -g typescript
```

#### 编译 TS 文件

```shell
tsc TS文件
```

---

lite-server

用于轻量级开发的节点服务器，为 web 应用程序提供服务，在浏览器中打开它，在 html 或 javascript 更改时刷新，使用套接字注入 CSS 更改，并在找不到路由时具有回退页面。

https://www.npmjs.com/package/lite-server

```shell
npm install lite-server --save-dev
```

---

## TypeScript 数据类型

![core-data-type.png](notebook-image/core-data-type.png)

PS：TypeScript 的类型系统只能在开发（编码）阶段辅助进行类型检查，TypeScript 最终会被编译成 JavaScript，而 JavaScript 本身不具备类型检查功能。

### 类型推断

### 联合数据类型

### 类型别名

### unknown 类型

### never 类型

---

## TypeScript 编译

监视 TS 脚本的更新，然后实时编译为 JS 文件（监听单个文件）

```shell
tsc index.ts --watch
```

### 多模块编译

在工程目录中执行这个命令后会自动生成一个`tsconfig.json`文件

```shell
tsc --init
```

此时执行 `tsc --watch` 就可以监视整个工程目录下的 TS 更新变化从而进行自动编译。

`tsconfig.json` 配置项：

- exclude：在`tsconfig.json`配置文件中，可以针对需要编译排除的文件进行配置：

```json
"exclude": [
    "node_modules"  // 这是一个默认的配置
]
```

- include：在`tsconfig.json`配置文件中，可以指定需要编译的 TS 文件：

```json
"include": [
  "index.ts"      // 这里指定的是需要编译的TS，如果没有在这个指定项中，则不会被编译
]
```

---

## TypeScript Class Interface

### Class

声明一个 Class 类，并事例化这个 Class：

```typescript
// 声明一个Class类
class Person {
  // 声明一个name属性为string
  name: string;

  // 声明一个constructor构造函数，在执行事例化时调用执行
  constructor(name: string) {
    this.name = name;
  }

  // TypeScript Class 中定义方法不需要使用function 关键字
  showInfo(): void {
    // this 指向的当前class创建出来的实例对象
    console.log(this.name);
  }
}

// 创建一个对象
const person = new Person("Krian");
person.showInfo();
```

可以直接在 constructor 构造器 入参中声明属性，并在对象初始化时，给这些属性进行赋值。

```typescript
// 声明一个constructor构造函数
constructor(public name: string, private balance: number) {
    // 在使用new关键字时，给这个类的属性进行赋值
}
```

只读属性：使用 readonly 关键字修饰

```typescript
class Person {
  // 声明一个name属性为string
  name: string;

  // 使用readonly关键字声明一个只读属性
  constructor(readonly name: string) {
    this.name = name;
  }

  // TypeScript Class 中定义方法不需要使用function 关键字
  showInfo(): void {
    // this 指向的当前class创建出来的实例对象
    console.log(this.name);
  }
}
```

使用 private 关键字，声明一个属性为私有属性，提供 getter 和 setter 方法进行数据操作：

```typescript

```

静态属性和方法：使用 static 关键字进行修饰

```typescript

```

抽象类：使用 abstract 关键字声明一个抽象类 和 抽象方法

```typescript

```

单例对象 私有化构造器：

```typescript

```

#### 继承

使用 extends 关键字实现 Class 类之间的继承关系

```typescript

```

使用 protected 关键字声明一个属性为受保护的，无法通过外部直接访问，但是能实现子父类之间继承和重写。

### Interface

interface 允许我们去定义一个对象的结构。

```typescript
// 使用interface关键字声明接口
interface Person {
  name: string;
  age: number;

  showInfo(): void;
}

// 初始化一个person对象
let person: Person;
person = {
  name: "krian",
  age: 24,
  showInfo() {
    console.log(this.name, this.age);
  },
};

person.showInfo();
```

class 通过 implements 实现接口（多实现）。

在 interface 内部声明属性时，可以使用 readonly 直接声明为只读属性。

在属性名后面加 ? 声明这个属性是可选的。

---

## 第六章 TypeScript 高级类型概念笔记

## 6.1 - Module Introduction（模块介绍）

本章聚焦 TypeScript 高级类型概念，这些概念能解决实际项目中复杂的类型处理问题，核心内容包括交叉类型（Intersection Types）、类型守卫（Type Guards）、歧视联合（Discriminated Unions）、类型转换（Type Casting）、索引属性（Index Properties）、函数重载（Function Overloads）、可选链（Optional Chaining）、空值合并（Nullish Coalescing），旨在帮助开发者编写更灵活、类型更安全的代码。

## 6.2 - Intersection Types（交叉类型）

### 6.2.1 概念定义

交叉类型通过 `&` 符号将多个类型“合并”为一个新类型，新类型包含所有源类型的属性和方法，适用于需要“同时具备多个类型特征”的场景（例如一个对象既需要用户信息，又需要权限信息）。

**语法格式**：

```typescript
type TypeA = { propA: Type };
type TypeB = { propB: Type };
type IntersectionType = TypeA & TypeB; // 同时包含 propA 和 propB
```

### 6.2.2 特点

1. **属性合并**：若多个源类型有同名属性，且属性类型兼容（如 `string` 和 `string`），则合并后属性类型不变；若类型不兼容（如 `string` 和 `number`），则合并后属性类型为 `never`（表示该属性无合法值）。
2. **方法合并**：若多个源类型有同名方法，合并后方法需兼容所有源方法的参数和返回值（即参数列表是所有源方法的“超集”，返回值是所有源方法的“子集”）。

### 6.2.3 实例演示

#### 示例1：基础对象交叉

```typescript
// 定义用户基本信息类型
type UserBase = {
  id: number;
  name: string;
};

// 定义用户权限类型
type UserPermission = {
  role: "admin" | "user" | "guest";
  hasEdit: boolean;
};

// 交叉类型：同时包含基本信息和权限
type User = UserBase & UserPermission;

// 合法使用：必须包含所有属性
const admin: User = {
  id: 1,
  name: "Zhang San",
  role: "admin",
  hasEdit: true,
};

// 错误：缺少 role 属性（TypeScript 会提示“Property 'role' is missing in type ...”）
const invalidUser: User = {
  id: 2,
  name: "Li Si",
  hasEdit: false,
};
```

#### 示例2：类型不兼容处理

```typescript
type TypeX = { age: number };
type TypeY = { age: string };
type TypeXY = TypeX & TypeY;

// 错误：age 类型为 number & string = never，无合法值
const obj: TypeXY = {
  age: 20, // 提示“Type 'number' is not assignable to type 'never'”
};
```

## 6.3 - More on Type Guards（深入理解类型守卫）

### 6.3.1 概念定义

类型守卫是一组“运行时检查逻辑”，用于判断一个值的具体类型，从而在条件分支中缩小类型范围（Type Narrowing），避免类型错误。TypeScript 会识别常见的类型守卫逻辑，并自动更新变量的类型推断。

### 6.3.2 常见类型守卫实现方式

#### 1. `typeof` 类型守卫（适用于基本类型）

用于判断 `string`、`number`、`boolean`、`symbol` 等基本类型，**不能用于对象类型**（`typeof {}` 会返回 `object`，无法区分 `Array`、`Date` 等）。

**示例**：

```typescript
// 定义联合类型参数
function formatValue(value: string | number | boolean) {
  if (typeof value === "string") {
    // 此处 value 被推断为 string 类型
    return `String: ${value.toUpperCase()}`;
  } else if (typeof value === "number") {
    // 此处 value 被推断为 number 类型
    return `Number: ${value.toFixed(2)}`;
  } else {
    // 此处 value 被推断为 boolean 类型
    return `Boolean: ${value ? "Yes" : "No"}`;
  }
}

// 测试
console.log(formatValue("hello")); // String: HELLO
console.log(formatValue(123.456)); // Number: 123.46
console.log(formatValue(false)); // Boolean: No
```

#### 2. `instanceof` 类型守卫（适用于引用类型）

用于判断一个对象是否是某个类的实例（基于原型链），适用于 `Array`、`Date`、自定义类等引用类型。

**示例**：

```typescript
function handleValue(value: Date | Array<string> | string) {
  if (value instanceof Date) {
    // 此处 value 被推断为 Date 类型
    return `Date: ${value.toLocaleDateString()}`;
  } else if (value instanceof Array) {
    // 此处 value 被推断为 Array<string> 类型
    return `Array: [${value.join(", ")}]`;
  } else {
    // 此处 value 被推断为 string 类型
    return `String: ${value}`;
  }
}

// 测试
console.log(handleValue(new Date(2024, 5, 1))); // Date: 2024/6/1
console.log(handleValue(["a", "b", "c"])); // Array: [a, b, c]
console.log(handleValue("test")); // String: test
```

#### 3. 自定义类型守卫（适用于复杂对象）

通过“返回值为 `parameter is Type`”的函数，自定义类型判断逻辑，适用于区分结构相似的对象类型。

**示例**：

```typescript
// 定义两个结构相似的类型
type Circle = {
  type: "circle";
  radius: number;
};

type Rectangle = {
  type: "rectangle";
  width: number;
  height: number;
};

type Shape = Circle | Rectangle;

// 自定义类型守卫：判断是否为 Circle 类型
function isCircle(shape: Shape): shape is Circle {
  return shape.type === "circle";
}

// 自定义类型守卫：判断是否为 Rectangle 类型
function isRectangle(shape: Shape): shape is Rectangle {
  return shape.type === "rectangle";
}

// 计算图形面积
function calculateArea(shape: Shape): number {
  if (isCircle(shape)) {
    // 此处 shape 被推断为 Circle 类型，可安全访问 radius
    return Math.PI * shape.radius ** 2;
  } else if (isRectangle(shape)) {
    // 此处 shape 被推断为 Rectangle 类型，可安全访问 width 和 height
    return shape.width * shape.height;
  }
  return 0;
}

// 测试
const circle: Circle = { type: "circle", radius: 5 };
const rectangle: Rectangle = { type: "rectangle", width: 4, height: 6 };
console.log(calculateArea(circle)); // ~78.54（π*5²）
console.log(calculateArea(rectangle)); // 24（4*6）
```

## 6.4 - Discriminated Unions（歧视联合）

### 6.4.1 概念定义

歧视联合（又称“可区分联合”）是一种特殊的联合类型，满足两个条件：

1. 所有成员类型都包含一个**同名且类型不同的“歧视属性”**（如 `type: "circle"` 或 `type: "rectangle"`）；
2. 通过该歧视属性的取值，可以唯一确定当前值属于哪个成员类型。

歧视联合的核心优势是：**无需复杂的类型守卫，仅通过歧视属性即可缩小类型范围**，代码更简洁、可读性更高。

### 6.4.2 实例演示

#### 示例1：基础歧视联合

```typescript
// 定义歧视联合：所有成员都有 type 歧视属性
type PaymentMethod =
  | { type: "cash"; amount: number } // 现金支付：仅含 amount
  | { type: "card"; cardNumber: string; expiryDate: string } // 银行卡支付：含卡号和有效期
  | { type: "wechat"; openId: string; amount: number }; // 微信支付：含 openId 和 amount

// 处理支付逻辑
function processPayment(method: PaymentMethod): string {
  switch (method.type) {
    case "cash":
      // 此处 method 被推断为 cash 类型，仅含 amount
      return `Cash payment: $${method.amount.toFixed(2)}`;
    case "card":
      // 此处 method 被推断为 card 类型，含 cardNumber 和 expiryDate
      return `Card payment: ****${method.cardNumber.slice(-4)}, Expiry: ${method.expiryDate}`;
    case "wechat":
      // 此处 method 被推断为 wechat 类型，含 openId 和 amount
      return `WeChat payment: OpenId ${method.openId.slice(0, 8)}..., Amount: $${method.amount.toFixed(2)}`;
  }
}

// 测试
console.log(processPayment({ type: "cash", amount: 50.5 }));
// Cash payment: $50.50

console.log(
  processPayment({
    type: "card",
    cardNumber: "1234567890123456",
    expiryDate: "12/26",
  }),
);
// Card payment: ****3456, Expiry: 12/26

console.log(
  processPayment({
    type: "wechat",
    openId: "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
    amount: 100,
  }),
);
// WeChat payment: OpenId o6_bmjrP..., Amount: $100.00
```

#### 示例2：结合类型守卫使用

当歧视属性的判断逻辑较复杂时，可结合自定义类型守卫进一步简化代码：

```typescript
type Book = { category: "book"; isbn: string };
type Movie = { category: "movie"; duration: number };
type Media = Book | Movie;

// 自定义类型守卫（基于歧视属性）
function isBook(media: Media): media is Book {
  return media.category === "book";
}

// 获取媒体信息
function getMediaInfo(media: Media): string {
  if (isBook(media)) {
    return `Book: ISBN ${media.isbn}`;
  } else {
    return `Movie: ${media.duration} minutes`;
  }
}

// 测试
console.log(getMediaInfo({ category: "book", isbn: "9787115546026" }));
// Book: ISBN 9787115546026
console.log(getMediaInfo({ category: "movie", duration: 120 }));
// Movie: 120 minutes
```

## 6.5 - Type Casting（类型转换）

### 6.5.1 概念定义

类型转换（又称“类型断言”）用于**告诉 TypeScript 编译器“我比你更清楚这个值的类型”**，强制将一个类型转换为另一个类型。它仅在编译阶段生效，不会影响运行时的类型（即不会改变值本身），适用于编译器无法正确推断类型的场景（如 DOM 元素获取、第三方库返回值处理）。

### 6.5.2 两种语法格式

#### 1. “尖括号”语法（不支持 JSX 环境）

```typescript
const value: unknown = "hello world";
const length = (<string>value).length; // 强制转换为 string 类型，访问 length 属性
```

#### 2. `as` 语法（推荐，支持所有环境，包括 JSX）

```typescript
const value: unknown = "hello world";
const length = (value as string).length; // 效果与尖括号语法一致
```

### 6.5.3 适用场景与注意事项

#### 场景1：DOM 元素获取

TypeScript 无法自动推断 `document.getElementById` 等方法返回的 DOM 元素具体类型（默认返回 `HTMLElement | null`），需通过类型转换指定具体元素类型（如 `HTMLInputElement`、`HTMLButtonElement`）。

**示例**：

```typescript
// 获取输入框元素：默认推断为 HTMLElement | null
const input = document.getElementById("username-input");

// 错误：HTMLElement 类型没有 value 属性（需转换为 HTMLInputElement）
console.log(input.value); // 提示“Property 'value' does not exist on type 'HTMLElement'”

// 正确：使用 as 转换为 HTMLInputElement，并判断非 null
const usernameInput = document.getElementById(
  "username-input",
) as HTMLInputElement | null;
if (usernameInput) {
  // 此处 usernameInput 被推断为 HTMLInputElement，可安全访问 value
  console.log(usernameInput.value);
}
```

#### 场景2：未知类型（`unknown`）处理

当变量类型为 `unknown` 时，TypeScript 禁止直接访问其属性或方法，需通过类型转换明确类型。

**示例**：

```typescript
// 模拟第三方库返回的未知类型数据
function getThirdPartyData(): unknown {
  return { name: "Wang Wu", age: 30 };
}

const data = getThirdPartyData();

// 错误：unknown 类型不能直接访问属性
console.log(data.name); // 提示“Object is of type 'unknown'”

// 正确：转换为自定义类型（需确保运行时数据结构匹配，否则会报错）
type UserData = { name: string; age: number };
const userData = data as UserData;
console.log(userData.name); // Wang Wu
console.log(userData.age); // 30
```

#### 注意事项

1. **避免“过度转换”**：若转换后的类型与运行时实际类型不匹配，会导致运行时错误（如将 `number` 转换为 `string` 后访问 `length` 属性）。
2. **优先使用类型守卫**：类型转换是“强制断言”，而类型守卫是“运行时检查”，若能通过类型守卫确定类型，优先使用类型守卫（更安全）。
3. **`null`/`undefined` 处理**：TypeScript 严格模式下，需先判断变量非 `null`/`undefined`，再进行类型转换（避免 `null as Type` 导致的运行时错误）。

## 6.6 - Index Properties（索引属性）

### 6.6.1 概念定义

索引属性（又称“索引签名”）用于定义**属性名不确定，但属性类型有规律**的对象类型。它允许通过“字符串索引”或“数字索引”访问对象属性，适用于动态生成属性名的场景（如配置对象、字典映射）。

### 6.6.2 两种索引类型

#### 1. 字符串索引（最常用）

语法：`{ [key: string]: ValueType }`，表示“所有属性名是字符串的属性，其类型均为 `ValueType`”。

**示例1：基础字典类型**

```typescript
// 定义“字符串键-数字值”的字典类型
type NumberDictionary = {
  [key: string]: number; // 任意字符串键，对应的值都是 number 类型
  length: number; // 允许显式定义已知属性（类型需与索引值类型一致）
};

// 合法使用
const scores: NumberDictionary = {
  math: 90,
  english: 85,
  length: 2, // 显式属性 length 类型为 number，符合要求
};

// 访问属性：通过字符串键或已知属性名
console.log(scores.math); // 90
console.log(scores["english"]); // 85
console.log(scores.length); // 2

// 错误：属性值类型不匹配（要求 number，实际为 string）
const invalidScores: NumberDictionary = {
  math: "90", // 提示“Type 'string' is not assignable to type 'number'”
};
```

**示例2：结合可选属性与只读属性**

```typescript
type UserConfig = {
  readonly [key: string]: string | number | boolean; // 索引值支持多种类型，且属性只读
  theme?: string; // 可选属性（类型需在索引值类型范围内）
};

// 合法使用
const config: UserConfig = {
  theme: "dark",
  fontSize: 16,
  autoSave: true,
};

// 错误：只读属性不能修改
config.fontSize = 14; // 提示“Cannot assign to 'fontSize' because it is a read-only property”
```

#### 2. 数字索引（适用于类数组对象）

语法：`{ [index: number]: ValueType }`，表示“所有属性名是数字的属性，其类型均为 `ValueType`”，常用于类数组对象（如 `NodeList`、自定义数组结构）。

**示例**：

```typescript
// 定义“数字索引-字符串值”的类数组类型
type StringArray = {
  [index: number]: string; // 数字索引对应的值为 string 类型
  length: number; // 类数组必须包含 length 属性
  push: (item: string) => void; // 可选：添加方法（方法类型不受索引约束）
};

// 模拟类数组对象
const fruits: StringArray = {
  0: "apple",
  1: "banana",
  2: "orange",
  length: 3,
  push: function (item) {
    this[this.length] = item;
    this.length++;
  },
};

// 访问与修改
console.log(fruits[0]); // apple
fruits.push("grape");
console.log(fruits.length); // 4
console.log(fruits[3]); // grape
```

### 6.6.3 注意事项

1. **索引类型与显式属性的兼容性**：显式定义的属性名若符合索引类型（如字符串索引中显式定义 `length: number`），其类型必须与索引值类型一致，否则会报错。
2. **字符串索引与数字索引的关系**：若同时定义字符串索引和数字索引，数字索引的值类型必须是字符串索引值类型的“子集”（因为 JavaScript 中数字键会自动转换为字符串键，如 `obj[1]` 等价于 `obj["1"]`）。

**错误示例**：

```typescript
// 错误：数字索引值类型（string）不是字符串索引值类型（number）的子集
type InvalidIndexType = {
  [key: string]: number;
  [index: number]: string; // 提示“Numeric index type 'string' is not assignable to string index type 'number'”
};
```

## 6.7 - Function Overloads（函数重载）

### 6.7.1 概念定义

函数重载允许为**同一个函数定义多个“参数类型+返回值类型”的组合**，使函数能处理不同类型的输入，并返回对应的输出类型，解决了“单一函数类型无法覆盖多种调用场景”的问题（如 `add` 函数既可以加数字，也可以拼接字符串）。

TypeScript 的函数重载本质是“类型层面的多态”，编译后会合并为一个函数（运行时仍为一个函数），仅在编译阶段进行类型检查。

### 6.7.2 语法格式

1. **重载签名（Overload Signatures）**：定义多个函数的“参数类型+返回值类型”组合，仅声明类型，不包含实现。
2. **实现签名（Implementation Signature）**：定义函数的实际实现逻辑，其参数类型和返回值类型必须“覆盖所有重载签名”（即能兼容所有重载场景）。

```typescript
// 1. 重载签名1：处理 number 类型参数
function func(param1: number, param2: number): number;

// 2. 重载签名2：处理 string 类型参数
function func(param1: string, param2: string): string;

// 3. 实现签名：覆盖所有重载场景（参数类型为 number | string，返回值类型为 number | string）
function func(
  param1: number | string,
  param2: number | string,
): number | string {
  // 实际实现逻辑
  if (typeof param1 === "number" && typeof param2 === "number") {
    return param1 + param2;
  } else if (typeof param1 === "string" && typeof param2 === "string") {
    return param1 + param2;
  }
  throw new Error("Invalid parameter types");
}
```

### 6.7.3 实例演示

#### 示例1：基础函数重载（加法与字符串拼接）

```typescript
// 重载签名1：两个数字相加，返回数字
function add(a: number, b: number): number;

// 重载签名2：两个字符串拼接，返回字符串
function add(a: string, b: string): string;

// 实现签名：兼容数字和字符串类型
function add(a: number | string, b: number | string): number | string {
  if (typeof a === "number" && typeof b === "number") {
    return a + b; // 数字加法
  } else if (typeof a === "string" && typeof b === "string") {
    return a + b; // 字符串拼接
  }
  throw new Error("Both parameters must be the same type (number or string)");
}

// 测试：符合重载签名1，返回 number
console.log(add(10, 20)); // 30

// 测试：符合重载签名2，返回 string
console.log(add("Hello, ", "TypeScript")); // Hello, TypeScript

// 错误：参数类型不匹配任何重载签名（一个 number，一个 string）
console.log(add(10, "20")); // 提示“No overload matches this call”
```

#### 示例2：可选参数与重载

```typescript
// 重载签名1：一个参数（数字），返回数字的平方
function calculate(x: number): number;

// 重载签名2：两个参数（数字），返回数字的和
function calculate(x: number, y: number): number;

// 实现签名：第二个参数可选，类型为 number | undefined
function calculate(x: number, y?: number): number {
  if (y === undefined) {
    return x ** 2; // 一个参数：计算平方
  } else {
    return x + y; // 两个参数：计算和
  }
}

// 测试：符合重载签名1
console.log(calculate(5)); // 25（5²）

// 测试：符合重载签名2
console.log(calculate(5, 3)); // 8（5+3）

// 错误：参数数量不匹配任何重载签名（三个参数）
console.log(calculate(5, 3, 2)); // 提示“No overload matches this call”
```

### 6.7.4 注意事项

1. **重载签名顺序**：重载签名应从“具体”到“宽泛”排序，因为 TypeScript 会按顺序匹配重载签名，若宽泛的签名在前，会优先匹配，导致具体签名无法生效。

**错误示例（顺序不当）**：

```typescript
// 错误：宽泛的签名在前，会优先匹配，导致具体签名失效
function func(a: number | string): void;
function func(a: number): void; // 此签名永远不会被匹配到

function func(a: number | string): void {
  console.log(a);
}

func(10); // 匹配第一个宽泛签名，而非第二个具体签名
```

2. **实现签名必须兼容所有重载签名**：实现签名的参数类型必须是所有重载签名参数类型的“联合类型”，返回值类型必须是所有重载签名返回值类型的“联合类型”，否则会报错。

## 6.8 - Optional Chaining（可选链）

### 6.8.1 概念定义

可选链通过 `?.` 运算符简化“嵌套对象属性访问”的逻辑，当访问的属性或方法不存在（即值为 `null` 或 `undefined`）时，不会抛出 `Cannot read property 'x' of undefined` 错误，而是直接返回 `undefined`，适用于处理“可能存在缺失的嵌套结构”（如 API 返回的复杂数据）。

### 6.8.2 语法与适用场景

#### 1. 访问嵌套对象属性（`obj?.prop?.nestedProp`）

```typescript
// 定义可能存在缺失的用户数据类型
type User = {
  name: string;
  address?: {
    city: string;
    street?: string;
  };
};

// 模拟 API 返回的用户数据（可能缺少 address 或 street）
const user1: User = {
  name: "Zhang San",
  address: {
    city: "Beijing",
    // 缺少 street 属性
  },
};

const user2: User = {
  name: "Li Si",
  // 缺少 address 属性
};

// 使用可选链访问属性
console.log(user1.address?.city); // Beijing（address 存在，city 存在）
console.log(user1.address?.street); // undefined（address 存在，street 缺失）
console.log(user2.address?.city); // undefined（address 缺失）

// 对比：不使用可选链（需手动判断，代码冗长）
console.log(user2.address && user2.address.city); // undefined（效果相同，但代码更长）
```

#### 2. 访问数组元素（`arr?.[index]`）

当数组可能为 `null` 或 `undefined` 时，使用 `arr?.[index]` 避免访问不存在的数组元素。

**示例**：

```typescript
// 定义可能为 null 的数组
const fruits: string[] | null =
  Math.random() > 0.5 ? ["apple", "banana"] : null;

// 使用可选链访问数组元素
console.log(fruits?.[0]); // 若 fruits 存在，返回第一个元素；否则返回 undefined
console.log(fruits?.length); // 若 fruits 存在，返回长度；否则返回 undefined

// 错误：不使用可选链（若 fruits 为 null，会抛出错误）
if (fruits) {
  console.log(fruits[0]); // 需手动判断，否则报错
}
```

#### 3. 调用可能不存在的方法（`func?.()`）

当函数可能为 `null` 或 `undefined` 时，使用 `func?.()` 避免调用不存在的方法。

**示例**：

```typescript
// 定义可能包含方法的对象
type Logger = {
  log?: (message: string) => void;
};

// 模拟两个 Logger 实例（一个有 log 方法，一个没有）
const validLogger: Logger = {
  log: (message) => console.log(`Log: ${message}`),
};

const invalidLogger: Logger = {}; // 缺少 log 方法

// 使用可选链调用方法
validLogger.log?.("Hello"); // Log: Hello（log 方法存在，正常调用）
invalidLogger.log?.("Test"); // undefined（log 方法缺失，不报错）

// 错误：不使用可选链（若 log 方法缺失，会抛出错误）
if (invalidLogger.log) {
  invalidLogger.log("Test"); // 需手动判断，否则报错
}
```

### 6.8.3 注意事项

1. **可选链不替代空值处理**：可选链仅返回 `undefined`，若需要默认值，需结合“空值合并运算符（`??`）”使用（见 6.9 节）。
2. **避免过度使用**：仅在属性/方法“确实可能缺失”时使用可选链，若属性是“必须存在”的，应通过类型定义强制要求，而非依赖可选链（避免隐藏逻辑错误）。

## 6.9 - Nullish Coalescing（空值合并）

### 6.9.1 概念定义

空值合并通过 `??` 运算符为“可能为 `null` 或 `undefined` 的值”设置默认值，仅当左侧值为 `null` 或 `undefined` 时，才返回右侧的默认值；若左侧值为 `0`、`""`、`false` 等“假值”，仍返回左侧值，解决了“逻辑或（`||`）运算符误判假值”的问题。

### 6.9.2 与逻辑或（`||`）的区别

| 运算符 | 触发默认值的条件               | 适用场景                             |
| ------ | ------------------------------ | ------------------------------------ | ------------------------------------------------------- | ------------------------ |
| `      |                                | `                                    | 左侧为“假值”（`0`、`""`、`false`、`null`、`undefined`） | 希望所有假值都使用默认值 |
| `??`   | 左侧仅为 `null` 或 `undefined` | 仅希望 `null`/`undefined` 使用默认值 |

**示例：对比两者差异**

```typescript
// 场景1：处理数字（0 是合法值，不应被替换为默认值）
const count1 = 0;
console.log(count1 || 10); // 10（错误：0 被视为假值，替换为默认值）
console.log(count1 ?? 10); // 0（正确：0 不是 null/undefined，保留原值）

// 场景2：处理空字符串（"" 是合法值，不应被替换）
const username1 = "";
console.log(username1 || "Guest"); // Guest（错误："" 被视为假值）
console.log(username1 ?? "Guest"); // ""（正确：保留空字符串）

// 场景3：处理 null/undefined（两者效果一致）
const age1 = null;
console.log(age1 || 18); // 18（正确）
console.log(age1 ?? 18); // 18（正确）

const age2 = undefined;
console.log(age2 || 18); // 18（正确）
console.log(age2 ?? 18); // 18（正确）
```

### 6.9.3 结合可选链使用（常见场景）

在处理嵌套对象或 API 数据时，常将“可选链（`?.`）”与“空值合并（`??`）”结合，既避免访问不存在的属性报错，又能为缺失的值设置默认值。

**示例**：

```typescript
// 定义 API 返回的用户数据类型（可能缺失属性）
type User = {
  name: string;
  age?: number;
  address?: {
    city?: string;
  };
};

// 模拟 API 返回的用户数据（缺失 age 和 address.city）
const user: User = {
  name: "Wang Wu",
};

// 结合可选链和空值合并：为缺失的属性设置默认值
const userAge = user.age ?? 18; // age 缺失（undefined），使用默认值 18
const userCity = user.address?.city ?? "Unknown City"; // address 缺失，使用默认值

console.log(userAge); // 18
console.log(userCity); // Unknown City
```

### 6.9.4 注意事项

1. **优先级**：`??` 运算符的优先级低于算术运算符、比较运算符和逻辑与（`&&`），但高于赋值运算符，若表达式中包含其他运算符，建议使用括号明确优先级。

**示例**：

```typescript
const a = 10;
const b = null;

// 错误：优先级问题，等价于 (a + b) ?? 5（b 为 null，a + b 为 NaN，返回 NaN）
console.log(a + b ?? 5);

// 正确：使用括号，等价于 a + (b ?? 5)（b 为 null，使用默认值 5，结果为 15）
console.log(a + (b ?? 5)); // 15
```

2. **不能与 `&&`/`||` 混用（无括号时）**：TypeScript 禁止在无括号的情况下将 `??` 与 `&&` 或 `||` 混用，避免歧义，需使用括号明确逻辑。

**错误示例**：

```typescript
// 错误：禁止无括号混用 ?? 和 ||
const result = (a || b) ?? c; // 提示“Cannot mix '??' and '||' in a single expression without parentheses”

// 正确：使用括号明确逻辑
const result1 = (a || b) ?? c; // 先判断 a || b，再处理 null/undefined
const result2 = a || (b ?? c); // 先处理 b ?? c，再判断 a || 结果
```

## 6.10 - Wrap Up（本章总结）

本章围绕 TypeScript 高级类型概念展开，目标是解决“复杂场景下的类型安全”问题，各知识点的作用与适用场景如下：

| 知识点           | 核心价值                                       | 适用场景                                         |
| ---------------- | ---------------------------------------------- | ------------------------------------------------ |
| 交叉类型（`&`）  | 合并多个类型的属性/方法                        | 需要对象同时具备多个类型特征（如用户+权限）      |
| 类型守卫         | 运行时缩小类型范围，避免类型错误               | 区分联合类型中的具体类型（如 `Date` vs `Array`） |
| 歧视联合         | 通过歧视属性简化联合类型判断                   | 处理结构相似但类型不同的对象（如不同支付方式）   |
| 类型转换（`as`） | 告诉编译器值的实际类型，解决推断失效问题       | DOM 元素获取、第三方库类型适配                   |
| 索引属性         | 定义属性名不确定但类型有规律的对象             | 字典映射、动态配置对象                           |
| 函数重载         | 为同一函数定义多种参数/返回值类型组合          | 处理多种输入类型（如数字加法 vs 字符串拼接）     |
| 可选链（`?.`）   | 简化嵌套属性访问，避免 `null`/`undefined` 报错 | 处理 API 复杂数据、可能缺失的嵌套结构            |
| 空值合并（`??`） | 为 `null`/`undefined` 设置默认值，不误判假值   | 为缺失属性设置默认值（如 `0`、`""` 需保留）      |

---

## TypeScript Decorator 装饰器

使用 Decorator 需要在 tsconfig.json 中进行配置：

```json
 "experimentalDecorators": true
```

---

## TypeScript 结合 DOM

DOM 元素对应的 TS 的类型：

```ts
interface HTMLElementTagNameMap {
  a: HTMLAnchorElement;
  abbr: HTMLElement;
  address: HTMLElement;
  applet: HTMLAppletElement;
  area: HTMLAreaElement;
  article: HTMLElement;
  aside: HTMLElement;
  audio: HTMLAudioElement;
  b: HTMLElement;
  base: HTMLBaseElement;
  bdi: HTMLElement;
  bdo: HTMLElement;
  blockquote: HTMLQuoteElement;
  body: HTMLBodyElement;
  br: HTMLBRElement;
  button: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  caption: HTMLTableCaptionElement;
  cite: HTMLElement;
  code: HTMLElement;
  col: HTMLTableColElement;
  colgroup: HTMLTableColElement;
  data: HTMLDataElement;
  datalist: HTMLDataListElement;
  dd: HTMLElement;
  del: HTMLModElement;
  details: HTMLDetailsElement;
  dfn: HTMLElement;
  dialog: HTMLDialogElement;
  dir: HTMLDirectoryElement;
  div: HTMLDivElement;
  dl: HTMLDListElement;
  dt: HTMLElement;
  em: HTMLElement;
  embed: HTMLEmbedElement;
  fieldset: HTMLFieldSetElement;
  figcaption: HTMLElement;
  figure: HTMLElement;
  font: HTMLFontElement;
  footer: HTMLElement;
  form: HTMLFormElement;
  frame: HTMLFrameElement;
  frameset: HTMLFrameSetElement;
  h1: HTMLHeadingElement;
  h2: HTMLHeadingElement;
  h3: HTMLHeadingElement;
  h4: HTMLHeadingElement;
  h5: HTMLHeadingElement;
  h6: HTMLHeadingElement;
  head: HTMLHeadElement;
  header: HTMLElement;
  hgroup: HTMLElement;
  hr: HTMLHRElement;
  html: HTMLHtmlElement;
  i: HTMLElement;
  iframe: HTMLIFrameElement;
  img: HTMLImageElement;
  input: HTMLInputElement;
  ins: HTMLModElement;
  kbd: HTMLElement;
  label: HTMLLabelElement;
  legend: HTMLLegendElement;
  li: HTMLLIElement;
  link: HTMLLinkElement;
  main: HTMLElement;
  map: HTMLMapElement;
  mark: HTMLElement;
  marquee: HTMLMarqueeElement;
  menu: HTMLMenuElement;
  meta: HTMLMetaElement;
  meter: HTMLMeterElement;
  nav: HTMLElement;
  noscript: HTMLElement;
  object: HTMLObjectElement;
  ol: HTMLOListElement;
  optgroup: HTMLOptGroupElement;
  option: HTMLOptionElement;
  output: HTMLOutputElement;
  p: HTMLParagraphElement;
  param: HTMLParamElement;
  picture: HTMLPictureElement;
  pre: HTMLPreElement;
  progress: HTMLProgressElement;
  q: HTMLQuoteElement;
  rp: HTMLElement;
  rt: HTMLElement;
  ruby: HTMLElement;
  s: HTMLElement;
  samp: HTMLElement;
  script: HTMLScriptElement;
  section: HTMLElement;
  select: HTMLSelectElement;
  slot: HTMLSlotElement;
  small: HTMLElement;
  source: HTMLSourceElement;
  span: HTMLSpanElement;
  strong: HTMLElement;
  style: HTMLStyleElement;
  sub: HTMLElement;
  summary: HTMLElement;
  sup: HTMLElement;
  table: HTMLTableElement;
  tbody: HTMLTableSectionElement;
  td: HTMLTableDataCellElement;
  template: HTMLTemplateElement;
  textarea: HTMLTextAreaElement;
  tfoot: HTMLTableSectionElement;
  th: HTMLTableHeaderCellElement;
  thead: HTMLTableSectionElement;
  time: HTMLTimeElement;
  title: HTMLTitleElement;
  tr: HTMLTableRowElement;
  track: HTMLTrackElement;
  u: HTMLElement;
  ul: HTMLUListElement;
  var: HTMLElement;
  video: HTMLVideoElement;
  wbr: HTMLElement;
}
```

当我们使用`getElementById`等等其他方法获取元素时，返回结果可能为`null`，但是我们能确保在 HTML 中我们一定能拿到这个元素，可以使用 ! 声明一定可以获取到对应元素。

```ts
const appDom = document.getElementById("app")! as HTMLDivElement;
```

---

## TypeScript 多文件 Multiple Files

### namespace

```ts
namespace 空间名 {
  // 声明interface
}
/// <refrence path='xxx.ts'/>
```

### ES module

---

## TypeScript 结合 Webpack

https://webpack.js.org/

![webpack-homepage.png](notebook-image/webpack-homepage.png)

安装指令：

```shell
npm install --save-dev webpack webpack-cli webpack-dev-server
npm install --save-dev typescript ts-loader
```

package.json

```json
"devDependencies": {
    "ts-loader": "^9.5.2",
    "typescript": "^5.7.3",
    "webpack": "^5.98.0",
    "webpack-cli": "^6.0.1",
    "webpack-dev-server": "^5.2.0"
}
npm install --save-dev clean-webpack-plugin
```

---

## TypeScript 结合 三方库

### Lodash

解决 TS 不识别 JS 原生三方库抛出异常问题

```shell
npm install --save-dev @type/lodash
```

使用 declare 关键字声明变量存在

### class-transformer

### class-validator

### TypeScript 结合 Axios

---

## TypeScript 结合 Vue

- 官网文档：https://cn.vuejs.org/guide/typescript/overview

---

## TypeScript 结合 Node

```shell

```

---
title: "JavaScript 学习笔记（8）：面向对象编程与原型机制详解"
date: 2025-10-08 00:55:15
tags:
  - "前端开发"
  - "面向对象编程"
  - "JavaScript"
  - "Java"
  - "继承"
categories:
  - "前端开发"
  - "JavaScript"
---


**所有的对象里面都有 `__proto__ `对象原型 指向原型对象**

**所有的原型对象里面有 constructor， 指向 创造改原型对象的构造函数**


## 一、编程思想：从面向过程到面向对象

### （一）面向过程

- 思路：盯着"步骤"，把问题拆成一串连续的操作，每一步用一个函数实现，最后按顺序调用完成任务。

- 案例：做蛋炒饭

  1. 函数 1：`准备食材(米饭、鸡蛋、葱花)`
  2. 函数 2：`热油(锅、油)`
  3. 函数 3：`炒鸡蛋(鸡蛋、油)`
  4. 函数 4：`混合翻炒(米饭、鸡蛋、盐)`
  5. 执行顺序：`准备食材()` → `热油()` → `炒鸡蛋()` → `混合翻炒()`

- 适合：简单的任务（计算器、单步骤的小工具），逻辑直接，但不好扩展。

### （二）面向对象

- 思路：盯着"对象"，把问题拆成一个个有特定功能的对象，靠对象之间的协作完成任务。每个对象都有"数据"（属性）和"操作"（方法）。

- 三大特性
  - 封装：对象内部的数据和方法包起来，只暴露必要的接口（比如"手机"对象把"芯片""电池"这些内部组件封装起来，只暴露"打电话""发消息"这些方法）。
  - 继承：子类能复用父类的属性和方法（比如"智能手机"继承了"手机"的"通话"功能，又加了"上网"功能）。
  - 多态：同一个方法在不同对象上有不同的实现（比如"支付"方法，支付宝对象实现的是"扫码支付"，微信对象实现的是"转账支付"）。

- 案例：做蛋炒饭

  - 食材对象（属性：米饭、鸡蛋、调料；方法：`提供原料()`）
  - 厨师对象（属性：姓名；方法：`热油()`、`翻炒()`、`调味()`）
  - 协作：厨师对象调食材对象的 `提供原料()`，再用自己的 `翻炒()` 等方法做完。

- 好处：代码复用性高、好维护，适合大项目（电商系统、管理平台）。

## 二、构造函数：面向对象的基础封装方式

### 概念

构造函数是创建对象的"模板"，用 `this` 绑定属性和方法，实例化后生成一个个独立的对象，把数据和行为封装在一起。

### 用法示例

```javascript
// 定义构造函数（首字母大写，区分普通函数）
function Person() {
  // 实例属性（每个对象独立拥有）
  this.name = '佚名'; 
  // 实例方法（每个对象独立拥有）
  this.setName = function(name) {
    this.name = name; // this指向当前实例对象
  };
  this.getName = function() {
    console.log(this.name);
  };
}

// 实例化对象（用new调用构造函数）
const p1 = new Person();
p1.setName('小明'); 
p1.getName(); // 输出：小明（p1的name被修改）

const p2 = new Person();
console.log(p2.name); // 输出：佚名（p1和p2完全独立）
```

### 问题分析

- 浪费内存：每个实例对象都会复制一份构造函数里的方法（比如 `setName`、`getName`）。建 100 个实例，就有 100 份一样的方法副本。
- 解决：用原型对象共享方法，不重复创建。

## 三、原型对象（prototype）：共享方法的核心

### 概念

- 每个构造函数都有一个 `prototype` 属性，指向原型对象。
- 原型对象上的方法 / 属性所有实例都能共用，实例化时不会重复创建，省内存。
- 构造函数、原型对象、实例的关系：`实例.__proto__ === 构造函数.prototype`（实例通过 `__proto__` 关联到原型对象）。

### 用法示例

#### 1. 原型对象挂载共享方法

```javascript
function Person() {
  this.name = '佚名'; // 实例属性（独立）
}

// 原型对象挂载共享方法（所有实例共用）
Person.prototype.setName = function(name) {
  this.name = name;
};
Person.prototype.getName = function() {
  console.log(this.name);
};

// 实例化
const p1 = new Person();
const p2 = new Person();

p1.setName('小红');
p1.getName(); // 输出：小红
p2.getName(); // 输出：佚名（互不干扰）

// 验证方法共享（内存中仅1份）
console.log(p1.setName === p2.setName); // 输出：true
```

#### 2. 方法查找规则（就近原则）

实例访问方法时，先找自己身上的，没有再去原型对象上找：

```javascript
function Person() {
  // 实例方法（优先级高于原型方法）
  this.sayHi = function() {
    console.log('嗨！');
  };
}

// 原型方法
Person.prototype.sayHi = function() {
  console.log('Hi~');
};

const p = new Person();
p.sayHi(); // 输出：嗨！（访问实例自身方法）
```

## 四、constructor 属性：原型与构造函数的 “身份证”

### 核心作用

每个原型对象默认都有一个 `constructor` 属性，指向它对应的构造函数，用来标明"这个原型对象是谁创建的"。

### 常见问题与解决

用对象字面量重写原型时，会把原来的 `constructor` 覆盖掉，要手动改回来：

```javascript
function Person() {}

// 用对象字面量重写原型（覆盖原constructor）
Person.prototype = {
  // 手动修正constructor指向原构造函数
  constructor: Person, 
  walk: function() { console.log('走路'); },
  eat: function() { console.log('吃饭'); }
};

const p = new Person();
console.log(p.constructor === Person); // 输出：true（修正后正确）
```

## 五、对象原型（**proto**）：原型链的连接纽带

### 概念

- 每个实例对象都有 `__proto__` 属性（非标准属性，浏览器实现的），指向它的构造函数的 `prototype` 原型对象。
- 作用：给对象查找原型上的属性 / 方法提供一条"路径"。

### 注意事项

- `__proto__` 和 `[[prototype]]` 意思一样（`[[prototype]]` 是 ES 规范里的内部属性，`__proto__` 是浏览器暴露出来的访问方式）。
- `__proto__` 的 `constructor` 属性指向实例的构造函数（比如 `p.__proto__.constructor === Person`）。

## 六、原型继承：复用代码的高效方式

### 逻辑

把子类的原型设成父类的实例，子类就继承了父类的属性和方法，代码就复用了。

### 用法示例

```javascript
// 父类：人（共有的属性和方法）
function Person() {
  this.eyes = 2; // 所有人都有2只眼睛
  this.head = 1; // 所有人都有1个头
}
Person.prototype.walk = function() {
  console.log('用腿走路');
};

// 子类：女人（继承父类，添加特有功能）
function Woman() {}
// 关键：子类原型 = 父类实例（继承父类属性和方法）
Woman.prototype = new Person();
// 修正constructor指向子类自身
Woman.prototype.constructor = Woman;
// 子类特有方法
Woman.prototype.bearBaby = function() {
  console.log('生孩子');
};

// 测试继承
const woman = new Woman();
console.log(woman.eyes); // 输出：2（继承父类属性）
woman.walk(); // 输出：用腿走路（继承父类方法）
woman.bearBaby(); // 输出：生孩子（子类特有方法）
```

## 七、原型链：属性查找的链式机制

### 概念

- 原型对象本身也是对象，它的 `__proto__` 会指向更上一层的原型对象，这样就形成了一条链（原型链）。
- 终点：所有对象的原型链最后都指向 `Object.prototype`，而 `Object.prototype.__proto__` 是 `null`（原型链到头了）。

### 属性查找规则

对象访问属性 / 方法时，按这个顺序找：
自身属性 → 实例.proto（构造函数.prototype） → 原型.proto → ... → Object.prototype → null（都找不到就返回 `undefined`）。

### 示例验证

```javascript
function Person() {
  this.name = '小明'; // 自身属性
}
Person.prototype.age = 18; // 原型属性

const p = new Person();

// 查找顺序验证
console.log(p.name); // 自身有 → 小明
console.log(p.age); // 自身无，查原型 → 18
console.log(p.toString()); // 原型无，查Object.prototype → [object Object]
console.log(p.gender); // 整条链无 → undefined
```

### instanceof 运算符

检测构造函数的 `prototype` 在不在实例的原型链上（判断对象类型主要就靠它）：

```javascript
console.log(p instanceof Person); // true（Person.prototype在p的原型链上）
console.log(p instanceof Object); // true（Object.prototype在p的原型链上）
console.log(p instanceof Array); // false（Array.prototype不在p的原型链上）
```

## 总结

- 面向对象编程用"对象"封装数据和行为，靠封装、继承、多态提高代码的复用性和可维护性。
- 构造函数是创建对象的模板，但方法会被重复创建，要用原型对象（`prototype`）共享方法来解决。
- 原型链是查找属性的底层机制，通过 `__proto__` 把各级原型连起来，最后指向 `Object.prototype`。
- 原型继承是 JavaScript 实现继承的主要方式：把子类的原型改成父类的实例来复用代码，同时要把 `constructor` 的指向改回来。

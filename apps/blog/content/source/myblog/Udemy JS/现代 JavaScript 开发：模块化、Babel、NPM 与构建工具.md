---
title: "现代 JavaScript 开发：模块化、Babel、NPM 与构建工具"
date: 2025-12-29 06:12:08
tags:
  - "ES Modules"
  - "Babel"
  - "NPM"
  - "Parcel"
categories:
  - "前端开发"
  - "前端工程化"
---


## 268 Section Intro（章节介绍）

### 目标

本章节聚焦“现代JavaScript开发实践”，衔接前文的异步编程（Promise、Async/Await）与ES6模块，后续将系统讲解**模块规范**、**工程化工具**（如NPM、Parcel）、**代码优化**及**开发最佳实践**，最终帮助学习者从“基础语法掌握”过渡到“项目开发能力”。

## 270 An Overview of Modern JavaScript Development（现代JavaScript开发概述）

### 270.1 现代JS开发的核心痛点

传统JS开发（如直接引入多个`<script>`标签）存在以下问题：

1. **作用域污染**：全局作用域下变量/函数冲突（如`var`声明的变量全局共享）；
2. **依赖管理混乱**：脚本加载顺序依赖`<script>`标签顺序，大型项目中易出现“依赖缺失”或“重复引入”；
3. **代码复用性低**：无法高效拆分代码为可复用单元；
4. **兼容性问题**：新语法（如ES6+）在旧浏览器中无法运行；
5. **缺乏工程化支持**：无自动化构建、打包、压缩等流程，开发效率低。

### 270.2 现代JS开发的解决方案

| 痛点                | 解决方案                                    | 核心工具/规范                 |
| ------------------- | ------------------------------------------- | ----------------------------- |
| 作用域污染/依赖管理 | 模块化开发                                  | ES6 Modules、CommonJS         |
| 兼容性问题          | 语法转换（Transpilation）+ 垫片（Polyfill） | Babel、core-js                |
| 工程化支持          | 包管理 + 构建工具                           | NPM/Yarn、Parcel/Webpack/Vite |
| 代码质量            | 静态类型检查 + 代码规范                     | TypeScript、ESLint            |

### 270.3 现代JS开发流程示例

1. 初始化项目：`npm init` 创建`package.json`（项目配置文件）；
2. 安装依赖：`npm install react react-dom`（安装第三方库）；
3. 编写代码：使用ES6+语法、ES Modules拆分代码；
4. 构建打包：通过Parcel自动转换语法、合并代码、压缩体积；
5. 部署上线：将打包后的`dist`目录部署到服务器（如Netlify）。

## 271 An Overview of Modules in JavaScript（JavaScript模块概述）

### 271.1 模块的概念

模块是**独立的代码单元**，具有以下特性：

- **封装性**：模块内的变量/函数默认私有，仅通过`export`暴露外部可访问的接口；
- **依赖管理**：通过`import`明确声明依赖的其他模块，解决加载顺序问题；
- **可复用性**：一个模块可被多个其他模块导入，避免代码重复。

### 271.2 常见模块规范对比

| 规范        | 适用场景                | 导出语法                                  | 导入语法                                              | 加载时机                   |
| ----------- | ----------------------- | ----------------------------------------- | ----------------------------------------------------- | -------------------------- |
| ES6 Modules | 浏览器环境、现代Node.js | `export const a = 1`; `export default fn` | `import { a } from './mod'`; `import fn from './mod'` | 静态加载（编译时确定依赖） |
| CommonJS    | Node.js（传统）         | `module.exports = { a: 1 }`               | `const { a } = require('./mod')`                      | 动态加载（运行时确定依赖） |
| AMD         | 浏览器环境（旧）        | `define(['dep'], (dep) => ({ a: 1 }))`    | `require(['./mod'], (mod) => {})`                     | 异步加载                   |

### 271.3 模块与脚本（Script）的区别

| 特性              | 模块（Module）                     | 普通脚本（Script）                          |
| ----------------- | ---------------------------------- | ------------------------------------------- |
| 作用域            | 模块级作用域（私有）               | 全局作用域                                  |
| `this`指向        | `undefined`                        | 浏览器中指向`window`，Node.js中指向`global` |
| 导入/导出         | 支持`import`/`export`              | 不支持                                      |
| 延迟执行（Defer） | 默认延迟执行（同`<script defer>`） | 默认立即执行（阻塞HTML解析）                |

### 271.4 浏览器中启用ES6 Modules

需在`<script>`标签中添加`type="module"`属性，示例：

```html
<!-- index.html -->
<script type="module" src="./main.js"></script>
```

```javascript
// main.js（模块文件）
import { sum } from "./math.js";
console.log(sum(1, 2)); // 输出3
```

```javascript
// math.js（被导入的模块）
export const sum = (a, b) => a + b; // 命名导出
```

## 272 Exporting and Importing in ES6 Modules（ES6模块的导出与导入）

### 272.1 命名导出（Named Exports）

用于导出**多个独立的变量/函数/类**，导出名称与导入名称必须一致（可通过`as`重命名）。

#### 语法1：直接导出（声明时导出）

```javascript
// mod.js
export const PI = 3.14159; // 导出常量
export function calculateArea(r) {
  // 导出函数
  return PI * r ** 2;
}
export class Circle {
  // 导出类
  constructor(r) {
    this.radius = r;
  }
  get area() {
    return calculateArea(this.radius);
  }
}
```

#### 语法2：集中导出（声明后统一导出）

```javascript
// mod.js
const PI = 3.14159;
function calculateArea(r) {
  return PI * r ** 2;
}
class Circle {
  constructor(r) {
    this.radius = r;
  }
  get area() {
    return calculateArea(this.radius);
  }
}

// 集中导出（推荐：清晰展示导出接口）
export { PI, calculateArea, Circle };
```

#### 语法3：导出时重命名（解决名称冲突）

```javascript
// mod.js
const PI = 3.14159;
export { PI as MathPI }; // 导出时重命名为MathPI
```

#### 命名导入示例

```javascript
// main.js
// 1. 导入指定名称的成员
import { PI, calculateArea, Circle } from "./mod.js";
console.log(calculateArea(2)); // 输出12.56636
const c = new Circle(3);
console.log(c.area); // 输出28.27431

// 2. 导入时重命名（解决名称冲突）
import { MathPI as Pi } from "./mod.js";
console.log(Pi); // 输出3.14159

// 3. 导入所有成员（命名空间导入）
import * as MathModule from "./mod.js";
console.log(MathModule.PI); // 输出3.14159
console.log(MathModule.calculateArea(2)); // 输出12.56636
```

### 272.2 默认导出（Default Exports）

用于导出**模块的“主内容”**（每个模块仅允许1个默认导出），导入时可自定义名称（无需加花括号）。

#### 语法1：直接默认导出

```javascript
// utils.js
export default function formatDate(date) {
  // 默认导出函数
  return date.toLocaleDateString("zh-CN");
}
```

#### 语法2：先声明后默认导出

```javascript
// utils.js
function formatDate(date) {
  return date.toLocaleDateString("zh-CN");
}
export default formatDate; // 单独默认导出
```

#### 语法3：默认导出匿名内容

```javascript
// utils.js
export default (a, b) => a + b; // 默认导出匿名箭头函数
```

#### 默认导入示例

```javascript
// main.js
// 1. 自定义导入名称（无需花括号）
import format from "./utils.js";
console.log(format(new Date())); // 输出"2024/5/20"（示例日期）

// 2. 与命名导入结合（需用花括号包裹命名成员）
import formatDate, { PI } from "./utils.js"; // 假设utils.js同时有默认导出和命名导出
console.log(formatDate(new Date()), PI); // 输出"2024/5/20" 3.14159
```

### 272.3 导出与导入的“生命联系”（Live Binding）

ES6 Modules的`import`与`export`并非“值的拷贝”，而是**指向同一内存地址的引用**（生命联系）。当导出模块中的值修改时，导入模块中的值会同步更新。

#### 示例：生命联系的体现

```javascript
// mod.js（导出模块）
export let count = 0;
export function increment() {
  count++;
}
```

```javascript
// main.js（导入模块）
import { count, increment } from "./mod.js";

console.log(count); // 初始值：0
increment(); // 调用导出模块的函数修改count
console.log(count); // 同步更新：1（非拷贝，而是引用）
```

### 272.4 常见错误与注意事项

1. **导入路径错误**：相对路径需以`./`或`../`开头（如`import from 'mod.js'`会被当作第三方库，而非本地模块）；
2. **默认导出与命名导出混淆**：默认导入无需加花括号（如`import { fn } from './mod'`会报错，若`fn`是默认导出）；
3. **重复导出**：同一模块中不可对同一名称重复命名导出（如`export const a=1; export const a=2`会报错）；
4. **静态导入限制**：`import`需在模块顶层（不可在`if`语句或函数内动态导入，动态导入需用`import()`函数）。

## 273 Top-Level await (ES2022)（顶层await，ES2022特性）

### 273.1 顶层await的核心作用

`await`关键字原本仅能在`async`函数内部使用，**顶层await**允许在模块顶层直接使用`await`，用于：

- 模块初始化时等待异步操作完成（如加载数据、初始化第三方库）；
- 避免在`async`函数中包裹顶层异步逻辑，简化代码。

### 273.2 顶层await的使用场景

#### 场景1：等待API数据加载

```javascript
// data.js（模块顶层等待API请求）
const res = await fetch("https://api.example.com/data");
const data = await res.json();
export default data; // 数据加载完成后才导出
```

```javascript
// main.js
import data from "./data.js"; // 等待data.js的异步操作完成后才导入
console.log(data); // 直接使用加载后的完整数据
```

#### 场景2：等待第三方库初始化

```javascript
// db.js（等待数据库连接初始化）
import mongoose from "mongoose";
await mongoose.connect("mongodb://localhost:27017/myDB"); // 顶层await等待连接
export const User = mongoose.model("User", { name: String }); // 连接成功后导出模型
```

### 273.3 顶层await的注意事项

1. **仅支持模块环境**：顶层await仅能在`type="module"`的脚本或ES Modules文件中使用，普通脚本（无`type="module"`）会报错；
2. **模块加载阻塞**：若A模块使用顶层await，导入A模块的B模块会等待A的异步操作完成后才继续执行，需避免在核心模块中使用（防止整体加载变慢）；
3. **错误处理**：需用`try/catch`捕获顶层await的错误，否则模块会抛出未捕获的Promise拒绝：
   ```javascript
   // data.js（错误处理示例）
   let data;
   try {
     const res = await fetch("https://api.example.com/data");
     data = await res.json();
   } catch (err) {
     console.error("数据加载失败：", err);
     data = { fallback: "默认数据" }; // 提供降级数据
   }
   export default data;
   ```

### 273.4 顶层await vs 异步函数包裹

| 方式         | 代码示例                                             | 优缺点                                                  |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------- |
| 顶层await    | `const res = await fetch(...)`                       | 代码简洁，无需额外函数包裹；但阻塞模块加载              |
| 异步函数包裹 | `async function init() { await fetch(...) } init();` | 不阻塞模块加载；但需手动调用函数，数据导出需处理Promise |

## 274 The Module Pattern（模块模式）

### 274.1 模块模式的核心思想

在ES6 Modules出现前，开发者通过**立即执行函数表达式（IIFE）** 实现模块化，核心是利用**函数作用域**封装私有变量，仅暴露指定的公共接口。

### 274.2 模块模式的实现步骤

1. 定义IIFE（创建私有作用域）；
2. 在IIFE内部声明私有变量/函数（仅内部可访问）；
3. 返回包含公共接口的对象（外部通过该对象访问模块功能）；
4. 将返回的对象赋值给全局变量（或挂载到`window`），供外部使用。

### 274.3 模块模式示例：计算器模块

```javascript
// 计算器模块（使用模块模式）
const Calculator = (function () {
  // 1. 私有变量（仅模块内部可访问）
  let currentValue = 0;

  // 2. 私有函数（仅模块内部可调用）
  function validateNumber(n) {
    return typeof n === "number" && !isNaN(n);
  }

  // 3. 公共接口（暴露给外部的方法）
  return {
    add: function (n) {
      if (validateNumber(n)) currentValue += n;
      return currentValue;
    },
    subtract: function (n) {
      if (validateNumber(n)) currentValue -= n;
      return currentValue;
    },
    getValue: function () {
      return currentValue;
    },
    reset: function () {
      currentValue = 0;
      return currentValue;
    },
  };
})();

// 外部使用模块
console.log(Calculator.add(5)); // 5（调用公共方法，修改私有变量currentValue）
console.log(Calculator.subtract(2)); // 3
console.log(Calculator.getValue()); // 3
console.log(Calculator.currentValue); // undefined（私有变量，外部无法访问）
Calculator.validateNumber(3); // 报错（私有函数，外部无法调用）
```

### 274.4 模块模式的优缺点

| 优点                       | 缺点                                   |
| -------------------------- | -------------------------------------- |
| 解决全局作用域污染         | 无原生依赖管理，需手动处理模块加载顺序 |
| 实现私有变量/函数          | 无法动态导入模块                       |
| 兼容性好（支持所有浏览器） | 模块间无法共享私有成员，复用性有限     |

### 274.5 模块模式与ES6 Modules的对比

- **模块模式**：基于函数作用域，动态执行，无原生`import/export`，适合旧环境；
- **ES6 Modules**：基于模块作用域，静态加载，原生支持`import/export`，依赖管理清晰，是现代开发的首选。

## 275 CommonJS Modules（CommonJS模块）

### 275.1 CommonJS的核心应用场景

CommonJS是**Node.js的传统模块规范**，主要用于服务器端开发，也可通过Browserify等工具在浏览器中使用。其设计思路是“同步加载模块”（适合服务器端，文件加载速度快，无需异步）。

### 275.2 CommonJS的导出与导入语法

#### 1. 导出语法（`module.exports`）

- **导出对象**：直接赋值给`module.exports`（推荐，可导出任意类型）；
- **导出属性**：通过`exports`对象添加属性（`exports`是`module.exports`的引用，不可直接赋值为新对象）。

```javascript
// mod.js（CommonJS导出示例）
// 方式1：导出对象（推荐）
const PI = 3.14;
function area(r) {
  return PI * r ** 2;
}
module.exports = {
  PI: PI,
  calculateArea: area,
};

// 方式2：导出属性（exports是module.exports的引用）
exports.add = (a, b) => a + b;
exports.subtract = (a, b) => a - b;

// 注意：以下写法错误（会断开exports与module.exports的引用）
// exports = { add: (a,b) => a+b }; // 外部导入时会获取空对象
```

#### 2. 导入语法（`require()`）

通过`require('模块路径')`导入模块，返回模块导出的对象，支持解构赋值。

```javascript
// main.js（CommonJS导入示例）
// 方式1：完整导入
const mod = require("./mod.js");
console.log(mod.PI); // 3.14
console.log(mod.calculateArea(2)); // 12.56

// 方式2：解构导入
const { add, subtract } = require("./mod.js");
console.log(add(1, 2)); // 3
console.log(subtract(5, 3)); // 2

// 方式3：导入第三方库（无需路径，直接写库名）
const fs = require("fs"); // 导入Node.js内置模块fs
fs.readFile("test.txt", "utf8", (err, data) => {
  console.log(data);
});
```

### 275.3 CommonJS的加载机制

1. **同步加载**：`require()`执行时会阻塞后续代码，直到模块加载完成；
2. **缓存机制**：模块第一次被`require`时会执行并缓存，后续`require`同一模块会直接返回缓存结果（避免重复执行）；
3. **模块标识符**：
   - 内置模块（如`fs`）：直接写模块名；
   - 第三方模块（如`lodash`）：从`node_modules`目录查找；
   - 本地模块：以`./`或`../`开头的相对路径，或绝对路径。

#### 示例：CommonJS缓存机制

```javascript
// mod.js
console.log("模块执行"); // 仅第一次require时输出
let count = 0;
module.exports = {
  increment: () => count++,
  getCount: () => count,
};
```

```javascript
// main.js
const mod1 = require("./mod.js"); // 输出"模块执行"
const mod2 = require("./mod.js"); // 不输出（使用缓存）

mod1.increment();
console.log(mod1.getCount()); // 1
console.log(mod2.getCount()); // 1（mod1和mod2指向同一模块实例）
```

### 275.4 CommonJS与ES6 Modules的核心区别

| 特性        | CommonJS                            | ES6 Modules                                    |
| ----------- | ----------------------------------- | ---------------------------------------------- |
| 加载时机    | 运行时动态加载（执行`require`时）   | 编译时静态加载（解析`import`时）               |
| `this`指向  | 模块内`this`指向`module.exports`    | 模块内`this`指向`undefined`                    |
| 默认导出    | `module.exports = value`            | `export default value`                         |
| 命名导出    | `exports.key = value`               | `export const key = value`                     |
| 动态导入    | 原生支持（`require`可在条件语句中） | 需用`import()`函数（返回Promise）              |
| Node.js支持 | 原生支持（默认）                    | 需设置`"type": "module"`（在`package.json`中） |

## 276 A Brief Introduction to the Command Line（命令行简介）

### 276.1 命令行的核心作用

命令行（Command Line Interface，CLI）是**与操作系统交互的文本界面**，现代JS开发中用于：

- 执行NPM命令（如`npm install`、`npm run build`）；
- 操作文件/目录（如创建、删除、移动文件）；
- 运行Node.js脚本（如`node main.js`）；
- 部署项目（如`netlify deploy`）。

### 276.2 常见命令行工具

| 操作系统 | 默认命令行工具                | 推荐增强工具               |
| -------- | ----------------------------- | -------------------------- |
| Windows  | 命令提示符（CMD）、PowerShell | Windows Terminal、Git Bash |
| macOS    | Terminal                      | iTerm2、Oh My Zsh          |
| Linux    | Terminal                      | Oh My Zsh                  |

### 276.3 常用命令（通用）

| 命令                 | 作用                                                          | 示例                                            |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `pwd`                | 显示当前工作目录路径                                          | `pwd` → `/Users/username/project`               |
| `ls`                 | 列出当前目录下的文件/目录                                     | `ls -l` → 详细列表（包含权限、大小）            |
| `cd 路径`            | 切换工作目录                                                  | `cd ../` → 回到上级目录；`cd src` → 进入src目录 |
| `mkdir 目录名`       | 创建新目录                                                    | `mkdir dist` → 创建dist目录                     |
| `touch 文件名`       | 创建新文件（macOS/Linux）；Windows用`type nul > 文件名`       | `touch index.js` → 创建index.js文件             |
| `rm 文件名`          | 删除文件                                                      | `rm test.txt` → 删除test.txt                    |
| `rm -r 目录名`       | 递归删除目录及内容（macOS/Linux）；Windows用`rmdir /s 目录名` | `rm -r node_modules` → 删除node_modules目录     |
| `cp 源文件 目标路径` | 复制文件                                                      | `cp index.js src/` → 复制index.js到src目录      |
| `mv 源文件 目标路径` | 移动/重命名文件                                               | `mv old.js new.js` → 重命名为new.js             |

### 276.4 JS开发常用命令示例

1. 初始化NPM项目：`npm init -y`（`-y`表示默认回答所有问题，快速创建`package.json`）；
2. 安装开发依赖：`npm install --save-dev parcel`（`--save-dev`缩写`-D`，依赖仅用于开发环境）；
3. 安装生产依赖：`npm install axios`（依赖用于生产环境，会写入`dependencies`）；
4. 运行脚本：`npm run dev`（执行`package.json`中`scripts`下的`dev`命令，如`"dev": "parcel index.html"`）；
5. 查看Node.js版本：`node -v` → `v18.16.0`；
6. 运行JS脚本：`node main.js` → 执行main.js文件。

## 277 Introduction to NPM（NPM简介）

### 277.1 NPM的概念

NPM（Node Package Manager）是**Node.js的包管理工具**，主要功能：

- **包管理**：下载、安装、更新、删除第三方库（如React、Lodash）；
- **项目配置**：通过`package.json`管理项目信息、依赖、脚本；
- **脚本执行**：通过`npm run 脚本名`执行自定义命令（如构建、测试、部署）。

### 277.2 NPM的核心文件：`package.json`

`package.json`是项目的**配置清单**，包含以下核心字段：

```json
{
  "name": "my-js-project", // 项目名称（小写，无空格）
  "version": "1.0.0", // 项目版本（遵循语义化版本：MAJOR.MINOR.PATCH）
  "description": "A modern JavaScript project", // 项目描述
  "main": "index.js", // 项目入口文件（CommonJS模块）
  "type": "module", // 启用ES6 Modules（默认CommonJS）
  "scripts": {
    // 自定义脚本
    "dev": "parcel index.html", // 开发环境启动命令
    "build": "parcel build index.html", // 生产环境打包命令
    "test": "jest" // 测试命令
  },
  "dependencies": {
    // 生产依赖（项目运行必需）
    "axios": "^1.4.0"
  },
  "devDependencies": {
    // 开发依赖（仅开发时使用）
    "parcel": "^2.9.1",
    "jest": "^29.5.0"
  },
  "author": "Your Name", // 作者
  "license": "MIT" // 开源协议
}
```

### 277.3 语义化版本（Semantic Versioning）

NPM依赖版本遵循`MAJOR.MINOR.PATCH`格式，含义：

- **MAJOR**（主版本）：不兼容的API变更（如从v1.x到v2.x）；
- **MINOR**（次版本）：向后兼容的功能新增（如从v1.2.x到v1.3.x）；
- **PATCH**（补丁版本）：向后兼容的问题修复（如从v1.3.0到v1.3.1）。

版本前缀含义：

- `^1.4.0`：允许次版本和补丁版本更新（如1.4.0 → 1.5.2）；
- `~1.4.0`：仅允许补丁版本更新（如1.4.0 → 1.4.3）；
- `1.4.0`：固定版本（不允许任何更新）。

### 277.4 NPM常用命令

| 命令                        | 作用                                     | 示例                                   |
| --------------------------- | ---------------------------------------- | -------------------------------------- |
| `npm init`                  | 初始化项目，创建`package.json`           | `npm init -y` → 快速初始化（默认配置） |
| `npm install <包名>`        | 安装生产依赖                             | `npm install axios`                    |
| `npm install -D <包名>`     | 安装开发依赖                             | `npm install -D parcel`                |
| `npm install <包名>@<版本>` | 安装指定版本的包                         | `npm install axios@1.0.0`              |
| `npm update <包名>`         | 更新包到最新兼容版本                     | `npm update axios`                     |
| `npm uninstall <包名>`      | 删除包                                   | `npm uninstall axios`                  |
| `npm run <脚本名>`          | 执行`scripts`中的自定义脚本              | `npm run dev` → 执行dev脚本            |
| `npm list`                  | 查看已安装的包及其依赖树                 | `npm list --depth 0` → 仅显示顶层依赖  |
| `npm outdated`              | 检查过时的包（版本落后于`package.json`） | `npm outdated`                         |

### 277.5 NPM与Yarn的对比

Yarn是Facebook推出的包管理工具，解决早期NPM的性能问题，核心区别：
| 特性 | NPM | Yarn |
|---------------------|------------------------------|-------------------------------|
| 安装速度 | 较慢（早期），v5+优化后较快 | 较快（并行安装、缓存机制） |
| 锁文件 | `package-lock.json`（v5+） | `yarn.lock`（默认） |
| 命令差异 | `npm install` | `yarn add` |
| | `npm uninstall` | `yarn remove` |
| | `npm run dev` | `yarn dev` |
| 全局安装 | `npm install -g <包名>` | `yarn global add <包名>` |

**选择建议**：现代项目中NPM（v5+）与Yarn功能差异不大，可根据团队习惯选择；Vite等新工具默认支持两者。

## 278 Bundling With Parcel and NPM Scripts（使用Parcel和NPM脚本打包）

### 278.1 打包工具的核心作用

打包工具（如Parcel、Webpack）是**现代JS开发的核心工具**，主要功能：

1. **模块合并**：将多个ES Modules/CommonJS模块合并为少数几个文件（减少HTTP请求）；
2. **语法转换**：将ES6+语法转换为ES5（兼容旧浏览器）；
3. **资源处理**：处理CSS、图片、字体等非JS资源（如将CSS注入HTML，图片压缩）；
4. **代码优化**：压缩JS/CSS代码（移除空格、注释，变量重命名），提升加载速度；
5. **自动化**：监听文件变化，自动重新打包（热更新，Hot Reload）。

### 278.2 Parcel的核心优势

Parcel是**零配置打包工具**，相比Webpack的复杂配置，Parcel无需手动编写配置文件（如`webpack.config.js`），开箱即用，适合快速开发。

### 278.3 使用Parcel打包项目的步骤

#### 步骤1：初始化项目并安装Parcel

```bash
# 1. 创建项目目录并进入
mkdir parcel-demo && cd parcel-demo

# 2. 初始化NPM项目（生成package.json）
npm init -y

# 3. 安装Parcel作为开发依赖
npm install -D parcel
```

#### 步骤2：创建项目文件

```html
<!-- index.html（入口HTML文件） -->
<!DOCTYPE html>
<html>
  <head>
    <title>Parcel Demo</title>
    <link rel="stylesheet" href="./style.css" />
    <!-- 引入CSS文件 -->
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.js"></script>
    <!-- 引入JS模块 -->
  </body>
</html>
```

```css
/* style.css */
body {
  background: #f0f0f0;
  font-family: Arial, sans-serif;
}
#app {
  font-size: 24px;
  color: #333;
  text-align: center;
  margin-top: 50px;
}
```

```javascript
// math.js（JS模块）
export const sum = (a, b) => a + b;
```

```javascript
// main.js（JS入口文件）
import { sum } from "./math.js";

const app = document.getElementById("app");
app.textContent = `1 + 2 = ${sum(1, 2)}`; // 动态插入内容
```

#### 步骤3：配置NPM脚本

修改`package.json`的`scripts`字段：

```json
{
  "scripts": {
    "dev": "parcel index.html", // 开发模式（热更新）
    "build": "parcel build index.html" // 生产模式（打包优化）
  }
}
```

#### 步骤4：运行开发模式

```bash
npm run dev
```

Parcel会自动：

- 启动开发服务器（默认端口1234）；
- 打开浏览器访问`http://localhost:1234`；
- 监听文件变化，修改后自动重新打包并刷新页面。

#### 步骤5：打包生产版本

```bash
npm run build
```

Parcel会生成`dist`目录，包含：

- 合并并压缩后的`index.html`、`main.[hash].js`、`style.[hash].css`；
- 自动处理资源路径（如图片URL）；
- 移除未使用的代码（Tree Shaking）。

### 278.4 Parcel的特点示例

#### 1. 热更新（Hot Reload）

修改`style.css`的`background`为`#fff`，浏览器会立即更新样式，无需手动刷新。

#### 2. 自动处理CSS

Parcel会将`style.css`注入到HTML的`<head>`中（开发模式），或打包为独立的CSS文件（生产模式）。

#### 3. 图片处理

在`index.html`中添加图片：

```html
<img src="./logo.png" alt="Logo" />
```

Parcel会自动压缩图片，并在生产模式下生成带哈希值的文件名（如`logo.abc123.png`），避免缓存问题。

#### 4. Tree Shaking（移除未使用代码）

若`math.js`中有未被导入的函数：

```javascript
// math.js
export const sum = (a, b) => a + b;
export const multiply = (a, b) => a * b; // 未被导入
```

Parcel在生产模式下会自动移除`multiply`函数，减小打包体积。

### 278.5 常见问题与解决方案

1. **端口被占用**：修改`dev`脚本为`parcel index.html --port 3000`（指定端口3000）；
2. **打包后路径错误**：若部署到子目录（如`https://example.com/my-app`），需添加`--public-url ./`：
   ```json
   "build": "parcel build index.html --public-url ./"
   ```
3. **缓存问题**：生产模式下Parcel会为文件名添加哈希值（如`main.abc123.js`），确保新版本不被浏览器缓存。

## 279 Configuring Babel and Polyfilling（配置Babel与垫片）

### 279.1 Babel的核心作用

Babel是**JS语法转换工具**，用于将ES6+（如箭头函数、`let/const`、解构赋值）转换为ES5语法，解决旧浏览器（如IE11）的兼容性问题。

### 279.2 垫片（Polyfill）的核心作用

Babel仅转换语法，无法处理ES6+新增的**API**（如`Promise`、`Array.prototype.includes`、`Object.assign`）。垫片（如`core-js`）会为旧浏览器添加这些API的实现，确保代码正常运行。

### 279.3 Babel与Polyfill的配置步骤

#### 步骤1：安装依赖

```bash
# 1. 安装Babel核心依赖和预设
npm install -D @babel/core @babel/cli @babel/preset-env

# 2. 安装core-js（提供垫片）
npm install core-js@3
```

- `@babel/core`：Babel的核心转换功能；
- `@babel/cli`：Babel的命令行工具；
- `@babel/preset-env`：预设集合，自动根据目标浏览器选择需要转换的语法；
- `core-js@3`：ES6+ API的垫片库。

#### 步骤2：创建Babel配置文件

在项目根目录创建`babel.config.json`（Babel 7+推荐的配置文件格式）：

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          // 目标浏览器（根据需求调整）
          "ie": "11", // 支持IE11
          "chrome": "58",
          "firefox": "54"
        },
        "useBuiltIns": "usage", // 自动按需导入垫片（仅导入使用到的API）
        "corejs": 3 // 指定core-js版本
      }
    ]
  ]
}
```

#### 步骤3：配置NPM脚本

修改`package.json`的`scripts`字段，添加Babel转换命令：

```json
{
  "scripts": {
    "dev": "parcel index.html", // Parcel会自动使用Babel
    "build": "parcel build index.html",
    "babel:transpile": "babel src --out-dir dist/src" // 单独使用Babel转换src目录
  }
}
```

#### 步骤4：测试语法转换与垫片

创建包含ES6+语法和API的文件：

```javascript
// src/main.js
const arr = [1, 2, 3];
const hasTwo = arr.includes(2); // ES2016 API
const promise = new Promise((resolve) => resolve("ok")); // ES2015 API

console.log(hasTwo);
promise.then(console.log);
```

运行`npm run babel:transpile`，转换后的`dist/src/main.js`会：

1. 将`const`转换为`var`（兼容IE11）；
2. 自动导入`core-js`的`Array.prototype.includes`和`Promise`垫片；
3. 保留代码逻辑不变。

### 279.4 Babel预设与插件

- **预设（Preset）**：是**插件的集合**，用于简化配置（如`@babel/preset-env`包含所有ES6+语法转换插件）；
- **插件（Plugin）**：用于转换特定语法（如`@babel/plugin-proposal-class-properties`用于转换类的私有属性）。

#### 示例：添加类私有属性支持

1. 安装插件：`npm install -D @babel/plugin-proposal-class-properties`；
2. 修改`babel.config.json`：
   ```json
   {
     "presets": ["@babel/preset-env"],
     "plugins": ["@babel/plugin-proposal-class-properties"]
   }
   ```
3. 测试代码：
   ```javascript
   class Person {
     #name = "Alice"; // 类私有属性（ES2022）
     getName() {
       return this.#name;
     }
   }
   const p = new Person();
   console.log(p.getName()); // 输出"Alice"
   ```
   转换后会兼容旧浏览器。

### 279.5 `useBuiltIns`的三种模式

| 模式      | 作用                                  | 优点                     | 缺点                                   |
| --------- | ------------------------------------- | ------------------------ | -------------------------------------- |
| `"usage"` | 自动按需导入垫片（仅导入使用的API）   | 垫片体积最小             | 需指定`corejs`版本                     |
| `"entry"` | 在入口文件手动导入`core-js`，按需添加 | 可控性强                 | 需手动在入口文件添加`import 'core-js'` |
| `false`   | 不自动添加垫片                        | 适合仅需要语法转换的场景 | 需手动导入所有需要的垫片，易遗漏       |

**推荐使用`"usage"`**，平衡体积与便利性。

## 280 Review: Writing Clean and Modern JavaScript（复习：编写简洁现代的JavaScript）

### 280.1 变量声明：优先使用`const`/`let`，避免`var`

- `const`：用于**不可变变量**（如常量、函数、对象/数组引用）；
- `let`：用于**可变变量**（如循环变量、条件赋值变量）；
- `var`：存在变量提升、全局污染问题，避免使用。

#### 示例：正确的变量声明

```javascript
// 推荐
const PI = 3.14; // 常量用const
const user = { name: "Alice" }; // 对象引用不可变（内容可改）
let count = 0; // 可变变量用let
count++; // 合法

// 不推荐
var age = 20; // 避免var
age = 21;
```

### 280.2 函数定义：优先使用箭头函数和简洁语法

- 单行函数：用箭头函数简化代码（`(a,b) => a+b`）；
- 多行函数：若需`this`绑定（如对象方法），用`function`关键字；
- 避免匿名函数（如`setTimeout(function() {}, 1000)`），使用命名函数提升可读性。

#### 示例：简洁的函数定义

```javascript
// 推荐
const sum = (a, b) => a + b; // 单行箭头函数
const getUser = () => ({ name: "Bob", age: 30 }); // 返回对象（需加括号）

const calculator = {
  value: 0,
  add(n) {
    // 对象方法用function简写
    this.value += n;
    return this.value;
  },
};

// 不推荐
function multiply(a, b) {
  // 单行函数可简化为箭头函数
  return a * b;
}

setTimeout(function () {
  // 匿名函数，调试时难以定位
  console.log("done");
}, 1000);
```

### 280.3 数据结构：优先使用数组方法和对象简写

- 数组遍历：用`map`/`filter`/`reduce`替代`for`循环（函数式编程，可读性高）；
- 对象简写：属性名与变量名相同时，用`{ name }`替代`{ name: name }`；
- 解构赋值：快速提取数组/对象的属性，避免重复代码。

#### 示例：现代数据结构操作

```javascript
// 1. 数组方法
const numbers = [1, 2, 3, 4];
const doubled = numbers.map((n) => n * 2); // [2,4,6,8]
const even = numbers.filter((n) => n % 2 === 0); // [2,4]
const sum = numbers.reduce((acc, n) => acc + n, 0); // 10

// 2. 对象简写
const name = "Charlie";
const age = 25;
const person = { name, age }; // 简写，等价于{ name: name, age: age }

// 3. 解构赋值
const { name: userName } = person; // 提取name并改名为userName
const [first, second] = numbers; // 提取数组前两个元素
```

### 280.4 模块化：使用ES6 Modules拆分代码

- 按功能拆分模块（如`math.js`、`utils.js`）；
- 明确导出接口（优先用命名导出，单一功能用默认导出）；
- 避免全局变量，通过`import`/`export`管理依赖。

#### 示例：模块化代码

```javascript
// utils.js（工具模块）
export const formatDate = (date) => date.toLocaleDateString("zh-CN");
export const isEmpty = (value) =>
  value === null || value === undefined || value === "";

// main.js（入口模块）
import { formatDate, isEmpty } from "./utils.js";

console.log(formatDate(new Date())); // "2024/5/20"
console.log(isEmpty("")); // true
```

### 280.5 错误处理：用`try/catch`捕获异步/同步错误

- 同步错误：直接用`try/catch`包裹；
- 异步错误：`async/await`中用`try/catch`，或`Promise`中用`.catch()`；
- 避免“沉默错误”（如不处理`Promise`的`reject`）。

#### 示例：正确的错误处理

```javascript
// 1. 同步错误处理
function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.error("JSON解析错误：", err);
    return null; // 提供默认值
  }
}

// 2. 异步错误处理（async/await）
async function fetchData() {
  try {
    const res = await fetch("https://api.example.com/data");
    if (!res.ok) throw new Error(`HTTP错误：${res.status}`); // 主动抛出错误
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("数据加载失败：", err);
    return { fallback: "默认数据" };
  }
}
```

### 280.6 代码风格：遵循ESLint规范

- 安装ESLint：`npm install -D eslint`；
- 初始化配置：`npx eslint --init`（选择Airbnb/Standard等流行规范）；
- 自动修复：`npx eslint src --fix`（自动修复多数代码风格问题）。

#### 示例：ESLint检测的常见问题

- 未使用的变量（如`const a = 1;`未被使用）；
- 语句末尾缺少分号（或多余分号，根据规范）；
- 缩进不一致（如混用空格和制表符）；
- 字符串引号不统一（如混用单引号和双引号）。

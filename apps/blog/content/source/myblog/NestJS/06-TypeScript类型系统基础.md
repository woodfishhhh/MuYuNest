---
title: TypeScript 类型系统基础：从注解到接口与类
date: 2026-07-12
updated: 2026-07-12
slug: typescript-type-system-basics
type: Notes
categories:
  - 编程语言
  - TypeScript
tags:
  - TypeScript
  - NestJS
  - 类型系统
  - 前端工程化
source:
  - https://www.bilibili.com/video/BV139Mez9EnA/
bvid: BV139Mez9EnA
pages: P54-P100
draft: false
---

# TypeScript 类型系统基础：从注解到接口与类

这组视频从 P54 开始已经不是 NestJS 项目的后续章节，而是一套独立的 TypeScript 入门课。它被拼在 part2 后半段，内容正好补上理解 NestJS 所需的语言基础：类型注解、类型推断、函数、对象、数组、元组、接口和类。

本文依据 Bilibili 自动翻译中文字幕整理，按“先建立类型系统的心智模型，再把它接回 NestJS”的顺序展开。示例是根据课程内容重新编写的教学版代码，不是视频代码的逐字还原。

## 1. TypeScript 到底多做了什么

TypeScript 没有发明一套新的运行时。我们写的仍然是 JavaScript，只是在源码里加入了类型信息，让编译器能在开发阶段检查错误。

```text
TypeScript 源码
    ↓ 类型检查 + 转译
JavaScript 源码
    ↓
Node.js / 浏览器执行
```

这条链路有两个直接结论：

1. 类型错误通常在编辑器或构建阶段暴露，不必等代码跑起来才发现。
2. `interface`、类型别名和大部分类型注解会在编译后消失，它们不会替你做运行时校验。

比如下面这段代码可以阻止一次明显的错误调用：

```ts
function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`;
}

formatPrice(19.9);
// formatPrice("19.9"); // 编译阶段报错
```

但类型系统只能检查“值的形状是否符合约定”，不能判断业务逻辑是否正确。把加法写成减法，返回值依旧是 `number`，编译器不会知道公式写反了。

```ts
function add(a: number, b: number): number {
  return a - b; // 类型正确，逻辑错误
}
```

类型检查不能代替单元测试，这也是课程后面反复写测试的原因。

## 2. 本地开发环境

课程演示使用全局安装。实际项目里更稳妥的做法是把工具锁在项目依赖中，团队成员和 CI 会使用同一版本。

```bash
npm install --save-dev typescript ts-node @types/node
npx tsc --init
```

常用命令：

```bash
npx tsc --noEmit              # 只检查类型，不输出 JavaScript
npx tsc                       # 编译项目
npx ts-node src/index.ts      # 学习阶段直接执行单个 TypeScript 文件
```

`ts-node` 适合练习和开发工具脚本。正式构建仍应让 `tsc` 或项目选定的构建器统一处理，不要把“能直接跑 `.ts`”误解成 Node.js 原生支持 TypeScript 的全部语法和项目配置。

## 3. 类型注解和类型推断怎么分工

类型注解是我们明确写出的类型，类型推断是编译器根据赋值和上下文算出的类型。

```ts
const projectName = "nest-notes"; // 推断为字符串字面量类型 "nest-notes"
let environment = "development"; // 字面量类型拓宽为 string
let retryCount: number = 3;       // 显式注解
```

`const` 变量不能重新赋值，因此这里保留了更精确的字面量类型；`let` 变量可能被改成其他字符串，初始字面量通常会拓宽为 `string`。局部变量能被准确推断时，重复写注解只会增加噪声。下面这句里的 `: number` 通常没提供新信息：

```ts
let port: number = 3000;
```

显式注解更适合放在边界上：函数参数、公开返回值、延迟初始化的变量，以及推断结果过宽或不安全的位置。

### 基础类型

```ts
const username: string = "woodfish";
const age: number = 20;
const enabled: boolean = true;
const createdAt: Date = new Date();
const tags: string[] = ["nestjs", "typescript"];
```

JavaScript 的整数和小数在 TypeScript 中都使用 `number`。基础类型应写成小写的 `string`、`number`、`boolean`，不要使用包装对象类型 `String`、`Number`、`Boolean`。

### 推断失效或不够安全的地方

#### 1. 延迟初始化

```ts
let currentUserId: number;

currentUserId = 42;
```

变量声明时没有初始值，编译器缺少推断依据，需要我们明确类型。

#### 2. 一个值可能有多种类型

```ts
const values = ["12", "pending", "30"];
const parsed: Array<number | boolean> = values.map((value) => {
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? false : numberValue;
});
```

这里的元素既可能是 `number`，也可能是 `boolean`，联合类型比随手写 `any[]` 更能保住后续检查。

#### 3. `JSON.parse` 带来的 `any`

课程用 `JSON.parse` 说明了 `any` 的危险：一旦某个值变成 `any`，后面的属性访问和函数调用几乎都会被放行。

```ts
const unsafeResult = JSON.parse('{"name":"Ada"}');
unsafeResult.notExists().stillNotExists(); // 类型检查帮不上忙
```

在真实项目里，可以先把外部数据视为 `unknown`，再做校验或类型收窄。

```ts
function isUser(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string"
  );
}

const result: unknown = JSON.parse('{"name":"Ada"}');

if (isUser(result)) {
  console.log(result.name);
}
```

TypeScript 只负责静态检查，网络请求、配置文件和用户输入仍要做运行时验证。

## 4. 函数：参数必须说明，返回值值得说明

函数参数通常无法凭空推断，因此要写清类型。返回值往往能被推断出来，但在服务层、公共方法和业务函数上显式写出返回类型，能防止实现悄悄偏离约定。

```ts
function add(a: number, b: number): number {
  return a + b;
}

const subtract = (a: number, b: number): number => a - b;
```

### `void` 和 `never`

`void` 不代表函数一定会正常结束。函数声明标注 `: void` 时，表示它不向调用方提供可用的返回值；而在 `() => void` 这类回调类型中，实现即使返回了值，调用方也会忽略它。

```ts
function logRequest(path: string): void {
  console.log(path);
}
```

`never` 表示函数没有可到达的正常出口，常见情况是始终抛出异常或陷入死循环。

```ts
function fail(message: string): never {
  throw new Error(message);
}
```

两者的区别在于：`void` 不暴露可用的返回值，但函数仍可能抛错或不结束；`never` 则明确表示控制权不会通过正常返回交还给调用方。

### 解构参数的类型写在解构表达式后

```ts
interface Weather {
  date: Date;
  weather: string;
}

function printWeather({ date, weather }: Weather): void {
  console.log(`${date.toISOString()}: ${weather}`);
}
```

把属性名和类型混在解构左侧很容易写乱。先写解构结构，再给整个参数标注一个命名类型，可读性更好。

## 5. 对象类型和结构化类型系统

可以直接在参数位置描述对象形状：

```ts
function printVehicle(vehicle: {
  name: string;
  year: number;
  broken: boolean;
}): void {
  console.log(vehicle.name);
}
```

但对象一复杂，内联注解会快速膨胀，而且多个函数会重复同一段结构。这时应给它一个名字。

```ts
interface Vehicle {
  name: string;
  year: number;
  broken: boolean;
  summary(): string;
}

function printVehicle(vehicle: Vehicle): void {
  console.log(vehicle.summary());
}
```

TypeScript 采用结构化类型：一个对象不必显式声明“实现了 `Vehicle`”，只要它具有要求的成员，就可以传给需要 `Vehicle` 的函数。

```ts
const civic = {
  name: "Civic",
  year: 2000,
  broken: true,
  summary() {
    return `${this.name} (${this.year})`;
  },
};

printVehicle(civic);
```

这让函数面向能力编程，而不是绑定某个具体类。接口写得越小、越聚焦，复用空间通常越大。

需要记住：`interface` 编译后会消失。它能约束源码，却不能在运行时读取元数据，也不能验证一段外部 JSON。

## 6. 数组和元组

数组适合保存一组同类值。类型明确后，编辑器既能限制写入，也能推断遍历元素的类型。

```ts
const technologies: string[] = ["NestJS", "TypeScript"];

technologies.push("TypeORM");
// technologies.push(42); // 报错

technologies.map((technology) => technology.toUpperCase());
```

需要混合元素时应明确写联合类型：

```ts
const requestTrace: Array<string | number> = ["GET", 200, "/users"];
```

元组对元素数量和每个位置的类型都有约束：

```ts
type HttpResult = [statusCode: number, message: string];

const result: HttpResult = [200, "ok"];
```

元组适合短小、位置语义稳定的数据。字段一多，调用方会开始记“第 0 位和第 2 位分别是什么”，这时对象更清楚。

```ts
interface HttpResultObject {
  statusCode: number;
  message: string;
}
```

## 7. 类、继承和访问修饰符

TypeScript 的类建立在 JavaScript `class` 之上，额外提供字段类型和 `public`、`protected`、`private` 等静态约束。

```ts
class VehicleService {
  constructor(protected readonly prefix: string) {}

  public describe(name: string): string {
    return `${this.prefix}: ${name}`;
  }

  private normalize(name: string): string {
    return name.trim().toLowerCase();
  }
}

class CarService extends VehicleService {
  describeCar(name: string): string {
    return this.describe(name);
  }
}
```

- `public`：类内、子类和外部都可以访问，也是默认值。
- `protected`：类内和子类可访问，外部不能直接使用。
- `private`：只允许当前类内部访问。

这些修饰符主要提供编译期约束。继承适合表达稳定的“是一个”关系，不应为了复用几行代码就堆出很深的类层级。NestJS 中更常见的复用手段是依赖注入和组合。

## 8. 接回 NestJS：为什么 DTO 常用 class

前面说过，接口会在编译后消失。NestJS 的 Pipe、装饰器和反射能力需要运行时能拿到类型实体，所以请求 DTO 通常写成 class，而不是 interface。

```ts
import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

```ts
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(3000);
}

void bootstrap();
```

这里有三层不同的责任：

1. TypeScript 检查项目源码中的类型使用。
2. DTO class 在编译后仍然存在，为 NestJS 提供运行时元数据。
3. `class-validator` 和 `ValidationPipe` 检查真正进入应用的外部数据。

只写 `interface CreateUserDto` 能让控制器源码看起来有类型，但挡不住客户端发来错误字段。反过来，只做运行时校验而不给服务层稳定的类型，也会让项目内部越来越难维护。

## 9. 一套够用的判断顺序

写 TypeScript 时，可以按下面的顺序决定是否需要补类型：

1. 先让编译器推断局部变量，别把每个 `const` 都写成教材式注解。
2. 函数参数、模块出口和业务返回值写清类型。
3. 遇到外部数据先当作 `unknown`，完成验证后再使用。
4. 重复出现的对象结构用 `interface` 或类型别名命名。
5. 需要运行时元数据、装饰器或实例行为时使用 class。
6. 类型检查只能保证结构，业务正确性仍交给测试。

把这几条带回 NestJS，Controller、DTO、Service、Entity 和测试之间的分工会清楚很多：类型系统负责开发阶段的约束，框架和验证库负责运行时边界，测试负责业务行为。

## 延伸阅读

- [TypeScript Handbook: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook: More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html)
- [TypeScript Handbook: Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- [TypeScript Handbook: Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [NestJS Controllers: DTO 为什么推荐使用 class](https://docs.nestjs.com/controllers)
- [NestJS Validation](https://docs.nestjs.com/techniques/validation)

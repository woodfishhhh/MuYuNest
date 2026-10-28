---
title: TypeScript 类型系统基础：从注解到接口与类
date: 2026-07-12
updated: 2026-07-12
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

## TypeScript 编译与运行时

TypeScript 给 JavaScript 源码加上静态类型检查，编译完还是由 Node.js 或浏览器执行 JavaScript。

```text
TypeScript 源码
    ↓ 类型检查 + 转译
JavaScript 源码
    ↓
Node.js / 浏览器执行
```

`interface`、类型别名和大部分类型注解编译后就没了。它们能提前发现类型错误，代替不了运行时校验。

```ts
function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`;
}

formatPrice(19.9);
// formatPrice("19.9"); // 编译阶段报错
```

类型系统检查的是值的形状，管不了业务逻辑。下面这个函数类型完全正确，公式照样写错了：

```ts
function add(a: number, b: number): number {
  return a - b; // 类型正确，逻辑错误
}
```

所以类型检查代替不了单元测试。

## 本地工具链

把 TypeScript 工具装进项目依赖，团队成员和 CI 用的就是同一个版本：

```bash
npm install --save-dev typescript ts-node @types/node
npx tsc --init
```

```bash
npx tsc --noEmit              # 只检查类型，不输出 JavaScript
npx tsc                       # 编译项目
npx ts-node src/index.ts      # 学习阶段直接执行单个 TypeScript 文件
```

`ts-node` 适合练习和写工具脚本。正式构建交给 `tsc` 或项目的构建器；能执行 `.ts`，不代表 Node.js 原生支持所有 TypeScript 语法和项目配置。

## 类型注解与类型推断

类型注解是开发者写的，类型推断是编译器根据赋值和上下文算出来的。

```ts
const projectName = "nest-notes"; // 推断为字符串字面量类型 "nest-notes"
let environment = "development"; // 字面量类型拓宽为 string
let retryCount: number = 3;       // 显式注解
```

`const` 不能重新赋值，一般保留更精确的字面量类型；`let` 的初始字面量一般会被拓宽。局部变量能准确推断就不用重复写注解。函数参数、公开的返回值、延迟初始化的变量，以及推断得太宽的地方，要显式标注。

### 基础类型

```ts
const username: string = "woodfish";
const age: number = 20;
const enabled: boolean = true;
const createdAt: Date = new Date();
const tags: string[] = ["nestjs", "typescript"];
```

JavaScript 的整数和小数在 TypeScript 里都是 `number`。基础类型写小写的 `string`、`number`、`boolean`，别用包装对象类型 `String`、`Number`、`Boolean`。

### 延迟初始化与联合类型

```ts
let currentUserId: number;

currentUserId = 42;
```

变量声明时没有初始值，就要写明类型。一个值可能是几种类型之一时，用联合类型：

```ts
const values = ["12", "pending", "30"];
const parsed: Array<number | boolean> = values.map((value) => {
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? false : numberValue;
});
```

联合类型保留每个分支的检查。`JSON.parse` 默认返回 `any`，之后的属性访问和函数调用都会被放过去：

```ts
const unsafeResult = JSON.parse('{"name":"Ada"}');
unsafeResult.notExists().stillNotExists(); // 类型检查帮不上忙
```

外部数据先当成 `unknown`，校验过再收窄：

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

网络请求、配置文件和用户输入都要做运行时验证。

## 函数类型

函数参数一般要显式写类型。服务层、公共方法和业务函数最好也写上返回类型，免得实现慢慢偏离接口约定。

```ts
function add(a: number, b: number): number {
  return a + b;
}

const subtract = (a: number, b: number): number => a - b;
```

### `void` 与 `never`

`: void` 表示函数不给调用方提供能用的返回值；在 `() => void` 这种回调类型里，实现就算返回了值，调用方也会忽略。

```ts
function logRequest(path: string): void {
  console.log(path);
}
```

`never` 表示函数没有正常的出口，比如总是抛异常，或者进了死循环。

```ts
function fail(message: string): never {
  throw new Error(message);
}
```

一句话：`void` 是不暴露返回值，`never` 是根本不会正常返回。

### 解构参数

```ts
interface Weather {
  date: Date;
  weather: string;
}

function printWeather({ date, weather }: Weather): void {
  console.log(`${date.toISOString()}: ${weather}`);
}
```

先写解构的结构，再给整个参数标一个命名类型。

## 对象类型与 interface

可以直接在参数位置描述对象的形状：

```ts
function printVehicle(vehicle: {
  name: string;
  year: number;
  broken: boolean;
}): void {
  console.log(vehicle.name);
}
```

对象结构复杂、或者好几处都要用时，用 `interface` 或类型别名起个名字：

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

TypeScript 是结构化类型。对象不用显式声明自己实现了 `Vehicle`，只要有需要的成员就能传进去：

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

接口小一点更好复用。`interface` 编译后就没了，提供不了运行时元数据，也验证不了外部 JSON。

## 数组与元组

数组存同一类的值，类型同时约束写入和遍历出来的元素：

```ts
const technologies: string[] = ["NestJS", "TypeScript"];

technologies.push("TypeORM");
// technologies.push(42); // 报错

technologies.map((technology) => technology.toUpperCase());
```

元素类型混合时用联合类型：

```ts
const requestTrace: Array<string | number> = ["GET", 200, "/users"];
```

元组约束元素的个数和每个位置的类型：

```ts
type HttpResult = [statusCode: number, message: string];

const result: HttpResult = [200, "ok"];
```

元组只适合短小、每个位置含义固定的数据。字段一多就改用对象：

```ts
interface HttpResultObject {
  statusCode: number;
  message: string;
}
```

## 类与访问修饰符

TypeScript 在 JavaScript 的 `class` 上加了字段类型和访问修饰符：

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

- `public`：类内、子类和外部都能访问，也是默认值。
- `protected`：类内和子类能访问，外部不能直接用。
- `private`：只有当前类内部能访问。

访问修饰符主要是编译期的约束。继承适合稳定的"是一个"关系；NestJS 里更常用依赖注入和组合来复用逻辑。

## NestJS DTO 为什么使用 class

`interface` 编译后就没了，而 NestJS 的 Pipe、装饰器和反射都需要运行时类型，所以请求 DTO 用 class：

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

三者分工：TypeScript 检查源码类型，DTO class 给 NestJS 提供运行时元数据，`class-validator` 和 `ValidationPipe` 校验客户端输入。只写 interface 挡不住错误字段，只做运行时校验又约束不了服务层的代码。

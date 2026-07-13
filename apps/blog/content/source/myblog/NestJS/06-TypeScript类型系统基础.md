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

## TypeScript 编译与运行时

TypeScript 在 JavaScript 源码中加入静态类型检查，编译后仍由 Node.js 或浏览器执行 JavaScript。

```text
TypeScript 源码
    ↓ 类型检查 + 转译
JavaScript 源码
    ↓
Node.js / 浏览器执行
```

`interface`、类型别名和大部分类型注解会在编译后消失。它们能提前发现类型错误，不能代替运行时校验。

```ts
function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`;
}

formatPrice(19.9);
// formatPrice("19.9"); // 编译阶段报错
```

类型系统检查值的形状，不判断业务逻辑。这个函数类型正确，公式仍然写错了：

```ts
function add(a: number, b: number): number {
  return a - b; // 类型正确，逻辑错误
}
```

类型检查不能代替单元测试。

## 本地工具链

把 TypeScript 工具安装到项目依赖中，团队成员和 CI 会使用同一版本：

```bash
npm install --save-dev typescript ts-node @types/node
npx tsc --init
```

```bash
npx tsc --noEmit              # 只检查类型，不输出 JavaScript
npx tsc                       # 编译项目
npx ts-node src/index.ts      # 学习阶段直接执行单个 TypeScript 文件
```

`ts-node` 适合练习和工具脚本。正式构建交给 `tsc` 或项目构建器；能执行 `.ts` 不等于 Node.js 原生支持所有 TypeScript 语法和项目配置。

## 类型注解与类型推断

类型注解由开发者写出，类型推断由编译器根据赋值和上下文计算。

```ts
const projectName = "nest-notes"; // 推断为字符串字面量类型 "nest-notes"
let environment = "development"; // 字面量类型拓宽为 string
let retryCount: number = 3;       // 显式注解
```

`const` 不能重新赋值，通常保留更精确的字面量类型；`let` 的初始字面量一般会拓宽。局部变量能准确推断时不用重复注解。函数参数、公开返回值、延迟初始化变量和推断过宽的位置应显式标注。

### 基础类型

```ts
const username: string = "woodfish";
const age: number = 20;
const enabled: boolean = true;
const createdAt: Date = new Date();
const tags: string[] = ["nestjs", "typescript"];
```

JavaScript 的整数和小数在 TypeScript 中都使用 `number`。基础类型应写成小写的 `string`、`number`、`boolean`，不要使用包装对象类型 `String`、`Number`、`Boolean`。

### 延迟初始化与联合类型

```ts
let currentUserId: number;

currentUserId = 42;
```

变量声明时没有初始值，需要明确类型。一个值可能有多种类型时使用联合类型：

```ts
const values = ["12", "pending", "30"];
const parsed: Array<number | boolean> = values.map((value) => {
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? false : numberValue;
});
```

联合类型保留每个分支的检查。`JSON.parse` 默认返回 `any`，后续属性访问和函数调用都会被放行：

```ts
const unsafeResult = JSON.parse('{"name":"Ada"}');
unsafeResult.notExists().stillNotExists(); // 类型检查帮不上忙
```

外部数据先视为 `unknown`，校验后再收窄：

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

函数参数通常需要显式类型。服务层、公共方法和业务函数也应写出返回类型，避免实现偏离接口约定。

```ts
function add(a: number, b: number): number {
  return a + b;
}

const subtract = (a: number, b: number): number => a - b;
```

### `void` 与 `never`

`: void` 表示函数不向调用方提供可用的返回值；在 `() => void` 回调类型中，实现即使返回值，调用方也会忽略。

```ts
function logRequest(path: string): void {
  console.log(path);
}
```

`never` 表示函数没有正常出口，例如始终抛出异常或进入死循环。

```ts
function fail(message: string): never {
  throw new Error(message);
}
```

`void` 不暴露返回值；`never` 不会正常返回。

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

先写解构结构，再给整个参数标注命名类型。

## 对象类型与 interface

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

对象结构复杂或被多处使用时，用 `interface` 或类型别名命名：

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

TypeScript 使用结构化类型。对象不必显式声明实现了 `Vehicle`，只要包含所需成员即可传入：

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

小接口更容易复用。`interface` 编译后会消失，不能提供运行时元数据，也不能验证外部 JSON。

## 数组与元组

数组保存同类值，类型同时约束写入和遍历元素：

```ts
const technologies: string[] = ["NestJS", "TypeScript"];

technologies.push("TypeORM");
// technologies.push(42); // 报错

technologies.map((technology) => technology.toUpperCase());
```

混合元素使用联合类型：

```ts
const requestTrace: Array<string | number> = ["GET", 200, "/users"];
```

元组约束元素数量和每个位置的类型：

```ts
type HttpResult = [statusCode: number, message: string];

const result: HttpResult = [200, "ok"];
```

元组只适合短小且位置语义稳定的数据。字段较多时改用对象：

```ts
interface HttpResultObject {
  statusCode: number;
  message: string;
}
```

## 类与访问修饰符

TypeScript 在 JavaScript `class` 上增加字段类型和访问修饰符：

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

访问修饰符主要提供编译期约束。继承用于稳定的“是一个”关系；NestJS 更常用依赖注入和组合复用逻辑。

## NestJS DTO 为什么使用 class

`interface` 编译后会消失。NestJS 的 Pipe、装饰器和反射需要运行时类型，因此请求 DTO 使用 class：

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

TypeScript 检查源码类型；DTO class 为 NestJS 提供运行时元数据；`class-validator` 与 `ValidationPipe` 校验客户端输入。只写 interface 挡不住错误字段，只做运行时校验也无法约束服务层代码。

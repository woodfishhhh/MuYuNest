---
title: TypeScript 工程起步与核心类型系统：编译、接口与类
slug: typescript-type-system-foundations
aliases:
  - typescript-practical-foundations
date: 2026-07-12
categories:
  - 编程语言
tags:
  - TypeScript
  - 类型系统
  - 编译配置
  - 接口与类
  - NestJS
---

TypeScript 的静态类型检查全部发生在编译期，编译完成后交给 Node.js 或浏览器执行的仍然是纯 JavaScript。`interface`、类型别名和绝大多数注解在编译输出里会被完全擦除，因此类型系统能帮你提前拦截字段拼写错误和空值遗漏，却代替不了接口入参的运行时校验和单元测试的业务逻辑断言。

## 工具链初始化与 `tsconfig.json` 核心配置

把 TypeScript 工具链装进项目 `devDependencies`，才能保证本地开发、协作者与 CI 使用完全一致的编译器版本：

```bash
npm install --save-dev typescript tsx @types/node
npx tsc --init
```

日常开发常用的三条核心命令各自负责不同环节：

```bash
npx tsc --noEmit           # 仅做全量类型检查，不输出 JS 产物（CI 必跑）
npx tsc                    # 按 tsconfig.json 编译输出 JavaScript
npx tsc --watch            # 监听文件变更并增量编译
npx tsx src/index.ts       # 直接运行单个 TypeScript 脚本（替代旧版 ts-node）
```

**`tsconfig.json` 中 `strict: true` 是现代工程的底线开关，它同时打开严格空值检查（`strictNullChecks`）与禁止隐式 `any`（`noImplicitAny`）。**

一份适配服务端与现代前端工具链的基础配置关键项如下：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

仅当项目接入 NestJS、TypeORM 或 `class-validator` 等依赖传统装饰器反射的框架时，才需要开启 `experimentalDecorators` 与 `emitDecoratorMetadata`——开启后编译器会为带装饰器的类与参数写入有限的 `design:paramtypes` 运行时元数据，但普通接口和类型依旧在编译后消失。

## 类型推断、`unknown` 边界与基础类型

TypeScript 会在声明并初始化时自动推断类型：`const` 绑定往往保留字面量类型（如 `"nest-notes"`），而 `let` 会拓宽为通用基础类型（如 `string`）。局部变量能准确推断时不必手写冗余注解，但**函数参数、对外导出方法的返回值、延迟初始化变量以及推断过宽的数组**必须显式标注。

基础原始类型一律使用小写 `string`、`number`、`boolean`，绝不能误用 JavaScript 包装对象类型 `String`、`Number`、`Boolean`：

```ts
const username: string = 'woodfish';
const age: number = 20;
const enabled: boolean = true;
const tags: string[] = ['nestjs', 'typescript'];

let currentUserId: number; // 延迟初始化必须显式注解
currentUserId = 42;
```

**来自 `JSON.parse()`、网络请求和环境变量的外部数据，在边界处应先标注为 `unknown` 并经过运行时类型守卫收窄，绝不能放任 `any` 穿透业务逻辑。**

```ts
function isUser(value: unknown): value is { name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string'
  );
}

const raw: unknown = JSON.parse('{"name":"Ada"}');
if (isUser(raw)) {
  console.log(raw.name); // 已安全收窄为 { name: string }
}
```

在 NestJS 等后端框架中，这层运行时校验通常交给 `class-validator` + `ValidationPipe` 完成，而请求 DTO 之所以必须写成 `class` 而非 `interface`，正是因为 `class` 在编译后保留了构造函数与属性元数据供运行时验证器读取。

## 函数类型、`void` 与 `never`、元组

函数声明应标清参数和返回契约，参数解构时将类型标注写在解构花括号之后：

```ts
interface Weather {
  date: Date;
  weather: string;
}

function printWeather({ date, weather }: Weather): void {
  console.log(`${date.toISOString()}: ${weather}`);
}

function fail(message: string): never {
  throw new Error(message);
}
```

分清两个容易混淆的返回类型：`: void` 表示调用方不依赖函数返回值（函数正常执行结束，即便在 `() => void` 回调里写了 `return` 也会被忽略）；`: never` 则表示函数永远不会正常返回（必然抛出异常或陷入无限循环）。

元组用来约束固定长度且每个位置类型确定的短小序列（例如 `[statusCode, message]`）；一旦字段超过两三个或需要按名字访问，应立即改用带命名字段的 `interface` 或 `type` 对象，避免调用方靠下标猜含义。

```ts
type HttpResult = [statusCode: number, message: string];
const result: HttpResult = [200, 'ok'];
```

## `interface` 与 `type`、结构化类型

描述对象形状时，`interface` 和类型别名 `type` 大多数场景可互换，但各有适用边界：

```ts
interface Vehicle {
  readonly vin: string;
  name: string;
  year: number;
  broken?: boolean;
  summary(): string;
}

function printVehicle(vehicle: Vehicle): void {
  console.log(vehicle.summary());
}

const civic = {
  vin: '1HGBH41JXMN109186',
  name: 'Civic',
  year: 2000,
  summary() {
    return `${this.name} (${this.year})`;
  },
};

printVehicle(civic); // 满足结构即可通过，无需显式 implements
```

**TypeScript 采用结构化类型系统（Duck Typing）：只要对象拥有接口要求的全部成员及兼容类型，无需显式 `implements` 即可赋值传递。**

选型建议非常明确：需要被类 `implements`、面向插件扩展允许声明合并（Declaration Merging）的公开对象契约，优先用 `interface`；表达联合类型（`A | B`）、交叉类型（`A & B`）、元组或映射类型等复杂组合时，必须用 `type`。`readonly` 属性与可选属性 `?` 同样只在编译期生效，运行时对象依然可被外部 JS 代码修改，真需要运行期冻结需使用 `Object.freeze()`。

## `class` 面向对象、访问修饰符与继承

TypeScript 在 ES6 `class` 基础上补充了字段类型注解、构造器参数属性简写和编译期访问控制：

```ts
abstract class BaseService {
  constructor(protected readonly prefix: string) {}

  abstract getName(): string;

  public describe(target: string): string {
    return `${this.prefix}: ${target}`;
  }

  private normalize(text: string): string {
    return text.trim().toLowerCase();
  }
}

class UserService extends BaseService {
  private static instance: UserService;

  private constructor(prefix: string) {
    super(prefix);
  }

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService('users');
    }
    return UserService.instance;
  }

  getName(): string {
    return 'UserService';
  }
}
```

- `public`（默认）：类内部、子类及外部实例均可访问。
- `protected`：仅类内部与继承子类可访问，实例外部不可见。
- `private`：仅当前类内部可见（编译期检查）；若需运行时强制私有隔离，应使用 ES 原生 `#field` 私有字段。
- `static`：挂载在类构造函数本身而非实例上；`abstract` 类只能被继承而不能直接 `new`；私有构造函数配合静态 `getInstance()` 可实现单例约束。

一个类可以通过 `implements A, B` 同时实现多个接口以约束其对外公开的契约。在服务端架构（如 NestJS）中，相比深层继承链，更推荐使用组合与依赖注入复用能力。

## DOM 类型映射、三方库声明与工程集成

操作浏览器 DOM 时，`document.getElementById()` 返回宽松的 `HTMLElement | null`，访问输入框 `.value` 等专有属性前需要通过类型断言或 `instanceof HTMLInputElement` 收窄；而 `document.querySelector('input')` 则会利用内置 `HTMLElementTagNameMap` 自动精确推断为 `HTMLInputElement | null`：

```ts
const input = document.querySelector('input');
if (input) {
  console.log(input.value); // 无需强转，安全访问 value
}
```

除非能 100% 确定元素必定挂载，否则应避免随手写非空断言 `!`（如 `document.getElementById('app')!`），改用显式判空更稳妥。

在模块组织上，现代 TypeScript 项目统一使用标准 ES Module（`import` / `export`），旧版 `namespace` 与 `/// <reference path="..." />` 仅存在于历史脚本兼容或全局 `.d.ts` 声明合并中，新工程不应再使用。接入没有内置类型定义的第三方 JS 库时，优先安装社区维护的 `@types/<pkg>`（例如 `npm i -D @types/lodash`）；若不存在对应声明包，则在项目 `src/types/` 下编写 `.d.ts` 文件通过 `declare module 'pkg-name'` 补齐模块契约。配合 Webpack 等打包器构建时，可使用 `ts-loader` 或 Vite/esbuild 转译，并将 `tsc --noEmit` 独立放进 CI 类型检查步骤。

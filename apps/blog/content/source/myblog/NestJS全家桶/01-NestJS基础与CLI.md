---
title: NestJS 基础、装饰器与 CLI
date: 2026-07-13
updated: 2026-07-13
tags:
  - NestJS
  - TypeScript
  - Dependency Injection
  - Decorator
  - Nest CLI
source:
  - https://www.bilibili.com/video/BV1NG41187Bs/
bvid: BV1NG41187Bs
pages: P1-P6
draft: false
---

# NestJS 基础、装饰器与 CLI

## 1. NestJS 解决什么问题

只用 Express 写 Node.js 后端时，路由、中间件、业务逻辑和对象创建方式都由项目自己约定。项目变大后，最容易出现的问题不是“接口写不出来”，而是职责混在一起、依赖关系失控。

NestJS 在 Express 或 Fastify 之上提供了一套应用结构：

```text
Module
├─ Controller    接收 HTTP 请求
├─ Provider      提供业务能力
└─ imports       组合其他模块
```

默认 HTTP 适配器是 Express，也可以换成 Fastify。适配器负责底层 HTTP 通信，Nest 负责模块、依赖注入、装饰器、管道、守卫和拦截器等上层能力。

NestJS 的代码风格和 Angular、Spring 很接近。它不是因为使用了装饰器就天然属于 AOP；更准确地说，Guard、Interceptor、Pipe 和 Exception Filter 等机制让横切逻辑有了明确的挂载位置。

## 2. 不要在类里创建依赖

下面的 `OrderService` 自己创建了仓库：

```ts
class FileOrderRepository {
  findAll() {
    return ['order-1'];
  }
}

class OrderService {
  private readonly repository = new FileOrderRepository();

  findAll() {
    return this.repository.findAll();
  }
}
```

这段代码的问题是，`OrderService` 和文件仓库绑定死了。换数据库、写单元测试或给仓库增加构造参数时，都必须修改 Service。

把依赖移到构造函数后，Service 只声明“我需要什么”：

```ts
interface OrderRepository {
  findAll(): string[];
}

class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
```

这里包含两个相关概念：

- 控制反转（IoC）：对象创建和依赖组装的控制权从业务类移到外部容器。
- 依赖注入（DI）：容器把已经创建好的依赖传给消费方，构造函数注入是最常见的方式。

Nest 的 DI 容器会根据模块中的 Provider 注册和构造函数参数建立依赖图。业务类不用手写 `new`，但依赖并没有消失，只是由容器统一管理。

## 3. Nest 中的依赖注入

最小的 Service：

```ts
// app.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return 'Hello Nest';
  }
}
```

Controller 通过构造函数声明依赖：

```ts
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }
}
```

最后在 Module 中完成注册：

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Nest 启动时会创建 `AppService`，再把实例传给 `AppController`。`private readonly appService: AppService` 同时完成参数声明、私有字段声明和赋值。

如果出现 `Nest can't resolve dependencies`，先检查三件事：

1. 依赖类是否使用 `@Injectable()`。
2. 依赖是否注册在当前模块的 `providers` 中。
3. 跨模块使用时，源模块是否导出 Provider，目标模块是否导入源模块。

## 4. TypeScript 装饰器

Nest 大量使用装饰器声明模块、路由和注入信息。旧版装饰器语义下需要在 `tsconfig.json` 中启用：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`experimentalDecorators` 允许使用装饰器语法，`emitDecoratorMetadata` 会为部分被装饰的声明生成运行时类型元数据。它不会把整个 TypeScript 类型系统保留到运行时。

### 4.1 类装饰器

类装饰器接收构造函数：

```ts
function MarkController(target: Function) {
  Reflect.defineProperty(target.prototype, 'role', {
    value: 'controller',
    writable: false,
  });
}

@MarkController
class UserController {}
```

装饰器可以读取或修改类，但应避免随意改写原型。Nest 自己更常见的做法是记录元数据，再由框架启动过程统一读取。

### 4.2 属性装饰器

```ts
function LogProperty(target: object, propertyKey: string | symbol) {
  console.log(target, propertyKey);
}

class User {
  @LogProperty
  name = 'Tom';
}
```

实例属性的装饰器通常拿到类的原型和属性名，并不会直接拿到每个实例的最终属性值。

### 4.3 方法装饰器

```ts
function LogMethod(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) {
  const original = descriptor.value as (...args: unknown[]) => unknown;

  descriptor.value = function (...args: unknown[]) {
    console.log(String(propertyKey), args);
    return original.apply(this, args);
  };
}

class UserService {
  @LogMethod
  findOne(id: string) {
    return { id };
  }
}
```

方法装饰器可以通过 `descriptor.value` 取得原方法。包裹原方法时要保留 `this` 和参数，否则实例方法容易在运行时出错。

### 4.4 参数装饰器

```ts
function LogParameter(
  target: object,
  propertyKey: string | symbol | undefined,
  parameterIndex: number,
) {
  console.log(target, propertyKey, parameterIndex);
}

class UserService {
  findOne(@LogParameter id: string) {
    return { id };
  }
}
```

参数装饰器拿到的是参数索引，不会自动得到调用时的参数值。Nest 的 `@Body()`、`@Param()` 等参数装饰器会先记录元数据，真正注入请求数据的是框架的请求处理流程。

## 5. 装饰器工厂

直接使用装饰器时，参数由运行时协议决定。需要让调用方传入路径等配置时，再包一层函数：

```ts
function Get(path: string): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('route:method', 'GET', target, propertyKey);
    Reflect.defineMetadata('route:path', path, target, propertyKey);
  };
}

class UserController {
  @Get('/users')
  findAll() {
    return [];
  }
}
```

外层函数接收业务配置，内层函数才是实际装饰器。Nest 的 `@Controller('users')`、`@Get(':id')` 等 API 都采用这种调用形式。

这里容易混淆两件事：装饰器通常负责声明元数据，HTTP 请求不应该在装饰器执行阶段直接发出。类定义加载时装饰器就可能运行，而不是等到某次请求到达时才运行。

## 6. 用 CLI 创建项目

可以全局安装 CLI：

```bash
npm install -g @nestjs/cli
nest new nest-demo
```

也可以避免全局安装，直接运行当前版本：

```bash
npx @nestjs/cli new nest-demo
```

创建时可选择 npm、pnpm 或 yarn。进入项目后启动开发服务器：

```bash
cd nest-demo
npm run start:dev
```

默认项目的关键文件：

```text
src/
├─ main.ts              应用启动入口
├─ app.module.ts        根模块
├─ app.controller.ts    HTTP 路由
└─ app.service.ts       业务逻辑
test/                   端到端测试
```

`main.ts` 从根模块创建应用：

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
```

请求 `GET /` 时，Nest 根据装饰器元数据找到 Controller 方法。Controller 再调用 Service，方法返回值由 HTTP 适配器写入响应。

## 7. 常用生成命令

先查看 CLI 支持的生成器：

```bash
nest generate --help
```

生成模块、控制器和服务：

```bash
nest generate module users
nest generate controller users
nest generate service users
```

常用缩写：

```bash
nest g mo users
nest g co users
nest g s users
```

生成器会尝试找到最近的 Module 并更新注册信息。自动修改后仍要检查 `imports`、`controllers` 和 `providers`，不要把“文件生成成功”当成依赖关系一定正确。

## 8. 一次生成 CRUD 资源

资源生成器可以一次创建 Module、Controller、Service、DTO 和实体骨架：

```bash
nest generate resource users
```

选择 REST API 并生成 CRUD 入口后，通常会得到：

```text
users/
├─ dto/
│  ├─ create-user.dto.ts
│  └─ update-user.dto.ts
├─ entities/
│  └─ user.entity.ts
├─ users.controller.ts
├─ users.service.ts
└─ users.module.ts
```

对应路由通常包括：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/users` | 创建用户 |
| `GET` | `/users` | 查询用户列表 |
| `GET` | `/users/:id` | 查询单个用户 |
| `PATCH` | `/users/:id` | 部分更新用户 |
| `DELETE` | `/users/:id` | 删除用户 |

生成的是结构，不是可直接上线的业务实现。DTO 校验、数据库访问、权限检查、异常处理和测试仍需补齐。

## 9. 常见问题

### 9.1 修改路由后一直 404

最终路径由 Controller 前缀和方法路径拼接：

```ts
@Controller('users')
class UsersController {
  @Get('active')
  findActive() {}
}
```

对应 `GET /users/active`。同时检查 Controller 是否已注册到 Module，以及当前请求端口是否正确。

### 9.2 Service 写了却无法注入

`@Injectable()` 只让类具备被容器管理的条件，还必须把它注册为 Provider。跨模块调用时不能只写 TypeScript `import`，还要处理 Nest 模块的导出和导入。

### 9.3 把业务逻辑全部写进 Controller

Controller 应负责 HTTP 输入输出，复用逻辑放入 Service。否则同一逻辑被多个路由调用时只能复制，单元测试也会被 HTTP 细节拖住。

### 9.4 误以为类型注解能在运行时校验数据

```ts
create(body: CreateUserDto) {}
```

只有类型注解时，外部请求仍可传入任意 JSON。运行时校验需要 `ValidationPipe` 和 `class-validator` 等机制。

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

只用 Express 写 Node.js 后端，路由、中间件、业务逻辑和对象怎么创建，全靠项目自己约定。项目一大，麻烦往往不在接口写不出来，而在职责混在一起、依赖关系失控。

NestJS 在 Express 或 Fastify 之上加了一套应用结构：

```text
Module
├─ Controller    接收 HTTP 请求
├─ Provider      提供业务能力
└─ imports       组合其他模块
```

默认的 HTTP 适配器是 Express，也能换成 Fastify。适配器管底层 HTTP 通信，Nest 管模块、依赖注入、装饰器、管道、守卫、拦截器这些上层能力。

代码风格和 Angular、Spring 很像。装饰器本身不算 AOP；Nest 里跟横切逻辑有关的是 Guard、Interceptor、Pipe 和 Exception Filter，它们给这类逻辑留了固定的挂载位置。

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

问题在于 `OrderService` 和文件仓库绑死了。换数据库、写单元测试、给仓库加构造参数，都得改 Service。

把依赖挪到构造函数，Service 只声明自己需要什么：

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

这里有两个相关概念：

- 控制反转（IoC）：创建对象、组装依赖的控制权从业务类挪到外部容器。
- 依赖注入（DI）：容器把建好的依赖传给使用方，最常见的是构造函数注入。

Nest 的 DI 容器根据模块里注册的 Provider 和构造函数参数建立依赖图。业务类不用手写 `new`，依赖还在，只是交给容器统一管。

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

Controller 在构造函数里声明依赖：

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

最后在 Module 里注册：

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

Nest 启动时先创建 `AppService`，再把实例传给 `AppController`。`private readonly appService: AppService` 一行同时完成了参数声明、私有字段声明和赋值。

报 `Nest can't resolve dependencies` 时，先查三件事：

1. 依赖类有没有加 `@Injectable()`。
2. 依赖有没有注册在当前模块的 `providers` 里。
3. 跨模块用的话，源模块有没有导出这个 Provider，目标模块有没有导入源模块。

## 4. TypeScript 装饰器

Nest 到处用装饰器声明模块、路由和注入信息。旧版装饰器语义要在 `tsconfig.json` 里打开：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`experimentalDecorators` 允许装饰器语法；`emitDecoratorMetadata` 给部分被装饰的声明生成运行时类型元数据，并不会把整个 TypeScript 类型系统留到运行时。

### 4.1 类装饰器

类装饰器拿到的是构造函数：

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

装饰器能读也能改类，但别随便改原型。Nest 自己更常见的做法是记录元数据，等框架启动时统一读取。

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

实例属性的装饰器一般拿到的是类的原型和属性名，拿不到每个实例最终的属性值。

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

方法装饰器通过 `descriptor.value` 拿到原方法。包一层的时候要保留 `this` 和参数，不然实例方法运行时容易出错。

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

参数装饰器拿到的是参数的索引，拿不到调用时传的值。Nest 的 `@Body()`、`@Param()` 这些也是先记元数据，真正把请求数据注进去的是框架的请求处理流程。

## 5. 装饰器工厂

直接用装饰器时，参数由运行时协议决定。想让调用方传路径之类的配置，就再包一层函数：

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

外层函数接业务配置，里层函数才是真正的装饰器。Nest 的 `@Controller('users')`、`@Get(':id')` 都是这种写法。

容易搞混的一点：装饰器一般只负责声明元数据，别在装饰器执行时直接发 HTTP 请求。类定义一加载，装饰器就可能执行了，不是等某个请求到了才执行。

## 6. 用 CLI 创建项目

可以全局装 CLI：

```bash
npm install -g @nestjs/cli
nest new nest-demo
```

也可以不全局装，直接跑当前版本：

```bash
npx @nestjs/cli new nest-demo
```

创建时能选 npm、pnpm 或 yarn。进项目后启动开发服务器：

```bash
cd nest-demo
npm run start:dev
```

默认项目里关键的几个文件：

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

请求 `GET /` 时，Nest 按装饰器元数据找到对应的 Controller 方法，Controller 调 Service，方法的返回值由 HTTP 适配器写进响应。

## 7. 常用生成命令

先看看 CLI 支持哪些生成器：

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

生成器会去找最近的 Module 并更新注册信息。自动改完还是要看一眼 `imports`、`controllers` 和 `providers`，文件生成成功了，依赖关系不一定对。

## 8. 一次生成 CRUD 资源

资源生成器能一次建好 Module、Controller、Service、DTO 和实体骨架：

```bash
nest generate resource users
```

选 REST API 并生成 CRUD 入口后，一般会得到：

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

对应的路由一般有：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/users` | 创建用户 |
| `GET` | `/users` | 查询用户列表 |
| `GET` | `/users/:id` | 查询单个用户 |
| `PATCH` | `/users/:id` | 部分更新用户 |
| `DELETE` | `/users/:id` | 删除用户 |

生成的只是结构，离能上线还远。DTO 校验、数据库访问、权限检查、异常处理和测试都还得自己补。

## 9. 常见问题

### 9.1 修改路由后一直 404

最终路径是 Controller 前缀加方法路径：

```ts
@Controller('users')
class UsersController {
  @Get('active')
  findActive() {}
}
```

对应 `GET /users/active`。另外看看 Controller 有没有注册到 Module，请求的端口对不对。

### 9.2 Service 写了却无法注入

`@Injectable()` 只是让类能被容器管理，还得把它注册成 Provider。跨模块调用光写 TypeScript 的 `import` 不够，还要处理 Nest 模块的导出和导入。

### 9.3 把业务逻辑全部写进 Controller

Controller 管 HTTP 的输入输出，能复用的逻辑放进 Service。不然多个路由要用同一段逻辑只能复制，单元测试也会被 HTTP 细节拖累。

### 9.4 误以为类型注解能在运行时校验数据

```ts
create(body: CreateUserDto) {}
```

只有类型注解的话，外部请求照样能传任意 JSON。运行时校验要靠 `ValidationPipe` 和 `class-validator` 这类机制。

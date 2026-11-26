---
title: NestJS 核心架构：模块边界、IoC/DI 容器与 TypeScript 装饰器
slug: nestjs-architecture-di-and-decorators
date: 2026-07-13
categories:
  - 后端开发
tags:
  - NestJS
  - 依赖注入
  - TypeScript
  - 装饰器
  - 模块化
---

Express 或 Fastify 在项目规模扩大后，真正让人头疼的往往是各层代码互相直接 `new` 依赖、模块边界模糊、测试替身无从切入。NestJS 在底层 HTTP 适配器（默认 Express，可切换 Fastify）之上提供了一套强约束的应用结构：用 Module 划定功能边界与可见性，用 IoC/DI 容器托管对象创建与生命周期，用 TypeScript 装饰器与反射元数据声明路由和注入点。

## 分层链路与核心依赖组成

NestJS 将单次 HTTP 请求拆成职责单一的处理链路，Controller 只管 HTTP 协议边界，业务编排进 Service，持久化封装进 Repository：

```text
HTTP Request
    ↓
Middleware        原始请求预处理、Cookie、请求 ID
    ↓
Guard             身份认证与权限元数据校验
    ↓
Interceptor       进入控制器前后的横切增强（日志、响应包装）
    ↓
Pipe              参数类型转换与 DTO 运行时校验
    ↓
Controller        匹配路由、读取输入、返回结果或领域映射
    ↓
Service           执行业务规则与事务编排
    ↓
Repository        读写数据库或外部存储
```

手动搭建最小 NestJS 应用至少依赖五个核心包：`@nestjs/core` 提供 `NestFactory` 启动逻辑，`@nestjs/common` 提供 `Module`、`Controller`、`Injectable` 与各类装饰器，`@nestjs/platform-express` 对接底层 Express 实例，`reflect-metadata` 让运行时能够读取装饰器元数据，`typescript` 负责将代码编译为目标 JavaScript。

入口文件 `main.ts` 从根模块启动应用：

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
```

`NestFactory.create(AppModule)` 会以根模块为起点递归扫描全部导入模块，实例化 Provider 并构建依赖图，再将所有 Controller 方法注册到底层 HTTP 路由表。

## 控制反转（IoC）与 DI 容器机制

如果在业务类内部直接实例化下游依赖，`OrderService` 就被彻底锁死在具体实现上，换数据库或写单元测试时必须改动业务源码：

```ts
// 紧耦合：创建权与使用权混在一起
class OrderService {
  private readonly repository = new FileOrderRepository();
}

// 控制反转：只通过构造函数声明契约
class OrderService {
  constructor(private readonly repository: OrderRepository) {}
}
```

**控制反转（IoC）把依赖的实例化控制权从业务类移交给外部容器，依赖注入（DI）则由容器在启动阶段自动解析并注入所需实例。**

在 NestJS 中启用标准构造函数注入需要同时满足三个条件：

1. 被注入的服务类必须标注 `@Injectable()`。
2. 该服务必须登记在当前模块的 `providers` 中，或由某个已导入的模块在 `exports` 中显式导出。
3. 使用方在构造函数参数里声明对应的类或注入 Token。

```ts
// messages/messages.service.ts
import { Injectable } from '@nestjs/common';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  constructor(private readonly repository: MessagesRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
```

```ts
// messages/messages.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll() {
    return this.messagesService.findAll();
  }
}
```

TypeScript 参数属性语法 `constructor(private readonly messagesService: MessagesService)` 在一行内同时完成参数声明、私有只读属性定义与自动赋值。注意 Controller 应当注册在模块的 `controllers` 数组中，切勿重复塞进 `providers`。

## Provider 注册方式、自定义 Token 与作用域

TypeScript 的 `interface` 在编译成 JavaScript 后会被完全擦除，DI 容器无法在运行时拿接口当依赖键。需要面向接口编程并按环境切换实现（例如测试用内存库、生产用 TypeORM）时，必须配合导出 `Symbol` Token 与 `@Inject()`：

```ts
// messages/message-store.ts
export const MESSAGE_STORE = Symbol('MESSAGE_STORE');

export interface MessageStore {
  findAll(): Promise<Message[]>;
}
```

```ts
// messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MESSAGE_STORE } from './message-store';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
  providers: [
    MessagesService,
    {
      provide: MESSAGE_STORE,
      useClass:
        process.env.NODE_ENV === 'test'
          ? InMemoryMessagesRepository
          : MessagesRepository,
    },
  ],
})
export class MessagesModule {}
```

```ts
// messages/messages.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { MESSAGE_STORE, MessageStore } from './message-store';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(MESSAGE_STORE)
    private readonly store: MessageStore,
  ) {}
}
```

除简写类名外，NestJS 支持四种完整的 Provider 注册形式：

| 注册字段 | 语义与适用场景 | 注意事项 |
| --- | --- | --- |
| `useClass` | 由容器实例化指定类，适合按环境切换实现类 | 目标类需标注 `@Injectable()` |
| `useValue` | 直接注入静态配置对象或测试 Mock 替身 | 模块加载时已求值，不适合异步初始化 |
| `useFactory` | 通过工厂函数动态构建依赖，支持注入前置 Provider 与返回 Promise | 工厂中的慢网络请求会直接拖慢应用启动 |
| `useExisting` | 为容器中已有的 Provider 创建别名，复用同一实例 | 不会新建第二个实例 |

```ts
{
  provide: 'DATABASE_OPTIONS',
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => ({
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
  }),
}
```

**NestJS 的 Provider 默认属于应用级单例，绝不能在 Service 实例属性上保存 `currentUser` 等单次请求状态，否则并发请求会互相覆盖数据。**

确有需要时可以通过 `@Injectable({ scope: Scope.REQUEST })` 或 `Scope.TRANSIENT` 改变生命周期，但请求作用域会顺着依赖链把上游消费者全部传染为每次请求重新实例化，带来额外的内存分配开销；绝大多数场景应保持默认单例，将请求上下文作为方法参数传递。

## Module 可见性、动态模块与循环依赖

Provider 的可见性默认被限制在声明它的模块内部。源码顶部写了 TypeScript 的 `import { PowerService } ...` 只解决编译期类型引用，改变不了运行时 DI 容器的模块隔离。

跨模块共享能力遵循固定的三步结构：源模块在 `exports` 中暴露，使用方在 `imports` 中引入源模块，最后在构造函数中注入：

```ts
// power/power.module.ts
@Module({
  providers: [PowerService],
  exports: [PowerService],
})
export class PowerModule {}

// cpu/cpu.module.ts
@Module({
  imports: [PowerModule],
  providers: [CpuService],
  exports: [CpuService],
})
export class CpuModule {}

// computer/computer.module.ts
@Module({
  imports: [CpuModule, DiskModule],
  controllers: [ComputerController],
})
export class ComputerModule {}
```

`ComputerModule` 只需导入 `CpuModule` 和 `DiskModule`，无需越级导入 `PowerModule`；同时切忌为了消除注入报错而在多个业务模块里重复登记 `providers: [PowerService]`，那会导致容器创建出互不相同的多个实例。

对于日志、配置等真正全应用通用的基础设施，可以加上 `@Global()` 装饰器标记为全局模块，避免每个业务模块重复 `imports`——但全局模块仍需在根模块 `AppModule` 导入一次，且不可滥用到普通业务模块上。需要从外部接收配置参数的复用模块，则通过静态方法返回 `DynamicModule`（习惯上 `forRoot()` 负责全局根配置，`forFeature()` 负责功能模块局部注册）：

```ts
@Module({})
export class StorageModule {
  static forRoot(options: { basePath: string }): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        { provide: STORAGE_OPTIONS, useValue: options },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
```

当两个模块或两个 Service 相互引用形成环时，Nest 启动阶段会报依赖解析失败。虽然可用 `forwardRef(() => TargetModule)` 延后求值打破环，但更健康的架构解法是下沉共享能力到第三个独立模块，或通过事件解耦，尽量从设计上消灭双向依赖。

## TypeScript 装饰器与元数据反射原理

NestJS 的路由匹配、参数注入和 DTO 校验全部依赖 TypeScript 传统实验性装饰器与元数据反射，必须在 `tsconfig.json` 中显式开启：

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`experimentalDecorators` 启用装饰器语法，`emitDecoratorMetadata` 让编译器在编译时把部分类构造函数、方法参数类型通过 `Reflect.defineMetadata` 写入 `design:paramtypes` 等元数据键中。不同位置的装饰器在类定义加载阶段（而非请求到达时）即被求值：

- **类装饰器**：接收构造函数 `target`，常用于挂载模块、控制器或守卫元数据。
- **方法装饰器**：接收 `(target, propertyKey, descriptor)`，可通过包装 `descriptor.value`（注意保留 `this` 与参数）增强方法，或用装饰器工厂绑定路由元数据：

```ts
function Get(path: string): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('route:method', 'GET', target, propertyKey);
    Reflect.defineMetadata('route:path', path, target, propertyKey);
  };
}
```

- **属性装饰器与参数装饰器**：实例属性装饰器只能拿到原型和属性名，参数装饰器只拿到参数索引（如 `@Body()`、`@Param()` 所在位置），两者在装饰器执行期都拿不到运行时请求数据，而是先写元数据，等请求进入 Nest 管线时再按索引注入真实值。

**`emitDecoratorMetadata` 只会对带装饰器的类与参数保留有限的构造函数引用，并不会把整个 TypeScript 类型系统保留到运行时——这也是请求 DTO 必须写成 `class` 而非 `interface` 的根本原因。**

如果控制器参数只写了 `interface CreateUserDto` 或普通类型别名，`design:paramtypes` 里只会记录为 `Object`，`ValidationPipe` 与 `class-transformer` 无从实例化校验对象，客户端传任意 JSON 都能直接穿透进控制器。

## Nest CLI 脚手架与依赖解析排障

日常开发使用 `@nestjs/cli` 生成骨架文件能够自动保持“功能名 + 角色”（如 `users.module.ts`、`users.controller.ts`）的命名约定并自动更新模块注册：

```bash
npx @nestjs/cli new my-service
nest g module users
nest g controller users/users --flat
nest g service users/users --flat
nest g resource posts   # 一次性生成 Module/Controller/Service/DTO/Entity
```

自动生成的 CRUD 骨架仍需手动补齐 DTO 校验规则、持久化与异常映射。

遇到最常见的启动错误 `Nest can't resolve dependencies of the XService (?)` 时，按索引提示位置依次核对以下五项：

1. 目标依赖类是否遗漏 `@Injectable()`。
2. 该依赖是否注册在某个模块的 `providers` 中（切勿误写入 `imports`）。
3. 若跨越模块边界，源模块是否在 `exports` 导出该 Provider，且当前模块已在 `imports` 引入源模块。
4. 构造函数参数使用的是否是运行时真实存在的类、字符串或 Symbol Token，而不是编译后消失的 `interface`。
5. 两个文件之间是否存在未处理的循环引用导致导入时某一方尚未完成求值（此时打印日志常看到依赖参数为 `undefined`）。

---
title: Service、模块边界与依赖注入
date: 2026-07-12
updated: 2026-07-12
tags:
  - NestJS
  - Service
  - Repository
  - Dependency Injection
  - Module
source:
  - https://www.bilibili.com/video/BV1D9MezXExs/
bvid: BV1D9MezXExs
pages: P19-P38
draft: false
---

# Service、模块边界与依赖注入

## 1. Controller、Service 与 Repository

消息 API 分三层：

```text
MessagesController
    ↓ 处理 HTTP 路由、参数和状态码
MessagesService
    ↓ 编排业务规则
MessagesRepository
    ↓ 读取和写入存储介质
messages.json / Database
```

### Controller

Controller 读 HTTP 参数、返回状态码，不碰 JSON 文件。

### Service

Service 提供创建消息、组合数据源、检查业务约束这些用例。哪怕 `findAll()`、`findOne()`、`create()` 现在只是转调 Repository，以后加权限、事务或换存储，Controller 也不用知道。

### Repository

Repository 封装持久化细节。示例用 JSON 文件；真实项目一般由 TypeORM、Prisma、Mongoose 这类工具提供存储抽象。

Service 和 Repository 可以有同名方法，但职责不一样。

## 2. JSON 文件 Repository

示例用 `Record<string, Message>` 存数据，通过 Node.js 的 Promise 文件 API 读写；文件不存在时初始化成空对象。

```ts
// messages/messages.repository.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Message {
  id: string;
  content: string;
}

type MessageTable = Record<string, Message>;

@Injectable()
export class MessagesRepository {
  private readonly filePath = join(process.cwd(), 'messages.json');

  private async readTable(): Promise<MessageTable> {
    try {
      const json = await readFile(this.filePath, 'utf8');
      return JSON.parse(json) as MessageTable;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== 'ENOENT') {
        throw error;
      }

      await writeFile(this.filePath, '{}', 'utf8');
      return {};
    }
  }

  async findAll(): Promise<Message[]> {
    return Object.values(await this.readTable());
  }

  async findOne(id: string): Promise<Message | undefined> {
    const table = await this.readTable();
    return table[id];
  }

  async create(content: string): Promise<Message> {
    const table = await this.readTable();
    const message: Message = { id: randomUUID(), content };

    table[message.id] = message;
    await writeFile(this.filePath, JSON.stringify(table, null, 2), 'utf8');

    return message;
  }
}
```

这段代码不能直接上生产。两个并发请求可能同时读到旧文件，再各自覆盖写入，数据就丢了；文件变大后，全量解析和写回也会越来越慢。

## 3. MessagesService

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

  findOne(id: string) {
    return this.repository.findOne(id);
  }

  create(content: string) {
    return this.repository.create(content);
  }
}
```

Service 现在只转调 Repository。以后加权限、去重、事务或多个数据源，Controller 还是只依赖这组业务接口。

Controller 只调 Service：

```ts
// messages/messages.controller.ts
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll() {
    return this.messagesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const message = await this.messagesService.findOne(id);

    if (!message) {
      throw new NotFoundException(`Message ${id} was not found`);
    }

    return message;
  }

  @Post()
  create(@Body() body: CreateMessageDto) {
    return this.messagesService.create(body.content);
  }
}
```

Nest 会把 `NotFoundException` 转成 404 响应。其他内置的 HTTP 异常还有 `BadRequestException`、`UnauthorizedException` 和 `ForbiddenException`。出错了就别再返回 200。

HTTP 异常可以直接在 Controller 里抛。业务复杂了，也可以让 Service 抛领域异常，再由异常过滤器映射成 HTTP 错误。

## 4. 控制反转

让类在内部创建依赖，会把具体实现锁死：

```ts
class MessagesService {
  private readonly repository = new MessagesRepository();
}

class MessagesController {
  private readonly service = new MessagesService();
}
```

结果是：

- `MessagesService` 永远只能用这个文件 Repository。
- 测 Service 时会真的读写磁盘，很难换成内存实现。
- Repository 再加依赖，创建链就散到各个上层类里。
- 生命周期不归框架管，好几个地方可能重复创建实例。

控制反转（Inversion of Control）把依赖的创建挪到类外面：

```ts
class MessagesService {
  constructor(private readonly repository: MessagesRepository) {}
}
```

这样"用依赖"和"建依赖"已经分开了。但要是全靠手动组装，创建 Controller 还得写：

```ts
const repository = new MessagesRepository();
const service = new MessagesService(repository);
const controller = new MessagesController(service);
```

依赖层级越深，手动组装的代码越多。Nest 的依赖注入系统就是来干这活的。

## 5. Nest DI 容器

依赖注入（Dependency Injection）建立在控制反转之上。启动时 Nest 收集 Provider，分析构造函数，建立依赖图。

```text
MessagesController
        ↓ needs
MessagesService
        ↓ needs
MessagesRepository
```

Nest 先建 Repository，再用它建 Service，最后把 Service 传给 `MessagesController`。调用方只声明依赖，不管 `new`。

这个消息模块的注册代码：

```ts
// messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
```

构造函数注入要满足：

1. 被注入的类用了 `@Injectable()`。
2. 类登记在某个模块的 `providers` 里，或者由这个模块导入的其他模块提供。
3. 使用方在构造函数里声明依赖。

`providers` 登记的是模块能提供的对象。Controller 放在 `controllers` 里，不用再放一遍 `providers`。

## 6. 类 Token 与自定义 Token

Service 也可以依赖接口：

```ts
interface MessageStore {
  findAll(): Promise<Message[]>;
  findOne(id: string): Promise<Message | undefined>;
  create(content: string): Promise<Message>;
}
```

TypeScript 的 interface 编译后就没了，DI 容器没法直接拿它当 Provider token。最短的写法是用类做 token：

```ts
constructor(private readonly repository: MessagesRepository) {}
```

要按接口替换实现的话，可以显式定义 token：

```ts
// message-store.ts
export const MESSAGE_STORE = Symbol('MESSAGE_STORE');

export interface MessageStore {
  findAll(): Promise<Message[]>;
  findOne(id: string): Promise<Message | undefined>;
  create(content: string): Promise<Message>;
}
```

```ts
// messages.module.ts
@Module({
  providers: [
    MessagesService,
    {
      provide: MESSAGE_STORE,
      useClass: MessagesRepository,
    },
  ],
})
export class MessagesModule {}
```

```ts
// messages.service.ts
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

测试时把 token 绑到内存仓库，生产环境再绑到数据库仓库。类注入写起来短，显式 token 换起来方便。

## 7. Provider 作用域

默认作用域下，同一个应用上下文里的 Provider 一般只建一次，之后的注入都复用这个实例。

```ts
constructor(
  first: MessagesService,
  second: MessagesService,
) {
  console.log(first === second); // true
}
```

默认是单例，所以 Service 的实例字段里别存请求状态，不然并发请求会互相污染。请求数据放在方法参数、请求作用域 Provider 或外部存储里。

Nest 也支持 request scope 和 transient scope，但它们会改变实例数量和性能开销。没有明确需求就先用默认作用域。

## 8. Module 可见性

Provider 默认只在声明它的模块里可见。TypeScript 能 `import` 某个 Service，Nest 的 DI 上下文不一定解析得了它。

下面用 Power、CPU、Disk 和 Computer 表示模块关系：

```text
ComputerModule
    ├─ imports CpuModule
    └─ imports DiskModule

CpuModule  ─┐
            ├─ imports PowerModule
DiskModule ─┘
```

### 8.1 导出 Provider

```ts
// power/power.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class PowerService {
  supplyPower(watts: number) {
    return `supplying ${watts} watts`;
  }
}
```

```ts
// power/power.module.ts
import { Module } from '@nestjs/common';
import { PowerService } from './power.service';

@Module({
  providers: [PowerService],
  exports: [PowerService],
})
export class PowerModule {}
```

`providers` 表示在本模块里创建和管理 `PowerService`，`exports` 表示导入本模块的其他模块可以用它。

### 8.2 导入模块

```ts
// cpu/cpu.service.ts
import { Injectable } from '@nestjs/common';
import { PowerService } from '../power/power.service';

@Injectable()
export class CpuService {
  constructor(private readonly power: PowerService) {}

  compute(a: number, b: number) {
    this.power.supplyPower(10);
    return a + b;
  }
}
```

```ts
// cpu/cpu.module.ts
import { Module } from '@nestjs/common';
import { PowerModule } from '../power/power.module';
import { CpuService } from './cpu.service';

@Module({
  imports: [PowerModule],
  providers: [CpuService],
  exports: [CpuService],
})
export class CpuModule {}
```

Disk 模块也是这个结构：导入 `PowerModule`，在 `DiskService` 构造函数里注入 `PowerService`，再把 `DiskService` 导出去。

```ts
// disk/disk.service.ts
import { Injectable } from '@nestjs/common';
import { PowerService } from '../power/power.service';

@Injectable()
export class DiskService {
  constructor(private readonly power: PowerService) {}

  getData() {
    this.power.supplyPower(20);
    return 'data';
  }
}
```

```ts
// disk/disk.module.ts
@Module({
  imports: [PowerModule],
  providers: [DiskService],
  exports: [DiskService],
})
export class DiskModule {}
```

### 8.3 组合模块

```ts
// computer/computer.module.ts
import { Module } from '@nestjs/common';
import { CpuModule } from '../cpu/cpu.module';
import { DiskModule } from '../disk/disk.module';
import { ComputerController } from './computer.controller';

@Module({
  imports: [CpuModule, DiskModule],
  controllers: [ComputerController],
})
export class ComputerModule {}
```

```ts
// computer/computer.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CpuService } from '../cpu/cpu.service';
import { DiskService } from '../disk/disk.service';

@Controller('computer')
export class ComputerController {
  constructor(
    private readonly cpu: CpuService,
    private readonly disk: DiskService,
  ) {}

  @Get()
  run() {
    return {
      result: this.cpu.compute(1, 2),
      data: this.disk.getData(),
    };
  }
}
```

跨模块共享记三个动作：源模块 `exports` Provider，目标模块 `imports` 源模块，使用的类在构造函数里注入。少一个都可能报 `Nest can't resolve dependencies`。

`ComputerModule` 不用再导入 `PowerModule`。CPU 和 Disk 已经在各自的模块里解决了电源依赖，顶层只用它们导出的能力。

## 9. 按资源拆分模块

二手车估价 API 有这些端点：

| 方法与路径 | 作用 |
| --- | --- |
| `POST /auth/signup` | 注册用户 |
| `POST /auth/signin` | 用户登录 |
| `GET /reports?...` | 按车型、年份、里程和位置估价 |
| `POST /reports` | 上报真实成交数据 |
| `PATCH /reports/:id` | 管理员审核报告 |

认证和用户数据放进 `UsersModule`，估价和成交记录放进 `ReportsModule`。重复的结构可以用 CLI 生成：

```bash
nest g module users
nest g controller users
nest g service users

nest g module reports
nest g controller reports
nest g service reports
```

Repository 往往跟具体的存储技术有关，可以等数据库方案定了再手动建。

模块按业务能力划分，不一定非得是 Controller、Service、Repository 三件套。认证可以单独成一个 `AuthModule`，一个 Service 也可以依赖多个 Repository。

## 10. 常见问题

### 10.1 `Nest can't resolve dependencies`

错误信息一般会给出解析不了的类和构造函数参数的索引。顺着依赖链往下查：

1. 目标类有没有 `@Injectable()`。
2. Provider 有没有出现在某个模块的 `providers` 里。
3. Provider 来自别的模块的话，源模块有没有 `exports` 它。
4. 当前模块有没有在 `imports` 里导入源模块。
5. 构造函数用的 token 是不是运行时真的存在的类、字符串或 Symbol。

别只补一句 TypeScript 的 `import`，那只解决源码引用，解决不了 DI 可见性。

### 10.2 把 Service 直接放进 `imports`

`imports` 收的是模块，普通 Service 放 `providers`。跨模块用 Service 时，导入的是提供它的那个模块。

### 10.3 为了消除报错，到处重复注册同一个 Provider

在好几个模块里重复注册 `PowerService`，可能会建出好几个独立的实例。应该由一个模块提供并导出，其他模块导入它。

### 10.4 interface 无法自动注入

interface 编译后不存在。构造函数参数只写了接口类型的话，Nest 找不到运行时的 token。用类做 token，或者配合 `@Inject()` 和显式 token。

### 10.5 JSON Repository 偶发报错

先确认文件路径是相对哪个工作目录、文件是不是合法的 JSON、编码是不是 UTF-8。只在并发写入时出错的话，问题不在 `JSON.parse`，而在读改写缺少并发控制，要换数据库，或者加上可靠的锁和原子写策略。

### 10.6 Service 中保存请求状态

默认的 Provider 会被复用。把 `currentUser`、临时请求参数这些写进实例字段，下一次请求就可能覆盖上一次的数据。尽量把这些值当方法参数传。

### 10.7 找不到数据却返回 200

Repository 返回 `undefined` 只是存储层的结果，HTTP 层还得把它映射成合适的错误。用 `NotFoundException`，或者建一套统一的领域异常到 HTTP 异常的映射。

## 11. 模块边界检查

1. `MessagesController` 里没有 `new MessagesService()`。
2. `MessagesService` 里没有 `new MessagesRepository()`。
3. `MessagesModule` 能独立提供消息功能。
4. `PowerService` 只由 `PowerModule` 提供，CPU 和 Disk 通过导入模块拿到它。
5. `ComputerModule` 不需要知道 Power 的实现细节。
6. 请求不存在的消息时返回 404，不是 200 加空值。

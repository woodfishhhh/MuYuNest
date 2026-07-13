---
title: Service、模块边界与依赖注入
date: 2026-07-12
updated: 2026-07-12
slug: nestjs-services-modules-di
type: Notes
categories:
  - 后端开发
  - NestJS
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

消息 API 分成三层：

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

Controller 读取 HTTP 参数并返回状态码，不处理 JSON 文件。

### Service

Service 提供创建消息、组合数据源、检查业务约束等用例。即使 `findAll()`、`findOne()`、`create()` 暂时只转调 Repository，Controller 也无需感知后续加入的权限、事务或存储变化。

### Repository

Repository 封装持久化细节。示例使用 JSON 文件；真实项目通常由 TypeORM、Prisma、Mongoose 等工具提供存储抽象。

Service 和 Repository 可以有同名方法，但职责不同。

## 2. JSON 文件 Repository

示例使用 `Record<string, Message>` 保存数据，通过 Node.js Promise 文件 API 读写；文件不存在时初始化为空对象。

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

这段代码不能直接用于生产环境。两个并发请求可能同时读到旧文件，再分别覆盖写入，导致数据丢失；文件变大后，全量解析和写回也会越来越慢。

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

Service 目前只转调 Repository。增加权限、去重、事务或多个数据源时，Controller 仍然只依赖这组业务接口。

Controller 只调用 Service：

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

Nest 会把 `NotFoundException` 转成 404 响应。其他内置 HTTP 异常包括 `BadRequestException`、`UnauthorizedException` 和 `ForbiddenException`。错误对象不应继续返回 200。

HTTP 异常可以直接在 Controller 中抛出。业务复杂后，也可以让 Service 抛出领域异常，再由异常过滤器映射到 HTTP。

## 4. 控制反转

让类在内部创建依赖会把具体实现锁死：

```ts
class MessagesService {
  private readonly repository = new MessagesRepository();
}

class MessagesController {
  private readonly service = new MessagesService();
}
```

这会导致：

- `MessagesService` 永远只能使用这个文件 Repository。
- 测试 Service 时会真的访问磁盘，很难换成内存实现。
- Repository 再增加依赖时，创建链会散落到各个上层类。
- 生命周期不受框架管理，多个地方可能重复创建实例。

控制反转（Inversion of Control）把依赖的创建移到类外部：

```ts
class MessagesService {
  constructor(private readonly repository: MessagesRepository) {}
}
```

这已经把“使用依赖”和“创建依赖”分开了。但如果完全手动组装，创建 Controller 仍然要写：

```ts
const repository = new MessagesRepository();
const service = new MessagesService(repository);
const controller = new MessagesController(service);
```

依赖层级越深，手动组装代码越多。Nest 的依赖注入系统负责完成这部分组装。

## 5. Nest DI 容器

依赖注入（Dependency Injection）建立在控制反转之上。启动时，Nest 收集 Provider，分析构造函数并建立依赖图。

```text
MessagesController
        ↓ needs
MessagesService
        ↓ needs
MessagesRepository
```

Nest 先创建 Repository，再用它创建 Service，最后把 Service 传给 `MessagesController`。调用者只声明依赖，不负责 `new`。

对这个消息模块，注册代码是：

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

构造函数注入需要：

1. 可被注入的类使用 `@Injectable()`。
2. 类被登记到某个模块的 `providers` 中，或由该模块导入的其他模块提供。
3. 消费方通过构造函数声明依赖。

`providers` 登记模块能够提供的对象。Controller 放在 `controllers` 中，无需重复放入 `providers`。

## 6. 类 Token 与自定义 Token

Service 也可以依赖接口：

```ts
interface MessageStore {
  findAll(): Promise<Message[]>;
  findOne(id: string): Promise<Message | undefined>;
  create(content: string): Promise<Message>;
}
```

TypeScript interface 编译后会消失，DI 容器无法把它直接作为 Provider token。最短的写法是使用类 token：

```ts
constructor(private readonly repository: MessagesRepository) {}
```

需要按接口替换实现时，可以显式定义 token：

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

测试时可把 token 绑定到内存仓库，生产环境再绑定到数据库仓库。类注入更短，显式 token 更容易替换。

## 7. Provider 作用域

默认作用域下，同一应用上下文中的 Provider 通常只创建一次，后续注入会复用该实例。

```ts
constructor(
  first: MessagesService,
  second: MessagesService,
) {
  console.log(first === second); // true
}
```

默认单例 Service 不应在实例字段中保存请求状态，否则并发请求会互相污染。请求数据应放在方法参数、请求作用域 Provider 或外部存储中。

Nest 也支持 request scope 和 transient scope，但它们会改变实例数量和性能成本。没有明确需求时，先使用默认作用域。

## 8. Module 可见性

Provider 默认只在声明它的模块中可见。TypeScript 能 `import` 某个 Service，不代表 Nest 的 DI 上下文能解析它。

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

`providers` 表示在本模块中创建和管理 `PowerService`，`exports` 表示允许导入本模块的其他模块使用它。

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

Disk 模块采用同样结构：导入 `PowerModule`，在 `DiskService` 构造函数中注入 `PowerService`，再把 `DiskService` 导出。

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

跨模块共享可以记成三个动作：源模块 `exports` Provider，目标模块 `imports` 源模块，消费类在构造函数中注入。缺一项都可能触发 `Nest can't resolve dependencies`。

`ComputerModule` 不需要再次导入 `PowerModule`。CPU 和 Disk 已经在各自模块内部解决电源依赖，顶层只消费它们导出的能力。

## 9. 按资源拆分模块

二手车估价 API 包含这些端点：

| 方法与路径 | 作用 |
| --- | --- |
| `POST /auth/signup` | 注册用户 |
| `POST /auth/signin` | 用户登录 |
| `GET /reports?...` | 按车型、年份、里程和位置估价 |
| `POST /reports` | 上报真实成交数据 |
| `PATCH /reports/:id` | 管理员审核报告 |

认证和用户数据放入 `UsersModule`，估价和成交记录放入 `ReportsModule`。CLI 可以生成重复结构：

```bash
nest g module users
nest g controller users
nest g service users

nest g module reports
nest g controller reports
nest g service reports
```

Repository 往往与具体存储技术相关，可以等数据库方案明确后手动建立。

模块按业务能力划分，不必固定为 Controller、Service、Repository 三件套。认证可以独立成 `AuthModule`，一个 Service 也可以依赖多个 Repository。

## 10. 常见问题

### 10.1 `Nest can't resolve dependencies`

错误消息通常会给出无法解析的类和构造函数参数索引。按依赖链向下查：

1. 目标类是否有 `@Injectable()`。
2. Provider 是否出现在某个模块的 `providers` 中。
3. 如果 Provider 来自别的模块，源模块是否 `exports` 它。
4. 当前模块是否在 `imports` 中导入了源模块。
5. 构造函数的 token 是否真的是运行时可用的类、字符串或 Symbol。

不要只补一个 TypeScript `import` 语句。那只解决源码引用，不解决 DI 可见性。

### 10.2 把 Service 直接放进 `imports`

`imports` 接收模块，普通 Service 应放在 `providers`。跨模块使用 Service 时，导入的是提供它的模块。

### 10.3 为了消除报错，到处重复注册同一个 Provider

在多个模块中重复注册 `PowerService` 可能创建独立实例。应由一个模块提供并导出，其他模块导入该模块。

### 10.4 interface 无法自动注入

interface 编译后不存在。若构造函数参数只写接口类型，Nest 没有运行时 token 可查。使用类作为 token，或配合 `@Inject()` 和显式 token。

### 10.5 JSON Repository 偶发报错

先确认文件路径基于哪个工作目录、文件是否为合法 JSON、编码是否为 UTF-8。若错误只在并发写入时出现，就不是 `JSON.parse` 本身的问题，而是读改写缺少并发控制，应该换数据库或增加可靠的锁与原子写策略。

### 10.6 Service 中保存请求状态

默认 Provider 会被复用。把 `currentUser`、临时请求参数等写进实例字段，下一次请求可能覆盖上一次请求的数据。优先把这些值作为方法参数传递。

### 10.7 找不到数据却返回 200

Repository 返回 `undefined` 只是存储层结果，HTTP 层还需要把它映射成合适的错误。使用 `NotFoundException`，或者建立统一的领域异常到 HTTP 异常映射。

## 11. 模块边界检查

1. `MessagesController` 中没有 `new MessagesService()`。
2. `MessagesService` 中没有 `new MessagesRepository()`。
3. `MessagesModule` 能独立提供消息功能。
4. `PowerService` 只由 `PowerModule` 提供，CPU 和 Disk 通过导入模块获得它。
5. `ComputerModule` 不需要知道 Power 的实现细节。
6. 请求不存在的消息时返回 404，而不是 200 和空值。

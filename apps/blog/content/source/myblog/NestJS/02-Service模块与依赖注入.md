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

上一章把请求送进了 Controller，这一章继续追问：Controller 之后的业务和数据访问该放在哪里，几个类由谁创建，一个模块里的 Service 又怎样交给另一个模块使用。

课程的推进方式很有意思。它先故意写出“类自己 `new` 依赖”的版本，让消息 API 跑起来；随后用控制反转解释这段代码为什么难测试，再引入 Nest 的依赖注入容器完成重构。最后用电源、CPU、磁盘和计算机四个模块演示跨模块共享 Provider。

## 来源与覆盖

- 课程：[BV1D9MezXExs](https://www.bilibili.com/video/BV1D9MezXExs/)
- 字幕来源：Bilibili 自动翻译中文字幕，P19-P38 均取得接近完整的字幕覆盖。
- P19-P24：Service 与 Repository 分层、JSON 文件存储、Controller 手工测试和 HTTP 异常。
- P25-P28：控制反转、DI 容器、构造函数注入和默认实例复用。
- P29-P34：用 Power、CPU、Disk、Computer 模块演示跨模块共享 Provider。
- P35-P38：从二手车估价 API 的资源和路由反推模块结构。

示例按课程思路重新组织和补全，不是视频源码的逐字抄录。

## 1. 从 Controller 到 Service，再到 Repository

消息 API 要保存和读取消息。把文件读写直接放进 Controller 当然能运行，但会让 HTTP、业务规则和存储格式黏在一起。课程把职责拆成三层：

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

Controller 负责协议边界。它知道 `GET /messages/:id` 中的 `id` 从哪里来，也知道找不到资源时该返回 404，但不应该知道 JSON 文件如何解析。

### Service

Service 承担业务用例，例如创建消息、组合多个数据源、检查业务约束。刚开始时，Service 的 `findAll()`、`findOne()`、`create()` 可能只是转调 Repository，看起来像“多包了一层”。这层边界仍然有价值：后面增加权限、去重、事务、事件或多个 Repository 时，Controller 不需要跟着存储实现一起变化。

### Repository

Repository 封装持久化细节。课程为了观察分层，手写了一个基于 JSON 文件的 Repository；真实项目更常由 TypeORM、Prisma、Mongoose 等工具提供相近的存储抽象。

Service 和 Repository 出现同名方法并不奇怪。方法名相同，只表示当前业务用例和存储操作恰好一一对应，不代表两个类职责相同。

## 2. 一个教学版文件 Repository

下面是根据课程逻辑整理的版本。它用 `Record<string, Message>` 保存数据，用 Node.js 的 Promise 文件 API 读写。为了让示例能独立运行，首次读取不到文件时会初始化为空对象。

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

这段代码适合观察 Repository 的边界，不适合直接当生产数据库。两个并发请求都可能先读到旧文件，再分别覆盖写入，造成数据丢失；文件变大后，每次全量解析和写回也会越来越慢。示例的目的不是重新发明数据库，而是让存储依赖足够具体，便于后面替换和测试。

## 3. Service 先保持简单

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

这时 Service 的确很薄。不要为了证明它“有用”而硬塞无关代码。层次的意义是给将来的变化留出位置，并让上层依赖稳定的业务接口，而不是保证每个文件都有很多行。

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

Nest 会捕获 `NotFoundException`，把它转换为 404 响应。类似的内置 HTTP 异常还有 `BadRequestException`、`UnauthorizedException`、`ForbiddenException` 等。不要返回一个带 `error` 字段但状态仍为 200 的普通对象，那会破坏 HTTP 语义，也让调用方难以统一处理错误。

课程把“消息不存在”的判断放在 Controller，是为了直接观察异常如何变成 HTTP 响应。业务复杂后，也可以让 Service 抛出领域异常，再由异常过滤器映射到 HTTP；关键是团队对边界有一致约定。

## 4. 为什么不能让类自己创建依赖

课程先写过下面这种临时代码：

```ts
class MessagesService {
  private readonly repository = new MessagesRepository();
}

class MessagesController {
  private readonly service = new MessagesService();
}
```

它能跑，却把三个类锁死在一起：

- `MessagesService` 永远只能使用这个文件 Repository。
- 测试 Service 时会真的访问磁盘，很难换成内存实现。
- Repository 再增加依赖时，创建链会散落到各个上层类。
- 生命周期不受框架管理，多个地方可能重复创建实例。

控制反转，Inversion of Control，要求类不要在内部决定依赖的具体创建方式。依赖应从外部交给它：

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

依赖层级一深，样板代码会迅速膨胀。Nest 的依赖注入系统正是用来自动完成这部分组装。

## 5. Nest DI 容器做了什么

依赖注入，Dependency Injection，建立在控制反转之上。应用启动时，Nest 会收集模块中登记的 Provider，分析构造函数依赖，并建立一张依赖图。

```text
MessagesController
        ↓ needs
MessagesService
        ↓ needs
MessagesRepository
```

当 Nest 需要创建 `MessagesController` 时，会从最底层开始解析：先创建 Repository，再用它创建 Service，最后把 Service 传给 Controller。调用者只声明自己需要什么，不负责 `new`。

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

要让构造函数注入成功，课程归纳出的最小条件是：

1. 可被注入的类使用 `@Injectable()`。
2. 类被登记到某个模块的 `providers` 中，或由该模块导入的其他模块提供。
3. 消费方通过构造函数声明依赖。

`providers` 可以理解为“这个模块的 DI 上下文能够提供的对象”。Controller 单独放在 `controllers` 中，Nest 会为路由创建它，不需要再重复放进 `providers`。

## 6. 为什么 Nest 默认直接注入类

从抽象角度看，Service 最理想的是依赖一个接口，而不是具体 Repository：

```ts
interface MessageStore {
  findAll(): Promise<Message[]>;
  findOne(id: string): Promise<Message | undefined>;
  create(content: string): Promise<Message>;
}
```

问题在于 TypeScript interface 编译后会消失，DI 容器在运行时拿不到它，无法把它直接当作查找 Provider 的 token。因此课程先采用 Nest 最常见的类 token 写法：

```ts
constructor(private readonly repository: MessagesRepository) {}
```

需要真正按接口替换实现时，可以显式定义 token：

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

这样测试时就能把 token 绑定到内存仓库，生产环境再绑定到数据库仓库。类注入更短，显式 token 更容易替换，两者不是谁绝对正确，而是抽象成本不同。

## 7. Provider 默认会复用同一个实例

课程专门验证了一个容易忽略的事实：默认作用域下，同一应用上下文中的 Provider 通常只会创建一次，后续注入会复用该实例。

```ts
constructor(
  first: MessagesService,
  second: MessagesService,
) {
  console.log(first === second); // true
}
```

这对设计有直接影响。不要在默认单例 Service 的普通字段中存放某个请求独有、会被后续请求修改的状态，否则并发用户可能互相污染。请求数据应留在方法参数、请求作用域 Provider 或外部存储中。

Nest 也支持 request scope 和 transient scope，但它们会改变实例数量和性能成本。没有明确需求时，先使用默认作用域。

## 8. Module 是 Provider 的可见性边界

单个模块内注入比较直接，跨模块时则多了一条重要规则：Provider 默认只在声明它的模块中可见。TypeScript 文件里能 `import` 某个 Service，不代表 Nest 的 DI 上下文就能解析它。

课程用一台简化的计算机演示模块关系：

```text
ComputerModule
    ├─ imports CpuModule
    └─ imports DiskModule

CpuModule  ─┐
            ├─ imports PowerModule
DiskModule ─┘
```

### 8.1 源模块导出 Provider

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

### 8.2 目标模块导入源模块

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

### 8.3 顶层模块消费多个模块

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

这里不需要让 `ComputerModule` 再导入 `PowerModule`。CPU 和 Disk 已经在各自模块内部解决了电源依赖，顶层只消费它们对外公开的能力。这正是模块边界带来的封装。

## 9. 从 API 路由反推模块

P35-P38 开始设计一个二手车估价 API。课程先列出用户能做什么：

| 方法与路径 | 作用 |
| --- | --- |
| `POST /auth/signup` | 注册用户 |
| `POST /auth/signin` | 用户登录 |
| `GET /reports?...` | 按车型、年份、里程和位置估价 |
| `POST /reports` | 上报真实成交数据 |
| `PATCH /reports/:id` | 管理员审核报告 |

接着按资源识别边界。认证和用户数据围绕 `users`，估价和成交记录围绕 `reports`，于是先建立 `UsersModule` 与 `ReportsModule`，各自包含 Controller、Service 和 Repository。CLI 可以生成重复结构：

```bash
nest g module users
nest g controller users
nest g service users

nest g module reports
nest g controller reports
nest g service reports
```

Repository 往往与具体存储技术紧密相关，课程没有依赖 CLI 自动生成，而是等数据库方案明确后手动建立。

这种设计不是要求每个资源永远固定“三件套”。它只是一个稳妥起点。随着业务展开，认证可能独立成 `AuthModule`，一个 Service 也可能依赖多个 Repository。模块应围绕稳定的业务能力调整，而不是机械地按数据表切目录。

## 10. 常见误区与调试思路

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

把 `PowerService` 同时放进多个模块的 `providers`，可能创建彼此独立的实例，也绕开原有模块边界。正确做法通常是由一个模块提供并导出，其他模块导入该模块。

### 10.4 interface 无法自动注入

interface 编译后不存在。若构造函数参数只写接口类型，Nest 没有运行时 token 可查。使用类作为 token，或配合 `@Inject()` 和显式 token。

### 10.5 JSON Repository 偶发报错

先确认文件路径基于哪个工作目录、文件是否为合法 JSON、编码是否为 UTF-8。若错误只在并发写入时出现，就不是 `JSON.parse` 本身的问题，而是读改写缺少并发控制，应该换数据库或增加可靠的锁与原子写策略。

### 10.6 Service 中保存请求状态

默认 Provider 会被复用。把 `currentUser`、临时请求参数等写进实例字段，下一次请求可能覆盖上一次请求的数据。优先把这些值作为方法参数传递。

### 10.7 找不到数据却返回 200

Repository 返回 `undefined` 只是存储层结果，HTTP 层还需要把它映射成合适的错误。使用 `NotFoundException`，或者建立统一的领域异常到 HTTP 异常映射。

## 11. 动手检查模块边界

复现这一章时，可以先不接数据库，按下面的结果检查结构是否真的理解：

1. `MessagesController` 中没有 `new MessagesService()`。
2. `MessagesService` 中没有 `new MessagesRepository()`。
3. `MessagesModule` 能独立提供消息功能。
4. `PowerService` 只由 `PowerModule` 提供，CPU 和 Disk 通过导入模块获得它。
5. `ComputerModule` 不需要知道 Power 的实现细节。
6. 请求不存在的消息时返回 404，而不是 200 和空值。

如果这六点成立，Controller、Service、Repository、Module 和 DI 容器已经连成了一套完整结构。

## 12. 章节回顾

P19-P38 的主线不是多记几个装饰器，而是逐步拿走各层不该承担的责任。Controller 不创建 Service，Service 不创建 Repository，消费模块也不越过模块边界直接抓取内部 Provider。所有类只声明依赖，Module 决定可见范围，DI 容器负责创建和复用实例。

这套结构最直接的回报是可替换和可测试：文件 Repository 可以换成数据库实现，生产实现可以在测试里换成内存实现，Controller 仍然只面向同一个 Service。项目变大后，依赖关系仍然能从构造函数和 Module 配置中被追踪，而不是散落在各处的 `new` 语句里。

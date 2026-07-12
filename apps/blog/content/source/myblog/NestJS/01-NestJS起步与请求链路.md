---
title: NestJS 起步与请求链路
date: 2026-07-12
updated: 2026-07-12
slug: nestjs-request-lifecycle
type: Notes
categories:
  - 后端开发
  - NestJS
tags:
  - NestJS
  - TypeScript
  - Controller
  - ValidationPipe
  - DTO
source:
  - https://www.bilibili.com/video/BV1D9MezXExs/
bvid: BV1D9MezXExs
pages: P1-P18
draft: false
---

# NestJS 起步与请求链路

课程没有一上来就让 CLI 生成完整项目，而是先手动拼出一个最小 NestJS 应用。这样安排看似绕路，实际是在回答两个很重要的问题：一个 HTTP 请求进入 Nest 后经过哪些部件，以及 CLI 生成的那些文件到底各自负责什么。

## 来源与覆盖

- 课程：[BV1D9MezXExs](https://www.bilibili.com/video/BV1D9MezXExs/)
- 字幕来源：Bilibili 自动翻译中文字幕，P1-P18 均取得接近完整的字幕覆盖。
- P1-P7：手工搭建最小 Nest 应用，理解 Module、Controller、启动流程和路由拼接。
- P8-P14：使用 CLI 创建消息 API，设计路由并读取 Body、Param 等请求数据。
- P15-P18：配置 `ValidationPipe`、DTO、`class-validator`，追踪运行时元数据来源。

正文按课程推进顺序重新整理，代码是便于复习和动手的教学版示例，不是视频代码的逐字还原。课程录制时使用的依赖版本较旧，下面不抄死旧版本号，重点保留仍然有效的结构和机制。

## 1. 先把请求链路看清楚

任何 Web 服务都绕不开一条请求响应链路：客户端发出请求，服务端读取请求数据，做校验和权限判断，执行对应业务，再把结果写进响应。NestJS 的做法不是把这些逻辑全塞进一个回调，而是给每类职责一个明确的位置。

```text
HTTP Request
    ↓
Middleware
    ↓
Guard             身份认证与授权
    ↓
Interceptor       进入处理器前的横切逻辑
    ↓
Pipe              转换和校验输入
    ↓
Controller        匹配路由，接收 HTTP 数据
    ↓
Service           执行业务逻辑
    ↓
Repository        访问文件或数据库
    ↓
HTTP Response
```

这一阶段课程真正动手写的是 `Module`、`Controller` 和 `Pipe`。`Guard`、`Interceptor`、异常过滤器等部件只是先放进全景图中，后续再逐一展开。

理解这张图时，要把 Controller 看成 HTTP 边界，而不是所有逻辑的容器。它应该知道请求从哪里取值、该调用哪个服务、返回什么状态；复杂计算和数据访问不应该长期留在 Controller 中。

## 2. 手动搭出最小应用

Nest 项目常用 TypeScript 编写，底层 HTTP 服务器默认由 Express 适配器提供。手动搭建时会接触到几类关键依赖：

- `@nestjs/common`：Controller、Module、路由装饰器、Pipe 等常用 API。
- `@nestjs/core`：`NestFactory` 和框架启动逻辑。
- `@nestjs/platform-express`：Nest 与 Express 之间的适配层。
- `reflect-metadata`：让框架能在运行时读取装饰器元数据。
- `typescript`：把 TypeScript 转译为可执行的 JavaScript。

如果只是新建项目，直接用 CLI 即可；手动安装核心包的价值主要是看清框架由哪些部分组成。

### 2.1 TypeScript 配置为什么重要

课程特别回看了下面两个编译选项：

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

`experimentalDecorators` 允许使用课程所采用的装饰器语法；`emitDecoratorMetadata` 会把一部分类型信息写进编译后的 JavaScript 元数据。Nest 后面的参数注入和 DTO 校验都依赖这条线索。普通 TypeScript 类型通常会在编译后消失，所以这里不是一个无关紧要的格式选项。

### 2.2 Controller 定义路由

下面是整理后的最小 Controller：

```ts
// app.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('app')
export class AppController {
  @Get('hello')
  getHello(): string {
    return 'hello from Nest';
  }
}
```

两个装饰器会共同组成最终路由：

```text
@Controller('app') + @Get('hello')
                 ↓
          GET /app/hello
```

类名和方法名不会参与 URL 匹配，真正决定路由的是装饰器参数。方法返回的字符串或对象会由 Nest 写入 HTTP 响应。

### 2.3 Module 负责登记组件

Controller 写出来以后，还需要让 Nest 知道它属于哪个模块：

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
})
export class AppModule {}
```

`@Module()` 不是简单的文件夹说明。它描述了一个功能边界：模块有哪些 Controller、Provider，以及需要从其他模块导入或向外导出什么。当前最小示例只有 Controller，后面加入 Service 后才会用到 `providers`。

### 2.4 main.ts 创建并启动应用

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

void bootstrap();
```

启动过程可以拆成三步：

1. `NestFactory.create(AppModule)` 以根模块为入口建立应用。
2. Nest 扫描模块中的 Controller 和 Provider，建立依赖关系与路由表。
3. `listen(3000)` 让底层 HTTP 适配器开始接收请求。

如果访问路由时得到 404，先检查 Controller 前缀和方法路由是否拼对；如果应用根本没有启动，先看终端错误，而不是只刷新浏览器。

## 3. 从手工项目切换到 Nest CLI

看过最小结构后，再用 CLI 生成项目就不会被一堆文件吓住了。

```bash
npx @nestjs/cli new messages
cd messages
npm run start:dev
```

`start:dev` 会监听源码变化并重启开发服务器。课程随后使用生成器创建功能模块和控制器：

```bash
nest generate module messages
nest generate controller messages/messages --flat
```

常用缩写是：

```bash
nest g module messages
nest g controller messages/messages --flat
nest g service messages/messages --flat
```

`messages/messages` 的前半段表示目标目录，后半段表示生成的类名；`--flat` 表示不要再额外套一层目录。生成 Controller 时，CLI 还会尝试把它登记到同目录的 Module 中。命令执行后仍要打开模块文件确认结果，不能因为 CLI 没报错就默认注册一定符合预期。

Nest 常见文件名由“功能名 + 角色”组成：

```text
messages.controller.ts
messages.service.ts
messages.module.ts
create-message.dto.ts
```

这种命名让人不打开文件就能判断职责。一个文件通常只放一个主要类，也更方便 CLI、测试和依赖注入按约定工作。

## 4. 先设计请求，再决定需要哪些部件

课程的第二个小项目是消息 API。它先列出要支持的请求，再反推 Controller、Pipe、Service 和 Repository，而不是先随手建文件。

| 方法与路径 | 输入 | 目的 | 主要部件 |
| --- | --- | --- | --- |
| `GET /messages` | 无 | 列出全部消息 | Controller、Service、Repository |
| `GET /messages/:id` | 路径参数 `id` | 获取一条消息 | Controller、Service、Repository |
| `POST /messages` | JSON 请求体 | 创建消息 | Pipe、Controller、Service、Repository |

三个请求不需要三个 Controller。它们都围绕 `messages` 资源，可以放进同一个 `MessagesController`，再由同一个模块封装。这里也没有认证需求，因此暂时不需要 Guard。

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

@Controller('messages')
export class MessagesController {
  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() body: unknown) {
    return body;
  }
}
```

这个版本只用于看路由和取值，`unknown` 也提醒我们：请求体来自外部，在校验之前不该假定它符合某个结构。

## 5. 参数装饰器如何读取请求

HTTP 请求大致由起始行、Headers 和可选的 Body 组成。Nest 用参数装饰器把这些位置映射成方法参数：

```ts
@Param('id')       // /messages/:id 中的 id
@Query('page')     // ?page=2 中的 page
@Headers('x-id')   // 指定请求头
@Body()            // 解析后的完整请求体
@Body('content')   // 请求体中的 content 字段
```

装饰器所在位置也有区别：

- `@Controller()` 是类装饰器，定义一组路由的公共前缀。
- `@Get()`、`@Post()` 是方法装饰器，定义 HTTP 方法和子路径。
- `@Body()`、`@Param()` 是参数装饰器，告诉 Nest 给某个参数注入什么值。

`@Param('id')` 中的名字必须和路由中的 `:id` 一致。路径参数默认仍然是字符串，即使 TypeScript 上写成 `number` 也不会自动把运行时值变成数字；需要转换时应使用 `ParseIntPipe` 或开启并配置转换逻辑。

## 6. 用请求文件保留可复现样例

浏览器地址栏只适合快速测试 GET。POST、PATCH 等请求最好交给 Postman、curl 或 VS Code REST Client。课程选择 `requests.http`，因为它能和源码一起版本管理，也能留下接口的可执行示例。

```http
### 列出全部消息
GET http://localhost:3000/messages

### 创建消息
POST http://localhost:3000/messages
Content-Type: application/json

{
  "content": "hello Nest"
}

### 获取指定消息
GET http://localhost:3000/messages/123
```

请求头和 JSON Body 之间必须有一个空行。若服务端拿不到 Body，先检查 `Content-Type: application/json`、JSON 语法和请求是否真的发到了当前端口。

## 7. ValidationPipe 把不可信输入挡在 Controller 外

`POST /messages` 期望收到这样的数据：

```json
{
  "content": "hello Nest"
}
```

只写一个 TypeScript 类型并不能校验真实请求。客户端仍然可以发送数字、`null`、拼错的字段甚至完全空的对象。课程的处理方式是全局启用 `ValidationPipe`，再用 DTO 描述每个接口的输入规则。

### 7.1 安装验证依赖

```bash
npm install class-validator class-transformer
```

### 7.2 全局启用验证管道

```ts
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
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

课程最初只使用了 `new ValidationPipe()`。上面的教学版额外打开了三个常见选项：`whitelist` 只保留 DTO 中有验证装饰器的字段，`forbidNonWhitelisted` 遇到额外字段时直接报错，`transform` 允许管道按目标类型做转换。具体项目是否全部启用，要看接口兼容性要求。

### 7.3 用 DTO 写出运行时规则

```ts
// messages/dto/create-message.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  content!: string;
}
```

然后把 DTO 类用于 Controller 参数：

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('messages')
export class MessagesController {
  @Post()
  create(@Body() body: CreateMessageDto) {
    return { content: body.content };
  }
}
```

这里必须使用 `class`，不能只写 `interface CreateMessageDto`。接口只存在于 TypeScript 编译阶段，运行时没有可供 `class-transformer` 实例化、也没有可供 `class-validator` 读取的装饰器元数据。

## 8. 验证背后到底发生了什么

一次合法或非法的 POST 请求会经过下面这条链路：

```text
原始 JSON Body
    ↓ class-transformer
CreateMessageDto 实例
    ↓ class-validator 读取属性装饰器
验证结果
    ├─ 失败：ValidationPipe 直接返回 400
    └─ 成功：把值传给 Controller 方法
```

`ValidationPipe` 怎么知道目标类是 `CreateMessageDto`？关键仍然是前面的装饰器元数据。启用 `emitDecoratorMetadata` 后，编译器会在装饰过的方法附近生成类似 `design:paramtypes` 的元数据，里面保留参数对应的类构造器。Nest 通过 `reflect-metadata` 读取它，才知道该把 Body 转成哪个类的实例。

这也解释了两个容易混淆的现象：

1. 大多数 TypeScript 类型在运行时确实会消失。
2. 开启装饰器元数据后，某些类类型会以元数据形式保留一小部分运行时线索。

它不是“TypeScript 运行时类型系统”，只是编译器为装饰器写下的有限信息。

## 9. 一条请求的完整走法

把前面的代码连起来，`POST /messages` 会这样执行：

1. HTTP 适配器收到请求并解析 JSON Body。
2. 路由表根据 `POST` 和 `/messages` 找到 `MessagesController.create()`。
3. 全局 `ValidationPipe` 看到参数类型是 `CreateMessageDto`。
4. `class-transformer` 创建 DTO 实例，`class-validator` 检查 `content`。
5. 校验失败时直接返回 400，Controller 不会执行。
6. 校验通过后，DTO 被传入 Controller，Controller 再调用后续 Service。
7. Controller 的返回值由 Nest 序列化并写入响应。

这条链路比死记装饰器更重要。调试时只要判断请求停在了哪一层，排查范围会小很多。

## 10. 常见误区与调试顺序

### 10.1 路由一直 404

先看启动日志里是否打印了对应路由，再检查 `@Controller()` 前缀和 `@Get()`、`@Post()` 子路径。还要确认 Controller 已经登记在当前模块的 `controllers` 中，根模块也确实导入了这个功能模块。

### 10.2 端口启动失败

`EADDRINUSE` 表示端口已被占用。停止旧进程或换一个端口，不要把它当成 Controller 代码错误。

### 10.3 POST 能进 Controller，但没有校验

按这个顺序检查：

1. 是否安装 `class-validator` 和 `class-transformer`。
2. 是否调用了 `app.useGlobalPipes()`，或者给当前路由单独加了 Pipe。
3. 参数类型是否为带验证装饰器的 DTO 类，而不是 `any`、对象字面量或 interface。
4. DTO 属性上是否真的有验证装饰器。
5. `tsconfig.json` 的装饰器相关设置是否和项目要求一致。

### 10.4 DTO 写了字段，额外字段却仍被接收

DTO 的字段声明本身不会删除未知属性。需要 `whitelist: true`；想把未知属性视为错误，再加 `forbidNonWhitelisted: true`。

### 10.5 把类型注解当成数据转换

```ts
findOne(@Param('id') id: number) {}
```

这句不会单凭 `number` 注解把字符串路径参数转成数字。更明确的写法是：

```ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

@Controller('messages')
export class MessagesController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return { id };
  }
}
```

## 11. 动手复现这一章

可以用一个很小的练习确认自己不是只看懂了代码：

1. 新建 `messages` 项目，生成 `MessagesModule` 和 `MessagesController`。
2. 实现 `GET /messages`、`GET /messages/:id`、`POST /messages` 三个路由。
3. 建立 `CreateMessageDto`，要求 `content` 是 1 到 200 个字符的非空字符串。
4. 在 `requests.http` 中分别发送合法 Body、数字 Body、缺字段 Body 和多余字段 Body。
5. 给 `GET /messages/:id` 加 `ParseIntPipe`，观察非数字参数对应的响应。

练习的检查点不是先接数据库，而是确认路由、取值、转换、校验和错误响应都按预期发生。

## 12. 章节回顾

P1-P18 完成了两层铺垫。第一层是框架结构：`main.ts` 启动应用，Module 登记功能，Controller 把 HTTP 请求映射到方法。第二层是请求输入：参数装饰器负责取值，DTO 写出数据契约，`ValidationPipe` 在 Controller 执行前完成转换与校验。

接下来进入 Service、Repository 和依赖注入时，可以一直沿用同一条判断：HTTP 细节留在 Controller，业务规则放进 Service，存储细节交给 Repository；Module 决定这些类在哪个范围内可见。

---
title: NestJS 起步与请求链路
date: 2026-07-12
updated: 2026-07-12
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

## 1. 请求链路

NestJS 把请求处理拆到不同部件：

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

Controller 读取 HTTP 数据并返回结果；业务逻辑和持久化分别交给 Service 与 Repository。

## 2. 最小 NestJS 应用

Nest 项目常用 TypeScript 编写，底层 HTTP 服务器默认由 Express 适配器提供。手动搭建时会接触到几类关键依赖：

- `@nestjs/common`：Controller、Module、路由装饰器、Pipe 等常用 API。
- `@nestjs/core`：`NestFactory` 和框架启动逻辑。
- `@nestjs/platform-express`：Nest 与 Express 之间的适配层。
- `reflect-metadata`：让框架能在运行时读取装饰器元数据。
- `typescript`：把 TypeScript 转译为可执行的 JavaScript。

新项目可以直接使用 CLI。手动安装核心包则能看清框架的组成。

### 2.1 TypeScript 装饰器配置

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

`experimentalDecorators` 允许使用装饰器语法。`emitDecoratorMetadata` 会把部分类型信息写进 JavaScript 元数据，供 Nest 的参数注入和 DTO 校验读取。普通 TypeScript 类型仍会在编译后消失。

### 2.2 Controller

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

类名和方法名不参与 URL 匹配，路由只由装饰器参数决定。方法返回的字符串或对象会由 Nest 写入 HTTP 响应。

### 2.3 Module

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

`@Module()` 描述功能边界：模块包含哪些 Controller、Provider，以及需要导入或导出什么。当前示例只有 Controller，因此暂时没有 `providers`。

### 2.4 main.ts

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

## 3. Nest CLI

```bash
npx @nestjs/cli new messages
cd messages
npm run start:dev
```

`start:dev` 会监听源码变化并重启开发服务器。生成 Module 和 Controller：

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

`messages/messages` 指定目标目录和类名，`--flat` 禁止额外创建一层目录。Controller 生成器会尝试更新同目录的 Module，执行后仍应检查注册结果。

Nest 常见文件名由“功能名 + 角色”组成：

```text
messages.controller.ts
messages.service.ts
messages.module.ts
create-message.dto.ts
```

文件名直接标明职责。一个文件通常只放一个主要类，方便 CLI、测试和依赖注入按约定工作。

## 4. 消息 API

| 方法与路径 | 输入 | 目的 | 主要部件 |
| --- | --- | --- | --- |
| `GET /messages` | 无 | 列出全部消息 | Controller、Service、Repository |
| `GET /messages/:id` | 路径参数 `id` | 获取一条消息 | Controller、Service、Repository |
| `POST /messages` | JSON 请求体 | 创建消息 | Pipe、Controller、Service、Repository |

三个路由都属于 `messages` 资源，放在同一个 `MessagesController` 中。当前没有认证需求，不需要 Guard。

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

## 5. 参数装饰器

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

`@Param('id')` 必须和路由中的 `:id` 同名。路径参数默认是字符串，TypeScript 的 `number` 注解不会转换运行时值；需要数字时使用 `ParseIntPipe` 或转换配置。

## 6. requests.http

POST、PATCH 等请求可使用 Postman、curl 或 VS Code REST Client。`requests.http` 可以和源码一起版本管理：

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

## 7. ValidationPipe 与 DTO

`POST /messages` 期望收到这样的数据：

```json
{
  "content": "hello Nest"
}
```

TypeScript 类型不能校验真实请求。客户端仍然可以发送数字、`null`、拼错的字段或空对象。全局 `ValidationPipe` 负责执行 DTO 中的输入规则。

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

常用选项：

- `whitelist`：只保留带验证装饰器的 DTO 字段。
- `forbidNonWhitelisted`：额外字段直接报错。
- `transform`：按目标类型转换输入。

是否全部启用取决于接口兼容性要求。

### 7.3 DTO

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

DTO 必须使用 `class`。interface 编译后不存在，`class-transformer` 无法实例化，`class-validator` 也读不到装饰器元数据。

## 8. 验证流程

`POST /messages` 的校验链路：

```text
原始 JSON Body
    ↓ class-transformer
CreateMessageDto 实例
    ↓ class-validator 读取属性装饰器
验证结果
    ├─ 失败：ValidationPipe 直接返回 400
    └─ 成功：把值传给 Controller 方法
```

启用 `emitDecoratorMetadata` 后，编译器会为装饰过的方法生成 `design:paramtypes` 等元数据，其中保存参数对应的类构造器。Nest 通过 `reflect-metadata` 读取它，再把 Body 转成 `CreateMessageDto` 实例。

运行时有两个边界：

1. 大多数 TypeScript 类型在运行时确实会消失。
2. 开启装饰器元数据后，某些类类型会以元数据形式保留一小部分运行时线索。

它不是“TypeScript 运行时类型系统”，只是编译器为装饰器写下的有限信息。

## 9. `POST /messages` 执行顺序

1. HTTP 适配器收到请求并解析 JSON Body。
2. 路由表根据 `POST` 和 `/messages` 找到 `MessagesController.create()`。
3. 全局 `ValidationPipe` 看到参数类型是 `CreateMessageDto`。
4. `class-transformer` 创建 DTO 实例，`class-validator` 检查 `content`。
5. 校验失败时直接返回 400，Controller 不会执行。
6. 校验通过后，DTO 被传入 Controller，Controller 再调用后续 Service。
7. Controller 的返回值由 Nest 序列化并写入响应。

调试时先判断请求停在哪一层，再检查对应部件。

## 10. 常见问题

### 10.1 路由一直 404

先看启动日志中的路由，再检查 `@Controller()` 前缀、方法子路径、模块的 `controllers`，以及根模块的 `imports`。

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

## 11. 练习

1. 新建 `messages` 项目，生成 `MessagesModule` 和 `MessagesController`。
2. 实现 `GET /messages`、`GET /messages/:id`、`POST /messages` 三个路由。
3. 建立 `CreateMessageDto`，要求 `content` 是 1 到 200 个字符的非空字符串。
4. 在 `requests.http` 中分别发送合法 Body、数字 Body、缺字段 Body 和多余字段 Body。
5. 给 `GET /messages/:id` 加 `ParseIntPipe`，观察非数字参数对应的响应。

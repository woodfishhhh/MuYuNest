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

NestJS 把请求处理拆给不同的部件：

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

Controller 读 HTTP 数据、返回结果；业务逻辑交给 Service，持久化交给 Repository。

## 2. 最小 NestJS 应用

Nest 项目一般用 TypeScript 写，底层 HTTP 服务器默认由 Express 适配器提供。手动搭的话会碰到这几个关键依赖：

- `@nestjs/common`：Controller、Module、路由装饰器、Pipe 这些常用 API。
- `@nestjs/core`：`NestFactory` 和框架的启动逻辑。
- `@nestjs/platform-express`：Nest 和 Express 之间的适配层。
- `reflect-metadata`：让框架在运行时能读到装饰器元数据。
- `typescript`：把 TypeScript 转成能执行的 JavaScript。

新项目直接用 CLI 就行。手动装核心包能看清框架由哪几块组成。

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

`experimentalDecorators` 允许装饰器语法。`emitDecoratorMetadata` 会把一部分类型信息写进 JavaScript 元数据，给 Nest 的参数注入和 DTO 校验用。普通的 TypeScript 类型编译后照样没了。

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

两个装饰器一起组成最终的路由：

```text
@Controller('app') + @Get('hello')
                 ↓
          GET /app/hello
```

类名和方法名不参与 URL 匹配，路由只看装饰器参数。方法返回的字符串或对象由 Nest 写进 HTTP 响应。

### 2.3 Module

Controller 写好后，还要告诉 Nest 它属于哪个模块：

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
})
export class AppModule {}
```

`@Module()` 描述功能边界：模块里有哪些 Controller、Provider，要导入或导出什么。现在的示例只有 Controller，所以暂时没有 `providers`。

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

启动过程分三步：

1. `NestFactory.create(AppModule)` 以根模块为入口建立应用。
2. Nest 扫描模块里的 Controller 和 Provider，建立依赖关系和路由表。
3. `listen(3000)` 让底层 HTTP 适配器开始接请求。

访问路由得到 404，先看 Controller 前缀和方法路由拼对没有；应用根本没起来的话，先看终端报错，别光刷新浏览器。

## 3. Nest CLI

```bash
npx @nestjs/cli new messages
cd messages
npm run start:dev
```

`start:dev` 监听源码变化并重启开发服务器。生成 Module 和 Controller：

```bash
nest generate module messages
nest generate controller messages/messages --flat
```

常用缩写：

```bash
nest g module messages
nest g controller messages/messages --flat
nest g service messages/messages --flat
```

`messages/messages` 指定目标目录和类名，`--flat` 不额外建一层目录。Controller 生成器会去更新同目录的 Module，跑完还是要看一眼注册结果。

Nest 常见的文件名是"功能名 + 角色"：

```text
messages.controller.ts
messages.service.ts
messages.module.ts
create-message.dto.ts
```

文件名直接写明职责。一个文件一般只放一个主要的类，CLI、测试和依赖注入才好按约定工作。

## 4. 消息 API

| 方法与路径 | 输入 | 目的 | 主要部件 |
| --- | --- | --- | --- |
| `GET /messages` | 无 | 列出全部消息 | Controller、Service、Repository |
| `GET /messages/:id` | 路径参数 `id` | 获取一条消息 | Controller、Service、Repository |
| `POST /messages` | JSON 请求体 | 创建消息 | Pipe、Controller、Service、Repository |

三个路由都属于 `messages` 资源，放进同一个 `MessagesController`。现在不需要认证，不用 Guard。

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

这个版本只用来看路由和取值。用 `unknown` 是在提醒：请求体来自外部，校验之前别假定它符合某个结构。

## 5. 参数装饰器

HTTP 请求大致由起始行、Headers 和可选的 Body 组成。Nest 用参数装饰器把这些位置映射成方法参数：

```ts
@Param('id')       // /messages/:id 中的 id
@Query('page')     // ?page=2 中的 page
@Headers('x-id')   // 指定请求头
@Body()            // 解析后的完整请求体
@Body('content')   // 请求体中的 content 字段
```

装饰器放的位置也不一样：

- `@Controller()` 是类装饰器，定义一组路由的公共前缀。
- `@Get()`、`@Post()` 是方法装饰器，定义 HTTP 方法和子路径。
- `@Body()`、`@Param()` 是参数装饰器，告诉 Nest 给这个参数注入什么值。

`@Param('id')` 要和路由里的 `:id` 同名。路径参数默认是字符串，TypeScript 的 `number` 注解不会转换运行时的值；要数字就用 `ParseIntPipe` 或转换配置。

## 6. requests.http

POST、PATCH 这类请求可以用 Postman、curl 或 VS Code REST Client 发。`requests.http` 能和源码一起进版本管理：

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

请求头和 JSON Body 之间要空一行。服务端拿不到 Body 的话，先查 `Content-Type: application/json`、JSON 语法，以及请求是不是真的发到了当前端口。

## 7. ValidationPipe 与 DTO

`POST /messages` 期望收到这样的数据：

```json
{
  "content": "hello Nest"
}
```

TypeScript 类型校验不了真实请求，客户端照样能发数字、`null`、拼错的字段或空对象。执行 DTO 里输入规则的是全局 `ValidationPipe`。

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
- `forbidNonWhitelisted`：有多余字段直接报错。
- `transform`：按目标类型转换输入。

要不要全开，看接口的兼容性要求。

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

然后把 DTO 类用在 Controller 参数上：

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

DTO 必须用 `class`。interface 编译后就没了，`class-transformer` 没法实例化，`class-validator` 也读不到装饰器元数据。

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

开了 `emitDecoratorMetadata`，编译器会给被装饰的方法生成 `design:paramtypes` 等元数据，里面存着参数对应的类构造器。Nest 用 `reflect-metadata` 读出来，再把 Body 转成 `CreateMessageDto` 实例。

运行时要分清两点：

1. 大多数 TypeScript 类型在运行时确实没了。
2. 开了装饰器元数据后，某些类类型会以元数据的形式留下一点运行时线索。

这算不上"TypeScript 运行时类型系统"，只是编译器给装饰器留的一点有限信息。

## 9. `POST /messages` 执行顺序

1. HTTP 适配器收到请求，解析 JSON Body。
2. 路由表按 `POST` 和 `/messages` 找到 `MessagesController.create()`。
3. 全局 `ValidationPipe` 看到参数类型是 `CreateMessageDto`。
4. `class-transformer` 创建 DTO 实例，`class-validator` 检查 `content`。
5. 校验失败直接返回 400，Controller 不执行。
6. 校验通过后，DTO 传进 Controller，Controller 再调后面的 Service。
7. Controller 的返回值由 Nest 序列化后写进响应。

调试时先判断请求停在哪一层，再去查那一层的部件。

## 10. 常见问题

### 10.1 路由一直 404

先看启动日志里打出来的路由，再查 `@Controller()` 前缀、方法子路径、模块的 `controllers`，以及根模块的 `imports`。

### 10.2 端口启动失败

`EADDRINUSE` 是端口被占了。停掉旧进程或者换个端口，这不是 Controller 代码的错。

### 10.3 POST 能进 Controller，但没有校验

按顺序查：

1. 装没装 `class-validator` 和 `class-transformer`。
2. 调没调 `app.useGlobalPipes()`，或者给当前路由单独加了 Pipe。
3. 参数类型是不是带验证装饰器的 DTO 类，而不是 `any`、对象字面量或 interface。
4. DTO 属性上是不是真的有验证装饰器。
5. `tsconfig.json` 里装饰器相关的设置和项目要求一不一致。

### 10.4 DTO 写了字段，额外字段却仍被接收

DTO 声明了字段，并不会因此删掉未知属性。要加 `whitelist: true`；想把未知属性当成错误，再加 `forbidNonWhitelisted: true`。

### 10.5 把类型注解当成数据转换

```ts
findOne(@Param('id') id: number) {}
```

光靠 `number` 注解，这句不会把字符串路径参数转成数字。更明确的写法：

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
3. 建 `CreateMessageDto`，要求 `content` 是 1 到 200 个字符的非空字符串。
4. 在 `requests.http` 里分别发合法 Body、数字 Body、缺字段的 Body 和带多余字段的 Body。
5. 给 `GET /messages/:id` 加 `ParseIntPipe`，看看非数字参数会得到什么响应。

---
title: 从 Controller 到 Middleware
date: 2026-07-13
updated: 2026-07-13
tags:
  - NestJS
  - Controller
  - Session
  - Provider
  - Middleware
source:
  - https://www.bilibili.com/video/BV1NG41187Bs/
bvid: BV1NG41187Bs
pages: P7-P12
draft: false
---

# 从 Controller 到 Middleware

## 1. 先把资源路由设计清楚

REST 风格讲的是围绕资源设计接口，用 HTTP 方法表达操作语义，跟"URL 里不许有问号"没关系。

```text
POST   /users          创建用户
GET    /users          查询用户列表
GET    /users/:id      查询单个用户
PATCH  /users/:id      部分更新用户
DELETE /users/:id      删除用户
```

路径参数和查询参数管的事不一样：

```text
/users/42                  资源标识，42 是路径参数
/users?page=2&role=admin   筛选、排序或分页条件
```

别为了"RESTful"把所有查询条件都塞进路径。资源身份放路径参数，可选的查询条件放 query string。

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `200 OK` | 查询或更新成功 |
| `201 Created` | 资源创建成功 |
| `204 No Content` | 操作成功且无需返回 Body |
| `304 Not Modified` | 条件请求命中缓存，不是普通成功响应 |
| `400 Bad Request` | 请求格式或参数错误 |
| `401 Unauthorized` | 尚未通过身份认证 |
| `403 Forbidden` | 身份已知，但无权访问资源 |
| `404 Not Found` | 资源或路由不存在 |
| `500 Internal Server Error` | 服务端未处理错误 |
| `502 Bad Gateway` | 网关从上游服务收到无效响应 |

`403` 不是专门给跨站脚本攻击或 Referer 校验用的，只要授权结果是明确拒绝访问，都可以用它。

## 2. Controller 读取请求数据

一个 Controller 能同时读 query、path、body 和 header：

```ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('role') role?: string,
  ) {
    return { page, role };
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return { id, requestId };
  }

  @Post()
  create(@Body() body: CreateUserDto) {
    return body;
  }
}
```

参数来源可以这么记：

```text
GET /users?page=2     -> @Query('page')
GET /users/42         -> @Param('id')
POST JSON Body        -> @Body()
X-Request-Id header   -> @Headers('x-request-id')
```

装饰器参数要和实际字段名对上，`@Param('userId')` 读不到路由 `:id` 的值。

## 3. 不要直接相信请求类型

路径参数和查询参数默认都是字符串。下面的 TypeScript 注解不会自动把 `id` 转成数字：

```ts
@Get(':id')
findOne(@Param('id') id: number) {
  return { id };
}
```

用了 Pipe 才会在运行时转换：

```ts
import { Get, Param, ParseIntPipe } from '@nestjs/common';

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return { id };
}
```

请求体也要过 DTO 校验：

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

分工：Controller 读 HTTP 数据，DTO 和 Pipe 约束输入，Service 管业务规则。别把三件事混进一个大方法。

## 4. 状态码与底层响应对象

Nest 给常见路由设了默认状态码：GET 一般是 200，POST 一般是 201。要固定状态码就用 `@HttpCode()`：

```ts
import { HttpCode, HttpStatus, Post } from '@nestjs/common';

@Post('login')
@HttpCode(HttpStatus.OK)
login(@Body() body: LoginDto) {
  return this.authService.login(body);
}
```

重定向用 `@Redirect()`，响应头用 `@Header()`。只有文件流、验证码图片这类确实要手动控制响应的场景，才直接注入 Express 的 `Response`：

```ts
import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller('assets')
export class AssetsController {
  @Get('pixel.svg')
  getPixel(@Res() response: Response) {
    response.type('image/svg+xml').send('<svg></svg>');
  }
}
```

用了 `@Res()`，这个路由一般就进了库特定模式，得自己结束响应。既想读原生响应、又想保留 Nest 的自动响应，用 `@Res({ passthrough: true })`。

## 5. API 版本控制

URI 版本控制要在启动入口打开：

```ts
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,
});
```

可以给整个 Controller 指定版本：

```ts
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {}
```

最终路径是 `/v1/users`。也可以只给某个方法加 `@Version('2')`。版本号是给不兼容变更用的，只是改了内部实现，没必要复制一套 API。

## 6. Session 如何识别浏览器

Session 数据存在服务端，浏览器 Cookie 一般只存 Session ID：

```text
Browser Cookie: sid=abc123
             ↓
Server Store: abc123 -> { userId: 42, captcha: "k8m2" }
```

浏览器之后的请求带上 Cookie，服务端靠它取回 Session。Cookie 里不是 Session 的全部内容，也不该直接存密码这类敏感信息。

用 Express 适配器时可以接 `express-session`：

```bash
npm install express-session
npm install -D @types/express-session
```

在 `main.ts` 注册：

```ts
import session from 'express-session';

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000,
    },
  }),
);
```

这里容易炸在几个配置：

- `secret` 别硬编码进仓库，从环境变量读，用足够长的随机值。
- `httpOnly` 让前端 JavaScript 读不到这个 Cookie，但代替不了 CSRF 防护。
- `secure: true` 只通过 HTTPS 发 Cookie。本地 HTTP 开发环境直接打开，Cookie 看起来就像"丢了"。
- `sameSite` 影响跨站请求带不带 Cookie。
- 默认的 MemoryStore 只适合开发，生产环境要换 Redis 之类的外部存储。

应用部署在反向代理后面、又用了安全 Cookie 的话，还要配好代理信任：

```ts
app.getHttpAdapter().getInstance().set('trust proxy', 1);
```

这段 API 来自 Express；换成 Fastify 适配器，Session 插件和类型也要跟着换。

## 7. 用 Session 保存验证码

验证码接口要返回 SVG，同时把答案存进服务端 Session：

```ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as svgCaptcha from 'svg-captcha';

@Controller('auth')
export class AuthController {
  @Get('captcha')
  createCaptcha(@Req() request: Request, @Res() response: Response) {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true,
    });

    request.session.captcha = captcha.text.toLowerCase();
    response.type('image/svg+xml').send(captcha.data);
  }

  @Post('login')
  login(@Req() request: Request, @Body() body: LoginDto) {
    const expected = request.session.captcha;
    delete request.session.captcha;

    if (!expected || expected !== body.captcha.toLowerCase()) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    return { success: true };
  }
}
```

验证码用完马上删，免得同一个答案被重复提交。实际项目还要加有效期、失败次数限制和登录限流。

前后端跨域时，光开 CORS 不够：服务端要允许凭证，客户端也要主动带 Cookie。

```ts
app.enableCors({
  origin: 'http://localhost:5173',
  credentials: true,
});
```

```ts
await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(form),
});
```

`Content-Type: application/json` 决定服务端怎么解析 Body，`credentials: 'include'` 决定跨域请求带不带 Cookie，是两回事。

## 8. Provider 的四种注册方式

类名简写：

```ts
@Module({
  providers: [UsersService],
})
export class UsersModule {}
```

等价于：

```ts
@Module({
  providers: [
    {
      provide: UsersService,
      useClass: UsersService,
    },
  ],
})
export class UsersModule {}
```

### 8.1 `useClass`

按环境替换实现：

```ts
const USER_REPOSITORY = Symbol('USER_REPOSITORY');

@Module({
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass:
        process.env.NODE_ENV === 'test'
          ? InMemoryUserRepository
          : TypeOrmUserRepository,
    },
  ],
})
export class UsersModule {}
```

用自定义 token 注入时要加 `@Inject()`：

```ts
constructor(
  @Inject(USER_REPOSITORY)
  private readonly repository: UserRepository,
) {}
```

### 8.2 `useValue`

注入配置对象或测试替身：

```ts
const APP_CONFIG = Symbol('APP_CONFIG');

{
  provide: APP_CONFIG,
  useValue: {
    apiBaseUrl: '/api',
  },
}
```

`useValue` 在模块加载时就定死了，不适合需要异步初始化的值。

### 8.3 `useFactory`

根据其他 Provider 构建值：

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

工厂可以返回 Promise，应用启动时会等它解析完。工厂里要是有很慢的网络请求，启动也会跟着变慢。

### 8.4 `useExisting`

给已有的 Provider 起别名，不会再创建第二个实例：

```ts
{
  provide: 'LOGGER',
  useExisting: AppLogger,
}
```

## 9. Module 决定 Provider 可见性

Provider 默认只在声明它的模块里可见。跨模块用的话，源模块要导出，使用方模块要导入：

```ts
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

```ts
@Module({
  imports: [UsersModule],
  controllers: [AdminController],
})
export class AdminModule {}
```

TypeScript 的 `import { UsersService } ...` 只是让源码能引用这个符号，改变不了 Nest DI 容器里的可见性。

## 10. 全局模块与动态模块

全局模块适合真正整个应用都要用的基础设施，比如配置或日志：

```ts
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
```

就算加了 `@Global()`，模块也得被根模块导入至少一次，Provider 也得写进 `exports`。别把所有业务模块都设成全局，不然依赖从哪来就查不清了。

动态模块通过静态方法接收配置：

```ts
import { DynamicModule, Module } from '@nestjs/common';

export interface StorageModuleOptions {
  basePath: string;
}

export const STORAGE_OPTIONS = Symbol('STORAGE_OPTIONS');

@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_OPTIONS,
          useValue: options,
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
```

根模块里调用：

```ts
@Module({
  imports: [StorageModule.forRoot({ basePath: './uploads' })],
})
export class AppModule {}
```

按惯例，`forRoot()` 多用于全局或一次性配置，`forFeature()` 多用于给某个功能模块注册局部资源。

## 11. 类中间件

Middleware 在路由处理器之前执行，能读写 Express 的请求和响应：

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on('finish', () => {
      console.log(
        request.method,
        request.originalUrl,
        response.statusCode,
        `${Date.now() - startedAt}ms`,
      );
    });

    next();
  }
}
```

在模块里注册：

```ts
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

@Module({})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: 'users', method: RequestMethod.ALL });
  }
}
```

`forRoutes()` 能接收路径配置或 Controller 类。调用 `next()` 后请求继续往后面的中间件和路由走；不调 `next()` 就得自己发响应，否则连接会一直挂着。

## 12. 函数中间件与全局注册

不需要依赖注入的话，可以写成普通函数：

```ts
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader(
    'x-request-id',
    request.header('x-request-id') ?? randomUUID(),
  );
  next();
}
```

在 `main.ts` 里全局注册：

```ts
app.use(requestId);
```

中间件按注册顺序执行。解析 Cookie、Session、CORS 或自定义认证信息时，顺序错了，后面的中间件就读不到想要的字段。

跨域优先用 Nest 提供的配置入口：

```ts
app.enableCors({
  origin: ['http://localhost:5173'],
  credentials: true,
});
```

只有要复用现成的 Express 生态配置时，才直接 `app.use(cors(...))`。项目换成 Fastify 的话，Express 专用的中间件不能直接照搬。

## 13. Middleware、Guard 与 Interceptor 怎么选

| 部件 | 更适合处理 |
| --- | --- |
| Middleware | 原始请求预处理、Cookie、日志、请求 ID、第三方 Express 中间件 |
| Guard | 身份认证、角色和权限判断 |
| Interceptor | 响应包装、耗时统计、缓存、调用前后逻辑 |
| Pipe | 参数转换与校验 |
| Exception Filter | 统一异常到 HTTP 响应的映射 |

在 Middleware 里判断 token 也行，但 Guard 离路由和元数据更近，做权限控制更合适。白名单别只比较 `originalUrl` 字符串，query string、尾斜杠和动态参数很容易绕过去，或者误伤正常请求。

## 14. 常见问题

### 14.1 请求一直转圈

中间件既没调 `next()`，也没用 `response.send()`、`response.end()` 这类方式结束响应。两条路至少要走一条，但也别先发响应再调 `next()`。

### 14.2 Session 每次请求都变

依次查：客户端有没有带 Cookie，CORS 允不允许 credentials，Cookie 的 `secure` 和 `sameSite` 适不适合当前环境，服务端多实例之间有没有共享 Session Store。

### 14.3 注入自定义 Provider 失败

`provide` 的 token 和 `@Inject()` 的参数要完全一样。字符串容易拼错，项目内部尽量用导出的 Symbol 常量。

### 14.4 导出了 Service 仍无法使用

源模块在 `exports` 里导出 Provider 之后，目标模块还要在 `imports` 里导入源模块。别把 Service 直接塞进 `imports`。

### 14.5 手动 `@Res()` 后接口没有返回

进了库特定的响应模式，Nest 就不再自动把返回值写进响应。确认调用了 `send()`、`json()` 或 `end()`，或者改用 `@Res({ passthrough: true })`。

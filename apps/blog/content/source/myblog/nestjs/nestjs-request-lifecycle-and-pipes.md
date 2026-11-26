---
title: NestJS 请求生命周期：Controller、Middleware、Pipe、Interceptor 与文件上传
slug: nestjs-request-lifecycle-and-pipes
date: 2026-07-13
categories:
  - 后端开发
tags:
  - NestJS
  - Middleware
  - ValidationPipe
  - Interceptor
  - Multer
---

在 NestJS 应用里，绝大多数“校验没生效、拦截器没执行、响应返回空白或文件流被序列化坏掉”的故障，根源都是对请求生命周期执行顺序以及各部件的边界分工不清。把 HTTP 请求从进入服务器到写出响应的每一步职责固定下来，路由、中间件、管道、拦截器、异常过滤器和文件流才不会互相冲突。

## 请求生命周期与横切部件选型

当一条 HTTP 请求进入 NestJS 管道后，各横切组件的实际执行顺序固定如下：

```text
HTTP Request
  -> Middleware（类中间件 / 函数中间件，预处理原始请求）
  -> Guard（身份认证与权限判定）
  -> Interceptor（前置切面：请求日志、计时起点）
  -> Pipe（参数类型转换与 DTO 校验）
  -> Controller / Service（执行核心业务）
  -> Interceptor（后置切面：RxJS 流改写统一响应格式）
  -> Exception Filter（捕获未处理异常并映射为标准 HTTP 错误）
  -> HTTP Response
```

不同组件在请求路径上离底层 HTTP 和路由元数据的距离不同，各自负责明确的边界：

| 组件 | 核心职责 | 典型适用场景 |
| --- | --- | --- |
| `Middleware` | 面向底层请求/响应流做预处理（不感知路由元数据） | 请求 ID 注入、Cookie/Session 解析、第三方 Express 中间件 |
| `Guard` | 基于 `ExecutionContext` 与元数据决定能否放行 | 登录校验、基于 `Reflector` 的角色权限控制 |
| `Interceptor` | 包裹处理器执行前后逻辑，基于 RxJS `Observable` | 统一响应包装、接口耗时统计、响应脱敏序列化 |
| `Pipe` | 拦截并转换/校验控制器方法入参 | 路径参数转数字/UUID、全局 DTO `ValidationPipe` |
| `Exception Filter` | 捕获处理链中抛出的异常并控制错误输出 | 统一错误 JSON 契约、屏蔽未知异常堆栈 |

## Controller 路由语义、参数读取与 `@Res` 陷阱

RESTful 接口设计的核心是围绕资源与 HTTP 方法表达操作语义（`POST /users` 创建、`GET /users/:id` 查询、`PATCH /users/:id` 局部更新、`DELETE /users/:id` 删除）。资源唯一标识放路径参数（`/users/42`），分页、排序与过滤条件放查询参数（`/users?page=2&role=admin`），切忌把过滤条件强行拼进路径段。

Controller 通过参数装饰器提取输入，并用 `@HttpCode()`、`@Header()` 或 `@Redirect()` 声明响应元数据：

```ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  VersioningType,
} from '@nestjs/common';
import type { Response } from 'express';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  @Get()
  findAll(@Query('page') page?: string, @Query('role') role?: string) {
    return { page, role };
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-request-id') requestId?: string,
  ) {
    return { id, requestId };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return { ok: true, email: body.email };
  }

  @Get('pixel.svg')
  getPixel(@Res({ passthrough: true }) response: Response) {
    response.type('image/svg+xml');
    return '<svg></svg>';
  }
}
```

对于需要兼容破坏性变更的接口，可以在 `main.ts` 启用版本控制（`app.enableVersioning({ type: VersioningType.URI })` 或 `VersioningType.HEADER`），再配合 `@Controller({ path: 'users', version: '1' })` 生成 `/v1/users` 路由。

**一旦在方法参数中注入 `@Res()` 却不开启 `{ passthrough: true }`，NestJS 会立即退回底层适配器控制模式，此时直接 `return` 结果会导致请求永远挂起直到超时。**

绝大多数接口应避免直接注入 Express `Response`，只有必须操作底层 Header/流且仍希望交由 Nest 序列化返回值或触发后续拦截器时，才使用 `@Res({ passthrough: true })`。

## Middleware 与 CORS 注册顺序

中间件分为支持依赖注入的**类中间件**（实现 `NestMiddleware`）和无状态的**函数中间件**。在模块中通过 `NestModule.configure()` 绑定作用路径，注意 NestJS 11 底层采用 `path-to-regexp` v8，全路由通配符须写为 `'{*splat}'`：

```ts
import {
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

export function requestId(req: Request, res: Response, next: NextFunction) {
  res.setHeader('x-request-id', req.header('x-request-id') ?? randomUUID());
  next();
}

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(requestId, LoggerMiddleware)
      .forRoutes({ path: 'users', method: RequestMethod.ALL });
  }
}
```

中间件严格按注册顺序执行，因此读取 Cookie 或 Session 之前必须保证解析中间件先行；跨域配置优先调用框架自带的 `app.enableCors({ origin: ['http://localhost:5173'], credentials: true })`，避免直接写死 Express 专属第三方中间件阻碍日后切换 Fastify 适配器。所有普通中间件分支必须二选一：要么调 `next()`，要么主动发送响应结束请求，绝不能发送响应后再调用 `next()`。

## Pipe 类型转换与全局 `ValidationPipe`

HTTP 路径参数与查询参数抵达服务端时全都是字符串。在代码里写成 `@Param('id') id: number` 只是编译期类型注解，运行时 `id` 依然是字符串。必须由 Pipe 在控制器执行前完成运行时转换和校验：

```ts
@Get(':id')
findOne(
  @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('active', ParseBoolPipe) active: boolean,
) {
  return { id, page, active };
}
```

当内置 Pipe 无法满足特定格式解析（如把逗号分隔 ID 列表转为整数数组）时，可实现 `PipeTransform` 编写自定义 Pipe：

```ts
@Injectable()
export class ParseIdListPipe implements PipeTransform<string, number[]> {
  transform(value: string): number[] {
    const ids = value.split(',').map(Number);
    if (ids.length === 0 || ids.some((id) => !Number.isInteger(id))) {
      throw new BadRequestException('ids 必须是逗号分隔的整数');
    }
    return ids;
  }
}
```

对于 JSON 请求体，全局开启 `ValidationPipe` 并配合 `class-validator` 与 `class-transformer` 是标准做法：

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
```

- `transform: true`：依据 `emitDecoratorMetadata` 反射将普通 JSON 对象实例化为对应的 DTO 类，并按类型装饰器转换基础字段。
- `whitelist: true`：自动剥离 DTO 类中未标注任何校验装饰器的多余属性。
- `forbidNonWhitelisted: true`：一旦客户端传入未声明的未知字段直接抛出 `400 Bad Request`，不再静默放行或忽略。

**如果在 `ValidationPipe` 中开启 `whitelist: true` 却忘记给某个 DTO 属性添加校验装饰器，该字段会在进入 Controller 前被整项剥离成 `undefined`。**

## RxJS 拦截器与全局异常过滤器

NestJS 拦截器围绕 RxJS `Observable` 运转：`next.handle()` 返回控制器执行结果的响应流，开发者可在其前后挂入耗时统计、日志记录或用 `map()` 包装统一输出结构：

```ts
// common/response.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, { success: true; data: T }>
{
  intercept(_context: ExecutionContext, next: CallHandler<T>) {
    return next.handle().pipe(map((data) => ({ success: true as const, data })));
  }
}
```

**全局响应包装拦截器必须避开 `StreamableFile`、SSE 长连接或手动接管 `@Res()` 的文件下载端点，否则二进制流或文本流会被强行转成 JSON 或触发重复写响应报错。**

异常出口使用实现 `ExceptionFilter` 的过滤器收口。通过根模块的 `APP_INTERCEPTOR` 和 `APP_FILTER` 注册（而非直接在 `main.ts` 调 `app.useGlobal*`），既能让全局组件接入 DI 容器注入日志或配置服务，也能保证 E2E 测试从 `AppModule` 启动时完整加载这套行为：

```ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const detail =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      error: detail,
    });
  }
}
```

未知错误（非 `HttpException`）只能在服务端日志里记录完整堆栈、SQL 和路径，对外响应必须收敛为脱敏后的通用错误码与描述。

## 文件上传（Multer）与流式下载安全边界

文件上传的真正风险不在接收 `multipart/form-data`，而在于目录逃逸、同名覆盖、伪造 MIME 类型与公开目录暴露私有文件。

在模块中配置 `MulterModule` 磁盘存储时，落盘目录必须使用 `process.cwd()` 拼接而非 `__dirname`（防止 TS 编译为 `dist/` 后路径偏移），生成随机文件名替代客户端原始 `originalname`，并在入口限制单文件大小与允许类型：

```ts
// upload/upload.module.ts
import { BadRequestException, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const uploadDir = join(process.cwd(), 'uploads');
mkdirSync(uploadDir, { recursive: true });

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const extensions: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
          };
          cb(null, `${randomUUID()}${extensions[file.mimetype] ?? '.bin'}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|webp)$/.test(file.mimetype);
        cb(
          allowed ? null : new BadRequestException('只允许 JPEG、PNG 或 WebP'),
          allowed,
        );
      },
    }),
  ],
})
export class UploadModule {}
```

Controller 结合 `FileInterceptor` 与 `ParseFilePipe` 完成单文件接收（多文件需换用 `FilesInterceptor` 与 `@UploadedFiles()`）：

```ts
@Post()
@UseInterceptors(FileInterceptor('file'))
upload(
  @UploadedFile(
    new ParseFilePipe({
      fileIsRequired: true,
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
      ],
      exceptionFactory: (msg) => new BadRequestException(msg),
    }),
  )
  file: Express.Multer.File,
) {
  return { filename: file.filename, size: file.size, mimeType: file.mimetype };
}
```

**`file.mimetype` 来自 HTTP 请求头极易被伪造，敏感业务必须在落盘后校验文件头魔数（Magic Bytes）并执行病毒查杀，且私有文件绝不能挂进 `app.useStaticAssets()` 公开静态目录。**

大文件下载切忌使用 `readFile()` 整块读入内存，应通过 NestJS 原生 `StreamableFile` 返回可读流并配合 `basename()` 或数据库文件 ID 查询隔离路径穿越：

```ts
@Get(':name/stream')
stream(@Param('name') name: string) {
  const safeName = basename(name);
  const filePath = join(process.cwd(), 'uploads', safeName);
  if (!existsSync(filePath)) throw new NotFoundException('文件不存在');

  return new StreamableFile(createReadStream(filePath), {
    type: 'application/octet-stream',
    disposition: `attachment; filename="${encodeURIComponent(safeName)}"`,
  });
}
```

若前端通过 `fetch` + `response.blob()` + `URL.createObjectURL()` 触发浏览器下载，下载触发后务必立刻调用 `URL.revokeObjectURL()` 释放本地对象内存。

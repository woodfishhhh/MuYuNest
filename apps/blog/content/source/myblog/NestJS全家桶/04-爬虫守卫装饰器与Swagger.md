---
title: NestJS 爬虫、守卫、自定义装饰器与 Swagger
date: 2026-07-13
updated: 2026-07-13
tags:
  - NestJS
  - Cheerio
  - Guard
  - Decorator
  - Swagger
source:
  - https://www.bilibili.com/video/BV1NG41187Bs/
bvid: BV1NG41187Bs
pages: P20-P23
categories:
  - 后端开发
draft: false
---

# NestJS 爬虫、守卫、自定义装饰器与 Swagger

一个可维护的 HTTP 服务不只要能发请求，还要解决四个问题：外部页面如何稳定解析，接口由谁访问，权限声明如何复用，以及这些约束怎样进入接口文档。

## 用 Axios 和 Cheerio 解析页面

Axios 负责 HTTP，Cheerio 负责在 Node.js 中解析 HTML。它不会执行页面中的 JavaScript，因此适合服务端已经返回完整 HTML 的页面。

```bash
npm i axios cheerio
```

先实现单页解析，不要一开始就把分页、下载和重试揉进同一个函数：

```ts
// crawler/crawler.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface CrawlPageResult {
  imageUrls: string[];
  nextUrl?: string;
}

@Injectable()
export class CrawlerService {
  private readonly client = axios.create({
    timeout: 10_000,
    maxRedirects: 3,
    headers: {
      'User-Agent': 'DocumentationBot/1.0 (+https://example.com/bot)',
    },
  });

  async parsePage(pageUrl: string): Promise<CrawlPageResult> {
    const response = await this.client.get<string>(pageUrl, {
      responseType: 'text',
    });
    const $ = cheerio.load(response.data);

    const imageUrls = $('.article-content img')
      .map((_index, element) => $(element).attr('src'))
      .get()
      .filter((src): src is string => Boolean(src))
      .map((src) => new URL(src, pageUrl).href);

    const nextHref = $('a[rel="next"]').attr('href');

    return {
      imageUrls,
      nextUrl: nextHref ? new URL(nextHref, pageUrl).href : undefined,
    };
  }
}
```

`new URL(src, pageUrl)` 同时处理绝对 URL、`/images/a.jpg` 和 `../a.jpg`，比手动拼域名可靠。选择器必须根据真实 DOM 调整；页面一改版，解析结果就可能变成空数组，因此需要对结果数量和关键字段做断言。

### 分页不要无限递归

爬取分页时要限制页数，并记录访问过的 URL，防止页面形成环：

```ts
async crawl(startUrl: string, maxPages = 20): Promise<string[]> {
  const pending: string[] = [startUrl];
  const visited = new Set<string>();
  const images = new Set<string>();

  while (pending.length > 0 && visited.size < maxPages) {
    const currentUrl = pending.shift()!;
    if (visited.has(currentUrl)) continue;

    visited.add(currentUrl);
    const page = await this.parsePage(currentUrl);

    page.imageUrls.forEach((url) => images.add(url));

    if (page.nextUrl && !visited.has(page.nextUrl)) {
      pending.push(page.nextUrl);
    }
  }

  return [...images];
}
```

这里不用无界递归，避免错误的“下一页”链接导致栈增长或死循环。还应遵守目标站点的服务条款、`robots.txt`、版权和访问频率限制；登录墙、验证码和反爬限制不是应该绕过的故障。

### 下载二进制文件

Axios 下载图片时使用流，避免把大文件全部缓存在内存：

```ts
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

async downloadImage(imageUrl: string, outputDir: string): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const url = new URL(imageUrl);
  const filename = basename(url.pathname) || `${Date.now()}.bin`;
  const outputPath = join(outputDir, filename);
  const response = await this.client.get(imageUrl, {
    responseType: 'stream',
  });

  await pipeline(response.data, createWriteStream(outputPath));
  return outputPath;
}
```

`Array.forEach(async () => ...)` 不会等待内部 Promise。批量下载可以用顺序 `for...of`，或者使用有限并发队列；不要直接 `Promise.all()` 数千个请求。文件名还要解决重复、非法字符和响应内容类型校验，生产任务应增加重试、退避、断点记录和失败清单。

### SSRF 风险

如果爬取地址来自接口参数，服务端可能被诱导访问 `127.0.0.1`、云元数据地址或内网管理系统。公开接口必须使用域名白名单，解析 DNS 后拒绝私网地址，并限制重定向目标。只校验字符串是否以 `https://` 开头远远不够。

## Guard 决定能否执行

Guard 在 Controller 之前返回布尔值，适合认证和授权。返回 `false` 时 Nest 会产生 403；认证失败需要明确返回 401 时，直接抛出 `UnauthorizedException`。

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; roles: string[] };
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('请先登录');
    }

    return true;
  }
}
```

示例中的 `request.user` 应由 Passport 策略、中间件或前置认证 Guard 在验证 JWT 后写入。不能从 `?role=admin` 读取角色，那相当于让客户端自己声明权限。

局部使用：

```ts
@UseGuards(AuthGuard)
@Controller('admin')
export class AdminController {}
```

全局 Guard 推荐通过 `APP_GUARD` 注册，这样可以使用依赖注入：

```ts
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

## 角色元数据

授权规则不应硬编码在 Guard 中。Controller 负责声明需要哪些角色，Guard 负责读取声明并判断当前用户。

```ts
// auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```ts
// auth/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRoles = request.user?.roles ?? [];

    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
```

`getAllAndOverride()` 同时读取方法和 Controller 上的元数据，方法声明优先。若业务要求用户拥有全部角色，把 `some()` 改为 `every()`，但必须先把权限语义写清楚。

```ts
@Roles('admin')
@UseGuards(AuthGuard, RolesGuard)
@Get('reports')
findReports() {
  return this.reportsService.findAll();
}
```

## 自定义参数装饰器

多个 Controller 都从 `request.user` 取用户时，可以封装参数装饰器：

```ts
// auth/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface CurrentUserValue {
  id: string;
  roles: string[];
  email: string;
}

export const CurrentUser = createParamDecorator(
  (
    field: keyof CurrentUserValue | undefined,
    context: ExecutionContext,
  ): CurrentUserValue | CurrentUserValue[keyof CurrentUserValue] => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { user: CurrentUserValue }>();

    return field ? request.user[field] : request.user;
  },
);
```

使用时既可以取完整用户，也可以只取一个字段：

```ts
@Get('me')
findMe(@CurrentUser() user: CurrentUserValue) {
  return user;
}

@Get('my-reports')
findMine(@CurrentUser('id') userId: string) {
  return this.reportsService.findByUser(userId);
}
```

这个装饰器只负责读取值，不负责认证。没有前置 Guard 时，`request.user` 仍可能不存在。

## 聚合装饰器

`applyDecorators()` 可以把一组重复声明组合起来：

```ts
import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

export function RequireRoles(...roles: string[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: '未登录或令牌无效' }),
    ApiForbiddenResponse({ description: '权限不足' }),
  );
}
```

聚合装饰器适合表达一个稳定的业务概念。不要为了少写两行代码，把毫无关系的缓存、限流、Swagger 和权限规则塞进一个名字含糊的装饰器。

## 配置 Swagger

安装 Nest 的 OpenAPI 集成：

```bash
npm i @nestjs/swagger
```

在启动入口创建文档：

```ts
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('后台服务 API')
  .setDescription('后台服务的 HTTP 接口')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api-docs', app, document);
```

启动后访问 `/api-docs`。生产环境不一定适合公开文档页面，可以通过环境变量关闭、增加鉴权，或只在内网暴露。

### Controller 与接口描述

```ts
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('用户')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  @Get(':id')
  @ApiOperation({ summary: '查询用户详情' })
  @ApiParam({ name: 'id', description: '用户 UUID', format: 'uuid' })
  @ApiQuery({
    name: 'includeProfile',
    required: false,
    type: Boolean,
    description: '是否包含公开资料',
  })
  @ApiOkResponse({ description: '查询成功', type: UserResponseDto })
  @ApiForbiddenResponse({ description: '权限不足' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeProfile', new DefaultValuePipe(false), ParseBoolPipe)
    includeProfile: boolean,
  ) {
    return this.usersService.findOne(id, includeProfile);
  }
}
```

`@ApiParam()` 描述 `:id`，`@ApiQuery()` 描述查询参数。文档中的 `required: true` 不会替代 Pipe 校验，Swagger 描述和运行时代码必须同时维护。

### DTO 模型

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'moyu@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 64, writeOnly: true })
  @IsString()
  @Length(8, 64)
  password!: string;

  @ApiPropertyOptional({ example: '木鱼' })
  @IsOptional()
  @IsString()
  nickname?: string;
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  nickname?: string;
}
```

请求 DTO 和响应 DTO 应分开。否则密码字段、内部角色或数据库列可能被错误地展示为响应结构。`@ApiProperty()` 负责 OpenAPI 模型，`class-validator` 装饰器负责运行时校验，两者职责不同。

### Bearer Token

`DocumentBuilder.addBearerAuth()` 注册安全方案，`@ApiBearerAuth()` 声明接口使用它。两者必须同时存在，名称也必须一致：

```ts
const config = new DocumentBuilder()
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'access-token',
  )
  .build();

@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {}
```

Swagger UI 的 Authorize 按钮只会把 `Authorization: Bearer ...` 加到请求头。它不会验证 Token，也不会自动创建 Guard；真正的安全边界仍然在认证策略和 Guard 中。

## 把文档与行为对齐

接口实现、权限和文档应该形成同一条约束链：

```text
ValidationPipe / DTO 约束输入
        ↓
AuthGuard 验证身份
        ↓
RolesGuard 校验权限元数据
        ↓
Controller 执行业务接口
        ↓
Swagger 描述输入、输出和错误响应
```

最常见的偏差有三类：文档写必填但代码接受空值，文档声明 Bearer Token 但接口没有 Guard，以及 DTO 暴露了不该返回的字段。接口测试应验证真实状态码和响应结构，OpenAPI 只能描述契约，不能替代运行时保护。

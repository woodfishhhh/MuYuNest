---
title: NestJS 认证授权、自定义装饰器与 Swagger 文档
slug: nestjs-auth-guards-and-swagger
date: 2026-07-13
categories:
  - 后端开发
tags:
  - NestJS
  - 认证授权
  - Guard
  - 装饰器
  - Swagger
---

把密码哈希、会话管理、路由守卫、自定义参数装饰器和 Swagger OpenAPI 拼装在一起时，最常见的隐患往往源于职责边界错位：例如让 Guard 去读取还没执行的 Interceptor 注入的用户对象、把 `AuthService` 和 HTTP `Session` 死绑导致无法复用、或者在 Swagger 文档里声明了必填与 Token 认证而运行时却没配 Guard 和 Pipe。

## 密码哈希与无状态认证边界

密码绝不能明文落库，也不该使用可逆加密或裸 SHA-256。标准做法是在注册时生成 16 字节随机盐并配合 `scrypt`（或 Argon2/bcrypt）计算慢哈希，以 `salt.hash` 格式存储；校验时重新计算后使用恒定时间的 `timingSafeEqual()` 对比，防止时序侧信道攻击：

```ts
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  return `${salt}.${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, storedHex] = stored.split('.');
  if (!salt || !storedHex) return false;

  const actual = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(storedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

`AuthService` 只负责查库与校验凭据，不直接读写 HTTP `Session` 或 `Cookie`，这样同一套认证逻辑可以被 HTTP Controller、WebSocket 网关或 CLI 复用：

```ts
@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async signup(email: string, password: string) {
    const existing = await this.usersService.findOneByEmail(email);
    if (existing) throw new BadRequestException('邮箱已被使用');
    return this.usersService.create(email, await hashPassword(password));
  }

  async signin(email: string, password: string) {
    const user = await this.usersService.findOneByEmail(email);
    const matched = user ? await verifyPassword(password, user.password) : false;
    if (!user || !matched) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    return user;
  }
}
```

**登录失败必须统一返回模糊的“邮箱或密码错误”，防止攻击者通过响应差异枚举已注册邮箱；同时数据库邮箱列必须加唯一约束，光靠“先查再写”挡不住并发重复注册。**

## Session、SVG 验证码与跨域凭据传递

NestJS 接入状态化会话时有两条路线：`cookie-session` 将签名后的少量状态直接存于客户端 Cookie（注意签名只防篡改不加密，严禁存敏感信息），适合极简状态；生产级支持服务端主动踢下线或大体积会话应采用 `express-session` 配合外部 Redis Store：

```ts
// main.ts（Express 适配器）
import session from 'express-session';

app.getHttpAdapter().getInstance().set('trust proxy', 1);
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

几个极易踩坑的 Cookie 配置：`secure: true` 要求强制走 HTTPS，本地 HTTP 开发开启后浏览器会静默丢弃 Cookie；部署在 Nginx 反向代理后面且启用 `secure` 时，必须配置 `trust proxy`，否则 Express 无法识别 TLS 终止代理传来的 `X-Forwarded-Proto`；前后端跨域携带 Cookie 时，服务端 CORS 必须开启 `credentials: true` 并指定精确来源，前端 `fetch` 也必须传入 `credentials: 'include'`。

若在登录链路中加入 SVG 验证码（如 `svg-captcha`），答案必须保存在服务端 Session 中，且在登录接口读取后**立刻执行 `delete request.session.captcha`**：

```ts
@Get('captcha')
createCaptcha(@Req() request: Request, @Res() response: Response) {
  const captcha = svgCaptcha.create({ size: 4, noise: 2, color: true });
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
```

一次校验后立刻删除验证码，防止同一张验证码在有效期内被脚本无限重放撞库。

## Guard 守卫、`Reflector` 元数据与执行顺序陷阱

Guard 在请求链路上位于 Middleware 之后、Interceptor 与 Pipe 之前，专门负责“认证是否通过（401）”和“角色权限是否匹配（403）”。注意当 `canActivate()` 返回 `false` 时，Nest 默认抛出 `403 Forbidden`；需要明确表达未登录时，必须主动抛出 `UnauthorizedException`（返回 `401`）。

角色授权规则应通过 `SetMetadata` 声明在 Controller 或方法上，再由 `RolesGuard` 注入 `Reflector` 读取：

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

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRoles = request.user?.roles ?? [];
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
```

`getAllAndOverride()` 会优先采纳方法级声明覆盖类级声明。若需全局启用认证守卫，推荐在根模块通过 `APP_GUARD` Provider 注册，方便 Guard 构造函数注入 `Reflector` 或其他服务。

**由于 Guard 严格先于路由 Interceptor 执行，任何依靠 Interceptor 挂载的 `request.currentUser` 在 Guard 阶段都是 `undefined`——需要供 Guard 判权的用户对象必须提前在 Middleware（或前面的认证 Guard）中加载。**

```ts
@Injectable()
export class CurrentUserMiddleware implements NestMiddleware {
  constructor(private readonly usersService: UsersService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const userId = req.session?.userId;
    if (userId) {
      req.currentUser = await this.usersService.findOne(userId);
    }
    next();
  }
}
```

对 Express 的 `Request` 扩展 `currentUser` 字段时，应通过 TypeScript 模块声明合并补全类型，切忌使用 `@ts-ignore`。此外切记 Session Cookie 里有 `userId` 不等于账号依然有效，敏感接口和管理员鉴权必须实时从数据库核查用户是否被禁用或降权。

## 自定义参数装饰器与聚合装饰器

`createParamDecorator` 允许把控制器里重复提取 `request.currentUser` 的样板代码封装成干净的参数装饰器：

```ts
// auth/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (field: keyof CurrentUserValue | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { user?: CurrentUserValue }>();
    const user = request.user;
    return field && user ? user[field] : user;
  },
);
```

参数装饰器本身只负责读取上下文，不提供任何认证拦截能力——如果方法上未挂载认证 Guard，`@CurrentUser()` 拿到的依然可能是 `undefined`。

当一组路由反复同时挂载角色元数据、双 Guard 与 Swagger 认证错误描述时，可以用 `applyDecorators()` 组合成一个表达明确业务语义的聚合装饰器：

```ts
import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

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

## Swagger（OpenAPI）集成与契约对齐

安装 `@nestjs/swagger` 后，在 `main.ts` 使用 `DocumentBuilder` 生成并挂载交互式文档；生产环境应通过环境变量控制关闭或限制在内网与鉴权后访问：

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('后台服务 API')
  .setDescription('后台服务的 HTTP 接口契约')
  .setVersion('1.0')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'access-token',
  )
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api-docs', app, document);
```

**`@ApiProperty()` 与 `@ApiBearerAuth()` 只负责生成 OpenAPI 描述文档，既不能替代 `ValidationPipe` 的运行时输入校验，也不能自动开启 Guard 认证拦截。**

在 DTO 与控制器上标注时，请求 DTO 与响应 DTO 务必拆分定义（避免把 `password` 或内部状态列暴露进文档与响应），安全方案名称（如 `'access-token'`）也必须与 `DocumentBuilder.addBearerAuth()` 保持完全一致：

```ts
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;
}

@ApiTags('用户')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  @Get(':id')
  @ApiOperation({ summary: '查询用户详情' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }
}
```

## 附：Axios + Cheerio 服务端静态抓取与 SSRF 边界

在 NestJS Service 中集成 `axios` 与 `cheerio` 抓取公开静态 HTML 页面时，需守住四条工程边界：`cheerio` 不执行客户端 JavaScript，仅适用服务端直接输出完整 HTML 的站点；分页抓取应采用带 `maxPages` 上限与 `Set` 去重的迭代队列，严禁无界递归；下载大文件时配置 `responseType: 'stream'` 走 `pipeline()` 落盘并用有限并发替代全量 `Promise.all`；若目标 URL 来自用户输入，必须做域名白名单和 DNS 解析后的私网 IP 拦截，防范 SSRF 探测 `127.0.0.1` 或云元数据接口。

```ts
@Injectable()
export class CrawlerService {
  private readonly client = axios.create({
    timeout: 10_000,
    maxRedirects: 3,
  });

  async parsePage(pageUrl: string) {
    const response = await this.client.get<string>(pageUrl, {
      responseType: 'text',
    });
    const $ = cheerio.load(response.data);
    const imageUrls = $('.article-content img')
      .map((_i, el) => $(el).attr('src'))
      .get()
      .filter((src): src is string => Boolean(src))
      .map((src) => new URL(src, pageUrl).href);

    return { imageUrls };
  }
}
```

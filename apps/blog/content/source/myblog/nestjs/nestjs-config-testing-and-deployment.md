---
title: NestJS 配置隔离、单元测试/E2E 测试与生产部署
slug: nestjs-config-testing-and-deployment
date: 2026-07-12
categories:
  - 后端开发
tags:
  - NestJS
  - ConfigModule
  - Jest
  - E2E
  - TypeORM
---

服务端代码在本地开发库跑通并不代表可上线：开发、测试、生产共用同一份配置或 SQLite 文件会瞬间污染数据；控制器单元测试通过却在真实 HTTP 请求里被 Pipe 或 Cookie 拦截；`AppModule` 和 `main.ts` 配置割裂导致 E2E 测试大面积 500。把多环境配置隔离、单测与 E2E 测试边界、QueryBuilder 参数绑定以及 TypeORM 0.3 迁移发布串成一条完整工程规范，服务才能安全上生产。

## `@nestjs/config` 多环境隔离与配置校验

开发、测试和生产环境必须使用独立的数据库与会话密钥，防止 E2E 测试清表逻辑误删开发数据。按 `NODE_ENV` 区分配置文件，并使用 `cross-env` 统一 Windows 与 Unix 的启动脚本写法：

```ini
# .env.development（与 .env.test 一并加入 .gitignore，禁止入库）
DB_NAME=db.sqlite
COOKIE_KEY=dev-only-secret
```

```json
{
  "scripts": {
    "start:dev": "cross-env NODE_ENV=development nest start --watch",
    "test:e2e": "cross-env NODE_ENV=test jest --config ./test/jest-e2e.json --maxWorkers=1"
  }
}
```

在 `AppModule` 中通过 `ConfigModule.forRoot()` 载入对应环境文件，配合 `TypeOrmModule.forRootAsync()` 注入 `ConfigService` 读取参数：

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [User, Report],
        synchronize: false,
      }),
    }),
  ],
})
export class AppModule {}
```

**生产环境绝不能依赖 `.env` 文件或把密码写死在仓库里，所有密钥和数据库连接串都应由部署平台注入环境变量，且启动时用 `getOrThrow()` 或校验 schema 做到缺项即失败。**

## Jest 单元测试与 Mock 边界

NestJS 使用 `Test.createTestingModule()` 构造隔离测试容器，让开发者只替换被测类的直接依赖，保留核心业务与密码学逻辑的真实执行：

```ts
type UsersPort = Pick<UsersService, 'findOneByEmail' | 'create'>;

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersPort>;

  beforeEach(async () => {
    users = {
      findOneByEmail: jest.fn(),
      create: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('注册时不会把明文密码交给持久化层', async () => {
    users.findOneByEmail.mockResolvedValue(null);
    users.create.mockImplementation(
      async (email, password) => ({ id: 1, email, password }) as User,
    );

    const user = await service.signup('a@example.com', 'secret123');
    expect(user.password).not.toBe('secret123');
    expect(user.password.split('.')).toHaveLength(2);
  });

  it('邮箱已存在时拒绝注册', async () => {
    users.findOneByEmail.mockResolvedValue({ id: 1 } as User);
    await expect(service.signup('a@example.com', 'secret123')).rejects.toThrow(
      BadRequestException,
    );
  });
});
```

Mock 的第一原则是**只验证可观察到的业务行为，不把 Mock 写成第二套数据库**。单个分支用静态 `mockResolvedValue`，只有“先写后读”连续状态流转才写极简的内存 Fake；异步报错统一使用 `await expect(promise).rejects.toThrow(...)`，避免脆弱的 `try/catch + done`。

**直接调用 Controller 方法的单元测试不会执行 `@Body()` DTO 校验、`ValidationPipe`、Guard 或 Cookie 中间件，这些 HTTP 管线行为必须交给 E2E 测试验证。**

| 验证目标 | 单元测试负责 | E2E 测试负责 |
| --- | --- | --- |
| 密码哈希与业务规则分支 | `AuthService`（Mock 仓储） | 补充验证接口响应不泄露密码 |
| 会话写入与控制器参数转交 | `Controller`（Mock Service） | 用 `request.agent` 跨请求持久化 Cookie |
| DTO 校验拒绝非法输入 | 不测装饰器 | 发送非法 Body 断言 `400` |
| Guard 拦截未登录或越权请求 | 可单测 `canActivate()` | 请求受保护端点断言 `401` / `403` |
| TypeORM 真实写库与约束 | 不用 Mock 猜测 | 连接独立测试库跑通真读写 |

## Supertest E2E 测试与共享应用配置

编写 E2E 测试最常踩的两个坑是：**测试跳过了 `main.ts` 导致全局管道/中间件缺失**，以及**并行测试抢占同一个 SQLite 文件报 `SQLITE_BUSY`**。

因为 `Test.createTestingModule({ imports: [AppModule] })` 只加载根模块而不执行 `main.ts`，所有只在 `main.ts` 注册的 `app.useGlobalPipes()`、`cookie-session` 或全局 Filter 在 E2E 里都会失效。稳妥做法是将全局 `APP_PIPE`、中间件注册放进 `AppModule`（或抽出共享的 `configureApp(app)` 函数供 `main.ts` 与测试共用）：

```ts
@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        cookieSession({
          keys: [process.env.COOKIE_KEY!],
          httpOnly: true,
          sameSite: 'lax',
        }),
      )
      .forRoutes('{*splat}');
  }
}
```

发送跨请求认证用例时，必须使用 `request.agent(app.getHttpServer())` 自动在请求间保留和回传 `Set-Cookie`（裸调 `request(app)` 每次请求都是无 Cookie 新会话）。同时在测试启动前删除旧 `test.sqlite`，每个 `beforeEach` 按“先从表、后主表”外键顺序清空记录，并使用 `--maxWorkers=1` 串行运行防止文件锁冲突：

```ts
const testDb = join(process.cwd(), 'test.sqlite');
let app!: INestApplication;

beforeAll(async () => {
  await rm(testDb, { force: true });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.init();
});

beforeEach(async () => {
  const dataSource = app.get(DataSource);
  await dataSource.getRepository(Report).clear();
  await dataSource.getRepository(User).clear();
});

afterAll(() => app.close());
```

如果测试库启用了 Migration 而非 `synchronize`，清理重建空库后必须先执行迁移脚本再跑用例。

## QueryBuilder 关联过滤与审核权限边界

在多条件范围检索（例如按品牌、型号、经纬度与年份邻近度估算二手车价格）中，普通 `find()` 无法表达算术距离过滤和排序，需要切换到 `QueryBuilder`。需要注意 Query String 入参必须先经过 DTO 的 `@Transform(({ value }) => Number(value))` 转为数字并校验范围，再进入查询：

```ts
async createEstimate(dto: GetEstimateDto) {
  const { make, model, year, mileage, lng, lat } = dto;

  const reports = await this.repo
    .createQueryBuilder('report')
    .where('report.make = :make', { make })
    .andWhere('report.model = :model', { model })
    .andWhere('ABS(report.lng - :lng) <= 5', { lng })
    .andWhere('ABS(report.lat - :lat) <= 5', { lat })
    .andWhere('ABS(report.year - :year) <= 3', { year })
    .andWhere('report.approved = :approved', { approved: true })
    .orderBy('ABS(report.mileage - :mileage)', 'ASC')
    .setParameter('mileage', mileage)
    .take(3)
    .getMany();

  if (reports.length === 0) return { price: null };
  const total = reports.reduce((sum, report) => sum + report.price, 0);
  return { price: total / reports.length };
}
```

**QueryBuilder 中只有第一个条件用 `where()`，后续所有追加条件必须用 `andWhere()`，再调用一次 `where()` 会直接覆盖前面全部过滤条件；所有外部参数一律用 `:paramName` 占位符绑定。**

同时业务审批流要保证新提交的报价默认 `approved: false`，只有通过了由 `CurrentUserMiddleware` 装载身份、再由 `AdminGuard` 放行的管理员审核接口后才进入估价样本；输出 `ReportDto` 只暴露 `userId` 而绝不整块返回关联的 `User` 实体。

## TypeORM 0.3 Migration 与生产部署检查

SQLite 仅适合本地快速原型和单机测试，其类型和约束检查远比生产数据库宽松，切忌把 SQLite 上的表现直接等同于 PostgreSQL/MySQL。生产环境配置如下：

```ts
const productionOptions = {
  type: 'postgres' as const,
  url: process.env.DATABASE_URL,
  synchronize: false,
  ssl: { rejectUnauthorized: false }, // 证书校验策略需按托管数据库服务商要求配置
};
```

**生产环境必须永久禁用 `synchronize: true`；所有表结构变更均通过 TypeORM 0.3 `DataSource` 入口生成并经人工审查 Migration（核对 `up()` 与 `down()` 回滚逻辑），作为独立发布前置步骤单实例串行执行。**

应用代码与 TypeORM 0.3 CLI 应当共用同一份 `DataSource` 配置，避免运行时和迁移脚本配置漂移；多副本容器部署时切忌在应用启动期盲目开启 `migrationsRun: true`，防止多个副本启动瞬间同时抢跑 DDL 迁移引发冲突。

完整发布流与上线核验清单：

1. 安装生产锁定依赖并执行 `nest build` 编译产出至 `dist/`。
2. 确认平台注入 `PORT`、`DATABASE_URL`、`COOKIE_KEY` 等必需环境变量（缺失即中止启动）。
3. 备份生产库后，由单个任务执行经过验证的 Migration。
4. 启动编译后产物 `node dist/main`（`start:prod`）。
5. 上线后依次验证：`/health` 探活、数据库读写日志、DTO 非法参数返回 `400`、受保护路由未登录返回 `401`、以及响应体无敏感字段泄漏。

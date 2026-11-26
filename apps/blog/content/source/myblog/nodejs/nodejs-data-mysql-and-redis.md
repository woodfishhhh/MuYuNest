---
title: Node.js 数据持久化与缓存：MySQL 连接池、Redis 与定时任务
slug: nodejs-data-mysql-and-redis
date: 2026-07-13
categories:
  - 后端开发
tags:
  - Node.js
  - MySQL
  - Redis
  - Lua
  - 定时任务
---

在 Node.js 后端服务里，MySQL 承担受事务和强约束保护的业务事实存储，Redis 承担高频读写、带过期语义的短期状态与原子计数。关系型表设计、SQL 优化与索引机制已在 MySQL 专栏（如 [MySQL 入门与 DDL](/posts/mysql-setup-ddl-and-types) 及 [事务与 MVCC](/posts/mysql-transactions-and-mvcc)）单独拆解，这里聚焦 Node.js 应用层如何安全地管理连接池、防止注入与并发竞态、做好架构分层，以及落稳 Redis 缓存、Lua 限流与自动化任务。

## `mysql2` 连接池与参数化防注入

应用层连接数据库绝不能在每个请求回调里新建并销毁 TCP 连接，而应由基础设施层统一维护连接池。将非敏感默认配置（主机、端口、库名、连接池上限）放在 `config/app.yaml`，把数据库密码留在环境变量中并在启动时强校验：

```ts
// src/infrastructure/database.ts
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import yaml from 'js-yaml';

interface FileDatabaseConfig {
  host: string;
  port: number;
  user: string;
  name: string;
  connectionLimit: number;
}

const configUrl = new URL('../../config/app.yaml', import.meta.url);
const loaded = yaml.load(await readFile(configUrl, 'utf8')) as {
  database?: Partial<FileDatabaseConfig>;
};
const file = loaded?.database;

if (
  typeof file?.host !== 'string' ||
  typeof file.port !== 'number' ||
  typeof file.user !== 'string' ||
  typeof file.name !== 'string' ||
  typeof file.connectionLimit !== 'number'
) {
  throw new Error('config/app.yaml 的 database 配置不完整');
}

const password = process.env.DB_PASSWORD;
if (!password) throw new Error('缺少环境变量 DB_PASSWORD');

const port = Number(process.env.DB_PORT ?? file.port);
const connectionLimit = Number(
  process.env.DB_POOL_SIZE ?? file.connectionLimit,
);

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !Number.isInteger(connectionLimit) ||
  connectionLimit < 1
) {
  throw new Error('数据库端口或连接池上限不合法');
}

export const db = mysql.createPool({
  host: process.env.DB_HOST ?? file.host,
  port,
  user: process.env.DB_USER ?? file.user,
  password,
  database: process.env.DB_NAME ?? file.name,
  connectionLimit,
  waitForConnections: true,
  queueLimit: 100,
});
```

**连接池上限必须按“应用进程数 × 单进程连接数 < 数据库最大连接数”核算，盲目调大单实例连接池在多进程或集群扩容时会直接打满 MySQL 连接槽位。**

接收外部 HTTP 请求写入 MySQL 时，必须守住三条防线：先检查 JSON 原始类型再做 `trim()` 规范化（避免 `String(['a'])` 悄悄把数组转成字符串）、使用 `?` 占位符执行参数化查询、检查写操作影响行数并在错误中间件统一收口：

```ts
import type { ResultSetHeader } from 'mysql2';

app.post('/users', async (req, res, next) => {
  try {
    const body: unknown = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return res.status(400).json({ message: '请求体必须是对象' });
    }

    const { name, email, age } = body as Record<string, unknown>;
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof age !== 'number'
    ) {
      return res.status(400).json({
        message: 'name、email 必须是字符串，age 必须是数字',
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !normalizedName ||
      normalizedName.length > 100 ||
      !normalizedEmail ||
      normalizedEmail.length > 320 ||
      !emailPattern.test(normalizedEmail) ||
      !Number.isInteger(age) ||
      age < 0 ||
      age > 150
    ) {
      return res.status(400).json({ message: 'name、email 或 age 不合法' });
    }

    const [result] = await db.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      [normalizedName, normalizedEmail, age],
    );

    res.status(201).json({ id: result.insertId, name: normalizedName });
  } catch (error) {
    next(error);
  }
});
```

执行 `UPDATE` 或 `DELETE` 时应检查 `result.affectedRows === 0` 并返回 `404`；更新字段白名单必须在服务端显式构造，严禁直接把整个 `req.body` 展开塞进 SQL，否则客户端可以顺手篡改 `role` 或 `status`。列表查询则应限制分页 `size` 上限，避免恶意大分页拖垮数据库。

## `mysql2`、Knex 与 Prisma 选型及事务原子性

三种常见数据访问工具操作的是同一台数据库，只是抽象层级不同：

| 工具 | 适用场景 | 仍需自行兜底的边界 |
| --- | --- | --- |
| `mysql2` | SQL 固定明确，需要极致的执行控制与零额外抽象 | 手写 SQL、结果类型映射、表结构迁移 |
| Knex | 动态筛选条件多、需要安全拼接查询链与统一事务包装 | 关联查询性能与表结构设计 |
| Prisma | TypeScript 强类型模型驱动开发，自动生成客户端与迁移 | 索引规划、长事务控制与 `BigInt` JSON 序列化转换 |

需要注意 Prisma 与原生类型的对齐：MySQL 里的 `BIGINT UNSIGNED`、`VARCHAR(100)` 与 `TIMESTAMP(0)` 应在 `schema.prisma` 中通过 `@db.UnsignedBigInt` 等原生修饰符精确保留；查询返回的 `BigInt` 不能直接丢给 `JSON.stringify()`，必须在序列化边界转为字符串。

**多步写操作一旦启用事务，回调内部必须统一复用事务句柄 `trx`，误用外部全局连接 `db` 会导致该条语句悄悄脱离事务原子性。**

以资金转账为例，金额必须用整数“分”规避浮点精度问题，前置校验正数与收付款人差异，并在数据库层使用同一 `trx` 配合条件更新防超扣：

```ts
if (!Number.isSafeInteger(amount) || amount <= 0) {
  throw new Error('转账金额必须是正整数');
}
if (fromId === toId) throw new Error('收款账户不能与付款账户相同');

await db.transaction(async (trx) => {
  const debited = await trx('accounts')
    .where({ id: fromId })
    .andWhere('balance', '>=', amount)
    .decrement('balance', amount);

  if (debited !== 1) throw new Error('余额不足或账户不存在');

  const credited = await trx('accounts')
    .where({ id: toId })
    .increment('balance', amount);

  if (credited !== 1) throw new Error('收款账户不存在');
});
```

## 服务端分层架构、IoC、DTO 校验与 JWT 链路

当接口规模增长时，将路由解析、业务规则与持久化拆进不同职责层能有效避免代码耦合：

```text
HTTP Request -> Controller -> Service -> Repository -> MySQL
```

- **Controller**：读取路径、查询参数与请求体，映射领域错误到 HTTP 状态码。
- **Service**：编排业务规则与数据库事务，不直接依赖 Express 的 `req` / `res`。
- **Repository**：封装具体 SQL 或 ORM 访问，向上层返回业务模型。

若要在 Express 中引入类与装饰器式的依赖注入，可以接入 `inversify` + `inversify-express-utils`（需在 `tsconfig.json` 开启 `experimentalDecorators` 与 `emitDecoratorMetadata`，并在程序最顶部导入 `reflect-metadata`）。依赖注入的核心价值在于剥离对象的创建权，让单元测试能够替换仓储实现；依赖关系简单时手工构造组装同样可行，不必为了形式强上容器。

在 HTTP 边界处，`class-validator` 与 `class-transformer` 负责将未知的 `req.body` 收敛为可信 DTO：

```ts
const dto = plainToInstance(CreateUserDto, input, {
  enableImplicitConversion: false,
});
const errors = await validate(dto, {
  whitelist: true,
  forbidNonWhitelisted: true,
});
```

关闭 `enableImplicitConversion` 可以防止字符串 `"18"` 被隐式混过数字校验；但入口校验只能提供友好的 `400` 响应，并发下防重复注册最终仍要靠数据库唯一索引兜底。

鉴权层常用 JWT 传递无状态身份凭证，但需注意 JWT Payload 只是 Base64URL 编码而非加密，严禁写入密码或敏感信息。验签时必须使用 `passport-jwt` 等库同时校验 `issuer`、`audience` 和签名算法；由于签名有效只代表令牌未过期，封禁用户或强制下线场景仍需在鉴权回调中回查用户状态或校验会话版本号。

## Redis 边界与数据结构选型

Redis 并非关系型数据库的替代品，它适合存放高频读写、允许过期、可从真相源重建的短期状态（验证码、限流计数、热点缓存、在线状态）；订单、余额等强一致性事实数据依然归属 MySQL。

**选型前先写出数据的访问动作，把所有对象统统序列化成 String 存储会彻底丧失 Redis 原子字段更新和集合运算的能力。**

| 数据结构 | 典型命令 | 适用场景 | 避坑边界 |
| --- | --- | --- | --- |
| String | `SET ... EX 60 NX` / `INCR` | 验证码、分布式锁、幂等标记、计数器 | 锁与验证码务必带过期时间，防止异常路径遗留永久垃圾 |
| Hash | `HSET` / `HGETALL` / `HDEL` | 字段扁平的实体属性缓存 | 不支持复杂嵌套与关系查询 |
| Set | `SADD` / `SISMEMBER` | 标签去重、已处理任务集合、活动参与者 | 大集合慎用全量 `SMEMBERS`，改用 `SSCAN` |
| List | `RPUSH` / `LPOP` | 简单轻量有序序列 | 进程在 `LPOP` 后崩溃会丢任务，可靠队列需用 Streams 或专业 MQ |

应用进程只应初始化少量长连接实例，并在缓存读写层统一处理 TTL 与 JSON 损坏兜底：

```ts
// infrastructure/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(
  process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  {
    connectTimeout: 5_000,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 2_000),
  },
);

redis.on('error', (error) => {
  console.error('redis error', error);
});

async function readCachedUser(id: number): Promise<UserSummary | null> {
  const raw = await redis.get(`user:summary:${id}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserSummary;
  } catch {
    await redis.del(`user:summary:${id}`);
    return null;
  }
}
```

普通内容缓存读失败时可以降级回源 MySQL，但限流器或分布式锁一旦报错绝不能静默当成放行处理。

## Lua 原子限流、Pub/Sub 与持久化误区

“30 秒内最多请求 5 次”不能在 Node.js 中拆成 `GET -> 判断 -> INCR` 两步执行，并发请求会在读写间隙同时穿过判断条件。把校验与自增封装进 Redis Lua 脚本，可以利用 Redis 单线程执行脚本的原子性消除竞态：

```lua
-- rate-limit.lua
local key = KEYS[1]
local window_seconds = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

local current = tonumber(redis.call("GET", key) or "0")
if current >= limit then
  return { 0, current, redis.call("TTL", key) }
end

local next_count = redis.call("INCR", key)
if next_count == 1 then
  redis.call("EXPIRE", key, window_seconds)
end

return { 1, next_count, redis.call("TTL", key) }
```

高频调用时可用 `SCRIPT LOAD` 缓存脚本摘要并调用 `EVALSHA`，同时捕获 `NOSCRIPT` 错误在 Redis 重启后自动重载一次；脚本本身必须简短，严禁在 Lua 中写入长循环或外部网络操作阻塞整个 Redis 实例。

使用 Redis 其他机制时需明确三项技术边界：

1. **Pub/Sub 不是可靠消息队列**：进入订阅模式的连接不能再发普通命令，需通过 `redis.duplicate()` 分离收发连接；Pub/Sub 只推给当前在线消费者，断线期间的消息直接丢失，只适合缓存失效广播或在线状态通知。
2. **`MULTI` 与 Lua 不支持回滚**：`MULTI/EXEC` 只保证命令按序排队执行，若脚本或事务中间某条写入因类型错误失败，前面已成功的写命令不会自动撤销。
3. **持久化与复制不能替代备份**：RDB 快照两次保存间可能丢数据，AOF 追加日志体积大；主从复制默认异步，刚写入主节点的数据未必能立刻从从节点读到，误删操作也会原样同步到从节点。生产环境开启持久化后必须定期做恢复演练。

## 分布式定时任务与 Serverless 运行时边界

单机使用 `node-schedule` 配合六段 Cron 表达式（`秒 分 时 日 月 星期`）极易写出“多实例重复跑、进程退出任务丢失、上一轮未结束下一轮又叠上来”的事故。

**多实例定时任务必须配合带 TTL 的分布式锁与业务幂等设计，锁只能降低并发冲突概率，最终一致性仍靠下游幂等兜底。**

```ts
async function runDailyCheckIn() {
  const day = new Date().toISOString().slice(0, 10);
  const lockKey = `jobs:check-in:${day}`;
  const acquired = await redis.set(
    lockKey,
    String(process.pid),
    'EX',
    600,
    'NX',
  );

  if (acquired !== 'OK') return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(process.env.CHECK_IN_URL!, {
      method: 'POST',
      headers: {
        cookie: process.env.CHECK_IN_COOKIE!,
        referer: process.env.CHECK_IN_REFERER!,
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = (await response.json()) as { success?: boolean };
    if (result.success !== true) throw new Error('业务执行失败');
  } finally {
    clearTimeout(timer);
  }
}
```

若将定时或 HTTP 任务迁移至 Serverless（FaaS + 平台触发器），云厂商接管了弹性扩缩与进程保活，但应用代码仍需应对四项运行时约束：首次请求或定时唤醒存在冷启动延迟、单次执行时长与 `/tmp` 临时磁盘有硬上限、AccessKey 等凭据只能配置在平台密钥管理中，以及函数高并发拉起时极易把外部 MySQL 和 Redis 连接打爆——数据库访问需配合连接池复用或 Serverless 数据代理。

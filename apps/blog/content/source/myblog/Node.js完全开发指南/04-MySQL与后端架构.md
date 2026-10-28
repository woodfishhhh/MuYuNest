---
title: MySQL 与后端架构
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - MySQL
  - ORM
  - Express
  - JWT
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
pages: P33-P43
draft: false
---

# MySQL 与后端架构

一个能用的新增用户接口，至少要守住三件事：输入不能直接拼进 SQL，数据库出错不能变成没有响应，请求结束后连接还能复用。

```ts
import express from 'express';
import type { ResultSetHeader } from 'mysql2';
import mysql from 'mysql2/promise';

const db = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

const app = express();
app.use(express.json());

app.post('/users', async (req, res, next) => {
  try {
    const body: unknown = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return res.status(400).json({ message: '请求体必须是对象' });
    }

    const { name, email, age } = body as Record<string, unknown>;
    if (
      typeof name !== 'string'
      || typeof email !== 'string'
      || typeof age !== 'number'
    ) {
      return res.status(400).json({
        message: 'name、email 必须是字符串，age 必须是数字',
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !normalizedName
      || normalizedName.length > 100
      || !normalizedEmail
      || normalizedEmail.length > 320
      || !emailPattern.test(normalizedEmail)
      || !Number.isInteger(age)
      || age < 0
      || age > 150
    ) {
      return res.status(400).json({ message: 'name、email 或 age 不合法' });
    }

    const [result] = await db.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      [normalizedName, normalizedEmail, age],
    );

    res.status(201).json({
      id: result.insertId,
      name: normalizedName,
      email: normalizedEmail,
      age,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: '数据库操作失败' });
});
```

`createPool` 管连接的生命周期，`execute` 的占位符把 SQL 结构和值分开，入口校验挡住明显的脏数据，错误中间件保证异常有统一的出口。先检查原始 JSON 的类型，再做 `trim()` 之类的规范化；直接 `String(value)` 或 `Number(value)`，会把数组、布尔值和空字符串悄悄变成看起来合法的另一种值。

## MySQL 先验收

Debian 或 Ubuntu 上可以直接装服务、启动，再做一次探活：

```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl enable --now mysql
sudo mysqladmin ping
sudo mysql -e "SELECT VERSION(), @@port;"
```

Windows 上用 MySQL Installer 装好 Server 和命令行客户端后，先确认实际的服务名再连接；默认服务名常见的是 `MySQL80`，但以第一条命令的输出为准：

```powershell
Get-Service -Name 'MySQL*'
Start-Service -Name 'MySQL80'
mysqladmin --host=127.0.0.1 --user=root --password ping
mysql --host=127.0.0.1 --user=root --password
```

`mysqladmin ping` 返回 `mysqld is alive` 只说明服务能连上，真正连接还要验证账号、密码、目标库和授权。应用别长期用 `root`，要建一个权限收窄的独立账号。

## 表先约束数据

关系型数据库的价值不只是"把对象存起来"。字段类型、主键、唯一约束和外键会一直约束数据，就算某个接口漏了校验，数据库也能拒绝不可能出现的状态。

```sql
CREATE DATABASE IF NOT EXISTS node_app
  DEFAULT CHARACTER SET utf8mb4;

USE node_app;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(320) NOT NULL,
  age INT UNSIGNED,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
);

CREATE TABLE photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photos_user_id (user_id),
  CONSTRAINT fk_photos_user
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

这些约束各管一块：

| 约束 | 防止的问题 |
| --- | --- |
| `PRIMARY KEY` | 一行数据无法被稳定定位 |
| `NOT NULL` | 必填字段悄悄变成空值 |
| `UNIQUE` | 邮箱等业务标识出现重复 |
| `FOREIGN KEY` | 作品指向不存在的用户 |
| 普通索引 | 高频条件只能扫描整张表 |

主键适合做内部身份。邮箱、用户名这些业务字段就算现在唯一，也不适合代替主键：业务规则会变，内部引用不该跟着变。

改表结构要留下迁移记录，别只在可视化工具里点几下：

```sql
ALTER TABLE users ADD INDEX idx_users_created_at (created_at);
ALTER TABLE photos ADD INDEX idx_photos_created_at (created_at);
```

加非空列时要想好旧数据怎么填；删列之前要确认读写它的旧版本应用已经下线。`DROP TABLE` 和 `DROP DATABASE` 会直接删掉结构和数据，别和删一行的 `DELETE` 搞混。

## 查询只取需要的列

列表接口别习惯性地 `SELECT *`。写明列名能减少传输，也免得以后加了内部字段被接口意外暴露。

```sql
SELECT id, name, age
FROM users
WHERE age >= 18
  AND name LIKE ?
ORDER BY id DESC
LIMIT ? OFFSET ?;
```

第 `page` 页、每页 `size` 条时：

```ts
const offset = (page - 1) * size;
```

`page` 和 `size` 要先转换、校验，再限制上限。允许客户端传一个特别大的 `size`，就等于允许它制造一次很贵的查询。

常用的匹配方式：

| 条件 | 含义 |
| --- | --- |
| `age >= 18 AND status = 'active'` | 同时满足 |
| `name = 'A' OR name = 'B'` | 满足任一条件 |
| `name LIKE '满%'` | 以“满”开头 |
| `name LIKE '%满%'` | 任意位置包含“满” |
| `name LIKE '_满'` | 前面恰好一个字符 |

前导百分号一般用不上普通的 B-Tree 索引。数据量大了，`LIKE '%词%'` 可能变成慢查询，要换全文索引或专门的搜索系统。

SQL 也能在结果返回之前完成计算和聚合：

```sql
SELECT
  COUNT(*) AS total,
  AVG(age) AS average_age,
  MIN(age) AS min_age,
  MAX(age) AS max_age
FROM users
WHERE status = 'active';

SELECT
  id,
  CONCAT(name, ' <', email, '>') AS label,
  IF(age >= 18, 'adult', 'minor') AS age_group,
  DATE_ADD(created_at, INTERVAL 7 DAY) AS follow_up_at
FROM users;
```

聚合适合把计算推到数据所在的地方，但别为了少写几行 Node.js 就堆出一段难维护的 SQL。判断标准：查询清不清楚，能不能用上索引，返回的数据量是不是真的少了。

## 写操作必须收窄范围

```sql
INSERT INTO users (name, email, age)
VALUES (?, ?, ?);

UPDATE users
SET name = ?, age = ?
WHERE id = ?;

DELETE FROM users
WHERE id = ?;
```

`UPDATE` 或 `DELETE` 漏了 `WHERE` 会影响整张表。接口层还要检查实际影响的行数：

```ts
const [result] = await db.execute<ResultSetHeader>(
  'UPDATE users SET name = ? WHERE id = ?',
  [name, id],
);

if (result.affectedRows === 0) {
  return res.status(404).json({ message: '用户不存在' });
}
```

把目标 `id` 放在路径里比较清楚：

```text
PATCH  /users/42
DELETE /users/42
```

服务端要从允许更新的字段里构造语句，不能把整个 `req.body` 原样交给数据库，不然客户端可能改到 `role`、`status` 这些本来不开放的字段。

## 关联查询

照片属于用户，返回照片和作者名时可以直接连两张表：

```sql
SELECT
  photos.id,
  photos.title,
  users.id AS user_id,
  users.name AS user_name
FROM photos
INNER JOIN users ON users.id = photos.user_id
WHERE photos.id = ?;
```

连接类型决定没匹配上的数据留不留：

| 连接 | 返回范围 |
| --- | --- |
| `INNER JOIN` | 两侧都能匹配的行 |
| `LEFT JOIN` | 左表全部行，右侧缺失时为 `NULL` |
| `RIGHT JOIN` | 右表全部行，左侧缺失时为 `NULL` |

要列出所有用户，包括还没上传作品的，就从 `users` 出发做左连接：

```sql
SELECT users.id, users.name, photos.title
FROM users
LEFT JOIN photos ON photos.user_id = users.id;
```

只是要拿另一条查询的结果当条件的话，子查询也很直接：

```sql
SELECT id, title
FROM photos
WHERE user_id = (
  SELECT id
  FROM users
  WHERE email = ?
  LIMIT 1
);
```

子查询不一定更慢，连接也不一定更快。最后要看执行计划、索引和数据分布；出现慢查询时用 `EXPLAIN` 看数据库实际选了哪条路径。

## 连接池归基础设施层

数据库连接别在每个路由里重新建。先装驱动和 YAML 解析器：

```bash
npm install mysql2 js-yaml
npm install --save-dev @types/js-yaml
```

`config/app.yaml` 只存能提交的、非敏感的默认值：

```yaml
database:
  host: 127.0.0.1
  port: 3306
  user: node_app
  name: node_app
  connectionLimit: 10
```

基础设施模块读 YAML，再用环境变量覆盖部署差异。密码没有 YAML 回退，缺了就直接不让进程启动：

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
const configText = await readFile(configUrl, 'utf8');
const loaded = yaml.load(configText) as {
  database?: Partial<FileDatabaseConfig>;
};
const file = loaded?.database;

if (
  typeof file?.host !== 'string'
  || typeof file.port !== 'number'
  || typeof file.user !== 'string'
  || typeof file.name !== 'string'
  || typeof file.connectionLimit !== 'number'
) {
  throw new Error('config/app.yaml 的 database 配置不完整');
}

const password = process.env.DB_PASSWORD;
if (!password) throw new Error('缺少环境变量 DB_PASSWORD');

const databaseConfig = {
  host: process.env.DB_HOST ?? file.host,
  port: Number(process.env.DB_PORT ?? file.port),
  user: process.env.DB_USER ?? file.user,
  password,
  database: process.env.DB_NAME ?? file.name,
  connectionLimit: Number(
    process.env.DB_POOL_SIZE ?? file.connectionLimit,
  ),
  waitForConnections: true,
  queueLimit: 100,
};

if (
  !Number.isInteger(databaseConfig.port)
  || databaseConfig.port < 1
  || databaseConfig.port > 65535
  || !Number.isInteger(databaseConfig.connectionLimit)
  || databaseConfig.connectionLimit < 1
) {
  throw new Error('数据库端口或连接池上限不合法');
}

export const db = mysql.createPool(databaseConfig);

export async function checkDatabase() {
  await db.query('SELECT 1');
}
```

YAML 解析器不会替换 `${DB_PASSWORD}` 这种占位符，覆盖逻辑要由代码明确执行。生产密码放环境变量或密钥服务，别提交进 YAML、`.env` 或源代码。连接池上限也不是越大越好：应用实例数乘以每个实例的连接数，不能超过数据库能承受的连接量。

## mysql2、Knex 还是 Prisma

三种方式操作的是同一个数据库，只是抽象层级不一样。

| 工具 | 适合的情况 | 仍要自己处理 |
| --- | --- | --- |
| `mysql2` | SQL 明确、需要精确控制 | SQL、结果类型、迁移 |
| Knex | 动态条件多、希望组合查询 | 表关系和 SQL 性能 |
| Prisma | TypeScript 模型驱动开发 | 索引、事务和迁移策略 |

### Knex 组合查询

```ts
import knex from 'knex';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

const users = await db('users')
  .select('id', 'name', 'age')
  .where('status', 'active')
  .andWhere('age', '>=', 18)
  .orderBy('id', 'desc')
  .limit(20);
```

查询链一般在 `await` 时才执行。调试动态查询时可以看生成的 SQL 和绑定值，但日志里别打出密码、token 这些敏感参数。

多个写操作要一起成功时，必须共用同一个事务对象：

```ts
// amount 使用最小货币单位，例如“分”
if (!Number.isSafeInteger(amount) || amount <= 0) {
  throw new Error('转账金额必须是正整数');
}
if (fromId === toId) throw new Error('收款账户不能与付款账户相同');

await db.transaction(async (trx) => {
  const debited = await trx('accounts')
    .where({ id: fromId })
    .andWhere('balance', '>=', amount)
    .decrement('balance', amount);

  if (debited !== 1) {
    throw new Error('余额不足或账户不存在');
  }

  const credited = await trx('accounts')
    .where({ id: toId })
    .increment('balance', amount);

  if (credited !== 1) {
    throw new Error('收款账户不存在');
  }
});
```

几个要点：

- 正数校验必须在写库之前做，不然负数会把"扣款"变成加款。
- 借记和贷记都必须正好影响一行，有一步不满足就抛错回滚。
- 事务里要是误用了全局的 `db`，那条语句就跑到事务外面去了。代码看着完整，原子性已经没了。

### Prisma 用模型生成客户端

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  name      String   @db.VarChar(100)
  email     String   @unique(map: "uk_users_email") @db.VarChar(320)
  age       Int?     @db.UnsignedInt
  status    String   @default("active") @db.VarChar(20)
  photos    Photo[]
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(0)

  @@map("users")
}

model Photo {
  id        BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  userId    BigInt   @map("user_id") @db.UnsignedBigInt
  title     String   @db.VarChar(200)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  user      User     @relation(fields: [userId], references: [id], map: "fk_photos_user")

  @@index([userId], map: "idx_photos_user_id")
  @@map("photos")
}
```

```bash
npx prisma migrate dev --name create_users_and_photos
```

```ts
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    photos: { select: { id: true, title: true } },
  },
});
```

原表用的是 `BIGINT UNSIGNED`、定长上限和 `TIMESTAMP`，Prisma 模型里也要保留这些原生类型，别拿默认的 `Int`、不带长度的 `String` 和普通的 `DateTime` 含糊代替。Prisma 返回的 `BigInt` 不能直接交给 `JSON.stringify()`，HTTP 响应要按接口约定转成字符串。类型提示也代替不了数据库知识：缺了索引，类型再准也会慢；关系和删除规则设计错了，生成的客户端也不会帮你改正业务。

## 分层只解决职责混乱

一个 API 项目常见的依赖方向：

```text
HTTP request
    -> Controller
    -> Service
    -> Repository
    -> MySQL
```

- Controller 读路径、查询和请求体，决定 HTTP 状态码。
- Service 执行业务规则和事务，不依赖 Express 的 `req`、`res`。
- Repository 封装数据访问，返回领域需要的数据。
- 基础设施层持有连接池、日志和外部客户端。

需要装饰器路由和容器装配的话，装 Inversify 的 Express 适配层：

```bash
npm install --save-exact express@4.22.2 inversify@6.2.2 inversify-express-utils@6.5.0 reflect-metadata@0.2.2
npm install --save-dev --save-exact @types/express@4.17.25
```

这组版本满足 `inversify-express-utils@6.5.0` 的 peer dependency，同时让 Express 停在 4.x、Inversify 停在 6.x。别省掉 `--save-exact`；还要提交生成的 `package-lock.json`，部署时用 `npm ci`，不然传递依赖还是可能漂移。

TypeScript 要开旧式装饰器和元数据输出：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

```ts
import 'reflect-metadata';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { Container, inject, injectable } from 'inversify';
import {
  controller,
  httpGet,
  InversifyExpressServer,
} from 'inversify-express-utils';
import type { RowDataPacket } from 'mysql2/promise';
import { db } from './infrastructure/database.js';

const TYPES = {
  UserRepository: Symbol.for('UserRepository'),
  UserService: Symbol.for('UserService'),
};

@injectable()
class UserRepository {
  async findByEmail(email: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, status FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, status FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  }
}

@injectable()
class UserService {
  constructor(
    @inject(TYPES.UserRepository)
    private readonly users: UserRepository,
  ) {}

  async getActiveUser(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== 'active') {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }
}

@controller('/users')
class UserController {
  constructor(
    @inject(TYPES.UserService)
    private readonly users: UserService,
  ) {}

  @httpGet('/active/:email')
  async getActive(request: Request, response: Response, next: NextFunction) {
    try {
      response.json(await this.users.getActiveUser(request.params.email));
    } catch (error) {
      next(error);
    }
  }
}

const container = new Container();
container
  .bind<UserRepository>(TYPES.UserRepository)
  .to(UserRepository)
  .inSingletonScope();
container.bind<UserService>(TYPES.UserService).to(UserService);

// UserController 所在模块必须在 build() 前被导入，装饰器才会注册路由。
const server = new InversifyExpressServer(container);
server.setConfig((app) => app.use(express.json()));
server.setErrorConfig((app) => {
  app.use((
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error(error);
    response.status(500).json({ message: '服务异常' });
  });
});

const app = server.build();
app.listen(3000);
```

`@injectable()` 让仓储和服务能被容器构造，`@inject()` 用稳定的 token 说明构造参数依赖什么，`@controller()` 和 `@httpGet()` 把控制器方法接到 Express 上。`reflect-metadata` 必须在这些类求值之前导入。依赖注入真正解决的是对象的创建权：业务类不再自己 `new` 下游依赖，测试时可以换绑定；依赖很少的时候手工装配也行，没必要硬上容器。

## DTO 守住 HTTP 边界

DTO 描述接口接受什么，不描述数据库里有什么：

```ts
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  validate,
} from 'class-validator';

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (
    typeof value === 'string' ? value.trim() : value
  ))
  name!: string;

  @IsString()
  @IsEmail()
  @Transform(({ value }) => (
    typeof value === 'string' ? value.trim() : value
  ))
  email!: string;

  @IsInt()
  @Min(0)
  age!: number;
}

async function parseCreateUser(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('INVALID_REQUEST');
  }

  const dto = plainToInstance(CreateUserDto, input, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new Error('INVALID_REQUEST');
  }

  return dto;
}
```

转换器只修剪本来就是字符串的值，不会把对象、布尔值或数组强转成文本；关掉隐式转换后，字符串 `"18"` 也冒充不了数字 `18`。入口校验负责给客户端一个清楚的 `400`，数据库约束负责保证最终一致性。两者不能互相代替：并发请求可能同时通过"邮箱是否存在"的查询，真正拦住重复的还是唯一索引。

## JWT 校验链路

JWT 的 Payload 只是 Base64URL 编码，没有加密。里面只放最少的身份声明，密码、手机号这些敏感数据别放进 token。

```ts
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('缺少 JWT_SECRET');

const userRepository = new UserRepository();

export function createAccessToken(userId: bigint) {
  return jwt.sign(
    { sub: String(userId) },
    secret,
    { expiresIn: '1h', issuer: 'node-app', audience: 'node-app-web' },
  );
}

passport.use(
  new Strategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      issuer: 'node-app',
      audience: 'node-app-web',
    },
    async (payload, done) => {
      try {
        if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub)) {
          return done(null, false);
        }

        const user = await userRepository.findById(payload.sub);
        if (!user || user.status !== 'active') return done(null, false);
        done(null, user);
      } catch (error) {
        done(error);
      }
    },
  ),
);

const requireJwt = passport.authenticate('jwt', { session: false });

app.get('/profile', requireJwt, (req, res) => {
  res.json(req.user);
});
```

签名有效只说明 token 没被篡改，不代表账户还有效。封禁、删除、权限变化这些状态要立刻生效的话，鉴权时还要查用户或者校验版本号。密钥要安全保存、定期轮换，访问 token 的有效期要短；退出登录、改密码和多端会话，要单独设计失效策略。

整条链路最后落在清楚的职责归属上：HTTP 层解释请求，业务层维护规则，数据层维护一致性，鉴权层只负责建立可信的身份。这些职责全混在一个路由函数里，功能也许照样能跑，但出了任何问题都很难定位。

---
title: Redis 与自动化任务
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - Redis
  - Lua
  - 定时任务
  - Serverless
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
pages: P44-P54
draft: false
---

# Redis 与自动化任务

"同一用户 30 秒最多请求 5 次"不能在 Node.js 里写成 `GET -> 判断 -> INCR`。两个请求可能同时读到一样的计数，然后一起放行。把判断和写入放进 Redis 的 Lua 脚本，这组操作中间才不会被别的命令插进来。

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

`KEYS` 只传 Redis key，`ARGV` 传窗口和阈值。脚本执行期间别的客户端插不进命令，所以"查次数"和"加次数"是一个原子步骤。

```ts
import fs from 'node:fs/promises';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 2,
});
const rateLimitScript = await fs.readFile('./rate-limit.lua', 'utf8');

app.post('/lottery', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const key = `lottery:rate:${userId}`;
    const result = await redis.eval(rateLimitScript, 1, key, 30, 5);
    const [allowed, count, ttl] = result as [number, number, number];

    res.setHeader('X-RateLimit-Limit', '5');
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, 5 - count)));

    if (allowed === 0) {
      res.setHeader('Retry-After', String(Math.max(1, ttl)));
      return res.status(429).json({ message: '请求过于频繁' });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
```

限流 key 要绑定真实的身份、IP 或资源，用固定的 key 会让所有用户共用一份额度。Redis 挂了的时候是放行还是拒绝，也要按业务风险明确选：防登录爆破一般偏向拒绝，低风险的推荐接口可以降级放行。

## Redis 放短期状态

MySQL 适合长期保存受约束的业务事实，Redis 适合高频访问、能过期、能重建的状态：

| 数据 | 更合适的位置 | 原因 |
| --- | --- | --- |
| 订单、账户余额 | MySQL | 需要事务和长期一致性 |
| 验证码 | Redis | 短时有效，按 key 读取 |
| 热门内容缓存 | Redis | 可重建，读频率高 |
| 限流计数 | Redis | 原子计数和 TTL |
| 在线连接状态 | Redis | 生命周期短、变化频繁 |

本地先把服务跑通，再接应用。Windows 可以用 Docker Desktop：

```bash
docker run --name redis-dev -p 127.0.0.1:6379:6379 -d redis:7-alpine
docker exec redis-dev redis-cli PING
# PONG
```

Ubuntu 或 Debian 直接装上并启动服务：

```bash
sudo apt install redis-server
sudo systemctl enable --now redis-server
redis-cli PING
# PONG
```

本机已经装了 Redis 的话，直接执行 `redis-server` 启动，再用 `redis-cli -h 127.0.0.1 -p 6379 PING` 检查。生产实例不能裸露在公网上，至少要限制监听地址和安全组，开认证或 ACL，连接信息放进环境变量或密钥系统。

## 数据结构由访问方式决定

### String：值、计数和过期

```redis
SET verify:1001 9527 EX 60 NX
GET verify:1001
TTL verify:1001

SET article:42:views 0
INCR article:42:views
```

`EX 60` 让 key 60 秒后失效，`NX` 保证只在不存在时写入。验证码、锁和幂等标记一般都要设过期时间，不然故障路径会留下永久的垃圾。

### Hash：扁平对象

```redis
HSET user:1 name xiaoman age 18
HGET user:1 name
HGETALL user:1
HDEL user:1 age
```

Hash 适合字段不多、整体关系简单的对象。嵌套关系、复杂查询和外键约束还是交给关系型数据库。

### Set：去重和成员判断

```redis
SADD article:42:tags node redis node
SMEMBERS article:42:tags
SISMEMBER article:42:tags redis
SREM article:42:tags redis
```

成员不会重复，适合标签、已处理的任务 ID、参与活动的用户这类集合。

### List：有序序列

```redis
RPUSH jobs email:1 email:2
LRANGE jobs 0 -1
LPOP jobs
LLEN jobs
```

List 能表达简单的队列，但"取出来之后进程崩了"可能导致任务丢失。真正的任务系统还需要确认、重试、死信和可观测性；可以用 Redis Streams 或成熟的队列，别只靠 `LPOP`。

选结构之前先写出访问动作：按字段改、判断成员、两端入队，还是原子计数。什么都 JSON 序列化成 String，会丢掉 Redis 数据结构自带的原子能力。

## ioredis 连接归谁管

应用一般只建少量长期连接，别每个请求都 `new Redis()`：

```ts
// infrastructure/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(
  process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  {
    connectTimeout: 5_000,
    lazyConnect: true,
    retryStrategy(times) {
      return Math.min(times * 100, 2_000);
    },
  },
);

redis.on('error', (error) => {
  console.error('redis error', error);
});

export async function connectRedis() {
  await redis.connect();
  await redis.ping();
}

export async function closeRedis() {
  await redis.quit();
}
```

`error` 监听器负责记录连接级别的异常，代替不了每次业务调用的异常处理。缓存读失败了可以回源 MySQL，限流和分布式锁失败了却不能悄悄当成成功。

写缓存时，序列化和 TTL 放在同一个地方：

```ts
type UserSummary = { id: number; name: string };

async function cacheUser(user: UserSummary) {
  await redis.set(
    `user:summary:${user.id}`,
    JSON.stringify(user),
    'EX',
    300,
  );
}

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

反序列化也会失败。旧版本留下的值、人工写进去的值、被截断的数据，都可能让 JSON 无效。缓存层要删掉坏值、回源，别让一个坏 key 一直把接口打挂。

## 发布订阅不是任务队列

订阅连接进了订阅模式就不能再当普通的命令连接用，所以收和发要分开：

```ts
const subscriber = redis.duplicate();
const publisher = redis.duplicate();

await Promise.all([
  subscriber.connect(),
  publisher.connect(),
]);

await subscriber.subscribe('salary');

subscriber.on('message', (channel, message) => {
  console.log({ channel, message });
});

await publisher.publish('salary', '300');
```

Pub/Sub 只把消息推给当时在线的订阅者，不存历史，也没有消费确认，订阅者断线期间的消息不会补发。适合在线通知和缓存失效广播，不适合必须处理一次的订单、邮件或扣款任务。

## MULTI 不等于数据库事务

```redis
MULTI
SET account:a 0
SET account:b 200
EXEC
```

`MULTI` 之后的命令先排队，`EXEC` 再按顺序执行；`DISCARD` 能放弃还没执行的队列。Redis 不会像 MySQL 那样自动回滚已经执行过的命令。Lua 也一样：脚本运行期间是原子的，但脚本中途报错时，之前已经完成的写入不会自动撤销。

涉及余额、库存这类强一致的业务，事实数据还是要放在支持完整事务语义的数据库里。Redis 可以负责锁、缓存或快速计数，但不能因为命令是连续执行的，就认为业务已经一致了。

## RDB、AOF 和复制

数据在内存里跑得快，不代表不需要恢复。Redis 有两种常见的持久化方式：

| 机制 | 写入方式 | 主要代价 |
| --- | --- | --- |
| RDB | 周期性生成快照 | 两次快照之间可能丢数据 |
| AOF | 追加记录写命令 | 文件更大，写放大更明显 |

```conf
save 3600 1
save 300 100
save 60 10000

appendonly yes
```

要不要同时开、同步频率设多高，取决于能接受丢多少数据、恢复要多久、磁盘性能怎么样。配了持久化也要实际演练恢复；只有备份文件、从没验证过能不能恢复，风险其实还在。

从节点可以分担读请求，并保留一份副本：

```conf
bind 127.0.0.1
port 6378
replicaof 127.0.0.1 6379
```

复制一般是异步的，刚写进主节点的数据，不保证马上能从副本读到。读写分离会带来短暂的旧数据；故障切换也要靠 Sentinel、Cluster 或外部编排来完成检测和选主。复制不是备份：误删的命令也会照样复制到副本。

## Lua 只保留必要逻辑

Redis 脚本用到的 Lua 语法不多：

```lua
local user = {
  name = "小满",
  age = 18,
  "node",
  "redis"
}

local function is_adult(age)
  return age >= 18
end

for index, value in ipairs(user) do
  print(index, value)
end

for key, value in pairs(user) do
  print(key, value)
end
```

- `local` 声明局部变量，避免污染全局环境。
- `nil` 表示不存在。
- Table 既能表示数组也能表示键值映射，数组索引从 `1` 开始。
- `ipairs` 遍历连续数组，`pairs` 遍历键值。
- 条件、循环和函数都用 `end` 结束。

脚本要短，因为执行期间 Redis 处理不了别的命令。复杂业务、网络请求和长循环都不该放进 Redis Lua；它最适合包几条必须原子执行的 Redis 命令。

高频的脚本可以先加载，再按 SHA 执行，省得每次都传完整文本：

```ts
let sha = await redis.script('LOAD', rateLimitScript) as string;

async function consumeRateLimit(key: string) {
  try {
    return await redis.evalsha(sha, 1, key, 30, 5);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('NOSCRIPT')) {
      throw error;
    }

    // Redis 重启后脚本缓存会消失。重新加载后只重试这一次。
    sha = await redis.script('LOAD', rateLimitScript) as string;
    return redis.evalsha(sha, 1, key, 30, 5);
  }
}

await consumeRateLimit(key);
```

## 定时任务不能只看 Cron

进程内任务的最小写法很简单：

```ts
import schedule from 'node-schedule';

const job = schedule.scheduleJob('0 30 0 * * *', async () => {
  await runDailyCheckIn();
});
```

这里是六段表达式：

```text
秒 分 时 日 月 星期
```

| 表达式 | 触发时间 |
| --- | --- |
| `*/5 * * * * *` | 每 5 秒 |
| `0 30 0 * * *` | 每天 00:30 |

真正容易出错的是任务语义：

- 进程退出后，进程内的定时器也就没了。
- 多实例部署时，每个实例都会执行同一个任务。
- 上一次还没跑完，下一次可能就叠上来了。
- 网络超时、凭据过期、远端返回 `500`，都要重试和告警。
- "请求成功"不代表业务成功，还要检查响应内容。

任务本身要能重复执行。以自动签到为例，每次执行带一个业务日期，并在 Redis 里抢一个带 TTL 的锁：

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

    if (!response.ok) {
      throw new Error(`签到失败：HTTP ${response.status}`);
    }

    const result = await response.json() as {
      success?: boolean;
      message?: string;
    };

    if (result.success !== true) {
      throw new Error(`签到失败：${result.message ?? '业务状态异常'}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
```

这个锁防的是多实例同时执行，但不是万能的：任务跑得比 TTL 还久，就可能再次并发；进程崩溃后，也要靠幂等设计来收尾。Cookie、Access Token 和用户标识都属于密钥，不能出现在仓库或普通日志里。

## Serverless 承担运行环境

云函数把运行时、扩缩容和触发器交给平台，但超时、重试、幂等和依赖的连接，业务代码还是得自己处理。

```js
exports.handler = async function handler(event) {
  try {
    const payload = typeof event.body === 'string'
      ? JSON.parse(event.body)
      : event.body;

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ ok: true, payload }),
    };
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: '请求体不是合法 JSON' }),
    };
  }
};
```

FaaS 以函数为部署和执行的单位，BaaS 提供认证、存储、数据库这些现成的后端能力。部署描述一般包括区域、运行时、入口、代码目录、内存、超时，以及 HTTP 或定时触发器：

```bash
s config add
s config get -a <alias>
s deploy
```

AccessKey 只能放进平台的凭据配置。还有几个限制：冷启动会让第一次调用更慢；执行时间和临时磁盘都有上限；连 Redis、MySQL 时要避免每次调用都建一堆连接。定时触发器能解决"本地进程退出后任务没了"的问题，但幂等、重试和告警还得业务自己补上。

Redis、Lua、Cron 和 Serverless 分别管状态、原子操作、触发时间和运行环境。失败策略和资源归属都补齐了，它们才能组成一条可靠的自动化链路。

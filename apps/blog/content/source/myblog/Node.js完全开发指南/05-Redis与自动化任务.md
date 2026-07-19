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

“同一用户 30 秒最多请求 5 次”不能写成 Node.js 里的 `GET -> 判断 -> INCR`。两个请求可能同时读到相同计数，然后一起通过。把判断和写入放进 Redis Lua 脚本，才能让这组操作不被其他命令插入。

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

`KEYS` 只传 Redis key，`ARGV` 传窗口和阈值。脚本执行期间，其他客户端不能插入命令，因此“检查次数”和“增加次数”是一个原子步骤。

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

限流 key 必须绑定真实身份、IP 或资源，固定 key 会让所有用户共享额度。Redis 不可用时是放行还是拒绝，也要按业务风险明确选择：登录防爆破通常应偏向拒绝，低风险推荐接口可能允许降级放行。

## Redis 放短期状态

MySQL 适合长期保存受约束的业务事实，Redis 适合高频访问、可过期、可重建的状态：

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

Ubuntu 或 Debian 直接安装并启动服务：

```bash
sudo apt install redis-server
sudo systemctl enable --now redis-server
redis-cli PING
# PONG
```

已有本机 Redis 时，直接执行 `redis-server` 启动，再用 `redis-cli -h 127.0.0.1 -p 6379 PING` 检查。生产实例不能裸露在公网。至少要限制监听地址和安全组，启用认证或 ACL，并把连接信息放在环境变量或密钥系统中。

## 数据结构由访问方式决定

### String：值、计数和过期

```redis
SET verify:1001 9527 EX 60 NX
GET verify:1001
TTL verify:1001

SET article:42:views 0
INCR article:42:views
```

`EX 60` 让 key 在 60 秒后失效，`NX` 保证只在不存在时写入。验证码、锁和幂等标记通常都必须设置过期时间，否则故障路径会留下永久垃圾。

### Hash：扁平对象

```redis
HSET user:1 name xiaoman age 18
HGET user:1 name
HGETALL user:1
HDEL user:1 age
```

Hash 适合字段较少、整体关系简单的对象。嵌套关系、复杂查询和外键约束仍应交给关系型数据库。

### Set：去重和成员判断

```redis
SADD article:42:tags node redis node
SMEMBERS article:42:tags
SISMEMBER article:42:tags redis
SREM article:42:tags redis
```

成员不会重复，适合标签、已处理任务 ID、活动参与用户等集合。

### List：有序序列

```redis
RPUSH jobs email:1 email:2
LRANGE jobs 0 -1
LPOP jobs
LLEN jobs
```

List 能表达简单队列，但“取出后进程崩溃”可能导致任务丢失。真正的任务系统还需要确认、重试、死信和可观测性；可以使用 Redis Streams 或成熟队列，而不是只靠 `LPOP`。

选择结构时先写出访问动作：按字段改、判断成员、两端入队，还是原子计数。把所有内容都 JSON 序列化成 String，会丢掉 Redis 数据结构提供的原子能力。

## ioredis 连接归谁管

应用通常只创建少量长期连接，而不是每个请求 `new Redis()`：

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

`error` 监听器负责记录连接级异常，但不能代替每次业务调用的异常处理。缓存读取失败时可以回源 MySQL，限流和分布式锁失败时却不能默默当成成功。

写缓存时把序列化和 TTL 放在同一处：

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

反序列化也会失败。旧版本留下的值、人工写入和截断数据都可能使 JSON 无效，缓存层应删除坏值并回源，而不是让一个坏 key 持续打挂接口。

## 发布订阅不是任务队列

订阅连接进入订阅模式后，不能再当普通命令连接使用，因此收发要分开：

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

Pub/Sub 只把消息推给当时在线的订阅者，不保存历史，也没有消费确认。订阅者断线期间的消息不会补发。它适合在线通知和缓存失效广播，不适合必须处理一次的订单、邮件或扣款任务。

## MULTI 不等于数据库事务

```redis
MULTI
SET account:a 0
SET account:b 200
EXEC
```

`MULTI` 后的命令先排队，`EXEC` 再按顺序执行；`DISCARD` 可以放弃尚未执行的队列。Redis 不会像 MySQL 那样自动回滚已经执行的命令。Lua 也一样：脚本运行期间具有原子性，但脚本中途报错时，之前完成的写入不会自动撤销。

涉及余额、库存等强一致业务时，事实数据仍应放在支持完整事务语义的数据库中。Redis 可以承担锁、缓存或快速计数，但不能只因为命令连续执行就假设业务已经一致。

## RDB、AOF 和复制

内存快不代表数据不需要恢复。Redis 提供两种常见持久化路径：

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

是否同时启用、同步频率设多高，要由可接受的数据丢失窗口、恢复时间和磁盘性能决定。配置了持久化也要实际演练恢复；只有备份文件却从未验证能否恢复，风险并没有消失。

从节点可以分担读并保留副本：

```conf
bind 127.0.0.1
port 6378
replicaof 127.0.0.1 6379
```

复制通常是异步的，刚写到主节点的数据不保证立刻能从副本读到。读写分离会引入短暂陈旧数据，故障切换也需要 Sentinel、Cluster 或外部编排来完成检测和选主。复制不是备份：误删命令同样会复制到副本。

## Lua 只保留必要逻辑

Redis 脚本用到的 Lua 语法并不多：

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
- Table 同时能表达数组和键值映射，数组索引从 `1` 开始。
- `ipairs` 遍历连续数组，`pairs` 遍历键值。
- 条件、循环和函数都以 `end` 结束。

脚本应短小，因为执行期间会阻塞 Redis 处理其他命令。复杂业务、网络请求和长循环不属于 Redis Lua；它最适合封装几条必须原子执行的 Redis 命令。

高频脚本可以先加载，再按 SHA 执行，避免每次传完整文本：

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

进程内任务最小写法很简单：

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

- 进程退出后，进程内定时器也会消失。
- 多实例部署时，每个实例都会执行同一任务。
- 上一次未完成，下一次可能重叠运行。
- 网络超时、凭据过期和远端 `500` 都需要重试与告警。
- “请求成功”不等于业务成功，还要检查响应内容。

任务本身应可重复执行。以自动签到为例，给每次执行一个业务日期，并在 Redis 中抢一个带 TTL 的锁：

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

这个锁防止多实例同时执行，但它不是万能锁：任务超过 TTL 时可能再次并发，进程崩溃后也需要靠幂等设计收尾。Cookie、Access Token 和用户标识属于密钥，不应出现在仓库或普通日志里。

## Serverless 承担运行环境

云函数把运行时、扩缩容和触发器交给平台，业务代码仍要处理超时、重试、幂等和依赖连接。

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

FaaS 以函数作为部署和执行单元，BaaS 则提供认证、存储、数据库等现成后端能力。部署描述通常包含区域、运行时、入口、代码目录、内存、超时和 HTTP 或定时触发器：

```bash
s config add
s config get -a <alias>
s deploy
```

AccessKey 只能进入平台凭据配置。冷启动意味着第一次调用可能更慢；执行时间和临时磁盘有限；连接 Redis、MySQL 时还要避免每次调用创建过多连接。定时触发器能解决“本地进程退出后任务消失”，却不会替业务补上幂等、重试和告警。

Redis、Lua、Cron 和 Serverless 分别解决状态、原子操作、触发时间和运行环境。只有把失败策略和资源所有权补齐，它们才会组成可靠的自动化链路。

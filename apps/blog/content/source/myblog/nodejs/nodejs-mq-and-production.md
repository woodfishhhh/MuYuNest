---
title: Node.js 消息队列（Outbox/RabbitMQ/Kafka）与生产运维
slug: nodejs-mq-and-production
date: 2026-07-13
categories:
  - 后端开发
tags:
  - Node.js
  - RabbitMQ
  - Kafka
  - Nacos
  - PM2
---

消息队列和微服务治理上线后，真正难排查的故障极少出在“消息发不出去”，而几乎全集中在写库与发消息的竞态窗口、消费者未幂等导致的重复处理、局部批量失败被静默吞掉、以及多进程部署下连接池和状态隔离失控。

## 写库和发消息之间的故障窗口：用 Outbox 封口

业务代码里最常见的双写写法藏着一个靠普通重试也补不上的致命竞态：

```ts
const order = await database.createOrder(input);
await messageBroker.publish('order.created', { orderId: order.id });
```

只要进程在 `createOrder` 提交后、`publish` 成功前崩溃或网络超时，数据库里就会多出一笔下游永远收不到的“幽灵订单”。把两行倒过来先发消息再写库同样不行——一旦事务回滚，下游已经按不存在的订单扣了库存或发了通知。

**跨数据库与消息队列无法共享同一个本地事务，稳妥做法是用 Outbox 表把“写订单”和“记待发事件”绑进同一次数据库事务。**

具体落地拆成两步：

1. 业务事务内同时写入 `orders` 和 `outbox`（带全局唯一的 `eventId` 与未发布状态），两张表同成功、同回滚。
2. 独立的 Relay 进程轮询未发布记录，投递到 Broker 并收到确认后，再把该条 `outbox` 标记为已发送。

```ts
import { randomUUID } from 'node:crypto';

await database.transaction(async (tx) => {
  const order = await tx.orders.create(input);

  await tx.outbox.create({
    id: randomUUID(),
    topic: 'order.created',
    aggregateId: order.id,
    payload: JSON.stringify({ orderId: order.id, userId: order.userId }),
    createdAt: new Date(),
  });
});

async function relay(batchSize = 100) {
  const events = await outbox.claimUnpublished(batchSize);

  for (const event of events) {
    try {
      await broker.publish(event.topic, event.payload, { eventId: event.id });
      await outbox.markPublished(event.id);
    } catch (error) {
      await outbox.release(event.id, error);
    }
  }
}
```

**Outbox 保证的是至少投递一次（At-Least-Once），消费者必须按 `eventId` 做幂等去重。**

因为 Relay 依然可能在“Broker 已收下消息、本地还没来得及执行 `markPublished`”这一瞬间重启，重启后会把同一条事件再发一遍。消费端只要把已处理的 `eventId` 记进去重表（与业务更新放在同一事务里），重复消息就能被安全吞掉。事件信封结构至少应包含 `id`、`type`、`schemaVersion`、`occurredAt` 和 `payload`，方便后续平滑演进字段。

## RabbitMQ 的确认链路、死信与路由选择

RabbitMQ 的可靠投递必须同时覆盖 Broker 持久化、生产者 Confirm 和消费者手动 Ack。只给消息加 `persistent: true` 是不够的：如果 Exchange 或 Queue 未设为 `durable: true`，Broker 重启后队列本身就会消失；生产端不等待 Confirm，也无从得知消息是否真正落盘。

```ts
import amqp from 'amqplib';
import { once } from 'node:events';

const connection = await amqp.connect(process.env.AMQP_URL!);
const channel = await connection.createConfirmChannel();

await channel.assertExchange('domain.events', 'topic', { durable: true });
await channel.assertExchange('domain.events.dlx', 'topic', { durable: true });

await channel.assertQueue('email.order-created.dead', { durable: true });
await channel.bindQueue(
  'email.order-created.dead',
  'domain.events.dlx',
  'email.order-created',
);

await channel.assertQueue('email.order-created', {
  durable: true,
  deadLetterExchange: 'domain.events.dlx',
  deadLetterRoutingKey: 'email.order-created',
});
await channel.bindQueue('email.order-created', 'domain.events', 'order.created');

async function publishOrderCreated(event: {
  id: string;
  type: string;
  payload: unknown;
}) {
  const accepted = channel.publish(
    'domain.events',
    'order.created',
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
      messageId: event.id,
      type: event.type,
    },
  );

  if (!accepted) await once(channel, 'drain');
  await channel.waitForConfirms();
}
```

需要注意，`channel.publish()` 返回 `false` 只是说明客户端发送缓冲区已满，必须等待 `drain` 事件处理背压，但并不代表发送失败；连接断开重连后，必须重新声明 Channel、Exchange、Queue 与消费者。

**消费者的 `channel.ack()` 必须放在数据库事务提交之后，遇到临时故障也绝不能直接 `nack(message, false, true)` 原地重回队列。**

```ts
channel.prefetch(10);

await channel.consume('email.order-created', async (message) => {
  if (!message) return;

  try {
    const event = parseAndValidateEvent(message.content);

    await database.transaction(async (tx) => {
      const inserted = await tx.processedEvents.tryInsert(event.id);
      if (!inserted) return;
      await tx.emailJobs.create({
        eventId: event.id,
        userId: event.payload.userId,
      });
    });

    channel.ack(message);
  } catch (error) {
    if (isPermanentMessageError(error)) {
      channel.nack(message, false, false);
      return;
    }

    await retryPublisher.schedule(message, error);
    channel.ack(message);
  }
});
```

直接 `requeue = true` 会在数据库短暂抖动时形成毫秒级热循环重试，把下游彻底压垮；正确做法是将可重试错误写入带递增延迟的 Retry 队列，超出重试上限再落入死信队列（保留原消息 ID、错误原因、首次失败时间和重试次数以便人工重放）；对于格式损坏或不支持版本的永久错误，直接 `nack(..., false)` 打入死信。

| Exchange 类型 | 路由匹配机制 | 典型适用场景 |
| --- | --- | --- |
| `direct` | Routing Key 精确匹配 | 明确指向单一队列的任务 |
| `topic` | `*` 匹配单段、`#` 匹配多段 | `order.created`、`order.paid` 等领域事件 |
| `headers` | 按消息头键值对组合匹配 | 存在多维路由属性的消息 |
| `fanout` | 忽略 Routing Key，广播至全部绑定队列 | 缓存失效广播、全站通知 |

使用 `fanout` 时每个下游服务必须绑定独立队列，若邮件服务和审计服务共用同一队列就会变成竞争消费；延迟任务可通过 `x-delayed-message` 插件（带 `x-delay` 头）实现，使用 TTL + 死信拼装时若同一队列混用不同过期时间会出现队头阻塞，而跨度数天以上的长周期任务则应存入数据库由调度器到期投递，避免长期堆积在 Broker。

## Kafka 分区顺序、Consumer Group 与容量规划

Kafka 的消息顺序仅在单个 Partition 内部严格成立。要让同一订单的 `order.created` 和 `order.paid` 按先后顺序被消费，生产端必须传入稳定的业务键 `key`：

```ts
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: process.env.KAFKA_BROKERS!.split(','),
});

const producer = kafka.producer({ allowAutoTopicCreation: false });
await producer.connect();

await producer.send({
  topic: 'order-events',
  messages: [
    {
      key: 'order:o_1',
      value: JSON.stringify({
        id: 'evt_1',
        type: 'order.created',
        schemaVersion: 1,
        orderId: 'o_1',
      }),
      headers: { traceId: 'trace_123' },
    },
  ],
});
```

在同一 Consumer Group 中，一个 Partition 同一时刻只能由组内一个消费者实例处理；不同 Consumer Group 各自独立维护 Offset，因此计费服务和审计服务可以互不干扰地消费同一份事件流。消费端处理单条消息时严禁吞掉异常，否则 Offset 继续向前推进会造成消息静默丢失；同时数据库提交后、Offset 提交前若发生崩溃，重启后会触发重复消费，同样必须依赖数据库内的唯一 `eventId` 幂等去重。单条消息处理耗时过长还会触发 Consumer Group Rebalance 暂停全部消费，重任务应拆解或异步解耦。

规划 Kafka 集群存储时可按公式倒推原始容量：`日均消息数 × 平均消息体积 × 保留天数 × 副本因子`，并额外留出索引、日志段和峰值余量。Kafka 的事务仅能原子提交一组 Kafka 写入或消费 Offset，无法把 MySQL 纳入同一个分布式事务——跨库与 Kafka 的一致性仍需靠 Outbox 或 CDC 保障。

| 需求特征 | 优先选择 |
| --- | --- |
| 任务队列、复杂路由（Direct/Topic/Fanout）、逐条 Ack 与死信控制 | RabbitMQ |
| 超高吞吐事件流、持久化长保留、多消费组独立按 Offset 回放 | Kafka |

## Nacos 服务发现与动态配置隔离

服务注册与发现最常犯的错误是在每次业务 HTTP 请求里同步现查注册中心，一旦注册中心抖动，所有接口会同时雪崩。正确模式是“本地内存快照 + 周期主动刷新 + Push 订阅更新 + single-flight 并发合并 + 超时兜底”：

```ts
import { NacosConfigClient, NacosNamingClient } from 'nacos';
import { request as httpRequest, type RequestOptions } from 'urllib';

const INSTANCE_MAX_STALE_MS = 15_000;
const INSTANCE_QUERY_TIMEOUT_MS = 2000;

const namingClient = new NacosNamingClient({
  logger,
  serverList: process.env.NACOS_SERVER_ADDR!,
  namespace: process.env.NACOS_NAMESPACE ?? 'public',
  httpclient: {
    request(url: string, options: RequestOptions = {}) {
      return httpRequest(url, {
        ...options,
        timeout: [INSTANCE_QUERY_TIMEOUT_MS, INSTANCE_QUERY_TIMEOUT_MS],
      });
    },
  },
});

await namingClient.ready();
await startDependencies();
await namingClient.registerInstance(
  'user-service',
  {
    ip: process.env.SERVICE_IP!,
    port: Number(process.env.PORT ?? 3001),
    weight: 1,
    enabled: true,
    healthy: true,
  },
  'DEFAULT_GROUP',
);
```

**服务必须在依赖全部就绪后再向 Nacos 注册实例，停机时则必须先调用 `deregisterInstance()` 摘除实例，再关闭端口并排空在途请求；读取本地快照时必须检查 `refreshedAt` 上限，避免注册中心失联后无限期使用过期地址。**

注意当主动调用 `getAllInstances(name, group, '', false)` 时，第四个参数必须传 `false` 禁用 SDK 本地缓存，且当注册中心明确返回合法空数组时应立即替换本地空快照让调用方快速失败，只有查询超时或格式损坏时才短暂保留上一版快照。

Nacos 动态配置适合存放开关、灰度比例和超时阈值，禁止用来热更新数据库连接池或明文密码。订阅配置变更回调时，必须先完整解析并校验新对象，校验失败则保持上一版 `Object.freeze` 后的不可变配置；发布配置的写入凭据属于管理面，应与业务实例的只读凭据严格分离。

## Elasticsearch 搜索投影与 Bulk 局部失败

Elasticsearch 是全文检索与分析投影，绝不能充当订单或余额等核心交易的唯一真相源；业务数据库提交事务后经 Outbox 或 CDC 同步更新 ES 索引，索引损坏或改写 Mapping 时随时能从真相源重建。

Mapping 在首次写入前由部署脚本建好（字段类型选错后通常需新建索引、重导数据并切换 Alias）。批量导入使用 `es.bulk()` 时最容易忽略一个陷阱：

```ts
const response = await es.bulk({
  operations: articles.flatMap((article) => [
    { index: { _index: 'articles', _id: article.id } },
    article,
  ]),
});

if (response.errors) {
  const failures = response.items
    .map((item, index) => ({ item, articleId: articles[index]?.id }))
    .filter(({ item }) => item.index?.error);

  throw new BulkIndexError(failures);
}
```

**`es.bulk()` 的 HTTP 请求返回 200 并不代表批次内的每条文档都写入成功，必须检查 `response.errors` 并逐条排查失败项。**

查询语法上，`match` 会触发分词，适合针对 `text` 字段做全文检索（多字段可用 `multi_match` 配合 `title^2` 加权）；`term` 与 `range` 属于精确或范围过滤，针对 `keyword` 与数值字段且应放入 `bool.filter` 中跳过相关性算分以利用缓存；仅需聚合统计时将 `size` 设为 `0` 避免拉回无用文档列表。

## `cluster`、PM2 与生产优雅关闭

单个 Node.js 进程的 JavaScript 主线程只能跑满一个 CPU 核心。多核扩展可以选择原生 `node:cluster` 或交由 PM2 在集群模式下托管，但**两者只能选其一**——如果在代码里调了 `cluster.fork()` 又在 PM2 里开 `exec_mode: 'cluster'`，会叠出两层进程树并让数据库连接数翻倍。

无论使用哪种多进程模式，每个 Worker 都拥有独立的 V8 堆内存：

- 进程内的 `Map`、内存限流计数和 Session 无法跨 Worker 共享，必须迁往 Redis 等外部存储。
- 数据库连接池总量按“Worker 数量 × 单进程 `connectionLimit`”翻倍放大，规划前必须与数据库最大连接数对齐。

推荐使用版本受控的 `ecosystem.config.cjs` 管理 PM2 生产配置：

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'api',
      script: './dist/server.js',
      instances: 4,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 10000,
      listen_timeout: 10000,
      wait_ready: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

配合 `wait_ready: true`，应用必须在完成端口监听和依赖初始化后再调用 `process.send?.('ready')`，并监听 `SIGINT`/`SIGTERM` 执行防重入的优雅退出：

```ts
const server = await startHttpServer();
process.send?.('ready');

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  const forceExit = setTimeout(() => process.exit(1), 9000);
  forceExit.unref();

  await server.close();
  await consumer.disconnect();
  await database.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
```

`pm2 list` 显示 `online` 只是进程拉起，远未达到上线验收标准。真正的发布完成标准是确认新实例健康检查通过、真实业务请求返回正常、消息消费者恢复消费、日志无循环重启告警，且旧实例已经完成连接排空与优雅退出。

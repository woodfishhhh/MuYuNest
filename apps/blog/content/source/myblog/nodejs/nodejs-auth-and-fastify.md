---
title: Node.js 鉴权体系（SSO/扫码登录）与 Fastify 服务实践
slug: nodejs-auth-and-fastify
date: 2026-07-13
categories:
  - 后端开发
tags:
  - Node.js
  - SSO
  - 鉴权
  - Fastify
  - 微服务
---

服务端安全与边界失控，往往源于把不同生命周期的凭证统称为 Token，以及让业务网关和下游接口裸露在未受控的输入与外部调用中。把“身份凭证建模 → 登录状态机 → 服务端外部代理边界 → Fastify 网关与服务拆分”串成一套职责清晰的架构，鉴权、流式转发和微服务治理才不会各自打架。

## 凭证隔离模型与 SSO 单点登录

身份体系里至少存在四类生命周期、可见范围和撤销策略完全不同的凭证：

```ts
type SessionKind =
  | 'identity_session'   // 认证中心的全局会话
  | 'app_session'        // 具体业务应用的独立会话
  | 'device_session'     // 单设备在线互斥标识
  | 'authorization_code'; // 短时一次性交换凭据
```

把这四类混用会直接导致跨应用越权、旧设备踢不掉、回调地址泄露长期令牌等故障。

**SSO 的核心是多个业务应用共享同一次认证中心身份核验，但每个应用必须持有作用域独立的业务令牌，绝不共用同一份 Token。**

```text
浏览器 → 业务应用 A → 认证中心（核验全局会话）
                    ← 一次性授权码（经浏览器回跳）
         应用 A 后端 → 用授权码换取受众为 A 的会话凭证
```

签名算法应采用非对称 `RS256`：只有认证中心保管私钥用于签发，业务应用只持公钥验签，即便某个边缘业务应用私钥或配置失守，攻击者也无法伪造其他应用的凭证。签发和校验时必须同时约束 `algorithms`、`issuer`、`audience` 和 `sub`：

```ts
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

function issueAccessToken(userId: string, audience: string) {
  return jwt.sign(
    { sub: userId, aud: audience },
    process.env.AUTH_PRIVATE_KEY!,
    {
      algorithm: 'RS256',
      issuer: 'https://auth.example.com',
      expiresIn: '15m',
      keyid: process.env.AUTH_KEY_ID,
    },
  );
}

function verifyAccessToken(token: string, publicKey: string) {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://auth.example.com',
    audience: 'article-app',
  });
}

async function createAuthorizationCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
}) {
  const code = randomBytes(32).toString('base64url');
  await redis.set(
    `auth-code:${code}`,
    JSON.stringify(input),
    'EX',
    60,
    'NX',
  );
  return code;
}
```

**授权码必须在 60 秒内过期且消费即销毁，读取与删除必须使用 Redis `GETDEL` 或 Lua 脚本原子完成，普通 `GET` 再 `DEL` 会留下并发重放窗口。**

回调 URL 校验必须对已注册的完整地址做精确等值匹配，杜绝前缀或子串匹配（避免 `https://app.example.com/callback.evil.com` 绕过），同时结合 `state` 防 CSRF 和 PKCE 防止公共客户端授权码被截获兑换。

## 单设备互斥登录与扫码登录状态机

实现“新设备登录顶掉旧设备”时，安全保证来自服务端下一次 API 请求的会话校验，WebSocket 推送只是为了提升前端及时弹窗退出的体验。

```ts
import { randomUUID } from 'node:crypto';

async function activateDevice(userId: string) {
  const nextSessionId = randomUUID();
  const key = `active-session:${userId}`;

  // SET ... EX ... GET 需要 Redis 6.2+，原子写入新会话并返回被替换的旧会话 ID
  const previousSessionId = await redis.set(
    key,
    nextSessionId,
    'EX',
    60 * 60 * 24 * 30,
    'GET',
  );

  if (previousSessionId) {
    socketHub.send(previousSessionId, {
      type: 'forced_logout',
      reason: 'signed_in_on_another_device',
    });
  }

  return nextSessionId;
}

async function assertActiveSession(userId: string, sessionId: string) {
  const activeSessionId = await redis.get(`active-session:${userId}`);
  if (activeSessionId !== sessionId) {
    throw new Error('session_replaced');
  }
}
```

切忌因为给旧设备发 WebSocket 通知失败就回滚新登录——旧连接可能早已断线或连在另一台实例上。真正的会话状态必须存储在 Redis 等共享存储中，浏览器 Canvas 指纹最多用于风控评分，不能替代服务端 `sessionId`。

扫码登录本质是一个受服务端严格约束的单向状态机。二维码内部只编码一个不透明随机 ID，状态迁移只允许单向推进：

```text
pending -> scanned -> authorized -> consumed
   \_______________________> expired
```

```ts
type QrStatus = 'pending' | 'scanned' | 'authorized' | 'consumed' | 'expired';

async function waitForQrResult(id: string, signal: AbortSignal) {
  while (!signal.aborted) {
    const response = await fetch(`/api/qr-sessions/${id}`, { signal });
    if (!response.ok) throw new Error(`qr_status_failed:${response.status}`);

    const result = await response.json();
    if (result.status === 'authorized') return result.authorizationCode;
    if (result.status === 'expired') throw new Error('qr_expired');
    if (result.status === 'consumed') throw new Error('qr_already_used');

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new DOMException('Polling aborted', 'AbortError');
}
```

移动端确认授权时必须同时验证“手机端本身已登录、二维码未过期、当前状态合法”三个条件；PC 端轮询拿到的应是一次性授权码而非长期 JWT，兑换后立即置为 `consumed` 防止截图重放，且需校验发起轮询的浏览器会话与创建二维码的浏览器一致。

## 服务端外部代理与高危交互边界

现代 Node.js 后端经常充当外部模型、对象存储和受控设备的操作代理，这些通道一旦缺少身份校验与背压控制就会成为漏洞或故障源。

### 1. AI 模型服务代理与流式背压

外部模型 API Key 严禁下发给浏览器或混入前端构建变量。服务端通过接口抽象（如 `TextGenerator`）隔离具体 SDK 版本变化，在流式转发时把客户端断连信号与超时信号合并传给上游：

```ts
import { once } from 'node:events';
import type { ServerResponse } from 'node:http';
import OpenAI from 'openai';

export interface TextGenerator {
  stream(input: string, signal: AbortSignal): AsyncIterable<string>;
}

async function writeSummaryStream(
  generator: TextGenerator,
  text: string,
  signal: AbortSignal,
  response: ServerResponse,
) {
  const clientController = new AbortController();
  const upstreamSignal = AbortSignal.any([signal, clientController.signal]);
  const abortUpstream = () => {
    clientController.abort(new Error('client_disconnected'));
  };

  response.once('close', abortUpstream);
  response.setHeader('content-type', 'text/plain; charset=utf-8');

  try {
    for await (const delta of generator.stream(
      `Summarize:\n\n${text}`,
      upstreamSignal,
    )) {
      if (!response.write(delta)) {
        await once(response, 'drain', { signal: upstreamSignal });
      }
    }

    if (!response.destroyed && !response.writableEnded) {
      response.end();
    }
  } finally {
    response.off('close', abortUpstream);
  }
}
```

**`response.write()` 返回 `false` 时必须等待 `drain` 事件，否则上游吐字速度大于客户端读取速度时内存会持续膨胀；多轮上下文 `responseId` 也必须与已鉴权的当前用户绑定。**

图片生成结果等大对象不应直接塞入 JSON 或数据库 Base64 字段，应先转存对象存储再返回短期签名 URL；针对外部模型调用只应对限流（429）或部分 5xx 做退避重试，已经开始吐字的流式请求不可盲目重试。

### 2. 上传隔离扫描与 OSS 客户端直传

用户上传的文件绝不能先落入公开静态目录再异步查杀，正确顺序是“先写入带体积上限的隔离区 → 调 ClamAV 扫描 → 验证内容与 MIME 一致 → 转正到对象存储”：

```ts
async function acceptUpload(stream: NodeJS.ReadableStream) {
  const quarantined = await quarantine.write(stream, {
    maxBytes: 20 * 1024 * 1024,
  });

  try {
    const scanResult = await clam.scanFile(quarantined.path);
    if (scanResult.isInfected === null) throw new Error('antivirus_scan_failed');
    if (scanResult.isInfected) {
      throw new Error(`malware_detected:${scanResult.viruses.join(',')}`);
    }
    return await objectStorage.promote(quarantined.path);
  } finally {
    await quarantine.remove(quarantined.path);
  }
}
```

注意 `scanStream` 会直接消费掉可读流，若后续还要上传同一份数据需先落隔离文件或分流；杀毒引擎不可用时应直接拒收或保留在隔离区，不能当成默认安全。

前端直传阿里云 OSS 等对象存储时，服务端签发 V4 预签名 `PUT` 地址（绑定允许的 `content-type`、Key 前缀与短过期时间）。由于预签名 `PUT` 无法在 URL 层面硬锁死字节上限，客户端回调 `/uploads/complete` 时服务端必须按当前用户的上传记录调用 `oss.head()` 核查真实对象大小与类型（或在需要强约束体积时改用带 Policy 条件的表单直传）；删除数据库记录与删除 OSS 对象之间应通过“先标待删、异步重试清理”保证最终一致。

### 3. 远程控制 WebSocket 通道边界

若服务端承载类似远程桌面的屏幕推流与键鼠事件通道（如 `ws` + 截图 + 原生输入模拟），绝不能靠一个可猜测的房间号直接放行控制权。必须在 HTTP `upgrade` 阶段完成双向鉴权并检查会话过期时间 `expiresAt`；升级后将控制权上下文存进 `WeakMap<WebSocket, RemoteSession>`，对每条输入消息限制 `maxPayload` 与每秒频率上限，拒绝二进制控制指令并把鼠标坐标归一化到 `0..1` 区间后再映射到被控端屏幕分辨率。

## Fastify 网关架构：Schema 校验、插件与熔断

把鉴权、限流、熔断和上游路由收敛进统一 API 网关时，Fastify 提供了比传统回调链更严格的输入输出契约和插件封装边界。

### 1. JSON Schema 双向裁剪与插件封装

Fastify 的路由 `schema` 同时驱动请求反序列化校验（底层基于 Ajv）与响应序列化裁剪（底层基于 `fast-json-stringify`）：

```ts
const createUserSchema = {
  body: {
    type: 'object',
    required: ['name', 'email'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 80 },
      email: { type: 'string', format: 'email' },
    },
  },
  response: {
    201: {
      type: 'object',
      required: ['id', 'name'],
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    },
  },
} as const;
```

**`additionalProperties: false` 在入口拒绝未声明的脏字段，在响应序列化层则直接过滤数据库实体里的密码哈希与内部状态列，防止随手返回整个模型时泄漏敏感字段。**

对于数据库连接、认证工具这类需要跨路由共享的资源，用 `fastify-plugin` 显式打破封装作用域并挂入 `onClose` 钩子优雅释放，而业务路由则按目录前缀封装隔离：

```ts
import fp from 'fastify-plugin';

const databasePlugin = fp(async (app) => {
  const db = await connectDatabase();
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await db.close();
  });
});

await app.register(databasePlugin);
await app.register(userRoutes, { prefix: '/users' });
```

### 2. 网关横切拦截、限流与熔断器

API 网关只负责鉴权校验、请求 ID 透传、限流、超时与熔断隔离，绝不能把“订单何时允许退款”这类领域规则塞进网关，更不能放任客户端伪造的内部身份头透传给下游：

```ts
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import type { FastifyReply, FastifyRequest } from 'fastify';
import CircuitBreaker from 'opossum';

const userOrigin = new URL(process.env.USER_SERVICE_ORIGIN!);

await app.register(fastifyJwt, { secret: process.env.GATEWAY_JWT_SECRET! });
await app.register(rateLimit, {
  global: false,
  hook: 'preHandler',
  keyGenerator: (request) => request.user.sub,
});

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    if (typeof request.user.sub !== 'string' || !request.user.sub) {
      throw new Error('missing_subject');
    }
  } catch {
    return reply.code(401).send({ code: 'unauthorized' });
  }
}

async function rejectGetOrHeadPayload(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const contentLength = Number(request.headers['content-length'] ?? 0);
  if (
    request.headers['transfer-encoding'] !== undefined ||
    !Number.isSafeInteger(contentLength) ||
    contentLength !== 0
  ) {
    return reply.code(400).send({ code: 'payload_not_allowed' });
  }
}

const userServiceBreaker = new CircuitBreaker(
  async (input: {
    path: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }) => {
    const response = await fetch(new URL(input.path, userOrigin), {
      method: input.method,
      headers: input.headers,
      body: input.body,
      signal: AbortSignal.timeout(1800),
    });
    if (response.status >= 500) throw new Error(`upstream_${response.status}`);
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? undefined,
      body: Buffer.from(await response.arrayBuffer()),
    };
  },
  {
    timeout: 2000,
    volumeThreshold: 10,
    errorThresholdPercentage: 50,
    resetTimeout: 10_000,
  },
);

app.all(
  '/users/*',
  {
    onRequest: [authenticate, rejectGetOrHeadPayload],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  },
  async (request, reply) => {
    const incomingUrl = new URL(request.raw.url!, 'http://gateway.internal');
    if (!incomingUrl.pathname.startsWith('/users/')) {
      return reply.code(400).send({ code: 'invalid_proxy_path' });
    }

    // 上游身份头必须由网关在剥离客户端伪造头后重新写入
    const result = await userServiceBreaker.fire({
      path: incomingUrl.pathname + incomingUrl.search,
      method: request.method,
      headers: {
        ...(request.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        'x-user-id': request.user.sub,
        'x-request-id': request.id,
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });

    if (result.contentType) reply.header('content-type', result.contentType);
    return reply.code(result.status).send(result.body);
  },
);
```

在 `onRequest` 阶段执行 `authenticate` 与 `rejectGetOrHeadPayload`，能让未授权请求和违规带 Body 的 GET/HEAD 在进入 Body 解析之前就被拦截；转发前应先剔除客户端自带的 `x-user-id` 与 `x-user-role` 等内部身份头，再由网关注入可信值（同时下游服务必须通过内网隔离或双向 TLS 确保只接收来自网关的流量）；每个下游服务应独享各自的 `CircuitBreaker` 实例，防止单个故障服务把全部路由拖进熔断状态。

### 3. 什么时候才值得拆微服务

把进程内函数调用换成跨网络 RPC 或 HTTP 调用，立刻会引入超时、部分失败、幂等键、分布式追踪和契约兼容等运维成本。**只有当模块确实需要独立扩容、故障强隔离、拥有独立的数据库边界且团队具备配套观测与发布能力时，拆分微服务才划算；否则优先采用内部模块与数据边界清晰的模块化单体，切忌让多个微服务共同直连同一组数据表。**

---
title: 登录体系、应用服务与 Fastify 微服务
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - SSO
  - WebSocket
  - Fastify
  - 微服务
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
pages: P65-P75
draft: false
---

# 登录体系、应用服务与 Fastify 微服务

登录系统最容易写错的地方，是把所有凭证都叫作 Token。认证中心的全局会话、业务应用会话、设备会话和扫码授权码不是一回事，它们的有效期、可见范围和撤销方式都应该不同。

```ts
type SessionKind =
  | 'identity_session'
  | 'app_session'
  | 'device_session'
  | 'authorization_code';
```

一旦这些边界混在一起，常见结果就是：A 应用的凭证能访问 B 应用、旧设备无法真正下线、二维码被重复领取，或者长期 Token 出现在 URL 和日志里。

## SSO 的凭证边界

SSO 只负责让多个应用复用同一次身份认证，不等于所有应用共用一份业务 Token。

```text
浏览器 → 业务应用 A → 认证中心
                    ← 一次性授权码
         应用 A 后端 → 用授权码换取 A 的会话

浏览器 → 业务应用 B → 认证中心
                    ← 另一枚一次性授权码
         应用 B 后端 → 用授权码换取 B 的会话
```

认证中心已经有全局会话时，可以省掉再次输入密码，但仍要为目标应用签发独立凭证。JWT 至少要校验：

- `iss`：只能接受预期的签发方。
- `aud`：凭证只能用于指定应用。
- `exp`：过期后必须拒绝。
- `sub`：稳定的用户标识，不能拿昵称或邮箱代替。

```ts
import jwt from 'jsonwebtoken';

function issueAccessToken(userId: string, audience: string) {
  return jwt.sign(
    {
      sub: userId,
      aud: audience,
    },
    process.env.AUTH_PRIVATE_KEY!,
    {
      algorithm: 'RS256',
      issuer: 'https://auth.example.com',
      expiresIn: '15m',
      keyid: process.env.AUTH_KEY_ID,
    },
  );
}
```

非对称签名让认证中心只保管私钥，业务应用只拿公钥验签。即使某个业务应用泄露，也不能伪造其他应用的凭证。这里容易炸在只调用 `jwt.verify()`，却没有同时限制 `algorithms`、`issuer` 和 `audience`：

```ts
const claims = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'https://auth.example.com',
  audience: 'article-app',
});
```

### 授权码不要复用

登录回跳只携带短时、一次性的授权码，不直接携带访问 Token：

```ts
import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

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

交换授权码时必须原子地读取并删除。普通的 `GET` 后接 `DEL` 存在竞争窗口，两个请求可能同时拿到同一份数据；使用 Redis `GETDEL` 或 Lua 脚本才能保证只消费一次。

回调地址也不能做模糊匹配。`https://app.example.com/callback.evil.com` 不应因为包含合法字符串而通过。服务端应该按已注册的完整 URL 精确比较，并用 `state` 绑定发起登录的浏览器会话；公共客户端再配合 PKCE，避免截获授权码后直接兑换。

## 单设备登录

单设备登录的安全目标不是“通知旧设备”，而是让旧会话在下一次 API 请求时必然失败。WebSocket 只负责及时更新界面。

```ts
import { randomUUID } from 'node:crypto';

async function activateDevice(userId: string) {
  const nextSessionId = randomUUID();
  const key = `active-session:${userId}`;

  const previousSessionId = await redis.set(
    key,
    nextSessionId,
    'EX',
    60 * 60 * 24 * 30,
    'GET',
  );

  return { nextSessionId, previousSessionId };
}
```

登录成功后，服务端把 `sessionId` 写入用户当前活跃会话。每次鉴权都比较当前值：

```ts
async function assertActiveSession(userId: string, sessionId: string) {
  const activeSessionId = await redis.get(`active-session:${userId}`);

  if (activeSessionId !== sessionId) {
    throw new UnauthorizedError('session_replaced');
  }
}
```

拿到旧 `sessionId` 后，可以向对应 WebSocket 推送下线事件：

```ts
if (previousSessionId) {
  socketHub.send(previousSessionId, {
    type: 'forced_logout',
    reason: 'signed_in_on_another_device',
  });
}
```

以上 Redis 示例统一使用 `ioredis`，所以 `SET` 的 `EX`、`NX`、`GET` 都使用位置参数；不要把 `node-redis` 的对象选项混进来。`GET` 需要 Redis 6.2 及以上版本。推送失败不能回滚新登录。旧连接可能已经断开，也可能位于另一台服务实例上；真正的撤销状态必须落在 Redis 或数据库，而不是某个 Node.js 进程的 `Map`。

Canvas 指纹最多用于风险评分。浏览器升级、显卡驱动和隐私策略都可能改变指纹，因此不能用它替代服务端生成的 `sessionId`，也不能仅凭指纹一致就跳过密码或二次验证。

## 扫码登录状态机

二维码里只放不透明的随机 ID：

```text
https://auth.example.com/scan?q=8Q0x...t6k
```

服务端维护真正的授权状态：

```ts
type QrStatus =
  | 'pending'
  | 'scanned'
  | 'authorized'
  | 'consumed'
  | 'expired';

interface QrLoginSession {
  id: string;
  status: QrStatus;
  browserSessionId: string;
  userId?: string;
  expiresAt: number;
}
```

状态只能单向变化：

```text
pending → scanned → authorized → consumed
   └──────────────→ expired
```

手机确认时要同时满足三个条件：手机自身已经登录、二维码未过期、当前状态仍允许授权。PC 领取结果时，还要确认创建二维码的浏览器会话没有变化。

```ts
async function waitForQrResult(id: string, signal: AbortSignal) {
  while (!signal.aborted) {
    const response = await fetch(`/api/qr-sessions/${id}`, { signal });

    if (!response.ok) {
      throw new Error(`qr_status_failed:${response.status}`);
    }

    const result = await response.json();

    if (result.status === 'authorized') return result.authorizationCode;
    if (result.status === 'expired') throw new Error('qr_expired');
    if (result.status === 'consumed') throw new Error('qr_already_used');

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new DOMException('Polling aborted', 'AbortError');
}
```

轮询必须能在页面卸载时取消，并设置总超时。拿到的仍应是一次性授权码，而不是长期 JWT；授权码兑换成功后立刻把状态改为 `consumed`，否则截图或历史响应都可能被重放。

## AI 调用放在服务端

浏览器不能直接持有模型供应商的 API Key。业务 API 需要先完成身份校验、输入限制和用量控制，再调用外部模型：

```ts
import OpenAI from 'openai';
import { once } from 'node:events';
import type { ServerResponse } from 'node:http';

export interface TextGenerator {
  generate(input: string, signal: AbortSignal): Promise<string>;
  stream(input: string, signal: AbortSignal): AsyncIterable<string>;
}

class OpenAiTextGenerator implements TextGenerator {
  private readonly client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  private readonly model = process.env.OPENAI_TEXT_MODEL!;

  async generate(input: string, signal: AbortSignal) {
    const response = await this.client.responses.create(
      {
        model: this.model,
        input,
      },
      { signal },
    );

    if (!response.output_text) throw new Error('empty_model_output');
    return response.output_text;
  }

  async *stream(input: string, signal: AbortSignal) {
    const events = await this.client.responses.create(
      {
        model: this.model,
        input,
        stream: true,
      },
      { signal },
    );

    for await (const event of events) {
      if (event.type === 'response.output_text.delta') {
        yield event.delta;
      }
    }
  }
}

export class AiService {
  constructor(private readonly generator: TextGenerator) {}

  async summarize(text: string) {
    if (text.length === 0) throw new Error('empty_input');
    if (text.length > 20_000) throw new Error('input_too_large');

    const signal = AbortSignal.timeout(20_000);
    return this.generator.generate(
      `Summarize the following text:\n\n${text}`,
      signal,
    );
  }

  streamSummary(text: string, signal: AbortSignal) {
    if (text.length === 0) throw new Error('empty_input');
    if (text.length > 20_000) throw new Error('input_too_large');

    return this.generator.stream(
      `Summarize the following text:\n\n${text}`,
      signal,
    );
  }
}

const ai = new AiService(new OpenAiTextGenerator());
const summary = await ai.summarize(articleText);

async function writeSummaryStream(
  text: string,
  signal: AbortSignal,
  response: ServerResponse,
) {
  const clientController = new AbortController();
  const upstreamSignal = AbortSignal.any([
    signal,
    clientController.signal,
  ]);
  const abortUpstream = () => {
    clientController.abort(new Error('client_disconnected'));
  };

  response.once('close', abortUpstream);
  response.setHeader('content-type', 'text/plain; charset=utf-8');

  try {
    for await (const delta of ai.streamSummary(text, upstreamSignal)) {
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

`response.write()` 返回 `false` 时必须等到 `drain`，否则模型输出速度高于客户端读取速度时，待发送数据会持续堆在内存里。客户端断开会触发 `AbortController`，合并后的 `upstreamSignal` 继续传进 SDK，外部流也会停止，而不是只停止本地写响应。

`openai` SDK 的入口、事件名和模型名都可能随版本变化，所以这些细节只留在 `OpenAiTextGenerator`。业务层只依赖 `TextGenerator`，升级时先按锁定的 SDK 版本调整适配器并做集成测试。API Key 只从服务端环境变量读取，不能返回给浏览器，也不能出现在前端构建变量中。

### 多轮上下文要绑定会话

后续请求可以传入上一次的 `response.id`，而不是只把当前一句话当成完整对话：

```ts
const conversationClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function reply(
  message: string,
  previousResponseId: string | undefined,
  signal: AbortSignal,
) {
  const response = await conversationClient.responses.create(
    {
      model: process.env.OPENAI_TEXT_MODEL!,
      input: [{ role: 'user', content: message }],
      previous_response_id: previousResponseId,
      store: true,
    },
    { signal },
  );

  if (!response.output_text) throw new Error('empty_model_output');
  return { responseId: response.id, text: response.output_text };
}
```

服务端要把 `responseId` 与已鉴权的业务会话绑定，不能允许客户端继续他人的响应链。长对话仍会消耗上下文窗口和输入 token，需要设定轮数、总长度和过期时间。

### 图片结果不直接塞进 JSON

```ts
const imageClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateImage(prompt: string, signal: AbortSignal) {
  if (prompt.length === 0) throw new Error('empty_prompt');
  if (prompt.length > 4000) throw new Error('prompt_too_large');

  const result = await imageClient.images.generate(
    {
      model: process.env.OPENAI_IMAGE_MODEL!,
      prompt,
      size: '1024x1024',
    },
    { signal },
  );

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error('empty_image_output');
  return Buffer.from(base64, 'base64');
}
```

图片是大对象，更适合写入对象存储后返回短期签名 URL，而不是把 Base64 常驻在数据库或普通 JSON 响应中。还要限制尺寸、并发和用户配额，并单独处理内容安全拒绝。

超时不能省。外部请求悬挂会占住连接和内存；重试也只能针对限流、网络断开和部分 5xx，并设置次数与退避。对已经开始流式返回的请求盲目重试，可能把两次结果拼到一起。日志中记录请求 ID、耗时、错误类型和用量即可，不要把密钥或完整敏感提示词写进去。

## 远程桌面的权限边界

远程桌面至少包含两条数据通道：

```text
被控端：屏幕帧 → 编码 → 传输 → 控制端显示
控制端：输入事件 → 鉴权 → 传输 → 被控端执行
```

输入协议需要显式限制事件类型：

```ts
type RemoteInput =
  | { type: 'pointer_move'; x: number; y: number }
  | { type: 'pointer_click'; button: 'left' | 'right' }
  | { type: 'key'; key: string; action: 'down' | 'up' };
```

坐标不能直接照搬浏览器像素。控制端画面可能被缩放，必须把坐标归一化到 `0..1`，再按被控屏幕分辨率换算，并拒绝越界值。

被控端可以用 `screenshot-desktop` 采集画面、`ws` 传输二进制帧，再由 `robotjs` 执行经过授权和校验的输入：

```ts
import { setTimeout as delay } from 'node:timers/promises';
import robot from 'robotjs';
import screenshot from 'screenshot-desktop';
import { WebSocket, WebSocketServer } from 'ws';

interface RemoteSession {
  id: string;
  canControl: boolean;
  expiresAt: number;
}

const remoteWss = new WebSocketServer({
  noServer: true,
  maxPayload: 8 * 1024,
});
const remoteSessions = new WeakMap<WebSocket, RemoteSession>();

httpServer.on('upgrade', async (request, socket, head) => {
  try {
    const session = await authorizeRemoteSession(request);
    if (!session.canControl) throw new Error('control_not_allowed');
    if (session.expiresAt <= Date.now()) throw new Error('session_expired');

    remoteWss.handleUpgrade(request, socket, head, (ws) => {
      remoteSessions.set(ws, session);
      remoteWss.emit('connection', ws, request);
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

remoteWss.on('connection', (ws) => {
  const session = remoteSessions.get(ws);
  if (!session?.canControl || session.expiresAt <= Date.now()) {
    return ws.close(1008, 'not_authorized');
  }

  const screen = robot.getScreenSize();
  let stopped = false;
  let inputWindowStartedAt = Date.now();
  let inputCount = 0;

  const closeIfExpired = () => {
    if (Date.now() < session.expiresAt) return false;
    stopped = true;
    ws.close(1008, 'session_expired');
    return true;
  };

  const consumeInputBudget = () => {
    const now = Date.now();
    if (now - inputWindowStartedAt >= 1000) {
      inputWindowStartedAt = now;
      inputCount = 0;
    }

    inputCount += 1;
    return inputCount <= 60;
  };

  const expiryTimer = setInterval(() => {
    closeIfExpired();
  }, 1000);
  expiryTimer.unref();

  ws.on('message', (raw, isBinary) => {
    if (closeIfExpired()) return;
    if (!consumeInputBudget()) {
      stopped = true;
      return ws.close(1008, 'rate_limited');
    }

    try {
      if (isBinary) throw new Error('binary_input_not_allowed');
      const input = parseAndValidateRemoteInput(JSON.parse(raw.toString()));

      if (input.type === 'pointer_move') {
        robot.moveMouse(
          Math.round(input.x * (screen.width - 1)),
          Math.round(input.y * (screen.height - 1)),
        );
      } else if (input.type === 'pointer_click') {
        robot.mouseClick(input.button);
      } else {
        robot.keyToggle(input.key, input.action);
      }
    } catch {
      stopped = true;
      ws.close(1008, 'invalid_input');
    }
  });

  ws.once('close', () => {
    stopped = true;
    clearInterval(expiryTimer);
  });

  void (async () => {
    while (!stopped) {
      if (closeIfExpired()) break;

      if (
        ws.readyState === WebSocket.OPEN &&
        ws.bufferedAmount < 1024 * 1024
      ) {
        ws.send(await screenshot({ format: 'png' }), { binary: true });
      }
      await delay(200);
    }
  })().catch(() => ws.close(1011, 'screen_capture_failed'));
});
```

`authorizeRemoteSession` 必须在 WebSocket 升级前完成双向身份校验。升级、每条输入消息和画面定时循环都重新检查 `expiresAt`；到期后服务端主动关闭连接。`maxPayload` 挡住超大消息，独立的输入计数器限制事件速率，`parseAndValidateRemoteInput` 再限制事件类型、按键白名单和归一化坐标。这个循环只能用于自己拥有或明确获准控制的设备，不能把示例端口直接暴露到公网，也不能绕过被控端的可见确认和随时断开能力。

原生输入模拟依赖常常要经过 `node-gyp` 编译。安装失败时应核对 Node.js ABI、Python、C/C++ 工具链和目标操作系统，而不是不断重装 npm 包。

这类服务一旦暴露到公网，就相当于开放键盘和鼠标权限。最低边界包括双向身份认证、短时授权、端到端加密、被控端可见确认、操作审计、速率限制和随时可用的紧急断开。只凭一个可猜测房间号连接是不可接受的。

## 上传先隔离再扫描

上传接口不能先把文件放入公开目录，再异步决定它是否安全。正确顺序是先隔离：

```ts
import NodeClam from 'clamscan';

const clam = await new NodeClam().init({
  preference: 'clamdscan',
  removeInfected: false,
  quarantineInfected: false,
  clamdscan: {
    host: process.env.CLAMD_HOST ?? '127.0.0.1',
    port: Number(process.env.CLAMD_PORT ?? 3310),
    timeout: 30_000,
    localFallback: false,
  },
});

function assertClean(result: {
  isInfected: boolean | null;
  viruses: string[];
}) {
  if (result.isInfected === null) throw new Error('antivirus_scan_failed');

  if (result.isInfected) {
    throw new Error(`malware_detected:${result.viruses.join(',')}`);
  }
}

async function scanFile(path: string) {
  assertClean(await clam.scanFile(path));
}

async function scanStream(stream: NodeJS.ReadableStream) {
  assertClean(await clam.scanStream(stream));
}

async function acceptUpload(stream: NodeJS.ReadableStream) {
  const quarantined = await quarantine.write(stream, {
    maxBytes: 20 * 1024 * 1024,
  });

  try {
    await scanFile(quarantined.path);
    return await objectStorage.promote(quarantined.path);
  } finally {
    await quarantine.remove(quarantined.path);
  }
}
```

`scanFile` 适合 ClamAV 与应用能访问同一隔离文件的主流程。远程 `clamd` 看不到应用本机路径时，应由应用打开文件并调用 `scanStream`。`scanStream` 会消费输入流，只适合无需再次读取的流，或先通过受控的落盘/分流管道保留副本；不能扫描完同一个流后又假设还能继续上传。

这里容易炸在只检查扩展名。文件名、MIME 类型和真实文件头可能互相矛盾；压缩包还要限制递归层级、文件数量与解压后总体积，防止路径穿越和压缩炸弹。

杀毒引擎不可用时，不应把文件当作“默认安全”。可以返回可重试错误或继续留在隔离区。病毒库版本、扫描耗时和失败率需要监控，扫描通过也只代表没有命中当前规则，不代表绝对无害。

## OSS 的对象模型

对象存储没有真正的目录树。`users/u_1/avatar.png` 是一个 Object Key，斜杠通常只是命名约定。

```ts
import { randomUUID } from 'node:crypto';
import OSS from 'ali-oss';

const oss = new OSS({
  region: process.env.OSS_REGION!,
  bucket: process.env.OSS_BUCKET!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
});

function createObjectKey(userId: string, extension: string) {
  return `users/${userId}/${randomUUID()}.${extension}`;
}

async function uploadToOss(
  key: string,
  stream: NodeJS.ReadableStream,
  contentType: string,
) {
  return oss.putStream(key, stream, {
    headers: { 'content-type': contentType },
  });
}

async function deleteFromOss(key: string) {
  await oss.delete(key);
}

async function createDirectUpload(userId: string, contentType: string) {
  const allowedTypes = new Set(['image/png', 'image/jpeg']);
  if (!allowedTypes.has(contentType)) throw new Error('unsupported_media_type');

  const key = createObjectKey(userId, 'bin');
  const uploadUrl = await oss.signatureUrlV4(
    'PUT',
    300,
    { headers: { 'content-type': contentType } },
    key,
    ['content-type'],
  );

  return { key, uploadUrl, contentType, expiresIn: 300 };
}
```

浏览器直传时必须使用签名时相同的请求方法和 Header：

```ts
await fetch(ticket.uploadUrl, {
  method: 'PUT',
  headers: { 'content-type': ticket.contentType },
  body: file,
});

await api.post('/uploads/complete', { key: ticket.key });
```

长期 Access Key 不能写进仓库或发给浏览器。客户端直传应使用短时、最小权限的签名，并约束 Bucket、Key 前缀和内容类型。预签名 PUT 本身不能可靠限制传输体积，完成回调必须按当前用户查找待上传记录，再用 `head()` 校验对象大小和类型；需要上传前硬限制大小时应改用带 Policy 条件的表单直传。私有文件下载同样使用短时签名 URL，不能为了省事把整个 Bucket 设为公开。

删除数据库记录和删除对象不是同一个原子事务。实际系统通常先把记录标记为待删除，再由可重试任务清理对象，避免一次网络失败留下无法追踪的状态。

## libuv 并不会替你并行执行 JavaScript

Node.js 的 JavaScript 回调主要运行在事件循环线程。网络 I/O 可由操作系统异步机制处理，部分文件系统、DNS 和加密任务会借助 libuv 线程池；完成后，回调仍要回到事件循环执行。

```text
timers
  → pending callbacks
  → poll
  → check
  → close callbacks
```

Promise 和 `process.nextTick` 使用微任务队列，不是上面独立的一行。连续递归添加 `nextTick` 会饿死 I/O：

```js
function starveIo() {
  process.nextTick(starveIo);
}

starveIo();
```

CPU 密集循环也会阻塞所有连接：

```ts
app.get('/hash-report', async () => {
  // 大量同步计算会让同一进程中的健康检查也超时
  return buildLargeReportSynchronously();
});
```

这类任务要拆分、交给 `worker_threads` 或独立任务服务。调大 `UV_THREADPOOL_SIZE` 不是通用解法：它只影响使用该线程池的底层操作，还可能增加内存和上下文切换。

`setTimeout(0)` 与 `setImmediate()` 的先后也不是固定口诀。它们在哪个上下文中注册、事件循环当前处于哪个阶段，都会影响结果；生产代码不应依赖二者偶然的输出顺序。

## Fastify 用 Schema 封住输入输出

Fastify 的价值不只是吞吐量。Schema、插件封装、生命周期钩子和结构化日志能把服务边界写进代码。

```ts
import Fastify from 'fastify';

const app = Fastify({ logger: true });

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

app.post('/users', { schema: createUserSchema }, async (request, reply) => {
  const user = await createUser(request.body);
  return reply.code(201).send({ id: user.id, name: user.name });
});
```

`additionalProperties: false` 会拒绝未声明输入；响应 Schema 则把密码哈希、内部权限字段挡在序列化边界之外。不要把整个数据库实体直接 `send()`，否则以后表里新增一个敏感字段，就可能被接口顺带暴露。

### 插件管理生命周期

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

插件适合承载数据库、认证和一组业务路由的初始化与释放边界。不要为了形式把每个函数都包装成插件。

错误响应应该集中处理，并避免把堆栈返回给客户端：

```ts
app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'request failed');

  if (error.validation) {
    return reply.code(400).send({
      code: 'invalid_request',
      message: 'Request validation failed',
    });
  }

  return reply.code(500).send({
    code: 'internal_error',
    message: 'Internal server error',
  });
});
```

## 网关只做横切策略

网关负责统一入口，但不应该成为第二个单体应用。适合放在网关的能力包括：

- 验证 Token，并把可信身份写入下游请求。
- 生成或透传请求 ID。
- 路由、限流、超时、熔断和健康实例选择。
- 记录统一的状态码、耗时和下游服务名。

网关必须先删除客户端伪造的内部身份头，再写入自己的值：

```ts
delete upstreamHeaders['x-user-id'];
delete upstreamHeaders['x-user-role'];

upstreamHeaders['x-user-id'] = request.user.sub;
upstreamHeaders['x-request-id'] = request.id;
```

如果直接透传 `x-user-role: admin`，攻击者可以绕过认证。下游服务还应只接受来自可信网关网络或双向 TLS 的请求，不能把内部 Header 当作天然可信。

下游调用必须有超时。重试只适合幂等请求，`POST /orders` 之类的写操作需要幂等键，否则一次网关重试可能创建两笔订单。诸如“订单何时允许退款”的规则属于订单服务，不属于网关。

一个最小 Fastify 网关可以把固定上游代理、限流和熔断放在同一条边界上：

```ts
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import CircuitBreaker from 'opossum';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role?: string };
    user: { sub: string; role?: string };
  }
}

const userOrigin = new URL(process.env.USER_SERVICE_ORIGIN!);
const gatewayJwtSecret = process.env.GATEWAY_JWT_SECRET;

if (!gatewayJwtSecret) {
  throw new Error('GATEWAY_JWT_SECRET is required');
}

await app.register(fastifyJwt, { secret: gatewayJwtSecret });

async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
    if (
      typeof request.user.sub !== 'string'
      || request.user.sub.length === 0
    ) {
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

  const rawContentLength = request.headers['content-length'];
  const contentLength = Number(rawContentLength ?? 0);
  const hasTransferEncoding = request.headers['transfer-encoding'] !== undefined;

  if (
    hasTransferEncoding
    || !Number.isSafeInteger(contentLength)
    || contentLength < 0
    || contentLength > 0
  ) {
    return reply.code(400).send({ code: 'payload_not_allowed' });
  }
}

function isJsonMediaType(contentType: string | undefined) {
  const mediaType = contentType?.split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' ||
    Boolean(mediaType?.startsWith('application/') && mediaType.endsWith('+json'));
}

await app.register(rateLimit, {
  global: false,
  hook: 'preHandler',
  keyGenerator: (request) => request.user.sub,
});

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

    if (response.status >= 500) {
      throw new Error(`upstream_${response.status}`);
    }

    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? undefined;

    if (body.length > 0 && !isJsonMediaType(contentType)) {
      throw new Error('upstream_returned_non_json');
    }

    return {
      status: response.status,
      contentType,
      body,
    };
  },
  {
    timeout: 2000,
    volumeThreshold: 10,
    errorThresholdPercentage: 50,
    resetTimeout: 10_000,
  },
);

app.all('/users/*', {
  onRequest: [
    authenticate,
    rejectGetOrHeadPayload,
  ],
  config: {
    rateLimit: { max: 30, timeWindow: '1 minute' },
  },
}, async (request, reply) => {
  const contentType = request.headers['content-type'];
  const hasBody = request.body !== undefined;

  if (hasBody && !isJsonMediaType(contentType)) {
    return reply.code(415).send({ code: 'json_body_required' });
  }

  const body = hasBody ? JSON.stringify(request.body) : undefined;
  if (hasBody && body === undefined) {
    return reply.code(400).send({ code: 'invalid_json_body' });
  }

  try {
    const incomingUrl = new URL(
      request.raw.url!,
      'http://gateway.internal',
    );

    if (!incomingUrl.pathname.startsWith('/users/')) {
      return reply.code(400).send({ code: 'invalid_proxy_path' });
    }

    const result = await userServiceBreaker.fire({
      path: incomingUrl.pathname + incomingUrl.search,
      method: request.method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        'x-user-id': request.user.sub,
        'x-request-id': request.id,
      },
      body,
    });

    if (result.contentType) reply.header('content-type', result.contentType);
    return reply.code(result.status).send(result.body);
  } catch (error) {
    request.log.warn({ err: error }, 'user service unavailable');
    return reply.code(503).send({ code: 'service_unavailable' });
  }
});
```

代理目标必须来自服务端配置，不能让请求参数决定任意 URL。路由的第一个 `onRequest` 钩子验证 JWT，失败立即返回 `401`，因此未认证请求不会进入 Body 解析。后续 `onRequest` 根据原始 `content-length` 和 `transfer-encoding` 拒绝 GET/HEAD Payload，不能等 Body 解析后再看 `request.body`。

`@fastify/rate-limit` 在 `preHandler` 阶段用已验证的 `request.user.sub` 计数，默认内存存储只适合单实例；多实例部署应按插件约定接入 Redis。未认证流量还应在反向代理或边缘层按可信客户端 IP 做粗限流。

这个小网关只接受并返回 JSON，表单、文本和 multipart 请求会得到 `415`，不会被 `JSON.stringify()` 后静默破坏。熔断器应按下游服务隔离，不能让一个故障服务把所有路由一起熔断。

## 什么时候拆微服务

把函数调用改成网络调用，会立即引入超时、部分失败、重试、幂等、版本兼容和分布式跟踪。服务拆分只有在边界能独立变更时才有收益：

- 某个模块需要独立部署或独立扩容。
- 故障需要与主体应用隔离。
- 数据和业务规则有清晰所有者。
- 团队能够承担独立构建、监控和发布。

如果这些条件都不存在，模块化单体通常更便宜。先把用户、文章、文件、通知等边界在代码和数据访问层拆清楚，之后再把真正需要独立运行的部分移出进程。

同步 HTTP 适合调用方必须立即拿到结果的操作，但必须设置超时并处理下游不可用。消息队列适合通知、审计和最终一致任务，但需要面对重复消费、积压和死信。无论采用哪种通信方式，都应维护明确的 API 或事件合同，而不是让所有服务随意读写同一组表。

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

登录系统最容易错的地方，是把所有凭证都叫 Token。认证中心的全局会话、业务应用的会话、设备会话和扫码授权码是四样东西，有效期、可见范围和撤销方式都应该不一样。

```ts
type SessionKind =
  | 'identity_session'
  | 'app_session'
  | 'device_session'
  | 'authorization_code';
```

这些边界一混，常见的结果是：A 应用的凭证能访问 B 应用，旧设备没法真正下线，二维码被重复领取，或者长期 Token 出现在 URL 和日志里。

## SSO 的凭证边界

SSO 只负责让多个应用复用同一次身份认证，并不是让所有应用共用一份业务 Token。

```text
浏览器 → 业务应用 A → 认证中心
                    ← 一次性授权码
         应用 A 后端 → 用授权码换取 A 的会话

浏览器 → 业务应用 B → 认证中心
                    ← 另一枚一次性授权码
         应用 B 后端 → 用授权码换取 B 的会话
```

认证中心已经有全局会话时，可以不用再输密码，但还是要给目标应用签发独立的凭证。JWT 至少要校验：

- `iss`：只接受预期的签发方。
- `aud`：凭证只能用在指定的应用。
- `exp`：过期就拒绝。
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

用非对称签名的话，认证中心只保管私钥，业务应用只拿公钥验签。就算某个业务应用泄露了，也伪造不了其他应用的凭证。这里容易炸在只调了 `jwt.verify()`，却没同时限制 `algorithms`、`issuer` 和 `audience`：

```ts
const claims = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'https://auth.example.com',
  audience: 'article-app',
});
```

### 授权码不要复用

登录回跳时只带一个短时、一次性的授权码，不直接带访问 Token：

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

兑换授权码时，读取和删除必须是原子的。普通的 `GET` 再 `DEL` 有竞争窗口，两个请求可能同时拿到同一份数据；用 Redis 的 `GETDEL` 或 Lua 脚本，才能保证只被消费一次。

回调地址也不能模糊匹配。`https://app.example.com/callback.evil.com` 不能因为包含合法的字符串就通过。服务端要按已注册的完整 URL 精确比较，并用 `state` 绑定发起登录的那个浏览器会话；公共客户端再配上 PKCE，防止授权码被截获后直接拿去兑换。

## 单设备登录

单设备登录的安全目标是：旧会话在下一次 API 请求时一定失败。"通知旧设备"只是附带的，WebSocket 只负责及时更新界面。

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

登录成功后，服务端把 `sessionId` 写进用户当前的活跃会话。每次鉴权都比较当前值：

```ts
async function assertActiveSession(userId: string, sessionId: string) {
  const activeSessionId = await redis.get(`active-session:${userId}`);

  if (activeSessionId !== sessionId) {
    throw new UnauthorizedError('session_replaced');
  }
}
```

拿到旧的 `sessionId` 后，可以给对应的 WebSocket 推一个下线事件：

```ts
if (previousSessionId) {
  socketHub.send(previousSessionId, {
    type: 'forced_logout',
    reason: 'signed_in_on_another_device',
  });
}
```

上面的 Redis 示例统一用 `ioredis`，所以 `SET` 的 `EX`、`NX`、`GET` 都是位置参数，别把 `node-redis` 的对象选项混进来。`GET` 需要 Redis 6.2 及以上。推送失败不能回滚新的登录：旧连接可能已经断了，也可能在另一台服务实例上。真正的撤销状态要落在 Redis 或数据库里，不能只放在某个 Node.js 进程的 `Map` 里。

Canvas 指纹最多拿来做风险评分。浏览器升级、显卡驱动和隐私策略都可能改变指纹，所以它代替不了服务端生成的 `sessionId`，也不能因为指纹一致就跳过密码或二次验证。

## 扫码登录状态机

二维码里只放一个不透明的随机 ID：

```text
https://auth.example.com/scan?q=8Q0x...t6k
```

真正的授权状态由服务端维护：

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

手机确认时要同时满足三个条件：手机本身已经登录、二维码没过期、当前状态还允许授权。PC 领取结果时，还要确认创建二维码的那个浏览器会话没变。

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

轮询要能在页面卸载时取消，并设一个总超时。拿到的还应该是一次性的授权码，不是长期的 JWT；授权码兑换成功后马上把状态改成 `consumed`，不然截图或历史响应都可能被重放。

## AI 调用放在服务端

浏览器不能直接拿着模型供应商的 API Key。业务 API 要先做完身份校验、输入限制和用量控制，再去调外部模型：

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

`response.write()` 返回 `false` 时要等 `drain`，不然模型输出比客户端读得快，待发送的数据就会一直堆在内存里。客户端断开会触发 `AbortController`，合并后的 `upstreamSignal` 继续传进 SDK，外部的流也会停掉，不只是停止本地写响应。

`openai` SDK 的入口、事件名和模型名都可能随版本变，所以这些细节只留在 `OpenAiTextGenerator` 里。业务层只依赖 `TextGenerator`，升级时先按锁定的 SDK 版本调适配器、做集成测试。API Key 只从服务端的环境变量读，不能返回给浏览器，也不能出现在前端的构建变量里。

### 多轮上下文要绑定会话

后续请求可以带上上一次的 `response.id`，不用只把当前这一句当成完整对话：

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

服务端要把 `responseId` 和已鉴权的业务会话绑在一起，不能让客户端接着别人的响应链往下聊。长对话照样消耗上下文窗口和输入 token，要设轮数、总长度和过期时间。

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

图片是大对象，更适合写进对象存储，再返回一个短期的签名 URL，别把 Base64 一直存在数据库或普通的 JSON 响应里。还要限制尺寸、并发和用户配额，并单独处理内容安全的拒绝。

超时不能省，外部请求挂住会一直占着连接和内存。重试也只能针对限流、网络断开和部分 5xx，并设置次数和退避。已经开始流式返回的请求要是盲目重试，可能把两次的结果拼到一起。日志里记请求 ID、耗时、错误类型和用量就够了，别把密钥或完整的敏感提示词写进去。

## 远程桌面的权限边界

远程桌面至少有两条数据通道：

```text
被控端：屏幕帧 → 编码 → 传输 → 控制端显示
控制端：输入事件 → 鉴权 → 传输 → 被控端执行
```

输入协议要显式限制事件类型：

```ts
type RemoteInput =
  | { type: 'pointer_move'; x: number; y: number }
  | { type: 'pointer_click'; button: 'left' | 'right' }
  | { type: 'key'; key: string; action: 'down' | 'up' };
```

坐标不能直接照搬浏览器的像素。控制端的画面可能被缩放了，要先把坐标归一化到 `0..1`，再按被控端的屏幕分辨率换算，越界的值直接拒绝。

被控端可以用 `screenshot-desktop` 采集画面、`ws` 传输二进制帧，再由 `robotjs` 执行授权和校验过的输入：

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

这段代码的几道关：

- `authorizeRemoteSession` 必须在 WebSocket 升级之前完成双向身份校验。
- 升级时、每条输入消息、画面定时循环里，都重新检查 `expiresAt`；到期后服务端主动关连接。
- `maxPayload` 挡住超大的消息，单独的输入计数器限制事件速率。
- `parseAndValidateRemoteInput` 再限制事件类型、按键白名单和归一化坐标。

这个循环只能用在自己拥有、或者明确获准控制的设备上，不能把示例端口直接暴露到公网，也不能绕过被控端的可见确认和随时断开的能力。

原生的输入模拟依赖经常要经过 `node-gyp` 编译。装不上时，去核对 Node.js ABI、Python、C/C++ 工具链和目标操作系统，别一遍遍重装 npm 包。

这类服务一旦暴露到公网，就等于开放了键盘和鼠标的权限。最低限度要有：双向身份认证、短时授权、端到端加密、被控端可见的确认、操作审计、速率限制，以及随时能用的紧急断开。只凭一个能被猜到的房间号就能连上，是不可接受的。

## 上传先隔离再扫描

上传接口不能先把文件放进公开目录，再异步判断它安不安全。正确的顺序是先隔离：

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

`scanFile` 适合 ClamAV 和应用能访问同一个隔离文件的主流程。远程的 `clamd` 看不到应用本机路径时，要由应用打开文件、调 `scanStream`。`scanStream` 会消费掉输入流，只适合不用再读的流，或者先经过受控的落盘/分流管道留一份副本；不能扫完同一个流，还以为能接着上传。

这里容易炸在只检查扩展名。文件名、MIME 类型和真实的文件头可能互相矛盾；压缩包还要限制递归层级、文件数量和解压后的总体积，防止路径穿越和压缩炸弹。

杀毒引擎不可用时，别把文件当成"默认安全"，可以返回可重试的错误，或者让它继续待在隔离区。病毒库版本、扫描耗时和失败率都要监控；扫描通过也只代表没命中当前的规则，不代表绝对无害。

## OSS 的对象模型

对象存储没有真正的目录树。`users/u_1/avatar.png` 是一个 Object Key，斜杠一般只是命名约定。

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

浏览器直传时，请求方法和 Header 必须和签名时一模一样：

```ts
await fetch(ticket.uploadUrl, {
  method: 'PUT',
  headers: { 'content-type': ticket.contentType },
  body: file,
});

await api.post('/uploads/complete', { key: ticket.key });
```

几条规则：

- 长期的 Access Key 不能写进仓库，也不能发给浏览器。客户端直传要用短时、最小权限的签名，并约束 Bucket、Key 前缀和内容类型。
- 预签名 PUT 本身没法可靠地限制传输体积。完成回调要按当前用户找到待上传的记录，再用 `head()` 校验对象的大小和类型；要在上传前就硬限制大小，就改用带 Policy 条件的表单直传。
- 私有文件的下载也用短时签名 URL，别为了省事把整个 Bucket 设成公开。

删数据库记录和删对象不在同一个原子事务里。实际系统一般先把记录标成待删除，再由能重试的任务去清理对象，免得一次网络失败留下一个没法追踪的状态。

## libuv 并不会替你并行执行 JavaScript

Node.js 的 JavaScript 回调主要跑在事件循环线程上。网络 I/O 可以交给操作系统的异步机制，部分文件系统、DNS 和加密任务会借用 libuv 的线程池；完成以后，回调还是要回到事件循环上执行。

```text
timers
  → pending callbacks
  → poll
  → check
  → close callbacks
```

Promise 和 `process.nextTick` 用的是微任务队列，不是上面单独的一行。不停地递归添加 `nextTick` 会把 I/O 饿死：

```js
function starveIo() {
  process.nextTick(starveIo);
}

starveIo();
```

CPU 密集的循环也会卡住所有连接：

```ts
app.get('/hash-report', async () => {
  // 大量同步计算会让同一进程中的健康检查也超时
  return buildLargeReportSynchronously();
});
```

这类任务要拆开，或者交给 `worker_threads`、独立的任务服务。调大 `UV_THREADPOOL_SIZE` 不是通用解法：它只影响用这个线程池的底层操作，还可能增加内存和上下文切换。

`setTimeout(0)` 和 `setImmediate()` 谁先谁后也没有固定口诀。在哪个上下文里注册、事件循环当前在哪个阶段，都会影响结果；生产代码别依赖它们偶然出现的输出顺序。

## Fastify 用 Schema 封住输入输出

Fastify 的价值不只在吞吐量。Schema、插件封装、生命周期钩子和结构化日志，能把服务的边界直接写进代码。

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

`additionalProperties: false` 会拒绝没声明的输入；响应 Schema 则在序列化这一层挡住密码哈希和内部权限字段。别把整个数据库实体直接 `send()`，不然以后表里加一个敏感字段，就可能被接口顺手暴露出去。

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

插件适合承载数据库、认证和一组业务路由的初始化和释放边界。别为了形式把每个函数都包成插件。

错误响应要集中处理，别把堆栈返回给客户端：

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

网关负责统一入口，但别把它做成第二个单体应用。适合放在网关的能力：

- 验证 Token，把可信的身份写进下游请求。
- 生成或透传请求 ID。
- 路由、限流、超时、熔断和健康实例的选择。
- 记录统一的状态码、耗时和下游服务名。

网关要先删掉客户端伪造的内部身份头，再写入自己的值：

```ts
delete upstreamHeaders['x-user-id'];
delete upstreamHeaders['x-user-role'];

upstreamHeaders['x-user-id'] = request.user.sub;
upstreamHeaders['x-request-id'] = request.id;
```

要是直接透传 `x-user-role: admin`，攻击者就能绕过认证。下游服务也应该只接受来自可信网关网络或双向 TLS 的请求，内部 Header 不能当成天然可信。

下游调用一定要有超时。重试只适合幂等的请求，`POST /orders` 这类写操作需要幂等键，不然网关重试一次就可能建出两笔订单。"订单什么时候允许退款"这种规则属于订单服务，不属于网关。

一个最小的 Fastify 网关，可以把固定上游的代理、限流和熔断放在同一条边界上：

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

代理目标必须来自服务端配置，不能让请求参数决定任意 URL。路由的第一个 `onRequest` 钩子验证 JWT，失败立刻返回 `401`，所以没认证的请求根本进不到 Body 解析。后面的 `onRequest` 按原始的 `content-length` 和 `transfer-encoding` 拒绝带 Payload 的 GET/HEAD，不能等 Body 解析完再看 `request.body`。

`@fastify/rate-limit` 在 `preHandler` 阶段用已验证的 `request.user.sub` 计数，默认的内存存储只适合单实例；多实例部署要按插件的约定接 Redis。没认证的流量还要在反向代理或边缘层按可信的客户端 IP 做一层粗限流。

这个小网关只收发 JSON，表单、文本和 multipart 请求会得到 `415`，不会被 `JSON.stringify()` 后悄悄弄坏。熔断器要按下游服务隔离，别让一个出故障的服务把所有路由一起熔断。

## 什么时候拆微服务

把函数调用换成网络调用，马上就会带来超时、部分失败、重试、幂等、版本兼容和分布式追踪这些问题。只有边界能独立变更时，拆服务才划算：

- 某个模块需要独立部署或独立扩容。
- 故障需要和主体应用隔离。
- 数据和业务规则有明确的负责人。
- 团队扛得住独立的构建、监控和发布。

这些条件都不满足的话，模块化单体一般更便宜。先把用户、文章、文件、通知这些边界在代码和数据访问层拆清楚，以后再把真正需要独立运行的部分移出进程。

同步 HTTP 适合调用方必须马上拿到结果的操作，但要设超时、处理下游不可用。消息队列适合通知、审计和最终一致的任务，但要面对重复消费、积压和死信。不管用哪种通信方式，都要维护明确的 API 或事件契约，别让所有服务随便读写同一组表。

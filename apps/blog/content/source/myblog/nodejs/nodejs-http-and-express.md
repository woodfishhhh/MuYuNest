---
title: Node.js HTTP 协议、Express 服务开发与反向代理
slug: nodejs-http-and-express
date: 2026-07-13
categories:
  - 后端开发
tags:
  - Node.js
  - HTTP
  - Express
  - CORS
  - SSE
---

构建 Node.js Web 服务的核心在于把每条 HTTP 请求的输入解析、中间件控制权、异常出口和响应边界收口清楚。服务端线上最常见也最隐蔽的三类故障分别是：请求分支漏掉结束响应导致连接挂死、发送完响应后继续调用 `next()` 触发 `ERR_HTTP_HEADERS_SENT`、以及异步异常逃逸出同步捕获链导致进程崩溃。

## 从原生 `node:http` 看清请求与响应边界

Express 底层运行在 Node.js 原生 HTTP 模块之上。直接用 `node:http` 实现路由与 JSON 解析，能看清框架到底帮我们接管了哪些底层细节：

```js
import { createServer } from 'node:http';

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (method === 'GET' && url.pathname === '/api/profile') {
    const id = url.searchParams.get('id');
    sendJson(response, 200, { id, name: 'woodfish' });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/login') {
    try {
      const body = await readJson(request);
      sendJson(response, 200, { ok: true, user: body.name });
    } catch (error) {
      sendJson(response, error.statusCode ?? 400, {
        ok: false,
        message: error.message,
      });
    }
    return;
  }

  sendJson(response, 404, { message: 'Not Found' });
});

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(data));
}

async function readJson(request, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('request body is too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('invalid JSON');
  }
}

server.listen(3000, () => {
  console.log('http://localhost:3000');
});
```

**HTTP 请求体在网络上按字节流传输，限制体积必须按 `Buffer` 字节数累加，而不能等到拼成字符串再检查 `.length`。**

每个路由分支发送响应后必须立刻 `return`，防止代码继续往下走到 404 分支引发重复写头异常。接口联调阶段建议把测试用例写成 `.http` 文件随仓库管理，除了正常返回，必须覆盖非法 JSON、超大 Body 触发 `413` 和未知路径触发 `404` 的分支。

## Express 路由划分、中间件链路与错误收口

Express 将请求体解析、业务路由和错误处理串成一条有序执行链：

```js
import express, { Router } from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const usersRouter = Router();

usersRouter.get('/:id', (request, response) => {
  response.json({
    id: request.params.id,
    keyword: request.query.keyword ?? '',
  });
});

usersRouter.post('/', (request, response) => {
  response.status(201).json({ user: request.body });
});

app.use('/users', usersRouter);
```

| 数据来源 | 请求示例 | Express 读取位置 |
| --- | --- | --- |
| 查询参数 | `/users/42?keyword=node` | `request.query.keyword` |
| 路径参数 | `/users/42` 匹配 `/users/:id` | `request.params.id` |
| JSON 请求体 | `POST /users` | `request.body`（需注册 `express.json()`） |

**解析出 `request.body` 只完成反序列化，路径、查询和请求体在进入业务逻辑前仍须校验类型、范围和业务约束。**

用 `Router` 按资源拆分模块前缀（如 `/users`）可以避免所有端点堆在入口文件。编写请求日志或鉴权等普通中间件时，每个分支只能二选一：要么调用 `next()`（或 `next(err)`）交出控制权，要么直接发送响应结束请求；发送响应后再调 `next()` 会直接触发异常。

统一错误处理中间件必须放在所有路由之后，并严格保留四个参数签名：

```js
app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  console.error(error);
  response.status(error.statusCode ?? 500).json({
    message: error.statusCode ? error.message : 'Internal Server Error',
  });
});
```

如果响应头已经发出，错误中间件必须把 `error` 转交给 Express 默认处理器来关闭连接，否则会在半残响应上再次尝试写头。服务端日志可记录请求标识和堆栈，返回给客户端的错误响应则绝不能泄露数据库细节或内部密钥。

## 反向代理与路径重写边界

反向代理让浏览器只面对同一个公开域名的统一入口，再由代理节点将请求转发至内部上游服务：

```text
Browser → /api/users → Reverse Proxy → http://internal-api:4000/users
```

使用 `http-proxy-middleware` 可以在开发或 BFF 层转发指定前缀并重写路径：

```js
import { createServer } from 'node:http';
import { createProxyMiddleware } from 'http-proxy-middleware';

const apiProxy = createProxyMiddleware({
  target: 'http://localhost:4000',
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
});

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    apiProxy(request, response);
    return;
  }

  response.writeHead(404);
  response.end('Not Found');
}).listen(3000);
```

开发环境用代理解决本地前端跨域，是因为代理与后端之间的 HTTP 通信属于服务端之间调用，不受浏览器同源策略约束。进入生产环境后，单纯的路径转发远远不够，代理层还必须配置连接与读取超时、健康检查、可信代理头（`X-Forwarded-*`）和请求体上限；对 `POST` 这类非幂等写请求切忌盲目自动重试，否则网络抖动会造成重复下单或重复扣款。

## 静态资源安全托管与缓存策略

带内容哈希的构建产物适合配置长效强缓存甚至由 CDN 分发，HTML 入口文件则通常需要协商缓存或短缓存，避免用户长期停留在旧版本资源索引上。

手写静态文件服务时，绝对不能把 URL 路径直接拼成磁盘文件路径，必须防范 `../` 目录穿越与符号链接逃逸：

```js
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative as pathRelative, resolve, sep } from 'node:path';
import mime from 'mime';

const staticRoot = await realpath(resolve('public'));

function isInside(root, target) {
  const offset = pathRelative(root, target);
  return (
    offset === '' ||
    (offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))
  );
}

async function sendStatic(request, response) {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const requestedPath = decodeURIComponent(
      url.pathname.slice('/assets/'.length),
    );
    const candidate = resolve(staticRoot, requestedPath);

    if (!isInside(staticRoot, candidate)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const filePath = await realpath(candidate);
    if (!isInside(staticRoot, filePath)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');

    response.writeHead(200, {
      'Content-Type': mime.getType(filePath) ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    });

    const stream = createReadStream(filePath);
    stream.on('error', (error) => response.destroy(error));
    stream.pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not Found');
  }
}
```

**只校验一次字符串前缀挡不住目录内的符号链接逃逸，必须先查词法路径边界，再经 `realpath()` 解析真实路径做二次校验。**

`decodeURIComponent()` 遇到畸形百分号编码会抛异常，文件在 `stat()` 与 `createReadStream()` 之间也可能被删除，因此必须同时捕获解码异常并监听读取流的 `error` 事件。若直接使用 Express，可通过 `app.use('/assets', express.static('public', { maxAge: '1h' }))` 交给框架处理静态托管。

## CORS 跨域控制与 Referer 防盗链

浏览器的同源策略由协议、主机名和端口三元组共同决定。

**CORS 机制拦不住请求到达服务端并执行业务副作用，它只决定浏览器是否允许前端脚本读取跨源响应。**

这也是为什么服务端绝对不能依赖 CORS 充当安全防线，更不能在 `OPTIONS` 预检请求里触发任何数据库写入或状态变更。一个带白名单和凭证控制的 Express CORS 中间件写法如下：

```js
const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://www.example.com',
]);

app.use((request, response, next) => {
  const origin = request.get('origin');

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-Id',
    );
    response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  }

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});
```

配好这套响应头有三个容易踩的坑：开启 `Access-Control-Allow-Credentials: true` 时，`Access-Control-Allow-Origin` 绝不能设为通配符 `*`，必须动态回显白名单内的精确来源；动态回显来源时必须附带 `Vary: Origin`，防止 CDN 或中间缓存把给 A 域名的跨域头误缓存后返回给 B 域名；服务端返回的自定义响应头（如 `X-Request-Id`）即使在浏览器网络面板可见，若未写入 `Access-Control-Expose-Headers`，前端 `response.headers.get()` 依然读不到。

静态资源若需减少第三方网页直接盗链，可以增加 `Referer` 校验中间件放行白名单主机并拦截外部来源。但由于浏览器隐私策略可能不发送 `Referer`，非浏览器客户端也可随意伪造该请求头，防盗链只能拦截普通网页引用，高价值私有资源必须依靠签名 URL、短期令牌和鉴权接口保护。

## Nodemailer 与 SMTP 邮件通知

后台告警、构建通知和邮箱验证码常通过 SMTP 外发。配置分离的原则是将非敏感的服务器地址、端口和发件账号保存在 YAML 等配置文件中，而将 SMTP 授权码或密码留在环境变量中：

```js
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import nodemailer from 'nodemailer';

const config = yaml.load(await readFile('mail.yaml', 'utf8'));
if (!process.env.SMTP_AUTH_CODE) {
  throw new Error('SMTP_AUTH_CODE is required');
}

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: process.env.SMTP_AUTH_CODE,
  },
});

await transporter.sendMail({
  from: config.smtp.user,
  to: 'receiver@example.com',
  subject: 'Build result',
  text: 'The build completed successfully.',
});
```

`js-yaml` 解析器不会自动展开 `${ENV_VAR}` 占位符，代码必须显式读取并校验 `process.env` 中的凭据。如果服务向外提供发信触发接口，必须做好调用方认证、收件人校验和频率限制，避免接口沦为垃圾邮件中继站。

## SSE 服务端单向持续推送

对于日志流、模型生成进度和实时监控指标这类只需要服务端向客户端单向推送文本的场景，Server-Sent Events（SSE）比维护双向 WebSocket 更轻量：

```js
app.get('/events', (request, response) => {
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  response.write('event: ready\n');
  response.write('data: connected\n\n');

  const timer = setInterval(() => {
    const payload = JSON.stringify({ time: Date.now() });
    response.write(`event: clock\ndata: ${payload}\n\n`);
  }, 1000);

  request.on('close', () => {
    clearInterval(timer);
  });
});
```

浏览器端使用原生 `EventSource` 订阅：

```js
const source = new EventSource('http://localhost:3000/events');

source.addEventListener('ready', (event) => {
  console.log(event.data);
});

source.addEventListener('clock', (event) => {
  console.log(JSON.parse(event.data));
});
```

**SSE 协议规定每个事件帧必须以双换行 `\n\n` 结束，且客户端断开时必须清理定时器与订阅句柄，否则泄漏的长连接任务会持续耗尽内存。**

生产环境把 Express 挂在 Nginx 等反向代理后方时，必须设置 `X-Accel-Buffering: no`（或在 Nginx 层关闭 `proxy_buffering`），否则代理层会攒够缓冲区才吐数据，导致前端迟迟收不到实时流；同时还应配合心跳注释包（`: ping\n\n`）、连接超时和单实例最大长连接数上限来维持长连接稳定。

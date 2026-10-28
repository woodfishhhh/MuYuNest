---
title: HTTP、反向代理与 Express 服务开发
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - HTTP
  - Express
  - CORS
  - SSE
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
pages: P26-P32
draft: false
---

# HTTP、反向代理与 Express 服务开发

```bash
npm install express
```

```js
import express from 'express';

const app = express();

app.get('/health', (request, response) => {
  response.json({ ok: true });
});

app.listen(3000, () => {
  console.log('http://localhost:3000/health');
});
```

这就是一个最小的 HTTP 闭环：进程监听端口，路由匹配方法和路径，处理函数结束响应。服务端最常见的三类故障：忘了结束响应，响应结束后还在写，没处理异步异常。

## 原生 HTTP 看协议

Express 底下还是 Node.js 的 HTTP 能力。用 `node:http` 写一遍路由，能看清请求和响应各管什么：

```js
import { createServer } from 'node:http';

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (method === 'GET' && url.pathname === '/api/profile') {
    const id = url.searchParams.get('id');

    sendJson(response, 200, { id, name: 'Xiao Man' });
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

server.listen(3000, () => {
  console.log('http://localhost:3000');
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
```

这段代码的分工：

- `request.method` 和 `URL.pathname` 决定路由。
- `URL.searchParams` 读查询参数。
- 请求体是流，要限制字节数，并处理非法 JSON。
- `sendJson()` 保证状态码、内容类型和序列化方式一致。
- 每个路由分支都 `return`，免得同一个响应被写两次。

这里容易炸在只限制了字符串长度。请求体按字节传输，用 `Buffer` 累加才能正确限制多字节文本的实际体积。真实服务还要处理请求中止、读取超时和内容类型校验。

### 用 HTTP 文件验收

装了 VS Code REST Client 后，可以把接口请求和代码放在一起：

```http
### 查询用户
GET http://localhost:3000/api/profile?id=42

### 登录
POST http://localhost:3000/api/login
Content-Type: application/json

{
  "name": "Xiao Man"
}

### 验证 404
GET http://localhost:3000/not-found
```

请求头和 JSON Body 之间要空一行。测试别只测 200，非法 JSON、超大请求体和不存在的路由都要测。

## Express 处理输入

Express 把路由、请求体和中间件串成一条处理链：

```js
import express from 'express';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/search', (request, response) => {
  response.json({ keyword: request.query.keyword ?? '' });
});

app.get('/users/:id', (request, response) => {
  response.json({ id: request.params.id });
});

app.post('/users', (request, response) => {
  response.status(201).json({ user: request.body });
});

app.listen(3000);
```

| 请求位置 | Express 读取方式 |
| --- | --- |
| `/search?keyword=node` | `request.query.keyword` |
| `/users/42` 对应 `/users/:id` | `request.params.id` |
| JSON 请求体 | `request.body`，前提是注册 `express.json()` |

解析成功了，不代表数据合法。查询参数、路径参数和 Body 都来自外部，类型、长度、格式和业务约束照样要校验。

### Router 划分边界

```js
// routes/users.js
import { Router } from 'express';

export const usersRouter = Router();

usersRouter.post('/login', (request, response) => {
  response.json({ message: 'login success' });
});

usersRouter.post('/register', (request, response) => {
  response.status(201).json({ message: 'register success' });
});
```

```js
import { usersRouter } from './routes/users.js';

app.use('/users', usersRouter);
```

最终路径是注册时的前缀加上 Router 内部的路径：`POST /users/login` 和 `POST /users/register`。前缀表达模块边界，也免得所有路由都堆在入口文件里。

### 中间件必须收口

```js
function requestLogger(request, response, next) {
  const startedAt = Date.now();

  response.on('finish', () => {
    console.log({
      method: request.method,
      url: request.originalUrl,
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}

app.use(requestLogger);
```

普通中间件只能选一种结果：调 `next()`，发响应，或者把错误交给错误处理器。发完响应再 `next()`，很容易触发 `ERR_HTTP_HEADERS_SENT`。

统一的错误出口放在路由后面：

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

错误中间件一定要保留四个参数。日志里要有请求标识和必要的上下文，但不能记密码、完整的授权头或者没必要的个人信息。

## 反向代理

反向代理让浏览器只访问一个公开入口，再由代理去选内部服务：

```text
Browser → /api/users → Reverse Proxy → http://internal-api:4000/users
```

`http-proxy-middleware` 能把 `/api` 请求转发出去，并改写路径：

```js
import { createServer } from 'node:http';
import { createProxyMiddleware } from 'http-proxy-middleware';

const apiProxy = createProxyMiddleware({
  target: 'http://localhost:4000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '',
  },
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

访问 `/api/users` 时，后端收到的是 `/users`。浏览器看到的是同源入口，所以开发环境常用代理绕开浏览器的跨域读取限制；代理到后端的是服务器之间的请求，本来就不受浏览器同源策略管。

能转发路径不代表高可用。生产环境的代理还要处理连接和响应超时、健康检查、重试边界、请求体上限、日志、限流和可信代理头。对非幂等请求盲目重试，可能会重复写数据。

## 静态文件与缓存

动态接口随请求或数据状态变化；带内容指纹的 JavaScript、CSS、字体和图片更适合静态托管：

```text
/api/*       → 业务服务
/assets/*    → 静态文件、浏览器缓存或 CDN
```

用原生 HTTP 返回静态文件时，URL 不能直接拼成磁盘路径：

```js
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import {
  isAbsolute,
  relative as pathRelative,
  resolve,
  sep,
} from 'node:path';
import mime from 'mime';

const staticRoot = await realpath(resolve('public'));

function isInside(root, target) {
  const offset = pathRelative(root, target);
  return offset === '' || (
    offset !== '..'
    && !offset.startsWith(`..${sep}`)
    && !isAbsolute(offset)
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
  } catch (error) {
    response.writeHead(404);
    response.end('Not Found');
  }
}
```

这段代码做了两次检查：

- 第一次挡住 `../` 造成的词法目录穿越；
- `realpath()` 解析现有的符号链接后，第二次检查拒绝指向静态目录外面的链接。

光做字符串前缀检查不够：`public/link` 看起来在根目录里，链接的目标却可能是磁盘上任何地方。`decodeURIComponent()` 碰到非法编码会抛错，所以也要接进错误处理链；文件在 `stat()` 之后还可能被删掉，所以读取流还要单独监听错误。

带内容哈希、不会原地修改的构建资源，可以设很长的强缓存；HTML 一般要保守一些。强缓存命中时，请求根本不会到应用服务器。CDN 再把静态资源放到离用户更近的节点，降低源站的带宽和延迟。

Express 的静态托管更简单：

```js
app.use('/assets', express.static('public', {
  maxAge: '1h',
}));
```

## Nodemailer 与 SMTP

邮件适合任务通知、故障告警和构建结果。YAML 存非敏感的结构，授权码从环境变量读：

```yaml
smtp:
  host: smtp.qq.com
  port: 465
  secure: true
  user: example@qq.com
```

```js
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import nodemailer from 'nodemailer';

const configText = await readFile('mail.yaml', 'utf8');
const config = yaml.load(configText);

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

YAML 解析器不会自动把占位符替换成环境变量，敏感值要在代码里明确读取。对外开放发邮件的接口时，还要校验收件人、限频、认证调用方、审计失败，不然服务很容易变成垃圾邮件的出口。POST 只是改变了数据放的位置，不会自带授权或加密，传输还是要走 HTTPS。

## Referer 防盗链

静态资源可以检查 `Referer`，减少普通网页的直接引用：

```js
const allowedHosts = new Set([
  'localhost',
  'www.example.com',
]);

function hotlinkGuard(request, response, next) {
  const referer = request.get('referer');

  if (!referer) {
    next();
    return;
  }

  try {
    const host = new URL(referer).hostname;

    if (!allowedHosts.has(host)) {
      response.status(403).send('Forbidden');
      return;
    }

    next();
  } catch {
    response.status(400).send('Invalid Referer');
  }
}

app.use('/assets', hotlinkGuard, express.static('public'));
```

浏览器可能因为隐私策略不发 Referer，非浏览器客户端也能伪造它。防盗链只能减少普通引用，不能拿来做身份认证。高价值的资源还需要签名 URL、短期令牌、鉴权和流量策略。

## CORS 只约束浏览器

浏览器的同源由协议、主机和端口一起决定：

```text
scheme + host + port
```

任何一项不同就是跨源。CORS 决定页面的 JavaScript 能不能读到跨源响应；请求可能已经到了服务器，甚至已经产生了副作用，浏览器才因为响应头不合规，拒绝把结果交给脚本。

一个只允许特定来源的 Express 中间件：

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
    response.setHeader(
      'Access-Control-Expose-Headers',
      'X-Request-Id',
    );
  }

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});
```

几个关键响应头各管一件事：

- `Access-Control-Allow-Origin`：允许哪个来源读响应。
- `Access-Control-Allow-Methods` 和 `Access-Control-Allow-Headers`：回答预检允许什么。
- `Access-Control-Expose-Headers`：前端能读到哪些非简单响应头。
- `Access-Control-Allow-Credentials`：允许带 Cookie 等凭证。
- `Vary: Origin`：防止共享缓存把给一个来源的 CORS 响应复用给另一个来源。

带凭证时，`Access-Control-Allow-Origin` 不能写 `*`。预检请求只是在问权限，别在里面写数据库、发邮件或做其他业务副作用。

后端就算返回了自定义头，前端也不一定读得到：

```js
response.setHeader('X-Request-Id', 'req-123');
response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
```

```js
const response = await fetch('http://localhost:3000/info');
console.log(response.headers.get('x-request-id'));
```

开发者工具里看得见，不代表页面脚本有权读取。

## SSE 持续推送

SSE 适合服务器单向推送文本事件，比如日志、构建进度和实时指标。Express 端点：

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

浏览器用 `EventSource`：

```js
const source = new EventSource('http://localhost:3000/events');

source.addEventListener('ready', (event) => {
  console.log(event.data);
});

source.addEventListener('clock', (event) => {
  console.log(JSON.parse(event.data));
});

source.onerror = (error) => {
  console.error(error);
};
```

每个事件帧以空行结束。没写 `event:` 时，事件名默认是 `message`。客户端断开后，要清掉定时器、消息订阅和数据库监听，不然每条失效的连接都会留下一个后台任务。

反向代理还可能缓冲响应，结果服务端一直在 `write()`，浏览器却迟迟收不到事件。除了关掉缓冲，还要配连接超时、心跳、断线重连策略，以及每个实例允许的最大长连接数。

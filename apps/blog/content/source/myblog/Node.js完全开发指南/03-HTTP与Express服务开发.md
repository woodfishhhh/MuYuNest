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

这就是一个最小 HTTP 闭环：进程监听端口，路由匹配方法和路径，处理函数结束响应。忘记结束响应、在响应后继续写入、没有处理异步异常，是服务端最常见的三类故障。

## 原生 HTTP 看协议

Express 最终仍建立在 Node.js HTTP 能力上。用 `node:http` 写一遍路由，可以看清请求与响应各自负责什么：

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

这段代码把职责拆得很清楚：

- `request.method` 和 `URL.pathname` 决定路由。
- `URL.searchParams` 读取查询参数。
- 请求体是流，必须限制字节数并处理非法 JSON。
- `sendJson()` 保证状态码、内容类型和序列化方式一致。
- 每个路由分支都 `return`，避免同一个响应被写两次。

这里容易炸在只限制字符串长度。请求体按字节传输，使用 `Buffer` 累加才能正确限制多字节文本的实际体积。真实服务还要处理请求中止、读取超时和内容类型校验。

### 用 HTTP 文件验收

安装 VS Code REST Client 后，可以把接口请求和代码放在一起：

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

请求头与 JSON Body 之间必须留一个空行。测试不应只覆盖 200，还要覆盖非法 JSON、超大请求体和不存在的路由。

## Express 处理输入

Express 把路由、请求体和中间件组织成一条处理链：

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

成功解析不等于数据合法。查询参数、路径参数和 Body 都来自外部，仍要校验类型、长度、格式和业务约束。

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

最终路径由注册前缀和 Router 内部路径拼成：`POST /users/login` 与 `POST /users/register`。前缀表达模块边界，也避免所有路由堆在入口文件。

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

普通中间件必须选择一种结果：调用 `next()`，发送响应，或把错误交给错误处理器。发送响应后再次 `next()`，很容易触发 `ERR_HTTP_HEADERS_SENT`。

统一错误出口放在路由之后：

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

错误中间件必须保留四个参数。日志应包含请求标识和必要上下文，但不能记录密码、完整授权头或不必要的个人信息。

## 反向代理

反向代理让浏览器只访问一个公开入口，再由代理选择内部服务：

```text
Browser → /api/users → Reverse Proxy → http://internal-api:4000/users
```

`http-proxy-middleware` 可以把 `/api` 请求转发并重写路径：

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

访问 `/api/users` 时，后端收到 `/users`。浏览器看见的是同源入口，所以代理常被用于开发环境规避浏览器跨域读取限制；代理到后端的服务器间请求本来就不受浏览器同源策略控制。

路径转发不等于高可用。生产代理还要处理连接和响应超时、健康检查、重试边界、请求体上限、日志、限流和可信代理头。对非幂等请求盲目重试，可能重复写入数据。

## 静态文件与缓存

动态接口随请求或数据状态变化，带内容指纹的 JavaScript、CSS、字体和图片更适合静态托管：

```text
/api/*       → 业务服务
/assets/*    → 静态文件、浏览器缓存或 CDN
```

用原生 HTTP 返回静态文件时，URL 不能直接拼到磁盘路径：

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

第一次检查挡住 `../` 形成的词法目录穿越，`realpath()` 再解析现有符号链接，第二次检查会拒绝指向静态目录外的链接。只有字符串前缀检查不够：`public/link` 看起来在根目录内，链接目标却可能是任意磁盘位置。`decodeURIComponent()` 可能因为非法编码抛错，因此也要进入错误处理链；文件在 `stat()` 之后仍可能被删除，所以读取流还要单独监听错误。

带内容哈希且不会原地修改的构建资源可以设置很长的强缓存；HTML 通常要更保守。强缓存命中时，请求不会到达应用服务器。CDN 再把静态资源放到离用户更近的节点，降低源站带宽和延迟。

Express 的静态托管更简洁：

```js
app.use('/assets', express.static('public', {
  maxAge: '1h',
}));
```

## Nodemailer 与 SMTP

邮件适合任务通知、故障告警和构建结果。YAML 保存非敏感结构，授权码从环境变量读取：

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

YAML 解析器不会自动把任意占位符替换成环境变量，敏感值应在代码中明确读取。对外提供发送邮件接口时，还必须校验收件人、限制频率、认证调用方并审计失败，否则服务很容易变成垃圾邮件出口。POST 只改变数据位置，不自动提供授权或加密，传输仍需 HTTPS。

## Referer 防盗链

静态资源可以检查 `Referer`，减少普通网页直接引用：

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

浏览器可能因为隐私策略不发送 Referer，非浏览器客户端也可以伪造它。防盗链只能减少普通引用，不能作为身份认证。高价值资源还需要签名 URL、短期令牌、鉴权和流量策略。

## CORS 只约束浏览器

浏览器同源由协议、主机和端口共同决定：

```text
scheme + host + port
```

任意一项不同就是跨源。CORS 决定页面 JavaScript 能否读取跨源响应；请求可能已经到达服务器，甚至已经产生副作用，浏览器才因为响应头不合规而拒绝把结果交给脚本。

一个受限来源的 Express 中间件：

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

关键响应头各自解决不同问题：

- `Access-Control-Allow-Origin` 允许哪个来源读取响应。
- `Access-Control-Allow-Methods` 和 `Access-Control-Allow-Headers` 回答预检允许什么。
- `Access-Control-Expose-Headers` 决定前端能读取哪些非简单响应头。
- `Access-Control-Allow-Credentials` 允许带 Cookie 等凭证。
- `Vary: Origin` 防止共享缓存把一个来源的 CORS 响应复用给另一个来源。

使用凭证时，`Access-Control-Allow-Origin` 不能写 `*`。预检请求是权限询问，不应写数据库、发送邮件或执行其他业务副作用。

后端即使返回了自定义头，前端也未必能读到：

```js
response.setHeader('X-Request-Id', 'req-123');
response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
```

```js
const response = await fetch('http://localhost:3000/info');
console.log(response.headers.get('x-request-id'));
```

开发者工具里可见，不代表页面脚本已获得读取权限。

## SSE 持续推送

SSE 适合服务器单向推送文本事件，例如日志、构建进度和实时指标。Express 端点如下：

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

浏览器使用 `EventSource`：

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

每个事件帧以空行结束。未写 `event:` 时事件名默认为 `message`。客户端断开后必须清理定时器、消息订阅和数据库监听，否则每条失效连接都会留下后台任务。

反向代理还可能缓冲响应，导致服务端不断 `write()`，浏览器却迟迟收不到事件。除了禁用缓冲，还要配置连接超时、心跳、断线重连策略和每个实例允许的最大长连接数。

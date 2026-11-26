---
title: Node.js 网络与系统编程：TCP 拆包、Socket.IO、分片上传与 Puppeteer
slug: nodejs-network-and-system
date: 2026-07-13
categories:
  - 后端开发
tags:
  - Node.js
  - TCP
  - Socket.IO
  - HTTP/2
  - 系统编程
---

TCP、文件流和串口在操作系统眼里全是没有天然消息边界的字节流。业务上最常碰到的“粘包”“半包”、大文件把内存打爆、实时聊天室多实例状态错乱，根源都在于把流式接口当成了按消息块收发的离散接口。先定好帧边界、单帧大小上限和资源回收负责人，再往上接业务协议，底层系统能力才能稳住。

## TCP 字节流拆包与自定义帧协议

TCP 只保证同一连接内的字节有序、可靠送达，客户端连续两次调用 `socket.write()`，服务端可能一次 `data` 事件全部收到，也可能被拆成三段到达。下面用换行符划分消息边界，并为每个连接独立维护待解析缓冲区与最大帧限制：

```js
import net from 'node:net';

const MAX_FRAME_BYTES = 64 * 1024;

const server = net.createServer((socket) => {
  socket.setEncoding('utf8');
  let pending = '';

  socket.on('data', (chunk) => {
    pending += chunk;

    let newline = pending.indexOf('\n');
    while (newline !== -1) {
      const frame = pending.slice(0, newline);
      pending = pending.slice(newline + 1);

      if (Buffer.byteLength(frame) > MAX_FRAME_BYTES) {
        socket.destroy(new Error('frame too large'));
        return;
      }

      try {
        const message = JSON.parse(frame);
        socket.write(JSON.stringify({ ok: true, message }) + '\n');
      } catch {
        socket.write(JSON.stringify({ ok: false, error: 'invalid json' }) + '\n');
      }

      newline = pending.indexOf('\n');
    }

    if (Buffer.byteLength(pending) > MAX_FRAME_BYTES) {
      socket.destroy(new Error('frame too large'));
    }
  });

  socket.on('error', (error) => {
    console.error('socket error', error);
  });
});

server.on('error', (error) => {
  console.error('server error', error);
});

server.listen(3000, '127.0.0.1');
```

**每个 TCP 连接必须独占一份解析缓冲区，且无论是否遇到分隔符都必须校验 `pending` 的最大字节数，否则恶意发送无换行符的超长数据就能打爆进程内存。**

换行协议适合纯文本或 JSON 行协议；若负载包含任意二进制数据，应在消息头写入固定长度的字节计数（Length-Prefixed Framing）。

客户端连接同样需要监听 `data`、`end` 和 `error`：

```js
const client = net.createConnection(
  { host: '127.0.0.1', port: 3000 },
  () => {
    client.write(JSON.stringify({ type: 'hello' }) + '\n');
  },
);

client.setEncoding('utf8');
client.on('data', (chunk) => console.log('server:', chunk));
client.on('end', () => console.log('server closed the connection'));
client.on('error', (error) => console.error('client error', error));
```

## Socket.IO 房间通信与多实例边界

构建实时聊天室或协同看板时，成员状态不能直接放进全局数组不管，连接断开时必须清理，广播范围和消息长度也要做约束。

```js
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: ['http://localhost:5173'] },
  maxHttpBufferSize: 64 * 1024,
});

const members = new Map();

io.on('connection', (socket) => {
  socket.on('join', async (input, reply) => {
    const ack = typeof reply === 'function' ? reply : () => {};

    if (typeof input?.name !== 'string' || typeof input?.room !== 'string') {
      return ack({ ok: false, message: '成员信息不合法' });
    }

    const name = input.name.trim();
    const room = input.room.trim();
    if (!name || !room || name.length > 30 || room.length > 50) {
      return ack({ ok: false, message: '成员信息不合法' });
    }

    const previous = members.get(socket.id);
    if (previous && previous.room !== room) {
      await socket.leave(previous.room);
      socket.to(previous.room).emit('system', {
        text: `${previous.name} 离开房间`,
      });
    }

    await socket.join(room);
    members.set(socket.id, { name, room });
    socket.to(room).emit('system', { text: `${name} 加入房间` });
    ack({ ok: true });
  });

  socket.on('chat', (input, reply) => {
    const ack = typeof reply === 'function' ? reply : () => {};
    const member = members.get(socket.id);
    if (!member) return ack({ ok: false, message: '请先加入房间' });

    const text = typeof input?.text === 'string' ? input.text.trim() : '';
    if (!text || text.length > 500) {
      return ack({ ok: false, message: '消息内容不合法' });
    }

    io.to(member.room).emit('chat', { sender: member.name, text });
    ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const member = members.get(socket.id);
    members.delete(socket.id);

    if (member) {
      io.to(member.room).emit('system', {
        text: `${member.name} 离开房间`,
      });
    }
  });
});

httpServer.listen(3000);
```

不同广播 API 的目标集合容易混淆：

| 调用方式 | 接收方范围 |
| --- | --- |
| `socket.emit()` | 仅当前连接 |
| `socket.broadcast.emit()` | 除当前连接外的全部连接 |
| `socket.to(room).emit()` | 目标房间内除当前连接外的成员 |
| `io.to(room).emit()` | 目标房间内全部成员（含当前连接） |

**Socket.IO 拥有独立于原生 WebSocket 的握手和心跳协议，裸 WebSocket 客户端无法直接连入，且多实例部署时必须挂载 Redis Adapter 才能跨进程同步房间事件。**

正式服务中身份校验应在握手中间件阶段完成，将服务端核实过的用户 ID 挂载到 `socket.data`，切忌信任客户端在 `join` 事件里自报的用户名。

## Puppeteer 动态抓取与跨进程数据管道

动态渲染页面需要等脚本执行完再采集，用固定 `setTimeout` 既浪费时间又不可靠，必须等待具体 DOM 条件并用 `try/finally` 确保浏览器实例一定关闭：

```js
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);

  await page.goto('https://example.com', {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });

  await page.waitForSelector('.entry-list a.title');

  const titles = await page.$$eval('.entry-list a.title', (nodes) =>
    nodes.map((node) => node.textContent?.trim()).filter(Boolean),
  );

  console.log(titles);
} finally {
  await browser.close();
}
```

大段文本交由 Python 等外部脚本处理（例如生成词云）时，应通过子进程 `stdin` 传递 JSON 并检查退出码，避免塞进命令行参数触及系统长度上限或引发转义错误：

```js
import { spawn } from 'node:child_process';

function createWordCloud(titles) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', ['./word-cloud.py'], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`python exited with ${code}: ${stderr}`));
    });

    child.stdin.end(JSON.stringify({ titles }));
  });
}
```

抓取任何外部站点前须确认服务条款、`robots.txt` 与访问频率限制；页面改版极易导致选择器返回空列表，异常日志应同时记录目标 URL、失效选择器及现场截图路径。

## Node-API 封装原生 C/C++ 扩展

需要调用系统底层 API 或复用高性能 C/C++ 库时，应优先采用 ABI 稳定的 Node-API（配合 `node-addon-api` 的 C++ 封装），减少跨 Node.js 主版本升级时的重编译成本。

`binding.gyp` 描述编译目标与头文件依赖：

```json
{
  "targets": [
    {
      "target_name": "screen",
      "sources": ["screen.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    }
  ]
}
```

```cpp
#include <napi.h>
#include <windows.h>

Napi::Value GetScreenSize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);

  result.Set("width", Napi::Number::New(env, GetSystemMetrics(SM_CXSCREEN)));
  result.Set("height", Napi::Number::New(env, GetSystemMetrics(SM_CYSCREEN)));
  return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getScreenSize", Napi::Function::New(env, GetScreenSize));
  return exports;
}

NODE_API_MODULE(screen, Init)
```

执行 `node-gyp configure && node-gyp build` 后即可 `require('./build/Release/screen.node')` 加载。

**原生 C++ 函数默认运行在 Node.js 主线程上，同步阻塞计算照样会卡死事件循环，内存越界则会直接拖垮整个进程。**

跨平台项目必须在代码层隔离平台专用系统调用，长耗时原生任务应封装为 `Napi::AsyncWorker` 移出主线程，并在入口处严格校验入参类型和缓冲区边界。

## 大文件分片上传、合并与流式下载

大文件直传容易因超时失败且无法断点续传。前端通过 `Blob.slice()` 切分分片，每个分片附带服务端签发的 UUID `uploadId`、数字索引与分片哈希；服务端绝对不能使用客户端传来的原始文件名拼装临时路径。

合并阶段必须把分片目录里的文件名转成数字再排序（字典序会把 `'10'` 排在 `'2'` 前面），并用生成器流式拼接：

```js
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const uploadRoot = path.resolve('uploads');
const fileRoot = path.resolve('files');

app.post('/merge', async (req, res, next) => {
  try {
    const { uploadId, total } = req.body ?? {};
    if (typeof uploadId !== 'string' || !/^[a-f0-9-]{36}$/i.test(uploadId)) {
      return res.status(400).json({ message: '上传 ID 不合法' });
    }
    if (
      typeof total !== 'number' ||
      !Number.isInteger(total) ||
      total <= 0 ||
      total > 10_000
    ) {
      return res.status(400).json({ message: '分片数量不合法' });
    }

    const chunkDir = path.join(uploadRoot, uploadId);
    const tempTarget = path.join(fileRoot, `${uploadId}.bin.tmp`);
    const finalTarget = path.join(fileRoot, `${uploadId}.bin`);
    const chunks = await fsp.readdir(chunkDir);
    const indexes = chunks
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b);

    if (
      indexes.length !== total ||
      indexes.some((value, index) => value !== index)
    ) {
      return res.status(409).json({ message: '分片不完整' });
    }

    await fsp.mkdir(fileRoot, { recursive: true });
    const output = fs.createWriteStream(tempTarget, { flags: 'wx' });
    const input = Readable.from(
      (async function* readChunks() {
        for (const index of indexes) {
          yield* fs.createReadStream(path.join(chunkDir, String(index)));
        }
      })(),
    );

    await pipeline(input, output);
    await fsp.rename(tempTarget, finalTarget);
    await fsp.rm(chunkDir, { recursive: true });
    res.status(201).json({ uploadId });
  } catch (error) {
    next(error);
  }
});
```

**先写入 `.tmp` 临时文件并核验完整文件哈希，全部成功后再原子重命名为正式文件，失败时只清理半成品并保留已上传分片供客户端重试。**

文件下载接口同样要走流式 `pipeline()` 把网络背压传回磁盘读流：

```js
app.get('/files/:id', async (req, res, next) => {
  try {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) {
      return res.status(400).end();
    }

    const filePath = path.join(fileRoot, `${req.params.id}.bin`);
    const stat = await fsp.stat(filePath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', 'attachment; filename="download.bin"');

    await pipeline(fs.createReadStream(filePath), res);
  } catch (error) {
    if (error?.code === 'ENOENT') return res.status(404).end();
    next(error);
  }
});
```

浏览器端用 `fetch` 拿到 `Blob` 并通过 `URL.createObjectURL(blob)` 触发下载后，务必立即调用 `URL.revokeObjectURL(url)` 释放浏览器内存引用。

## HTTP 缓存协商、HTTP/2、短链接与串口

在应用网关和系统集成中，还有四项容易误用的机制需要明确边界：

**1. HTTP 强缓存与 ETag 协商缓存**

`Cache-Control: no-cache` 允许客户端缓存副本，只是要求每次复用前必须向服务器发起条件验证；完全禁止任何本地落盘应使用 `no-store`。按内容摘要生成 `ETag` 比依赖时间戳的 `Last-Modified` 更精确：

```js
import crypto from 'node:crypto';

app.get('/api/config', (req, res) => {
  const body = JSON.stringify({ theme: 'light' });
  const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.type('json').send(body);
});
```

**2. HTTP/2 多路复用与 TLS**

`node:http2` 通过 `createSecureServer()` 在单条连接上并发多个二进制帧流并压缩头部（使用 `:method`、`:path`、`:status` 等伪首部）。多路复用消除了 HTTP/1.1 的队头阻塞和并发连接数限制，但所有流依然共享底层同一条 TCP 连接，网络丢包时仍会引发 TCP 层的整体重传卡顿。

**3. 短链接服务与开放重定向防护**

短链接核心是数据库唯一索引 `UNIQUE KEY uk_short_links_code (code)` 兜底的随机短码映射。服务端生成短码时如遇 `ER_DUP_ENTRY` 冲突则自动重试；校验目标 URL 必须严格限制协议为 `http:` 或 `https:` 拦截 `javascript:` 注入，拼接短链域名必须读取可信环境变量 `PUBLIC_BASE_URL` 而不能信任客户端可伪造的 `Host` 请求头。

**4. 硬件串口通信独占**

对接打印机、扫码器或单片机时应先用 `SerialPort.list()` 枚举端口，再匹配波特率、数据位和停止位。绝对不能让多个 HTTP 路由直接并发调用 `port.write()`，必须由单一硬件管理模块独占串口实例，负责命令排队、帧边界解析、断线重连和超时报错。

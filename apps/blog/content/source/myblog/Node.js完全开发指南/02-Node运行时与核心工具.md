---
title: Node.js 运行时、核心 API 与工具开发
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - File System
  - Process
  - Streams
  - CLI
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
pages: P10-P25
draft: false
---

# Node.js 运行时、核心 API 与工具开发

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('tmp', 'hello.txt');

await mkdir('tmp', { recursive: true });
await writeFile(output, 'hello Node.js\n', 'utf8');
console.log(await readFile(output, 'utf8'));
```

这段代码已经碰到了 Node.js 工具开发的三条边界：路径交给 `node:path`，文件操作要等 Promise 完成，输出位置取决于进程的工作目录。路径拼错、漏了 `await`、搞错工作目录，是脚本"本机能跑、换个目录就坏"的主要原因。

## 运行时边界

浏览器提供 `window`、DOM 和 BOM；Node.js 面向文件、网络、进程和操作系统，没有内置的 `document`、`location` 或 `requestAnimationFrame`。Promise、数组、对象、正则这些 ECMAScript 能力两边都能用。

跨环境的代码可以用 `globalThis` 拿到全局对象：

```js
globalThis.appName = 'toolbox';
console.log(globalThis.appName);
```

全局变量会制造隐式依赖，业务数据还是要通过参数或模块导出传递。`Buffer`、`process` 这些是 Node.js 提供的运行时能力，不属于 ECMAScript 语法。

### 模块目录不是工作目录

CommonJS 直接提供 `__filename` 和 `__dirname`。ESM 要从 `import.meta.url` 转成文件路径：

```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const directory = dirname(filename);

console.log({ filename, directory, cwd: process.cwd() });
```

- 模块目录跟着当前文件走，适合定位和代码一起发布的模板和资源。
- `process.cwd()` 跟着启动位置走，适合解释用户传进来的相对路径和项目根目录。

两者混着用的话，从 IDE、npm 脚本和别的目录启动，会得到不一样的结果。

## 参数、环境与退出码

```js
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex === -1 ? 3000 : Number(args[portIndex + 1]);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('invalid --port');
  process.exitCode = 1;
} else {
  console.log(`listen on ${port}`);
}
```

`process.argv` 的前两项一般是 Node.js 可执行文件和脚本路径，后面才是用户参数。设置 `process.exitCode` 能让标准输出和异步清理自然做完；`process.exit()` 会立刻终止进程，缓冲区里的日志可能来不及写出去。

环境变量用来传部署差异和敏感配置：

```js
const apiBase = process.env.API_BASE ?? 'http://localhost:3000';
const isProduction = process.env.NODE_ENV === 'production';
```

别把密钥硬编码进源码，也别假设环境变量一定存在，程序启动时就要校验必需的变量。给 `process.env` 赋值只影响当前进程和之后的子进程，不会永久改系统配置。

不同 shell 设变量的写法不一样，跨平台的 npm 脚本可以用 `cross-env`：

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development node src/index.js",
    "start": "cross-env NODE_ENV=production node src/index.js"
  }
}
```

## path 处理路径

别用字符串手动拼文件路径：

```js
import path from 'node:path';

const file = path.join('assets', 'images', '..', 'logo.png');
const absolute = path.resolve('dist', 'index.html');

console.log(path.basename(absolute));
console.log(path.dirname(absolute));
console.log(path.extname(absolute));
console.log(path.parse(absolute));
console.log(path.sep);
```

`join()` 负责连接和规范化片段，`resolve()` 会结合当前工作目录生成绝对路径。要在任意系统上解析固定格式的路径，就显式选规则：

```js
path.win32.basename('C:\\work\\index.js');
path.posix.basename('/srv/app/index.js');
```

这里容易炸在把 URL 当成文件路径处理。URL 交给 `URL`，磁盘路径才交给 `node:path`。

## os 读取机器信息

`node:os` 描述操作系统，`process` 描述当前的 Node.js 进程：

```js
import os from 'node:os';

console.log({
  platform: os.platform(),
  release: os.release(),
  arch: os.arch(),
  home: os.homedir(),
  logicalCpus: os.cpus().length,
  memory: process.memoryUsage(),
});
```

`process.memoryUsage()` 里，`rss` 是进程的驻留内存，`heapUsed` 是 V8 堆已经用掉的部分，`external` 和 `arrayBuffers` 反映一部分原生内存。只盯着 `heapUsed` 可能漏掉 Buffer 或原生扩展的占用。

网卡信息里可能有内网 IP 和 MAC 地址，别整份写进公开日志。逻辑 CPU 数也只是并行度的参考，不代表能开同样数量的重任务。

## CSR 与 SSR

Node.js 默认没有 DOM，但可以由第三方库提供 DOM 实现。`jsdom` 能在进程里构造和操作文档：

```js
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><main id="app"></main>');
const app = dom.window.document.querySelector('#app');

app.textContent = 'rendered on the server';
console.log(dom.serialize());
```

服务端先拿到数据、返回完整的 HTML，是 SSR；浏览器下载 JavaScript 后再请求数据、生成页面，是 CSR。

| 维度 | CSR | SSR |
| --- | --- | --- |
| HTML 生成位置 | 浏览器 | 服务器 |
| 首次内容 | 依赖脚本下载和执行 | 可直接返回已生成内容 |
| 交互 | 客户端直接接管 | 通常还要 hydration |
| 服务器开销 | 静态资源为主 | 每次渲染可能消耗计算资源 |
| 可索引性 | 依赖爬虫执行脚本能力 | 初始 HTML 更容易读取 |

用了 SSR，SEO 也不会自动变好。标题、描述、语义标签、真实链接、图片替代文本和稳定的正文结构，照样都要做对。

## 启动子进程

选 `node:child_process` 的哪个 API，先看三点：命令可不可信、输出量多大、要不要持续通信。

| API | 行为 | 适合场景 |
| --- | --- | --- |
| `exec()` | 经 shell 执行字符串，缓冲完整输出 | 短小且完全可信的 shell 命令 |
| `execFile()` | 直接执行文件，参数数组分离 | 调用确定的可执行程序 |
| `spawn()` | 返回流，边运行边消费 | 长任务、大量输出、持续进程 |
| `fork()` | 启动 Node.js 模块并建立 IPC | 父子 Node.js 进程通信 |
| `*Sync` | 阻塞当前线程 | 启动阶段的极短任务 |

### spawn 处理长输出

```js
import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['--version'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('error', (error) => console.error('failed to start:', error.message));
child.on('close', (code, signal) => console.log({ code, signal }));
```

`error` 表示进程根本没起来，比如可执行文件不存在；`close` 表示标准流关闭了，并给出退出状态。只监听其中一个，就会漏掉失败的分支。

参数数组能减少引号和注入问题。没校验过的用户输入绝不能直接拼进 `exec()` 的 shell 字符串。

### fork 交换消息

父进程：

```js
import { fork } from 'node:child_process';

const worker = fork('./worker.js');
worker.send({ type: 'sum', values: [1, 2, 3] });
worker.on('message', (message) => console.log(message));
worker.on('exit', (code) => console.log('worker exit:', code));
```

子进程：

```js
process.on('message', (message) => {
  if (message?.type !== 'sum' || !Array.isArray(message.values)) return;

  const result = message.values.reduce((sum, value) => sum + value, 0);
  process.send?.({ type: 'result', result });
});
```

IPC 消息也是外部输入，要校验结构。父进程还要处理超时、异常退出和资源回收，别默认子进程一定会回复。

## 调用 FFmpeg 与 pngquant

媒体编解码别在 JavaScript 主线程里重写。格式转换、抽音频、滤镜处理直接交给 FFmpeg：

```bash
ffmpeg -n -i input.mov -c:v libx264 -c:a aac output.mp4
ffmpeg -n -i input.mp4 -vn -c:a libmp3lame -q:a 2 audio.mp3
ffmpeg -n -ss 00:01:30 -i input.mp4 -t 20 -c:v libx264 -c:a aac clip.mp4
ffmpeg -n -i input.mp4 -vf "scale=1280:-2" scaled.mp4
ffmpeg -n -i input.mp4 -i logo.png -filter_complex "[0:v][1:v]overlay=W-w-24:H-h-24[v]" -map "[v]" -map "0:a?" -c:a copy watermarked.mp4
```

几个参数：

- `-ss` 指定起点，`-t` 指定从起点开始保留多长。`-ss` 放在 `-i` 前面寻址更快；要帧级精确、输入的索引又靠不住时，可以放到 `-i` 后面并重新编码。
- `-vf` 处理单路视频滤镜，`-filter_complex` 能连接视频、图片等多路输入。
- `-n` 在输出文件已经存在时拒绝覆盖；只有确认旧文件可以扔掉，才换成 `-y`。自动化任务要明确选一个。

Node.js 调用时用参数数组，关掉子进程的 stdin，并保证 FFmpeg 的输出流有人消费：

```js
import { spawn } from 'node:child_process';

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      ['-hide_banner', '-nostdin', '-n', ...args],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed: code=${code}, signal=${signal}`));
    });
  });
}

await runFfmpeg([
  '-i', 'input.mov',
  '-c:v', 'libx264',
  '-c:a', 'aac',
  'output.mp4',
]);
```

FFmpeg 经常把进度写到标准错误流，所以 stderr 有内容不代表失败，最终要看退出码。`inherit` 让日志一直流出去，不会因为管道没人读、被写满而把子进程卡住；`-nostdin` 避免后台任务意外等终端输入。生产任务还要限制输入体积、执行时长、并发数和输出目录。

pngquant 用颜色量化来压缩 PNG：

```bash
pngquant --quality 70-85 --speed 3 --output compressed.png -- input.png
```

PNG 原图可能有大量颜色，而调色板 PNG 最多存 256 个代表色。pngquant 按改进的 median-cut 思路，把颜色样本反复切成色桶，差异大、权重高的区域优先拆分，再给每个桶选一个代表色，把像素映射回调色板。抖动能减轻色带，但也可能增加噪点和体积。质量区间控制能接受多少视觉损失，速度参数在耗时和压缩效果之间取舍。外部程序缺失、版本差异、路径里有空格，都是调用层要显式处理的失败点。

## EventEmitter 管理事件

```js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

function onReady(payload) {
  console.log('ready:', payload);
}

bus.on('ready', onReady);
bus.once('first-request', () => console.log('only once'));

bus.emit('ready', { port: 3000 });
bus.emit('first-request');
bus.emit('first-request');

bus.off('ready', onReady);
```

`off()` 要拿到注册时的同一个函数引用。循环里注册匿名监听器又移除不掉，内存和重复的副作用会越积越多。调大 `setMaxListeners()` 只是把警告藏起来，泄漏还在。

`process`、流和很多网络对象都暴露事件接口。事件驱动的关键在于说清楚：谁注册、谁触发、什么时候移除，错误事件由谁来消费。

## 回调转 Promise

旧式的 Node.js API 常用错误优先的回调，`promisify()` 能把符合约定的函数转成 Promise：

```js
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

try {
  const { stdout } = await execAsync('node --version');
  console.log(stdout.trim());
} catch (error) {
  console.error(error);
}
```

它只适用于最后一个参数形如 `(error, value)` 的函数。有多个成功值、依赖 `this`、或者不遵守错误优先约定的 API，要专门包一层。`callbackify()` 则用来让 Promise 函数兼容旧的回调接口。

格式化日志可以用 `node:util`：

```js
import { format } from 'node:util';

console.log(format('%s started on port %d', 'server', 3000));
```

## fs 操作文件

业务代码一般优先用 `node:fs/promises`：

```js
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

await mkdir('output/assets', { recursive: true });

const content = await readFile('input.txt', 'utf8');
await writeFile('output/result.txt', content.toUpperCase(), 'utf8');
await appendFile('output/app.log', 'converted\n', 'utf8');
await rename('output/result.txt', 'output/final.txt');
await rm('output/assets', { recursive: true, force: true });
```

`writeFile()` 默认覆盖目标。删除、重命名和覆盖之前，先确认绝对路径还在允许的工作目录里；用户输入的相对路径不能直接拿来当破坏性操作的目标。

### 大文件走流

`readFile()` 会把整个文件读进内存。复制或转换大文件要用流：

```js
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

await pipeline(
  createReadStream('large-input.txt'),
  createWriteStream('large-output.txt'),
);
```

`pipeline()` 会传播错误、协调结束，比裸的 `source.pipe(target)` 更容易形成完整的失败链路。写入端比较慢时，流的背压还能防止读取端无限堆数据。

### 监听与链接

`fs.watch()` 可以拿来做开发期的刷新，但不同平台可能合并、重复或漏掉事件，不能当审计日志用。回调里一般还要防抖，并且容忍编辑器原子替换时目标暂时消失。

- 硬链接让多个目录项指向同一份文件数据。
- 符号链接存的是目标路径，目标没了链接就失效。

Windows 上建符号链接可能受权限或系统策略限制。建之前还要防止链接把后续的文件操作带到工作目录外面去。

异步文件请求会从 JavaScript 进到原生绑定，再由 libuv 调平台的实现。什么时候完成取决于 I/O 和事件循环，不能光看代码的书写顺序，就断定它一定比定时器或 `setImmediate()` 先完成。

## crypto 处理摘要与密钥

密码学能力可以分三类：

| 类型 | 密钥关系 | 常见用途 |
| --- | --- | --- |
| 对称加密 | 加解密共享密钥 | 加密较大数据 |
| 非对称密码 | 公钥与私钥成对 | 签名、密钥交换、小数据处理 |
| 哈希 | 单向摘要 | 完整性校验、内容指纹 |

计算文件的 SHA-256：

```js
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const hash = createHash('sha256');

for await (const chunk of createReadStream('archive.zip')) {
  hash.update(chunk);
}

console.log(hash.digest('hex'));
```

摘要一致只能说明内容一致，证明不了内容来自可信的发布者；要验证身份，还需要可信的公钥和数字签名。

AES-GCM 同时提供机密性和完整性校验，解密时必须带回认证标签：

```js
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const key = randomBytes(32); // 示例；生产密钥应来自密钥服务
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([
  cipher.update('confidential', 'utf8'),
  cipher.final(),
]);
const authTag = cipher.getAuthTag();

const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const plaintext = Buffer.concat([
  decipher.update(ciphertext),
  decipher.final(),
]);

console.log(plaintext.toString('utf8'));
```

同一把 GCM 密钥下不能重复用 nonce。持久化时一般存 `iv + authTag + ciphertext`，密钥单独保管；认证标签对不上时 `final()` 会失败，不能返回部分明文。

RSA 用公钥和私钥处理不同方向的操作。它不适合直接加密大文件，常见做法是用公钥加密一把随机的 AES 会话密钥：

```js
import {
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const sessionKey = randomBytes(32);

const wrappedKey = publicEncrypt(
  { key: publicKey, oaepHash: 'sha256' },
  sessionKey,
);
const unwrappedKey = privateDecrypt(
  { key: privateKey, oaepHash: 'sha256' },
  wrappedKey,
);

console.log(sessionKey.equals(unwrappedKey));
```

公钥可以分发，私钥要严格控制；数字签名是私钥签名、公钥验签。密码不能只做一次 MD5 或 SHA-256，要用带随机盐、专门为口令设计的慢哈希方案。

## CLI 命令入口

命令行工具至少要有 shebang 和 `bin` 映射：

```js
#!/usr/bin/env node
```

```json
{
  "name": "project-kit",
  "type": "module",
  "bin": {
    "project-kit": "./src/index.js"
  }
}
```

开发时跑 `npm link`，就能从全局命令路径验证当前的包。Commander 管命令结构，Inquirer 管交互输入：

```js
#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';

const program = new Command();

program
  .name('project-kit')
  .version('1.0.0')
  .command('create <project-name>')
  .description('create a project from a template')
  .action(async (projectName) => {
    const { typescript } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript?',
        default: true,
      },
    ]);

    const branch = typescript ? 'typescript' : 'javascript';
    console.log({ projectName, branch });
  });

program.parse(process.argv);
```

完整的创建命令还要检查目标目录、校验项目名、捕获下载失败、停掉 spinner、删掉半成品，并设置非零退出码。Ora 只负责显示状态，代替不了错误处理；`download-git-repo` 只负责拿到模板，保证不了目标目录的安全。

## Markdown 预览工具

一个本地预览器可以拆成四块：

```text
读取 Markdown
    ↓
marked.parse() 生成 HTML 片段
    ↓
EJS 填入完整页面
    ↓
BrowserSync 刷新浏览器
```

EJS 的几种输出方式：

```ejs
<% /* 执行 JavaScript，不输出 */ %>
<%= title %>   <!-- 转义输出 -->
<%- content %> <!-- 原样输出 HTML -->
```

`marked` 生成的 HTML 一般要用 `<%- content %>` 插进去，前提是 Markdown 可信，或者已经消过毒。不然恶意的 HTML 和脚本会进到预览页面里。

监听文件变化时，服务只能初始化一次。之后有变化就重新生成文件、调 reload；每次变化都重启 BrowserSync，会不停地占端口、加监听器。

## zlib 接入流

压缩用的转换流可以直接放进 `pipeline()`：

```js
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';

await pipeline(
  createReadStream('input.txt'),
  createGzip(),
  createWriteStream('input.txt.gz'),
);

await pipeline(
  createReadStream('input.txt.gz'),
  createGunzip(),
  createWriteStream('restored.txt'),
);
```

Deflate 对应 `createDeflate()` 和 `createInflate()`。用在 HTTP 上时，要先按客户端的 `Accept-Encoding` 选算法，再写上匹配的 `Content-Encoding`。不协商就固定返回压缩格式，客户端和中间缓存都可能把响应体解释错。

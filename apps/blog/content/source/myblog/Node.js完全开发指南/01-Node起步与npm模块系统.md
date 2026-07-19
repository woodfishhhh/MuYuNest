---
title: Node.js 起步、npm 工作流与模块系统
date: 2026-07-13
updated: 2026-07-13
tags:
  - Node.js
  - npm
  - package.json
  - CommonJS
  - ES Modules
source:
  - https://www.bilibili.com/video/BV1cV4y1B7P4/
bvid: BV1cV4y1B7P4
pages: P1-P9
draft: false
---

# Node.js 起步、npm 工作流与模块系统

```bash
mkdir node-app
cd node-app
npm init -y
node -e "console.log(process.version)"
```

这几条命令建立了一个最小 Node.js 项目：`node` 负责执行 JavaScript，`npm` 负责描述项目、安装依赖和运行脚本。若最后一条命令提示找不到 `node`，先检查安装目录是否进入 `PATH`，再重新打开终端。

## Node 负责什么

Node.js 是 JavaScript 运行时，不是新的编程语言。V8 执行 JavaScript，libuv 提供事件循环、异步 I/O 和跨平台抽象，OpenSSL 支撑 TLS、哈希与加密，文件和网络操作最终仍由操作系统完成。

```text
JavaScript API：fs、http、path、process
          ↓
原生绑定与运行时
          ↓
V8、libuv、OpenSSL、操作系统
```

这套结构擅长处理等待较多的工作，例如 API 服务、代理、即时通信、构建工具和自动化脚本。CPU 密集计算如果长时间占用 JavaScript 主线程，会连带阻塞其他请求；图像编码、音频转码等任务更适合交给外部程序、工作线程或子进程。

安装版本时，长期项目通常选择 LTS。安装完成后检查三个入口：

```bash
node -v
npm -v
npx -v
```

- `node` 执行文件或表达式。
- `npm` 管理包、依赖、配置和脚本。
- `npx` 定位并执行包暴露的命令。

## package.json 控制项目

`package.json` 同时描述项目身份、模块模式、命令和依赖。一个可直接运行的配置如下：

```json
{
  "name": "node-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "node --test"
  }
}
```

`private: true` 可以阻止项目被误发布。`type: module` 决定 `.js` 文件按 ESM 解释；不写时默认按 CommonJS 处理。常见字段各有明确职责：

| 字段 | 职责 |
| --- | --- |
| `name` | 包名；公开发布时必须满足命名规则且未被占用 |
| `version` | 当前版本，通常遵循语义化版本 |
| `main` | CommonJS 包的传统入口 |
| `type` | `.js` 使用 `commonjs` 还是 `module` |
| `scripts` | 项目内可复用命令 |
| `bin` | 安装后生成的命令及其入口 |
| `files` | 发布包时允许包含的文件 |
| `repository` | 源码仓库地址 |
| `license` | 开源协议 |

### 版本表达兼容性

```text
1.4.2
│ │ └─ PATCH：向后兼容的修复
│ └─── MINOR：向后兼容的新功能
└───── MAJOR：不兼容变更
```

语义化版本不是改动量计数器，而是兼容承诺。依赖范围允许 npm 在承诺内选择版本，`package-lock.json` 再记录这次解析出的确定结果。

### 依赖放对位置

```bash
npm install express
npm install --save-dev eslint
```

- `dependencies` 是应用运行时需要的包。
- `devDependencies` 只服务于开发、测试或构建。
- `peerDependencies` 声明插件需要由宿主提供的兼容版本。

例如，插件通常不应私自再安装一份宿主框架：

```json
{
  "peerDependencies": {
    "vite": "^5.0.0 || ^6.0.0"
  }
}
```

依赖分类错误最常见的后果是生产安装缺包，或库项目打出重复的宿主实例。

## npm install 的落盘链路

```bash
npm install
```

一次安装至少经过这些步骤：

```text
读取 npm 配置
    ↓
读取 package.json 与 package-lock.json
    ↓
解析版本范围并构建依赖树
    ↓
命中缓存或从 registry 下载
    ↓
校验完整性
    ↓
尽量提升可复用依赖并写入 node_modules
    ↓
更新 lockfile 与命令入口
```

### 扁平化有边界

若 A 和 B 都需要 `C@1`，npm 可以把 C 提升到顶层供二者复用：

```text
app
├─ A
├─ B
└─ C@1
```

若 B 需要不兼容的 `C@2`，它不能与顶层版本共用：

```text
app
├─ A
├─ C@1
└─ B
   └─ node_modules
      └─ C@2
```

因此 `node_modules` 只是尽量扁平，并不保证所有依赖只有一层。排查“同一个包为什么出现多个版本”时，应先看完整依赖树，而不是直接删除嵌套目录。

### lockfile 锁的是依赖图

`package-lock.json` 会记录实际版本、下载地址、完整性摘要、依赖关系、命令入口和运行时要求等信息。当 `package.json` 的范围仍兼容时，npm 可以复用锁定结果；范围发生冲突时才重新解析。

应用项目应提交 lockfile。CI 更适合使用：

```bash
npm ci
```

它要求声明文件与 lockfile 一致，并按锁定结果进行干净安装。这里容易炸在手工修改 `package.json` 后没有同步 lockfile：本地残留的 `node_modules` 可能暂时掩盖问题，CI 会直接失败。

### 配置和缓存先查清

```bash
npm config list
npm config get registry
npm config get cache
```

npm 会合并项目级、用户级、全局级和内置配置。项目根目录的 `.npmrc` 很容易改变 registry、代理或证书行为。安装超时、发布到错仓库、身份认证失败时，先看最终生效配置。

缓存按内容和完整性信息索引，不是 `node_modules` 的简单副本。缓存命中能减少下载，但不会绕过依赖解析和完整性校验。

## npm run 找命令

安装带 `bin` 字段的包后，npm 会在 `node_modules/.bin` 生成命令入口。Windows 会生成适配 CMD 和 PowerShell 的包装文件，类 Unix 系统使用 shell 入口。

```json
{
  "scripts": {
    "dev": "vite"
  }
}
```

```bash
npm run dev
```

执行脚本时，npm 会临时把项目的 `node_modules/.bin` 加入命令搜索路径。这样脚本使用的是项目锁定的 Vite，而不是某台电脑上碰巧存在的全局版本。

包要暴露自己的命令，需要声明 `bin`：

```json
{
  "name": "hello-cli",
  "bin": {
    "hello-cli": "./bin/hello.js"
  }
}
```

入口文件通常还要有 shebang，并具备可执行条件：

```js
#!/usr/bin/env node

console.log('hello');
```

### 生命周期脚本

```json
{
  "scripts": {
    "prebuild": "node scripts/clean.js",
    "build": "node scripts/build.js",
    "postbuild": "node scripts/report.js"
  }
}
```

运行 `npm run build` 时，顺序是 `prebuild → build → postbuild`。它适合放确定性的准备和收尾动作，不适合藏入删除用户文件、上传数据等难以预判的副作用。

## npx 执行一次性工具

```bash
npx create-vite@6.1.0 my-app
```

`npx` 关注“运行哪个命令”：它优先查找项目已有命令，缺失时可以临时取得指定包再执行。`npm` 关注“项目安装了哪些包”。

显式写版本比 `@latest` 更利于复现。这里容易炸在包名和命令名不同，或临时下载了未经审查的新版本；自动化脚本应固定版本，敏感环境还应避免隐式联网执行。

## 发布前先打包

```bash
npm config get registry
npm login
npm pack --dry-run
npm publish
```

`npm pack --dry-run` 会列出准备进入发布包的文件。发布前至少检查：

- registry 是否真的是目标仓库；
- 包名是否可用；
- 版本是否已经发布过；
- `files` 是否只包含运行代码、类型声明和必要资源；
- README、仓库地址和许可证是否完整；
- 令牌、`.env`、私钥和内部配置是否被排除。

```json
{
  "name": "@example/text-tools",
  "version": "1.0.0",
  "files": ["dist", "README.md"],
  "repository": {
    "type": "git",
    "url": "https://example.com/team/text-tools.git"
  }
}
```

同一个版本不能覆盖发布。代码变更后应先更新版本，再发布新的不可变产物。

### 私有 registry

Verdaccio 可以在本地或内网提供 npm registry，用于共享内部包、缓存上游依赖和统一依赖入口。先安装并准备独立配置目录：

```bash
npm install --global verdaccio
mkdir verdaccio
```

初始化阶段先只监听回环地址，并临时允许创建少量账号：

```yaml
listen: 127.0.0.1:4873
storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@example/*':
    access: $authenticated
    publish: $authenticated
    proxy: npmjs
  '**':
    access: $all
    publish: $authenticated
    proxy: npmjs
```

保存配置后启动服务，在本机预置实际需要的账号：

```bash
verdaccio --config ./verdaccio/config.yaml
npm adduser --registry http://127.0.0.1:4873 --auth-type=legacy
```

账号建完后停止 Verdaccio，把 `htpasswd` 改成禁止继续注册，再重启服务：

```yaml
auth:
  htpasswd:
    file: ./htpasswd
    max_users: -1
```

`max_users: -1` 不会删除已有账号，只会关闭新账号注册。这里一定要先预置账号，否则会把所有人一起锁在登录入口外。

`$authenticated` 只表示“认证成功”，不表示这个账号经过了额外的发布审批。开放注册时，任何新注册用户都可能命中这条规则；关闭注册后，它仍然包含 `htpasswd` 中的所有账号。需要按团队或包控制权限时，应再配置分组或接入专用认证插件，不能把 `$authenticated` 当成审批名单。

生产环境不要直接暴露 `4873`。让 Verdaccio 继续监听 `127.0.0.1:4873`，由 Nginx 在 TLS 端口反向代理：

```nginx
server {
    listen 443 ssl;
    server_name registry.intra.example;

    ssl_certificate     /etc/nginx/tls/registry.crt;
    ssl_certificate_key /etc/nginx/tls/registry.key;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://127.0.0.1:4873;
    }
}
```

防火墙只允许公司内网或 VPN 网段访问 `443`，并拒绝外部访问 `4873`。若必须由 Verdaccio 直接服务内网，也只绑定服务器的私网地址，并按来源网段放行，不能监听公网接口。

先登录，再显式指定 HTTPS 地址发布和安装，最不容易发错仓库：

```bash
npm login --registry https://registry.intra.example --auth-type=legacy
npm publish --registry https://registry.intra.example
npm install @example/text-tools --registry https://registry.intra.example
```

稳定使用时可以把作用域写入项目级 `.npmrc`，避免影响所有包：

```ini
@example:registry=https://registry.intra.example
```

私服不是天然安全边界。回环或私网监听、TLS、来源网段防火墙、账号注册策略、包权限和持久化备份要一起成立。

## CommonJS 的值导出

CommonJS 用 `require()` 加载模块，用 `module.exports` 决定调用方最终得到什么值。

```js
// status.cjs
module.exports = {
  success: 1,
  error: 0,
};
```

```js
// index.cjs
const { success } = require('./status.cjs');

console.log(success);
```

导出值也可以直接是函数：

```js
// add.cjs
module.exports = function add(a, b) {
  return a + b;
};
```

`require()` 可以加载本地 JavaScript、第三方包、`node:fs` 这类内置模块、JSON 和编译后的 `.node` 原生扩展。它在运行时同步加载，首次读取和编译较大的模块会阻塞当前路径。

`exports` 初始时只是 `module.exports` 的快捷引用。下面的写法会让两者断开，调用方拿不到函数：

```js
exports = function add(a, b) {
  return a + b;
};
```

需要替换整个导出值时，必须赋给 `module.exports`。

## ESM 的绑定导出

在 `type: module` 的项目中，`.js` 使用 ESM；也可以用 `.mjs` 明确指定。

```js
// status.js
export const success = 1;
export const error = 0;

export default {
  success,
  error,
};
```

```js
import status, { success as successCode } from './status.js';
import * as statusModule from './status.js';

console.log(status.error);
console.log(successCode);
console.log(statusModule.default);
```

静态 `import` 位于模块顶层，Node.js 可以在执行前建立模块图。需要按条件加载时使用动态导入：

```js
if (process.env.FEATURE_X === 'on') {
  const feature = await import('./feature-x.js');
  feature.run();
}
```

| 维度 | CommonJS | ESM |
| --- | --- | --- |
| 语法 | `require`、`module.exports` | `import`、`export` |
| 加载时机 | 运行时同步加载 | 静态模块图；动态导入返回 Promise |
| 导入结果 | 获得导出值 | 命名导入是只读实时绑定 |
| 顶层 `this` | 当前 `module.exports` | `undefined` |
| 静态分析 | 较弱 | 更利于分析和 Tree Shaking |

两套语法不能只靠改一行代码混用。常见失败包括：项目声明 `type: module` 却调用 `require()`，ESM 相对导入漏写扩展名，以及把 CommonJS 的默认导出误当成 ESM 命名导出。

## CommonJS 怎么加载

CommonJS 加载器的核心链路是：

```text
解析模块标识
    ↓
检查缓存
    ↓
按扩展名选择加载方式
    ↓
读取并包装 JavaScript
    ↓
传入 exports、require、module、__filename、__dirname
    ↓
执行并缓存 module.exports
```

包装器可以近似理解为：

```js
(function (exports, require, module, __filename, __dirname) {
  // 当前模块代码
});
```

这解释了三个现象：文件顶层变量不会自动污染其他模块；`__filename` 等名字来自加载器上下文；同一模块多次 `require()` 通常复用缓存，因此模块顶层副作用也通常只执行一次。

JSON 模块会读取文本并解析，`.node` 扩展会进入原生动态库加载流程。具体源码会随 Node.js 版本调整，但“解析、加载、执行、缓存”这条边界不会因为语法糖而消失。

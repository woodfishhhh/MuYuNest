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

这几条命令建了一个最小的 Node.js 项目：`node` 执行 JavaScript，`npm` 描述项目、装依赖、跑脚本。最后一条提示找不到 `node` 的话，先看安装目录有没有进 `PATH`，再重开一个终端。

## Node 负责什么

Node.js 是 JavaScript 运行时，不是一门新语言。V8 执行 JavaScript，libuv 提供事件循环、异步 I/O 和跨平台抽象，OpenSSL 撑起 TLS、哈希和加密，文件和网络操作最后还是由操作系统完成。

```text
JavaScript API：fs、http、path、process
          ↓
原生绑定与运行时
          ↓
V8、libuv、OpenSSL、操作系统
```

这套结构擅长等待多的活：API 服务、代理、即时通信、构建工具、自动化脚本。CPU 密集的计算要是长时间占着 JavaScript 主线程，其他请求也会跟着被卡住；图像编码、音频转码这类任务更适合交给外部程序、工作线程或子进程。

长期项目一般装 LTS 版本。装完检查三个入口：

```bash
node -v
npm -v
npx -v
```

- `node` 执行文件或表达式。
- `npm` 管包、依赖、配置和脚本。
- `npx` 找到并执行包暴露出来的命令。

## package.json 控制项目

`package.json` 同时描述项目身份、模块模式、命令和依赖。一个能直接跑的配置：

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

`private: true` 能防止项目被误发布。`type: module` 让 `.js` 文件按 ESM 解释，不写就默认按 CommonJS。常见字段各管各的：

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

语义化版本表达的是兼容承诺，不是改了多少代码。依赖范围允许 npm 在承诺之内挑版本，`package-lock.json` 再把这次解析出来的确定结果记下来。

### 依赖放对位置

```bash
npm install express
npm install --save-dev eslint
```

- `dependencies`：应用运行时要用的包。
- `devDependencies`：只给开发、测试或构建用。
- `peerDependencies`：声明插件需要宿主提供的兼容版本。

比如插件一般不该自己再装一份宿主框架：

```json
{
  "peerDependencies": {
    "vite": "^5.0.0 || ^6.0.0"
  }
}
```

依赖放错位置，最常见的后果是生产安装缺包，或者库项目里打进了重复的宿主实例。

## npm install 的落盘链路

```bash
npm install
```

一次安装至少要走这些步骤：

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

A 和 B 都要 `C@1` 的话，npm 可以把 C 提到顶层给两者共用：

```text
app
├─ A
├─ B
└─ C@1
```

B 要的是不兼容的 `C@2` 的话，就没法和顶层的版本共用：

```text
app
├─ A
├─ C@1
└─ B
   └─ node_modules
      └─ C@2
```

所以 `node_modules` 只是尽量扁平，不保证所有依赖都只有一层。排查"同一个包为什么有好几个版本"时，先看完整的依赖树，别直接删嵌套目录。

### lockfile 锁的是依赖图

`package-lock.json` 记录实际版本、下载地址、完整性摘要、依赖关系、命令入口和运行时要求这些信息。`package.json` 的范围还兼容时，npm 可以复用锁定的结果；范围冲突了才重新解析。

应用项目要提交 lockfile。CI 里更适合用：

```bash
npm ci
```

它要求声明文件和 lockfile 一致，并按锁定的结果做干净安装。这里容易炸在手改了 `package.json` 却没同步 lockfile：本地残留的 `node_modules` 可能一时掩盖了问题，到 CI 就直接失败。

### 配置和缓存先查清

```bash
npm config list
npm config get registry
npm config get cache
```

npm 会合并项目级、用户级、全局级和内置的配置。项目根目录的 `.npmrc` 很容易改掉 registry、代理或证书的行为。安装超时、发错仓库、身份认证失败时，先看最终生效的配置。

缓存按内容和完整性信息索引，不是 `node_modules` 的简单拷贝。命中缓存能少下载，但依赖解析和完整性校验一步都不会少。

## npm run 找命令

装了带 `bin` 字段的包后，npm 会在 `node_modules/.bin` 里生成命令入口。Windows 上生成适配 CMD 和 PowerShell 的包装文件，类 Unix 系统用 shell 入口。

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

执行脚本时，npm 会临时把项目的 `node_modules/.bin` 加进命令搜索路径。这样脚本用的是项目锁定的 Vite，不是某台电脑上碰巧装着的全局版本。

包要暴露自己的命令，就得声明 `bin`：

```json
{
  "name": "hello-cli",
  "bin": {
    "hello-cli": "./bin/hello.js"
  }
}
```

入口文件一般还要有 shebang，并且具备可执行的条件：

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

运行 `npm run build` 时，顺序是 `prebuild → build → postbuild`。适合放确定性的准备和收尾动作，别往里藏删除用户文件、上传数据这种难以预料的副作用。

## npx 执行一次性工具

```bash
npx create-vite@6.1.0 my-app
```

`npx` 关心的是"跑哪个命令"：先找项目里已有的命令，没有的话可以临时拿到指定的包再执行。`npm` 关心的是"项目装了哪些包"。

显式写版本比 `@latest` 更好复现。这里容易炸在包名和命令名不一样，或者临时下载了一个没审查过的新版本；自动化脚本要固定版本，敏感环境还要避免隐式联网执行。

## 发布前先打包

```bash
npm config get registry
npm login
npm pack --dry-run
npm publish
```

`npm pack --dry-run` 会列出准备打进发布包的文件。发布前至少检查：

- registry 是不是真的目标仓库；
- 包名能不能用；
- 这个版本是不是已经发过了；
- `files` 里是不是只有运行代码、类型声明和必要的资源；
- README、仓库地址和许可证全不全；
- 令牌、`.env`、私钥和内部配置有没有排除掉。

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

同一个版本不能覆盖发布。代码改了就先升版本，再发布新的、不可变的产物。

### 私有 registry

Verdaccio 能在本地或内网提供 npm registry，用来共享内部包、缓存上游依赖、统一依赖入口。先安装，准备一个独立的配置目录：

```bash
npm install --global verdaccio
mkdir verdaccio
```

初始化阶段只监听回环地址，临时允许创建少量账号：

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

保存配置后启动服务，在本机先建好实际需要的账号：

```bash
verdaccio --config ./verdaccio/config.yaml
npm adduser --registry http://127.0.0.1:4873 --auth-type=legacy
```

账号建完后停掉 Verdaccio，把 `htpasswd` 改成禁止继续注册，再重启：

```yaml
auth:
  htpasswd:
    file: ./htpasswd
    max_users: -1
```

`max_users: -1` 不会删掉已有的账号，只是关掉新账号注册。所以一定要先把账号建好，不然所有人都会被一起锁在登录入口外面。

`$authenticated` 只表示"认证成功"，不表示这个账号经过了额外的发布审批。开放注册时，任何新注册的用户都可能命中这条规则；关了注册，它仍然包含 `htpasswd` 里的所有账号。要按团队或包控制权限，得再配分组或者接专门的认证插件，不能把 `$authenticated` 当成审批名单。

生产环境别直接暴露 `4873`。让 Verdaccio 继续监听 `127.0.0.1:4873`，由 Nginx 在 TLS 端口做反向代理：

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

防火墙只放行公司内网或 VPN 网段访问 `443`，拒绝外部访问 `4873`。要是非得让 Verdaccio 直接给内网提供服务，也只绑服务器的私网地址，按来源网段放行，不能监听公网接口。

先登录，再显式指定 HTTPS 地址来发布和安装，最不容易发错仓库：

```bash
npm login --registry https://registry.intra.example --auth-type=legacy
npm publish --registry https://registry.intra.example
npm install @example/text-tools --registry https://registry.intra.example
```

稳定用下来以后，可以把作用域写进项目级的 `.npmrc`，免得影响所有包：

```ini
@example:registry=https://registry.intra.example
```

私服本身不是安全边界。回环或私网监听、TLS、按来源网段的防火墙、账号注册策略、包权限和持久化备份，要一起到位才行。

## CommonJS 的值导出

CommonJS 用 `require()` 加载模块，由 `module.exports` 决定调用方最后拿到什么值。

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

导出的值也可以直接是个函数：

```js
// add.cjs
module.exports = function add(a, b) {
  return a + b;
};
```

`require()` 能加载本地 JavaScript、第三方包、`node:fs` 这类内置模块、JSON，以及编译好的 `.node` 原生扩展。它在运行时同步加载，第一次读取、编译比较大的模块时会卡住当前路径。

`exports` 一开始只是 `module.exports` 的一个快捷引用。下面这种写法会让两者断开，调用方拿不到函数：

```js
exports = function add(a, b) {
  return a + b;
};
```

要替换整个导出值，必须赋给 `module.exports`。

## ESM 的绑定导出

`type: module` 的项目里，`.js` 用的是 ESM；也可以用 `.mjs` 明确指定。

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

静态 `import` 写在模块顶层，Node.js 能在执行前把模块图建好。要按条件加载就用动态导入：

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

两套语法不是改一行代码就能混着用的。常见的失败：项目声明了 `type: module` 却调 `require()`，ESM 的相对导入漏写扩展名，把 CommonJS 的默认导出误当成 ESM 的命名导出。

## CommonJS 怎么加载

CommonJS 加载器的核心链路：

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

包装器大致可以理解成：

```js
(function (exports, require, module, __filename, __dirname) {
  // 当前模块代码
});
```

这能解释三个现象：

- 文件顶层的变量不会自动污染其他模块；
- `__filename` 这些名字来自加载器的上下文；
- 同一个模块多次 `require()` 一般复用缓存，所以模块顶层的副作用一般也只执行一次。

JSON 模块会读出文本再解析，`.node` 扩展走原生动态库的加载流程。具体源码会随 Node.js 版本调整，但"解析、加载、执行、缓存"这条边界不会因为语法糖就没了。

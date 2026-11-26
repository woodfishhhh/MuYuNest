---
title: "JavaScript 事件循环、Promise 与 async/await"
slug: "js-event-loop-and-async"
aliases:
  - "javascript-async-core"
date: 2026-04-22 21:30:00
categories:
  - "前端开发"
tags:
  - "JavaScript"
  - "事件循环"
  - "Promise"
  - "async/await"
  - "异步编程"
---

`setTimeout(fn, 0)` 写的明明是 0 毫秒延迟，执行时却总是输给 `Promise.then`；接口已经返回了 `404` 或 `500`，`fetch` 却顺利走进了 `.then` 没进 `catch`；在 `async` 函数内部写了 `try/catch` 吞掉异常，结果外层调用者以为请求成功了。这些异步 bug 都源于事件循环队列优先级、Promise 状态机和 `async/await` 错误传播机制。

（关于与异步常一起考察的原型链与继承机制，请参阅 [JavaScript 原型链、继承与常用手写模式](/posts/js-prototypes-oop-and-patterns)。）

## 浏览器事件循环：微任务与宏任务

JavaScript 主线程是单线程的，同一时刻只能执行调用栈顶部的同步代码。网络请求、定时器、DOM 事件交由浏览器宿主的线程或模块处理，回调就绪后按类型进入**微任务队列（Microtask Queue）**或**宏任务队列（Macrotask Queue）**：

| 任务类别 | 典型来源 | 调度时机 |
| --- | --- | --- |
| 同步任务 | 主脚本顶层代码、`new Promise(executor)` 中的 `executor` 本体、`async` 函数内首个 `await` 之前的语句 | 立即入调用栈顺序执行 |
| 微任务 | `Promise.then` / `catch` / `finally`、`queueMicrotask`、`MutationObserver` | 当前宏任务清空调用栈后**立即全部排空** |
| 宏任务 | `setTimeout` / `setInterval`、DOM 事件回调、网络 I/O 回调、`MessageChannel` | 每轮微任务队列彻底清空且浏览器决定是否渲染后，从队头取下一个执行 |

**`setTimeout(fn, 0)` 只保证回调在下一轮宏任务里尽早进入调度，绝不代表 0 毫秒后准时触发。**

事件循环每跑完一个宏任务，都要把微任务队列（包含微任务执行期间新追加进来的微任务）彻底排空，才会进入页面渲染或下一个宏任务。下面这段代码直接暴露了这个优先级：

```javascript
console.log("1");

setTimeout(() => {
  console.log("4: timer");
}, 0);

Promise.resolve("3: promise").then((msg) => {
  console.log(msg);
  // 若在此插入 500ms 同步重计算，不仅主线程卡顿掉帧，
  // 上面的 setTimeout 也会连带推迟至少 500ms 才能执行
});

console.log("2");
// 输出顺序：1 -> 2 -> 3: promise -> 4: timer
```

线上遇到动画掉帧或定时器漂移时，在 Performance 面板查完长宏任务后，顺手检查一下有没有链式微任务堵死了主线程。

## Promise 状态机与核心约束

为了摆脱多层嵌套回调（回调地狱），ES6 引入了 `Promise` 把异步结果的未来状态规范化。使用 `Promise` 必须守住四条底层约束：

1. **三种状态且不可逆**：`pending`（待定）→ `fulfilled`（已兑现）或 `rejected`（已拒绝）。一旦凝固，后续再次调用 `resolve()` 或 `reject()` 会被静默忽略。
2. **`executor` 同步执行**：`new Promise((resolve, reject) => { ... })` 传入的执行器函数在构造时**立即同步运行**，异步的只是后续 `.then` 回调的微任务调度。
3. **`resolve` 传参是结算状态，与 `return` 无关**：在异步回调里写 `resolve(val)` 即完成状态迁移，`executor` 本身的 `return` 值会被忽略；真正传递链式下游值的，是 `.then()` 回调里的 `return`。
4. **`.then().catch()` 优于 `.then(success, fail)`**：`.then(success, fail)` 里的 `fail` 只能捕获上游 Promise 的拒绝，接不住 `success` 回调自己抛出的异常；把 `.catch()` 挂在链尾才能统一兜住整条链路上的错误。

下面是遵守状态不可逆、回调队列收集与构造期异常捕获的最小 `Promise` 核心骨架（完整规范还需遵守 Promises/A+ 对 thenable 对象的递归解析）：

```javascript
class MiniPromise {
  constructor(executor) {
    this.state = "pending";
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (val) => {
      if (this.state !== "pending") return;
      this.state = "fulfilled";
      this.value = val;
      this.onFulfilledCallbacks.forEach((fn) => fn());
    };

    const reject = (err) => {
      if (this.state !== "pending") return;
      this.state = "rejected";
      this.reason = err;
      this.onRejectedCallbacks.forEach((fn) => fn());
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }
}
```

### 链式调用与四个静态并发组合器

每次调用 `.then()` 都会返回一个全新的 `Promise` 实例：回调里 `return` 普通值会把下游包装为兑现态，若 `return` 另一个 `Promise`，当前链路会自动等待那个内部 `Promise` 结算后再继续向下传递。

处理多个并行异步任务时，按业务失败容忍度从四个组合器中精确选型：

| 静态方法 | 成功条件 | 失败时机与返回原因 | 典型工程场景 |
| --- | --- | --- | --- |
| `Promise.all(list)` | 全部兑现 | 任一拒绝立即整体 reject（返回首个失败原因），**其余已发请求不会自动中止** | 页面初始化同时拉取强依赖的多份配置 |
| `Promise.allSettled(list)` | 永不因单项失败 reject | 等待全部结算，返回每项 `{ status, value \| reason }` 数组 | 批量操作统计、多卡片独立容错加载 |
| `Promise.race(list)` | 最快结算的一项兑现 | 最快结算的一项（无论成功或失败）直接决定总结果 | 请求超时竞速控制（请求 vs 超时定时器） |
| `Promise.any(list)` | 任意一项兑现即返回首个成功值 | 全部失败才 reject，抛出包含所有原因数组的 `AggregateError` | 多 CDN / 多备用节点兜底探测 |

```javascript
// 用 Promise.race 配合超时兜底，防止慢请求无限挂起
function withTimeout(promise, ms = 5000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`请求超过 ${ms}ms 未响应`)), ms)
  );
  return Promise.race([promise, timeout]);
}
```

## `async/await` 本质、返回值与并发陷阱

`async/await` 是消费 Promise 的语法糖，底层依然完全受微任务队列调度：`await` 只会暂停当前 `async` 函数自身的后续语句（将 `await` 之后的代码包装成微任务），调用栈主线程会立刻返回继续执行外层同步代码。

**任何 `async` 函数的返回值都会被强制包装为 `Promise`：`return x` 等价于 `Promise.resolve(x)`，`throw err` 等价于 `Promise.reject(err)`。**

### 误把并行写成串行

`await` 相邻书写时会强制串行等待，互不依赖的多个异步任务必须先同时发起请求拿到 Promise 句柄，再交由 `Promise.all` 或 `Promise.allSettled` 统一 `await`：

```javascript
// 串行反例：若两接口各耗时 400ms，总耗时 800ms
async function loadSequential() {
  const user = await fetchUser();
  const perms = await fetchPermissions();
  return { user, perms };
}

// 并发正例：同时发出，总耗时约 400ms
async function loadParallel() {
  const [user, perms] = await Promise.all([fetchUser(), fetchPermissions()]);
  return { user, perms };
}
```

如果是在循环里按顺序依赖执行请求，使用 `for...of` 配合 `await`；切勿在 `arr.forEach(async item => { await ... })` 里期待串行等待，因为 `forEach` 不会等待异步回调返回的 Promise。

### 传统回调 API 的 Promise 化与 Top-Level `await`

遇到浏览器旧式回调 API（如 `navigator.geolocation.getCurrentPosition`），将其包裹进 `new Promise` 即可接入 `async/await`：

```javascript
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}
```

在 ES2022+ 原生 ES Module（`<script type="module">` 或 `"type": "module"`）中支持顶层 `await`，无需包一层 IIFE；但要注意顶层 `await` 会阻塞导入该模块的下游模块继续执行，核心基础模块应谨慎使用。

## `try/catch` 错误传播与 `fetch` 常见坑点

### `fetch` 对 HTTP 错误状态码不会自动 reject

**`fetch()` 只有在断网、DNS 失败、跨域被拒或请求被主动中止时才会 reject；遇到 `404`、`429`、`500` 等 HTTP 错误响应，它依然会正常 resolve 且把 `response.ok` 设为 `false`。**

必须在解析响应体之前手动校验 `response.ok` 并抛出异常，否则后续 `response.json()` 很容易因为服务端返回了 HTML 错误页而报出令人困惑的 `SyntaxError`：

```javascript
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP 请求失败 [${response.status}]: ${response.statusText}`);
  }
  return response.json();
}
```

### 内部 `try/catch` 吞掉异常导致外层误判

如果底层 `async` 函数里写了 `try/catch` 打日志却忘了重新 `throw error`，函数返回的 Promise 依然会以 `undefined` 兑现（`fulfilled`），导致外层调用者的 `catch` 永远无法触发。

**底层工具函数只负责抛出带上下文的错误，或者在内部记录日志后必须 `throw error` 向上传播，由最贴近 UI 交互的上层函数决定重试、降级还是弹窗提示。**

```javascript
async function loadUserProfile(userId) {
  try {
    return await fetchJson(`/api/users/${userId}`);
  } catch (err) {
    console.error("[loadUserProfile] 失败:", err);
    throw err; // 必须继续抛出，让外层 UI 层感知失败状态
  }
}

async function initPage() {
  try {
    const profile = await loadUserProfile(101);
    renderProfile(profile);
  } catch (err) {
    showErrorBanner("用户信息加载失败，请点击重试");
  } finally {
    hideLoadingSpinner(); // 无论成功或失败均收尾关闭加载态
  }
}
```

另外注意 `try/catch` 无法捕获尚未发生的异步回调（如 `try { setTimeout(() => { throw new Error("boom"); }, 0); } catch {}` 是无效的），错误边界必须放在回调内部或通过 Promise 链向外部传递。

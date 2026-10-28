---
title: "JavaScript 异步编程核心：AJAX、Promise 与 Async/Await"
date: 2025-12-27 17:49:23
tags:
  - "异步编程"
  - "AJAX"
  - "Promise"
  - "Async/Await"
categories:
  - "前端开发"
  - "JavaScript"
---

# JavaScript 异步编程核心笔记（基于 Udemy 课程选集）

## 一、异步 JavaScript 基础（对应选集 246：Asynchronous JavaScript, AJAX and APIs）

### 1.1 异步编程概念

JavaScript 是单线程语言。异步就是：等某个操作（如网络请求、定时器）完成的时候，不阻塞后面的代码，先去执行别的任务，操作完成后再处理结果。

常见场景：

- 网络请求（如获取 API 数据）
- 定时器（`setTimeout`、`setInterval`）
- 事件监听（如点击、输入事件）

同步 vs 异步示例：

  ```javascript
  // 同步代码：按顺序执行，阻塞后续操作
  console.log("1");
  let sum = 0;
  for (let i = 0; i < 1000000000; i++) {
    sum += i;
  }
  console.log("2"); // 需等待循环完成后才执行

  // 异步代码：不阻塞，先执行后续操作，再处理异步结果
  console.log("A");
  setTimeout(() => {
    console.log("B"); // 1秒后执行，不影响后续代码
  }, 1000);
  console.log("C"); // 立即执行，输出顺序：A → C → B
  ```

### 1.2 AJAX 技术

- AJAX（Asynchronous JavaScript and XML）：异步请求数据的技术，不刷新页面就能和服务器交换数据、更新页面的一部分。
- 原理：用 `XMLHttpRequest` 对象（或后来的 `fetch` API）向服务器发请求，拿到响应后解析数据、操作 DOM。
- 数据格式：早期常用 XML，现在主流是 JSON（轻量、好解析）。

## 二、XMLHttpRequest（对应选集 248：Our First AJAX Call: XMLHttpRequest）

### 2.1 基本使用步骤

1. 创建 `XMLHttpRequest` 实例
2. 配置请求（请求方式、URL、是否异步）
3. 监听 `load` 事件（获取响应结果）
4. 发送请求
5. 错误处理（网络错误、HTTP 错误）

### 2.2 示例：使用 XMLHttpRequest 获取数据

```javascript
// 1. 创建实例
const xhr = new XMLHttpRequest();

// 2. 配置请求（GET 方式，请求 JSONPlaceholder 的用户数据）
xhr.open("GET", "https://jsonplaceholder.typicode.com/users/1", true);

// 3. 监听响应完成事件
xhr.onload = function () {
  // 检查 HTTP 状态码（200-299 表示成功）
  if (xhr.status >= 200 && xhr.status < 300) {
    // 解析 JSON 响应
    const user = JSON.parse(xhr.responseText);
    console.log("用户信息：", user);
    console.log("用户名：", user.name);
  } else {
    console.error("请求失败，状态码：", xhr.status);
  }
};

// 4. 监听网络错误
xhr.onerror = function () {
  console.error("网络错误，无法连接服务器");
};

// 5. 发送请求
xhr.send();
```

### 2.3 缺点

- 语法繁琐，步骤多
- 不支持 Promise，不好链式调用，也不好统一处理错误
- 多个异步请求时容易陷入“回调地狱”

## 三、回调地狱（对应选集 250：Welcome to Callback Hell）

### 3.1 定义

多个异步操作要按顺序执行时（比如先获取用户，再用用户 ID 获取订单，再用订单 ID 获取订单详情），回调函数会一层套一层，代码结构混乱、难读、难维护，这就是“回调地狱”。

### 3.2 示例：回调地狱

```javascript
// 模拟异步获取用户
function getUser(userId, callback) {
  setTimeout(() => {
    console.log("获取用户成功");
    callback({ id: userId, name: "张三" });
  }, 1000);
}

// 模拟根据用户 ID 获取订单
function getOrders(userId, callback) {
  setTimeout(() => {
    console.log(`获取用户 ${userId} 的订单成功`);
    callback([
      { orderId: 101, total: 200 },
      { orderId: 102, total: 350 },
    ]);
  }, 1000);
}

// 模拟根据订单 ID 获取订单详情
function getOrderDetail(orderId, callback) {
  setTimeout(() => {
    console.log(`获取订单 ${orderId} 的详情成功`);
    callback({ orderId: orderId, product: "手机", quantity: 1 });
  }, 1000);
}

// 回调地狱：多层嵌套
getUser(1, (user) => {
  getOrders(user.id, (orders) => {
    getOrderDetail(orders[0].orderId, (detail) => {
      console.log("最终订单详情：", detail);
    });
  });
});
```

### 3.3 解决方案

- 使用 Promise 链式调用
- 使用 `async/await` 语法（基于 Promise，更简洁）

## 四、Promise（对应选集 251：Promises and the Fetch API、252：Consuming Promises、253：Chaining Promises、254：Handling Rejected Promises、255：Throwing Errors Manually）

### 4.1 Promise 概念

Promise 是处理异步操作的对象，代表一个异步操作最终的完成（或失败）以及结果值。

三种状态：

1. Pending（待定）：初始状态，既没成功也没失败
2. Fulfilled（已成功）：异步操作完成，调用 `resolve` 函数
3. Rejected（已失败）：异步操作失败，调用 `reject` 函数

状态一旦改变（从 Pending 变成 Fulfilled 或 Rejected），就永久保持，不会再变。

### 4.2 Promise 基本用法

#### 4.2.1 创建 Promise

用 `new Promise((resolve, reject) => { ... })` 创建，传入一个“执行器函数”，它接收两个参数：

- `resolve`：异步操作成功时调用，把 Promise 状态改成 Fulfilled，并传出结果值
- `reject`：异步操作失败时调用，把 Promise 状态改成 Rejected，并传出错误信息

##### **简明解释**

- resolve(value)：把这个 Promise 标记为“已完成”（fulfilled），并把 value 传给后续的 then。
- reject(error)：把这个 Promise 标记为“已拒绝”（rejected），并把 error 传给后续的 catch。
- 只有第一次调用生效，之后再调 resolve/reject 会被忽略。
- 如果传给 resolve 的是一个 Promise/thenable，它会“跟随”那个 Promise 的状态（promise 解析）。

“这个算 return 吗？”

- 不算。resolve/reject 是函数调用，用来“结算”Promise，和 return 不是一回事。
- 在 executor 或 setTimeout 回调里写 return resolve() 只是从那个回调返回，没必要；resolve() 本身已经结算了 Promise。
- 有意义的 return 在 .then 回调里：return 的值会成为“下一个 Promise”的完成值。

示例：

```javascript
// 一个典型的等待函数
function wait(seconds) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(); // 等待结束，结算 Promise（then 会收到 undefined）
      // return resolve(); // 可写但冗余，仅返回自 setTimeout 回调
    }, seconds * 1000);
  });
}
wait(1)
  .then(() => "A") // 返回值 'A' → 传给下一个 then
  .then((val) => console.log(val)); // 'A'
// reject 的用法
new Promise((resolve, reject) => {
  reject(new Error("出错了"));
}).catch((err) => console.error(err.message)); // 出错了
```

要点：

- 创建 Promise 时，用 resolve/reject 改变状态；executor 的 return 值会被忽略。
- .then 回调里 return 的值用来“链式传递”。

#### 4.2.2 示例：创建 Promise 处理异步请求

```javascript
// 封装一个基于 Promise 的请求函数
function fetchData(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        // 成功：解析 JSON 并调用 resolve
        resolve(JSON.parse(xhr.responseText));
      } else {
        // 失败：调用 reject，传递状态码
        reject(new Error(`请求失败，状态码：${xhr.status}`));
      }
    };
    xhr.onerror = function () {
      // 网络错误：调用 reject
      reject(new Error("网络错误，无法连接服务器"));
    };
    xhr.send();
  });
}
```

### 4.3 消费 Promise（处理结果）

用 `then()`、`catch()`、`finally()` 处理 Promise 的结果：

- `then(onFulfilled, onRejected)`：处理成功结果（`onFulfilled`）或失败结果（`onRejected`），返回一个新的 Promise，所以能链式调用
- `catch(onRejected)`：只处理失败结果，等价于 `then(null, onRejected)`
- `finally(onFinally)`：不管成功还是失败都会执行，用来做清理（如关闭加载动画）

#### 4.3.1 示例：消费 Promise

```javascript
// 调用 fetchData 获取用户数据
fetchData("https://jsonplaceholder.typicode.com/users/1")
  .then((user) => {
    console.log("用户信息：", user);
    // 返回新的 Promise，继续获取订单（链式调用）
    return fetchData(
      `https://jsonplaceholder.typicode.com/users/${user.id}/todos`,
    );
  })
  .then((todos) => {
    console.log("用户的待办事项数量：", todos.length);
    // 手动抛出错误（测试错误处理）
    if (todos.length > 10) {
      throw new Error("待办事项数量超过 10 个");
    }
    return todos;
  })
  .catch((error) => {
    // 统一处理所有错误（包括网络错误、HTTP 错误、手动抛出的错误）
    console.error("出错了：", error.message);
  })
  .finally(() => {
    // 无论成功或失败，都执行（如关闭加载动画）
    console.log("请求流程结束，清理资源");
  });
```

### 4.4 Promise 链式调用

`then()` 返回一个新的 Promise，所以可以连续调用 `then()`，把多个异步操作按顺序串起来，避免回调地狱。

示例：链式调用解决回调地狱

```javascript
// 用 Promise 重构之前的“用户→订单→订单详情”流程
function getUser(userId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("获取用户成功");
      resolve({ id: userId, name: "张三" });
    }, 1000);
  });
}

function getOrders(userId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`获取用户 ${userId} 的订单成功`);
      resolve([
        { orderId: 101, total: 200 },
        { orderId: 102, total: 350 },
      ]);
    }, 1000);
  });
}

function getOrderDetail(orderId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`获取订单 ${orderId} 的详情成功`);
      resolve({ orderId: orderId, product: "手机", quantity: 1 });
    }, 1000);
  });
}

// 链式调用：代码线性执行，无嵌套
getUser(1)
  .then((user) => getOrders(user.id))
  .then((orders) => getOrderDetail(orders[0].orderId))
  .then((detail) => console.log("最终订单详情：", detail))
  .catch((error) => console.error("出错了：", error));
```

### 4.5 手动抛出错误（`throw`）

在 `then()` 里可以用 `throw new Error("错误信息")` 手动抛错，后面的 `catch()` 会捕获它。示例见 4.3.1 中的“手动抛出错误”部分。

### 4.6 Promise 静态方法

#### 4.6.1 `Promise.resolve(value)`

创建一个立即成功的 Promise，直接返回 `value`。示例：

  ```javascript
  Promise.resolve("成功的数据").then((data) => console.log(data)); // 输出：成功的数据
  ```

#### 4.6.2 `Promise.reject(error)`

创建一个立即失败的 Promise，直接返回 `error`。示例：

  ```javascript
  Promise.reject(new Error("手动触发失败")).catch((error) =>
    console.error(error.message),
  ); // 输出：手动触发失败
  ```

#### 4.6.3 `Promise.all(iterable)`

接收一个 Promise 数组，全部成功后返回一个包含所有结果的数组；只要有一个失败，立即返回这个失败原因。示例：

  ```javascript
  const promise1 = fetchData("https://jsonplaceholder.typicode.com/users/1");
  const promise2 = fetchData("https://jsonplaceholder.typicode.com/users/2");
  const promise3 = fetchData("https://jsonplaceholder.typicode.com/users/3");

  Promise.all([promise1, promise2, promise3])
    .then((users) => {
      console.log("3 个用户信息：", users);
      console.log("第一个用户：", users[0].name);
    })
    .catch((error) => console.error("有请求失败：", error.message));
  ```

#### 4.6.4 `Promise.race(iterable)`

接收一个 Promise 数组，返回第一个完成（成功或失败）的 Promise 的结果。示例：

  ```javascript
  // 模拟一个 2 秒后成功的请求
  const fastPromise = new Promise((resolve) =>
    setTimeout(() => resolve("快请求成功"), 1000),
  );
  // 模拟一个 3 秒后成功的请求
  const slowPromise = new Promise((resolve) =>
    setTimeout(() => resolve("慢请求成功"), 3000),
  );

  Promise.race([fastPromise, slowPromise]).then((result) =>
    console.log(result),
  ); // 输出：快请求成功（1 秒后）
  ```

#### 4.6.5 `Promise.allSettled(iterable)`

接收一个 Promise 数组，等所有 Promise 都完成（不管成功还是失败）后，返回每个 Promise 的结果组成的数组。每个结果对象有两个属性：

- `status`：字符串，值为 `fulfilled`（成功）或 `rejected`（失败）
- `value`：只有 `status` 为 `fulfilled` 时才有，是 Promise 成功的结果
- `reason`：只有 `status` 为 `rejected` 时才有，是 Promise 失败的原因

某个 Promise 失败**不会中断**整体，所有任务结束后统一返回结果。适合要拿到所有请求完整状态的场景，比如批量操作结果统计、多接口并行调用且要处理部分失败。

示例：

  ```javascript
  // 模拟成功的请求
  const successPromise = fetchData(
    "https://jsonplaceholder.typicode.com/users/1",
  );
  // 模拟失败的请求（无效 URL）
  const failPromise = fetchData(
    "https://jsonplaceholder.typicode.com/invalid-url",
  );
  // 模拟延迟成功的请求
  const delayPromise = new Promise((resolve) => {
    setTimeout(() => resolve("延迟 2 秒成功"), 2000);
  });

  Promise.allSettled([successPromise, failPromise, delayPromise]).then(
    (results) => {
      console.log("所有请求完成结果：", results);
      // 遍历结果，分别处理成功和失败的情况
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`请求 ${index + 1} 成功：`, result.value);
        } else {
          console.log(`请求 ${index + 1} 失败：`, result.reason.message);
        }
      });
    },
  );
  ```

输出结果示例（2 秒后，所有请求完成）：

  ```
  所有请求完成结果： [
    { status: 'fulfilled', value: { id: 1, name: 'Leanne Graham', ... } },
    { status: 'rejected', reason: Error: 请求失败（404）... },
    { status: 'fulfilled', value: '延迟 2 秒成功' }
  ]
  请求 1 成功： { id: 1, name: 'Leanne Graham', ... }
  请求 2 失败： 请求失败（404）
  请求 3 成功： 延迟 2 秒成功
  ```

和 `Promise.all` 的区别：

  | 特性 | `Promise.all` | `Promise.allSettled` |
  | ------------------- | ---------------------------- | ----------------------------- |
  | 失败处理 | 任一失败则立即 reject | 等待所有完成，记录失败原因 |
  | 返回结果 | 所有成功的结果数组 | 每个 Promise 的状态+结果/原因 |
  | 适用场景 | 需所有请求成功才能继续的场景 | 需获取所有请求完整状态的场景 |

#### 4.6.6 `Promise.any(iterable)`

接收一个 Promise 数组，返回第一个成功的 Promise 的结果；如果全部失败，返回一个包含所有失败原因的 `AggregateError`（聚合错误）。

和 `Promise.race` 很像，都是看“第一个”，区别在于：`Promise.race` 返回第一个完成（成功或失败）的结果，`Promise.any` 只认成功，会跳过所有失败的 Promise，直到找到第一个成功的。只有全部失败时才会触发 `catch`。

示例 1：存在成功的 Promise

  ```javascript
  // 模拟失败的请求
  const failPromise1 = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("请求 1 失败")), 500),
  );
  // 模拟第一个成功的请求（1 秒后）
  const successPromise = new Promise((resolve) =>
    setTimeout(() => resolve("请求 2 成功（第一个成功）"), 1000),
  );
  // 模拟延迟更久的成功请求
  const lateSuccessPromise = new Promise((resolve) =>
    setTimeout(() => resolve("请求 3 成功（已被忽略）"), 2000),
  );

  Promise.any([failPromise1, successPromise, lateSuccessPromise])
    .then((result) => console.log("结果：", result)) // 1 秒后输出：请求 2 成功（第一个成功）
    .catch((error) => console.error("所有请求失败：", error));
  ```

示例 2：所有 Promise 都失败

  ```javascript
  // 三个均为失败的 Promise
  const failPromise1 = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("请求 1 超时")), 500),
  );
  const failPromise2 = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("请求 2 404")), 1000),
  );
  const failPromise3 = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("请求 3 服务器错误")), 1500),
  );

  Promise.any([failPromise1, failPromise2, failPromise3])
    .then((result) => console.log("结果：", result))
    .catch((error) => {
      console.error("所有请求均失败：", error); // 输出 AggregateError
      console.error(
        "所有失败原因：",
        error.errors.map((err) => err.message),
      );
      // 输出：["请求 1 超时", "请求 2 404", "请求 3 服务器错误"]
    });
  ```

`AggregateError` 是专门用来聚合多个错误的内置错误类型，`errors` 属性是所有失败原因的数组，可以用 `error.errors` 遍历所有失败信息。

和 `Promise.race`/`Promise.all` 的对比：

  | 特性 | `Promise.any` | `Promise.race` | `Promise.all` |
  | ------------------- | ---------------------------- | ----------------------------- | ---------------------------- |
  | 关注结果类型 | 仅关注“成功”的结果 | 关注“第一个完成”（成功/失败） | 关注“所有成功”的结果 |
  | 失败处理 | 所有失败才 reject（AggregateError） | 任一完成（含失败）则返回 | 任一失败则立即 reject |
  | 返回结果 | 第一个成功的结果 | 第一个完成的结果（成功/失败） | 所有成功的结果数组 |
  | 适用场景 | 多个备选接口，只要一个可用即可 | 竞速场景（如超时控制） | 需所有依赖都成功的场景 |

典型场景：

- 多 CDN 资源加载：从多个 CDN 加载同一资源，有一个成功就用，提高可用性
- 备选接口调用：调用多个功能相同的接口，取第一个成功的响应，减少等待时间
- 容错型并行请求：允许部分请求失败，有一个成功就继续执行后续逻辑

## 五、Fetch API（对应选集 251：Promises and the Fetch API、256：Coding Challenge #1）

### 5.1 Fetch 概念

- Fetch API 是现代浏览器提供的异步请求接口，用来替代 `XMLHttpRequest`。基于 Promise，语法更简洁，支持链式调用。
- 基本语法：`fetch(url, [options])`，返回一个 Promise 对象（resolve 时返回 `Response` 对象，reject 只针对网络错误）。

### 5.2 核心特点

- 默认请求方式是 `GET`
- 只有网络错误（如连不上服务器）时 Promise 才会 reject；**HTTP 错误（如 404、500）不会 reject**，要自己判断 `Response.ok` 属性
- 响应体要用 `Response.json()`、`Response.text()` 等方法解析

### 5.3 示例：使用 Fetch 获取数据（结合反向地理编码 API）

```javascript
// 实现“根据 GPS 坐标获取国家”的函数（对应 Coding Challenge #1）
function whereAmI(lat, lng) {
  // 1. 调用 fetch 发送反向地理编码请求（Geocode.xyz API）
  fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`)
    .then((response) => {
      // 2. 手动处理 HTTP 错误（如 403 限流、404 地址不存在）
      if (!response.ok) {
        throw new Error(`地理编码请求失败，状态码：${response.status}`);
      }
      // 3. 解析 JSON 响应体
      return response.json();
    })
    .then((data) => {
      // 4. 输出结果（如“你在 柏林, 德国”）
      console.log(`你在 ${data.city}, ${data.country}`);
      // 5. 链式调用：根据国家名称获取更多信息（如国家 API）
      return fetch(`https://restcountries.com/v3.1/name/${data.country}`);
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`国家信息请求失败，状态码：${response.status}`);
      }
      return response.json();
    })
    .then((countryData) => {
      console.log("国家信息：", countryData[0].name.common);
      console.log("首都：", countryData[0].capital[0]);
    })
    .catch((error) => {
      // 6. 统一处理所有错误（网络错误、HTTP 错误、手动抛出的错误）
      console.error("❌ 出错了：", error.message);
    });
}

// 测试函数（三个坐标：德国柏林、南非开普敦、印度孟买）
whereAmI(52.508, 13.381); // 输出：你在 Berlin, Germany → 国家信息：Germany，首都：Berlin
// whereAmI(-33.933, 18.474); // 输出：你在 Cape Town, South Africa → 国家信息：South Africa，首都：Pretoria
// whereAmI(19.037, 72.873); // 输出：你在 Mumbai, India → 国家信息：India，首都：New Delhi
```

### 5.4 Fetch 与 XMLHttpRequest 对比

| 特性     | Fetch API                           | XMLHttpRequest                                           |
| -------- | ----------------------------------- | -------------------------------------------------------- |
| 语法     | 简洁，基于 Promise                  | 繁琐，步骤多                                             |
| 链式调用 | 支持（`then()` 链式）               | 不支持（需嵌套回调）                                     |
| 错误处理 | 仅捕获网络错误，HTTP 错误需手动处理 | 需分别监听 `onload`（HTTP 错误）和 `onerror`（网络错误） |
| 响应解析 | 需调用 `json()`/`text()` 等方法     | 需手动 `JSON.parse()`                                    |
| 兼容性   | 现代浏览器支持（IE 不支持）         | 所有浏览器支持                                           |

## 六、Async/Await（对应选集 262：Consuming Promises with Async_Await、263：Error Handling With try...catch）

### 6.1 Async/Await 概念

`async/await` 是 ES2017 引入的语法糖，基于 Promise，可以用“同步代码”的写法写异步代码，更好读也更好维护。

- `async`：修饰函数，让函数返回一个 Promise（函数里没有显式返回 Promise，也会自动包装成成功的 Promise）
- `await`：只能在 `async` 函数里用，等待一个 Promise 完成（暂停函数执行，直到 Promise 状态改变）

### 6.2 基本用法

#### 6.2.1 示例：用 Async/Await 重构 Fetch 请求

```javascript
// 1. 定义 async 函数
async function getCountryByCoords(lat, lng) {
  try {
    // 2. await 等待 fetch 结果（暂停函数，直到 Promise 完成）
    const geoResponse = await fetch(
      `https://geocode.xyz/${lat},${lng}?geoit=json`,
    );

    // 3. 手动处理 HTTP 错误
    if (!geoResponse.ok) {
      throw new Error(`地理编码失败：${geoResponse.status}`);
    }

    // 4. await 等待响应解析
    const geoData = await geoResponse.json();
    console.log(`你在 ${geoData.city}, ${geoData.country}`);

    // 5. 链式请求国家信息
    const countryResponse = await fetch(
      `https://restcountries.com/v3.1/name/${geoData.country}`,
    );
    if (!countryResponse.ok) {
      throw new Error(`获取国家信息失败：${countryResponse.status}`);
    }
    const countryData = await countryResponse.json();
    console.log("国家首都：", countryData[0].capital[0]);

    // 6. 返回结果（async 函数自动包装为 Promise）
    return countryData[0];
  } catch (error) {
    // 7. 统一捕获所有错误（包括网络错误、HTTP 错误、手动抛出的错误）
    console.error("❌ 操作失败：", error.message);
    // 重新抛出错误，允许外部处理
    throw error;
  }
}

// 8. 调用 async 函数（返回 Promise，可通过 then() 或 await 处理结果）
getCountryByCoords(52.508, 13.381)
  .then((country) => console.log("最终返回的国家：", country.name.common))
  .catch((error) => console.error("外部捕获错误：", error.message));
```

### 6.3 错误处理（`try...catch`）

- `await` 的 Promise 失败（reject）时会抛出错误，用 `try...catch` 捕获，相当于 Promise 的 `catch()` 方法。
- 一个 `try` 块里可以有多个 `await`，所有 `await` 的错误都由同一个 `catch` 块捕获。

### 6.4 Async/Await 与 Promise 对比

| 特性     | Async/Await                      | Promise                      |
| -------- | -------------------------------- | ---------------------------- |
| 代码风格 | 同步式写法，线性结构             | 链式调用，需嵌套 `then()`    |
| 错误处理 | `try...catch`（直观）            | `catch()` 链式（需注意位置） |
| 调试体验 | 支持断点逐行调试                 | 链式调用调试难度较高         |
| 依赖     | 基于 Promise（需先理解 Promise） | 独立语法                     |

## 七、实战案例：多 API 协作（对应选集 256：Coding Challenge #1）

### 7.1 需求

写一个函数，输入 GPS 坐标，要做到：

1. 通过 Geocode.xyz API 反向地理编码，获取坐标对应的城市和国家
2. 通过 Rest Countries API 获取该国家的详细信息（如首都、人口）
3. 处理 API 限流（Geocode.xyz 每秒仅允许 3 个请求）和错误

### 7.2 完整代码（Async/Await 版本）

```javascript
// 工具函数：延迟函数（解决 API 限流问题）
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 主函数：根据坐标获取国家信息
async function whereAmI(lat, lng) {
  try {
    // 1. 延迟 500ms，避免触发 API 限流（每秒 3 个请求）
    await delay(500);

    // 2. 第一步：反向地理编码（获取城市和国家）
    const geoRes = await fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`);
    if (!geoRes.ok) {
      // 处理 API 限流错误（403）
      if (geoRes.status === 403) {
        throw new Error("API 限流，请 1 秒后再试");
      }
      throw new Error(`反向地理编码失败：${geoRes.statusText}`);
    }
    const geoData = await geoRes.json();
    if (!geoData.country) {
      throw new Error("无法获取该坐标对应的国家");
    }
    console.log(`✅ 定位成功：${geoData.city}, ${geoData.country}`);

    // 3. 第二步：获取国家详细信息
    const countryRes = await fetch(
      `https://restcountries.com/v3.1/name/${geoData.country}`,
    );
    if (!countryRes.ok) {
      throw new Error(`获取国家信息失败：${countryRes.statusText}`);
    }
    const [countryData] = await countryRes.json(); // 解构数组（返回结果是数组）

    // 4. 输出最终结果
    console.log(`\n📌 国家详情：`);
    console.log(`名称：${countryData.name.common}`);
    console.log(`首都：${countryData.capital[0]}`);
    console.log(`人口：${(countryData.population / 1000000).toFixed(2)} 百万`);
    console.log(`货币：${Object.keys(countryData.currencies)[0]}`);

    // 5. 返回结果供外部使用
    return {
      city: geoData.city,
      country: countryData.name.common,
      capital: countryData.capital[0],
      population: countryData.population,
    };
  } catch (error) {
    console.error(`\n❌ 操作失败：${error.message}`);
    throw error; // 重新抛出，允许外部处理
  }
}

// 测试：三个坐标依次调用（延迟避免限流）
async function testWhereAmI() {
  const coordsList = [
    [52.508, 13.381], // 德国柏林
    [-33.933, 18.474], // 南非开普敦
    [19.037, 72.873], // 印度孟买
  ];

  for (const [lat, lng] of coordsList) {
    await whereAmI(lat, lng); // 等待前一个请求完成，避免限流
    console.log("------------------------");
  }
}

// 执行测试
testWhereAmI();
```

### 7.3 关键知识点应用

1. Promise 延迟：用 `delay()` 函数解决 API 限流问题
2. Async/Await 语法：多步异步操作按顺序写下来，可读性高
3. 错误处理：`try...catch` 捕获所有错误，包括网络错误、HTTP 错误、业务错误（如无国家信息）
4. API 协作：串联两个 API 请求，前一个请求的结果作为后一个请求的参数

## 八、总结

- 演进：`XMLHttpRequest` → `Promise` → `fetch` → `async/await`，目的都是简化异步代码、避免回调地狱、统一错误处理。
- Promise：三种状态、`then()`/`catch()` 链式调用、静态方法（`all`/`race`），是现代异步编程的基础。
- Fetch：基于 Promise，HTTP 错误要手动处理，用 `json()` 解析响应。
- Async/Await：同步式写法、`try...catch` 处理错误、调试友好，是现在主流的异步写法。
- 实战：
  - 多 API 协作时，用 `await` 保证顺序执行
  - API 限流/超时，用 `delay()` 或 `Promise.race()`
  - 统一处理错误，别漏掉错误场景

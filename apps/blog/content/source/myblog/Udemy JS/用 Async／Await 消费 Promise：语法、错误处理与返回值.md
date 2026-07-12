---
title: "用 Async/Await 消费 Promise：语法、错误处理与返回值"
date: 2025-12-28 12:44:03
tags:
  - "Async/Await"
  - "Promise"
  - "错误处理"
  - "返回值"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、Async/Await 基础概念与特点

### 1.1 Async 函数的定义与创建

- **定义**：Async 函数是一种特殊的 JavaScript 函数，通过在 `function` 关键字前添加 `async` 关键字声明，专门用于配合 Await 关键字消费 Promise，使异步代码逻辑更接近同步代码的直观形式。
- **创建语法**：

  ```javascript
  // 函数声明式
  async function fetchData() {
    // 函数体（可包含 await 语句）
  }

  // 箭头函数式
  const fetchData = async () => {
    // 函数体（可包含 await 语句）
  };
  ```

- **特点**：
  1. 自动返回 Promise：无论 Async 函数内部返回什么值（非 Promise 类型值会被自动包装成已resolved的 Promise），函数最终的返回结果一定是 Promise 对象。例如：
     ```javascript
     async function getNum() {
       return 10; // 等价于 return Promise.resolve(10)
     }
     getNum().then((res) => console.log(res)); // 输出：10
     ```
  2. 后台异步执行：Async 函数调用后，会在 JavaScript 事件循环的后台队列中执行，不会阻塞主线程（调用栈）的正常执行，避免页面卡顿或功能冻结。

### 1.2 Await 关键字的作用与使用规则

- **定义**：`await` 是仅能在 Async 函数内部使用的关键字，用于“等待”一个 Promise 对象的状态变更（从 pending 变为 resolved 或 rejected），并获取 Promise resolved 后的结果。
- **使用规则**：
  1. 仅能在 Async 函数内使用：若在非 Async 函数中使用 `await`，会直接触发语法错误。
     ```javascript
     // 错误示例：非 Async 函数中使用 await
     function wrongFunc() {
       await fetch('https://api.example.com'); // Uncaught SyntaxError: await is only valid in async functions
     }
     ```
  2. 右侧需是 Promise 对象：若 `await` 右侧不是 Promise，会将其视为已 resolved 的 Promise，直接返回该值。例如：
     ```javascript
     async function getValue() {
       const result = await "hello"; // 等价于 await Promise.resolve('hello')
       console.log(result); // 输出：hello
     }
     getValue();
     ```
- **执行逻辑**：`await` 会暂停当前 Async 函数内部的代码执行（注意：仅暂停函数内部，不阻塞主线程），直至 Promise 状态变更：
  - 若 Promise resolved：`await` 表达式的结果为 Promise 的 resolved 值，函数继续执行后续代码；
  - 若 Promise rejected：需配合 `try/catch` 捕获错误（后续“错误处理”章节详解），否则会触发未捕获的 Promise 错误。

## 二、Async/Await 消费 Promise 实战案例

### 2.1 基础案例：使用 Async/Await 调用 API 获取数据

#### 场景需求

通过 `fetch` 调用“国家信息 API”，获取指定国家（如葡萄牙）的信息，并打印响应结果，验证 Async 函数的异步特性。

#### 实现代码

```javascript
// 1. 定义 Async 函数，用于获取国家数据
async function getCountryData(country) {
  // 2. 使用 await 等待 fetch 返回的 Promise（fetch 本身返回 Promise）
  const res = await fetch(`https://restcountries.com/v3.1/name/${country}`);

  // 3. 打印响应（验证：await 后确实获取到了 resolved 的结果）
  console.log("API 响应结果：", res);

  // 4. （拓展）解析响应为 JSON（response.json() 也返回 Promise，需再次 await）
  const data = await res.json();
  console.log("解析后的国家数据：", data);
  return data; // 函数返回 Promise，resolved 值为 data
}

// 5. 验证 Async 函数的异步性：调用前打印日志
console.log("开始调用获取国家数据的函数");

// 6. 调用 Async 函数（返回 Promise，需用 then 获取结果）
getCountryData("portugal");

// 7. 验证 Async 函数的异步性：调用后打印日志
console.log("函数调用已发起，等待结果...");
```

#### 执行结果与分析

```
开始调用获取国家数据的函数
函数调用已发起，等待结果...
API 响应结果：Response {type: 'cors', url: 'https://restcountries.com/...', ...}
解析后的国家数据：[{name: {common: 'Portugal'}, ...}]
```

- 结果分析：先打印“开始调用”和“调用已发起”，再打印 API 响应和解析后的数据，证明 Async 函数在后台异步执行，未阻塞主线程的同步代码（调用前后的 `console.log`）。

### 2.2 进阶案例：Async/Await 处理 Promise 链（地理定位 + 反向地理编码）

#### 场景需求

1. 通过浏览器 `navigator.geolocation.getCurrentPosition` 获取用户当前地理位置（需先“Promise 化”该回调式 API）；
2. 用获取到的经纬度调用“反向地理编码 API”，获取用户所在国家；
3. 用获取到的国家名称，调用“国家信息 API”，最终打印完整的国家数据。

#### 前置步骤：Promise 化回调式 API（地理定位）

`navigator.geolocation.getCurrentPosition` 是传统回调式 API（非 Promise 风格），需先封装为 Promise，才能用 Await 消费：

```javascript
// 封装地理定位 API 为 Promise
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position), // 成功：resolve 位置信息
      (error) => reject(error), // 失败：reject 错误信息
    );
  });
}
```

#### 完整实现代码

```javascript
// 1. Promise 化地理定位 API（同上）
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

// 2. 定义 Async 函数，串联三个异步操作
async function getLocationAndCountry() {
  try {
    // 步骤1：await 地理定位 Promise，获取经纬度
    const position = await getCurrentLocation();
    const { latitude: lat, longitude: lng } = position.coords;
    console.log("当前经纬度：", lat, lng);

    // 步骤2：await 反向地理编码 API，获取所在国家
    const geoRes = await fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`);
    const geoData = await geoRes.json();
    const country = geoData.country;
    console.log("当前所在国家：", country);

    // 步骤3：await 国家信息 API，获取完整数据
    const countryRes = await fetch(
      `https://restcountries.com/v3.1/name/${country}`,
    );
    const countryData = await countryRes.json();
    console.log("完整国家数据：", countryData);

    return countryData;
  } catch (error) {
    // 捕获所有步骤中可能出现的错误（如用户拒绝定位、API 请求失败）
    console.error("操作失败：", error);
  }
}

// 3. 调用 Async 函数
getLocationAndCountry();
```

#### 代码优势分析

- 对比传统 `then` 链：无需嵌套 `then` 回调（避免“回调地狱”），代码按“步骤1→步骤2→步骤3”的线性逻辑编写，可读性大幅提升；
- 错误统一处理：通过 `try/catch` 捕获整个异步流程中的所有错误（包括地理定位失败、API 请求超时等），无需在每个 `then` 后加 `catch`。

## 三、Async/Await 关键注意事项与本质

### 3.1 Async/Await 的本质：Promise 的语法糖

- **核心结论**：Async/Await 并非新的异步机制，而是“消费 Promise 的语法糖”——底层仍依赖 Promise 和 JavaScript 事件循环，只是简化了 Promise 的调用写法。
- **等价对比：Async/Await vs then 链**
  以“获取国家数据并解析 JSON”为例，两种写法等价：
  1. Async/Await 写法：
     ```javascript
     async function fetchCountry() {
       const res = await fetch("https://restcountries.com/v3.1/name/portugal");
       const data = await res.json();
       console.log(data);
     }
     ```
  2. 传统 then 链写法：
     ```javascript
     function fetchCountry() {
       fetch("https://restcountries.com/v3.1/name/portugal")
         .then((res) => res.json())
         .then((data) => console.log(data));
     }
     ```
- **注意**：使用 Async/Await 的前提是理解 Promise 的底层逻辑（如 pending/resolved/rejected 状态、事件循环），否则可能无法排查隐藏的异步错误。

### 3.2 未处理错误的风险与临时解决方案

#### 风险场景

若 Async 函数中 `await` 的 Promise 被 rejected（如 API 请求超限、网络中断），且未做错误处理，会触发“未捕获的 Promise 错误”，导致代码崩溃。

例如：反向地理编码 API 限制“每秒仅 3 次请求”，若快速刷新页面多次调用，会返回 429 错误：

```javascript
async function getGeoData(lat, lng) {
  // 未处理错误：若 API 请求超限，fetch 返回的 Promise 会 rejected
  const res = await fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`);
  const data = await res.json();
  return data;
}
getGeoData(38.7167, -9.1333); // 葡萄牙里斯本经纬度，快速调用会报错
```

#### 临时解决方案：try/catch 捕获错误

在 Async 函数内部用 `try/catch` 包裹所有 `await` 语句，统一捕获错误：

```javascript
async function getGeoData(lat, lng) {
  try {
    const res = await fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`);
    // 额外处理 HTTP 错误（如 429、404，fetch 仅在网络错误时 reject，HTTP 错误需手动判断）
    if (!res.ok) {
      throw new Error(`HTTP 错误：${res.status}`); // 手动抛出错误，进入 catch
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("反向地理编码失败：", error.message);
    // 可返回默认值或重新抛出错误（让调用者处理）
    // return { country: 'Unknown' };
    // throw error;
  }
}
```

## 四、总结与核心考点

### 4.1 知识点总结

1. **Async 函数**：用 `async` 声明，自动返回 Promise，后台异步执行，不阻塞主线程；
2. **Await 关键字**：仅在 Async 函数内使用，等待 Promise 状态变更，获取 resolved 结果，暂停函数内部执行但不阻塞主线程；
3. **实战优势**：简化 Promise 链（替代 `then` 嵌套），代码逻辑线性化，错误处理统一（`try/catch`）；
4. **本质与前提**：是 Promise 的语法糖，使用前需理解 Promise 和事件循环，否则易踩坑。

### 4.2 常见考点与例题

#### 例题1：判断代码执行顺序

请写出以下代码的输出顺序：

```javascript
console.log("1");

async function asyncFunc() {
  console.log("2");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("3");
}

asyncFunc();
console.log("4");
```

#### 答案与解析

输出顺序：`1 → 2 → 4 → 3`

- 解析：
  1. `console.log('1')` 是同步代码，先执行；
  2. 调用 `asyncFunc()`，同步执行函数内的 `console.log('2')`；
  3. `await` 等待 Promise（定时器 1 秒后 resolve），暂停 `asyncFunc` 内部执行，将后续代码（`console.log('3')`）放入微任务队列；
  4. 主线程继续执行同步代码 `console.log('4')`；
  5. 1 秒后定时器触发，Promise resolve，`console.log('3')` 从微任务队列进入主线程执行。

#### 例题2：Async 函数返回值处理

以下代码中，`result` 的值是什么？

```javascript
async function getResult() {
  return "success";
}

getResult().then((res) => {
  const result = res;
  // 此处 result 的值是？
});
```

#### 答案与解析

`result` 的值是 `'success'`

- 解析：Async 函数内部返回非 Promise 值时，会自动包装成 `Promise.resolve('success')`，因此 `then` 中获取的 `res` 就是 `'success'`。

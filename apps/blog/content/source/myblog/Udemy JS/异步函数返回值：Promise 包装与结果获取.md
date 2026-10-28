---
title: "异步函数返回值：Promise 包装与结果获取"
date: 2025-12-28 13:01:30
tags:
  - "异步函数"
  - "返回值"
  - "Promise"
  - "then"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、知识点总览

这一集讲 JavaScript 异步函数（Async Functions）返回值的特点、怎么拿到返回值、错误怎么处理，以及代码怎么优化。要回答的问题是："异步函数怎么把数据返回出来""返回值为什么是 Promise""怎么好好处理异步返回的结果"。

## 二、异步函数返回值的本质（特点）

### 2.1 关键结论：异步函数永远返回 Promise

- 特点：不管异步函数（`async function` 声明）里面返回的是什么（基本类型、对象、函数等），最后都会被 JavaScript 包成一个已兑现（fulfilled）的 Promise；函数里面抛了错的话，返回的就是一个已拒绝（rejected）的 Promise。
- 原理：
  异步函数是"非阻塞"执行的——调用异步函数时，JS 引擎马上返回一个还没完成的 Promise，然后在后台接着执行函数里的代码；函数执行完（或者碰到 `return`/`throw`），再更新 Promise 的状态（兑现/拒绝），把结果传出去。

### 2.2 对比：异步函数 vs 普通函数返回值

用 `console.log` 看执行顺序，就能直观看出两者的差别：

```javascript
// 1. 普通函数：同步执行，立即返回值
function normalFunc() {
  console.log("普通函数内部");
  return "普通函数返回值";
}
console.log("1. 调用普通函数前");
const normalResult = normalFunc();
console.log("2. 普通函数返回值：", normalResult);
// 执行顺序：1 → 普通函数内部 → 2 → 普通函数返回值：普通函数返回值

// 2. 异步函数：先返回Promise，内部代码后台执行
async function asyncFunc() {
  console.log("异步函数内部");
  return "异步函数返回值"; // 会被包装成 Promise.resolve("异步函数返回值")
}
console.log("3. 调用异步函数前");
const asyncResult = asyncFunc();
console.log("4. 异步函数返回值：", asyncResult);
// 执行顺序：3 → 4 → 异步函数内部（后台执行完毕后）
// 异步函数返回值：Promise {<fulfilled>: "异步函数返回值"}
```

## 三、异步函数返回值的获取方式

### 3.1 方式1：使用 `.then()` 链式调用（兼容 Promise 旧语法）

- 适用场景：异步函数执行完后，要根据返回值接着做事（比如渲染页面、调别的接口）。
- 语法示例：

  ```javascript
  // 异步函数：模拟获取用户地理位置（返回城市名称）
  async function getCity() {
    // 模拟异步操作（如调用地理定位API）
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return "葡萄牙 Olhao"; // 包装为 Promise.resolve("葡萄牙 Olhao")
  }

  // 调用异步函数，用 .then() 获取返回值
  console.log("开始获取城市...");
  getCity()
    .then((city) => {
      console.log("获取到城市：", city); // 1秒后执行：获取到城市：葡萄牙 Olhao
    })
    .catch((error) => {
      console.error("获取失败：", error);
    });
  ```

### 3.2 方式2：使用 `await` + 异步函数（推荐，更简洁）

- 规则：`await` 关键字必须用在另一个异步函数里，作用是"暂停当前这个异步函数，等目标 Promise 兑现了再接着往下走"。
- 好处：避开 `.then()` 链式调用的嵌套问题（"回调地狱"），代码写起来更像同步的。
- 语法示例：

  ```javascript
  async function getCity() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return "葡萄牙 Olhao";
  }

  // 用 async IIFE（立即执行异步函数）包裹 await（因顶层 await 需特殊配置）
  (async function () {
    console.log("开始获取城市...");
    try {
      const city = await getCity(); // 等待 getCity() 返回的 Promise 兑现
      console.log("获取到城市：", city); // 1秒后执行：获取到城市：葡萄牙 Olhao
    } catch (error) {
      console.error("获取失败：", error);
    }
  })();
  ```

- 补充：项目支持 ES2022+ 语法的话，可以直接在模块顶层用 `await`（不用 IIFE），比如：
  ```javascript
  // 模块文件（.mjs 或 package.json 配置 "type": "module"）
  const city = await getCity();
  console.log(city);
  ```

## 四、异步函数的错误处理

### 4.1 问题：异步函数内部错误默认不触发外部 `catch`

- 现象：异步函数里用 `try/catch` 接住了错误、但没有重新抛出（`throw`）的话，函数返回的 Promise 还是"已兑现"，外面的 `.catch()` 或 `try/catch` 接不到这个错误。
- 示例（错误写法）：

  ```javascript
  async function getCity() {
    try {
      await new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("定位失败")), 1000); // 模拟异步错误
      });
      return "葡萄牙 Olhao";
    } catch (error) {
      console.log("内部捕获错误：", error.message); // 仅内部打印，未重新抛出
    }
  }

  // 外部调用：无法捕获内部错误
  getCity()
    .then((city) => {
      console.log("城市：", city); // 执行：城市：undefined（因函数未返回有效值）
    })
    .catch((error) => {
      console.error("外部捕获错误：", error); // 不执行！
    });
  ```

### 4.2 解决方案：重新抛出错误（`throw error`）

- 原理：在异步函数的 `catch` 块里重新抛出错误，函数返回的 Promise 就会变成"已拒绝"，外面就能用 `.catch()` 或 `try/catch` 接住。
- 示例（正确写法）：

  ```javascript
  async function getCity() {
    try {
      await new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("定位失败")), 1000);
      });
      return "葡萄牙 Olhao";
    } catch (error) {
      console.log("内部捕获错误：", error.message);
      throw error; // 重新抛出，让外部能捕获
    }
  }

  // 外部用 try/catch + await 捕获错误
  (async function () {
    try {
      const city = await getCity();
      console.log("城市：", city);
    } catch (error) {
      console.error("外部捕获错误：", error.message); // 执行：外部捕获错误：定位失败
    }
  })();
  ```

### 4.3 额外优化：用 `finally` 执行收尾操作

- 特点：不管 Promise 是"兑现"还是"拒绝"，`finally` 块里的代码都会执行（比如关掉加载动画、清理资源）。
- 示例：
  ```javascript
  (async function () {
    console.log("开始获取城市...");
    try {
      const city = await getCity();
      console.log("城市：", city);
    } catch (error) {
      console.error("错误：", error.message);
    } finally {
      console.log("获取操作结束（无论成功/失败）"); // 必执行
    }
  })();
  // 执行顺序：
  // 1. 开始获取城市...
  // 2. 内部捕获错误：定位失败
  // 3. 错误：定位失败
  // 4. 获取操作结束（无论成功/失败）
  ```

## 五、实战例题（巩固应用）

### 例题1：获取用户信息并渲染

需求：用两个异步函数分别拿"用户 ID"和"用户详情"，先拿 ID，再用 ID 查详情，最后打印结果；任何一步失败都要接住错误并提示。

```javascript
// 异步函数1：获取用户ID（模拟接口调用）
async function getUserId() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return "user_123"; // 模拟返回ID
}

// 异步函数2：用ID获取用户详情
async function getUserInfo(userId) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    // 模拟错误：若ID无效则抛出错误
    if (userId !== "user_123") throw new Error("用户不存在");
    return { name: "张三", age: 25, city: "北京" };
  } catch (error) {
    throw new Error(`获取详情失败：${error.message}`); // 重新抛出，附加上下文
  }
}

// 主逻辑：串联两个异步函数
(async function renderUser() {
  try {
    console.log("开始加载用户信息...");
    const userId = await getUserId();
    const userInfo = await getUserInfo(userId);
    console.log("用户信息：", userInfo);
    // 执行：用户信息：{ name: '张三', age: 25, city: '北京' }
  } catch (error) {
    console.error("加载失败：", error.message);
  } finally {
    console.log("用户信息加载流程结束");
  }
})();
```

### 例题2：判断返回值类型

问题：下面这段代码执行后，`result1` 和 `result2` 分别是什么类型？为什么？

```javascript
async function func1() {
  return 123;
}
async function func2() {
  throw new Error("出错了");
}

const result1 = func1();
const result2 = func2();
```

答案：

- `result1` 是 `Promise`（状态：fulfilled，值：123）。因为异步函数不管返回什么，都会包成已兑现的 Promise。
- `result2` 是 `Promise`（状态：rejected，值：Error 对象）。因为异步函数里抛了错，会包成已拒绝的 Promise。

## 六、总结

1. 返回值的本质：异步函数永远返回 Promise，`return X` 相当于 `return Promise.resolve(X)`，`throw E` 相当于 `return Promise.reject(E)`。
2. 怎么拿返回值：优先用 `await + async`（代码简洁），要兼容的场景用 `.then()`；`await` 必须在异步函数里用。
3. 错误处理：异步函数里接住错误后，要 `throw error` 外面才接得到；`finally` 用来做收尾。
4. 原则：别把 `await` 和 `.then()` 混着写，代码风格统一，读起来更省力。

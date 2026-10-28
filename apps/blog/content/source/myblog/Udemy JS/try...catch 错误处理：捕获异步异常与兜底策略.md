---
title: "try...catch 错误处理：捕获异步异常与兜底策略"
date: 2025-12-28 12:53:11
tags:
  - "try...catch"
  - "异常处理"
  - "Async/Await"
  - "错误兜底"
categories:
  - "前端开发"
  - "JavaScript"
---


## 一、try...catch 与 async/await 的关联（核心应用场景）

### 1.1 关键特性

- async/await 里没法像普通 Promise 那样直接用 `.catch()` 接错误，要靠 try...catch 处理
- try...catch 不是专门给 async/await 设计的，它是 JavaScript 语言自带的特性（大概从语言一开始就有），同步代码和异步代码的错误都能接
- 作用：不中断脚本执行，接住代码里的异常，按自己的方式处理

### 1.2 应用示例（async/await 场景）

```javascript
// 异步函数：通过 API 获取国家数据
const getCountryData = async (country) => {
  try {
    // 尝试执行异步操作
    const response = await fetch(
      `https://restcountries.com/v3.1/name/${country}`,
    );
    // 手动判断响应状态（fetch 仅在无网络时拒绝，404/403 需手动处理）
    if (!response.ok) {
      throw new Error(`请求失败，状态码: ${response.status}`); // 主动抛出错误
    }
    const data = await response.json();
    return data[0];
  } catch (err) {
    // 捕获并处理错误
    console.error("❌ 错误信息:", err.message);
    // 可进一步将错误渲染到页面（用户可见）
    document.body.innerHTML += `<p>❌ 获取数据失败: ${err.message}</p>`;
    // 可选择重新抛出错误，供上层调用者处理
    // throw err;
  }
};

// 调用函数（故意传入不存在的国家，触发错误）
getCountryData("nonexistentcountry");
```

## 二、try...catch 基本工作原理（同步代码场景）

### 2.1 语法结构

```javascript
try {
  // 待执行的代码块（可能发生错误的代码）
  可能出错的代码;
} catch (error) {
  // 错误捕获与处理块（仅当 try 块中发生错误时执行）
  处理错误的代码;
}
```

- 执行逻辑：JavaScript 先试着执行 try 块里的代码；执行中出了错，马上停掉 try 块，跳到 catch 块处理错误；try 块没出错的话，catch 块直接跳过

### 2.2 同步代码示例（错误捕获演示）

#### 示例1：捕获“重新分配常量”错误

```javascript
// 未使用 try...catch 的情况（脚本会中断）
const x = 1;
x = 2; // 错误：常量无法重新分配，脚本直接终止
console.log("此处不会执行"); // 不会输出

// 使用 try...catch 的情况（脚本正常执行）
const y = 1;
try {
  y = 2; // 尝试重新分配常量（会触发错误）
  console.log("try 块中错误后的代码（不会执行）");
} catch (err) {
  // 捕获错误并处理
  alert(`❌ 错误提示: ${err.message}`); // 弹出："错误提示: Assignment to constant variable"
  console.log("catch 块执行后，脚本继续运行"); // 正常输出
}
console.log("脚本未中断，继续执行"); // 正常输出
```

#### 示例2：无错误场景（catch 块跳过）

```javascript
let a = 5;
try {
  a = a + 3; // 无错误的正常操作
  console.log("try 块执行成功，a 的值:", a); // 输出："try 块执行成功，a 的值: 8"
} catch (err) {
  console.log("错误处理（不会执行）");
}
console.log("脚本正常结束"); // 输出："脚本正常结束"
```

## 三、try...catch 的适用范围与限制

### 3.1 不适用场景：语法错误排查

- 注意：try...catch 接不住写代码时的语法错误（括号没闭合、变量名拼错这类）
- 示例（接不住的语法错误）：

```javascript
try {
  // 语法错误：缺少右括号（代码解析阶段已报错，try 块无法执行）
  console.log('语法错误示例'
} catch (err) {
  console.log('无法捕获语法错误', err); // 不会执行
}
```

- 正确做法：语法错误要在写代码阶段用代码检查工具（比如 ESLint）或开发者工具的"控制台"排查；try...catch 主要处理运行时的错误（网络请求失败、数据格式异常等）

### 3.2 适用场景：运行时错误处理

- 典型场景：
  1. 异步操作出错（网络请求失败、定时器里的错误）
  2. 数据处理出错（JSON 解析失败、数组越界）
  3. 用户输入出错（非法值导致计算出错）

#### 示例：处理 JSON 解析错误

```javascript
const parseJsonData = (jsonStr) => {
  try {
    const data = JSON.parse(jsonStr); // 尝试解析 JSON 字符串
    console.log("✅ JSON 解析成功:", data);
    return data;
  } catch (err) {
    console.error("❌ JSON 解析失败:", err.message);
    return null; // 返回默认值，避免后续代码出错
  }
};

// 测试：传入非法 JSON 字符串
parseJsonData('{name: "China"}'); // 错误：JSON 语法错误（键名需加双引号），输出错误信息并返回 null
// 测试：传入合法 JSON 字符串
parseJsonData('{"name": "China", "population": 1411780000}'); // 解析成功，输出数据
```

## 四、fetch 场景的特殊处理（关键注意点）

### 4.1 fetch 的默认行为陷阱

- fetch API 只在"没网"或"请求发不出去"时才会拒绝 Promise、触发错误；404（资源不存在）、403（权限不足）这些 HTTP 错误状态码，fetch 照样认为请求"成功"了，不会自动抛错
- 解决办法：在 try 块里手动判断 `response.ok`（`response.ok` 为 true 表示状态码在 200-299 之间），是 false 就主动抛错

### 4.2 完整示例（处理 fetch 所有错误场景）

```javascript
const fetchUser = async (userId) => {
  try {
    const response = await fetch(`https://api.example.com/users/${userId}`);

    // 1. 处理 HTTP 错误（404/403 等）
    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
    }

    // 2. 处理 JSON 解析错误（若响应格式不是 JSON）
    const user = await response.json();

    // 3. 处理业务逻辑错误（如返回空数据）
    if (!user) {
      throw new Error("未找到该用户数据");
    }

    console.log("✅ 用户数据:", user);
    return user;
  } catch (err) {
    // 统一捕获所有类型错误（网络错误、HTTP 错误、解析错误、业务错误）
    console.error("❌ 获取用户失败:", err.message);
    // 可添加用户友好提示
    document.querySelector(".error-message").textContent =
      `获取数据失败: ${err.message}`;
  }
};

// 测试不同场景
fetchUser(123); // 正常：获取 ID 为 123 的用户
fetchUser(999); // 触发 404 错误（无此用户）
fetchUser("abc"); // 触发 400 错误（用户 ID 格式非法）
```

## 五、错误处理最佳实践

### 5.1 核心原则

1. 别忽略错误：永远别写空的 catch 块（`catch (err) {}`），至少把错误信息记下来
2. 错误信息要准：用 `err.message` 拿错误详情，必要时记下错误堆栈（`err.stack`），方便定位
3. 对用户友好：把技术错误翻成用户看得懂的话（比如"网络连接异常，请检查网络"，而不是"TypeError: Failed to fetch"）
4. 分层处理：底层函数抛错，上层函数按业务场景处理（重试、降级等）

### 5.2 实践示例（分层处理）

```javascript
// 底层工具函数：负责发送请求（仅抛出错误，不处理）
const request = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`请求失败 [${response.status}]: ${url}`); // 抛出包含关键信息的错误
  }
  return response.json();
};

// 上层业务函数：调用工具函数并处理错误
const loadProductList = async () => {
  try {
    const products = await request("https://api.example.com/products");
    renderProductList(products); // 渲染正常数据
  } catch (err) {
    console.error("加载商品列表错误:", err.stack); // 记录详细堆栈
    // 错误降级：显示默认数据或重试按钮
    renderProductList([]);
    showRetryButton(() => loadProductList()); // 提供重试功能
    showToast("⚠️ 商品列表加载失败，点击重试"); // 用户友好提示
  }
};

// 页面初始化时调用
loadProductList();
```

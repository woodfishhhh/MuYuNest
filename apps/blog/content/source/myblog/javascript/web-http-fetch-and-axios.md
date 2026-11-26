---
title: "浏览器异步请求实战：XHR、Fetch、Axios 与文件上传"
slug: "web-http-fetch-and-axios"
date: 2025-12-20 12:00:04
categories:
  - "前端开发"
tags:
  - "AJAX"
  - "XMLHttpRequest"
  - "Fetch"
  - "Axios"
  - "FormData"
---

早期网页提交一次表单必须整页刷新重新拉取 HTML，AJAX（Asynchronous JavaScript and XML）允许浏览器在后台通过脚本向服务器交换数据（如今主流格式早已变为 JSON），拿到响应后再局部更新 DOM。不管是直接调底层 `XMLHttpRequest`、原生的 `fetch`，还是项目里常用的 `axios`，核心都要处理好请求配置、HTTP 状态判断、并发与取消、文件上传和错误分层。

## `XMLHttpRequest` 状态机与手写 Promise 封装

理解 `XMLHttpRequest`（XHR）的生命周期，在排查代理、上传进度和兼容性问题时非常管用。一个 XHR 实例会按顺序流转 `readyState` 的五个状态（`0 UNSENT` → `1 OPENED` → `2 HEADERS_RECEIVED` → `3 LOADING` → `4 DONE`），并触发对应事件：

- `open(method, url)`：配置请求方式与地址；**`setRequestHeader()` 必须在 `open()` 之后、`send()` 之前调用**。
- `load` / `loadend`：请求完成到达 `readyState === 4`，`loadend` 在成功、失败、超时或中止后都会触发。
- `error` / `timeout`：网络断开或超过 `xhr.timeout` 设定毫秒数时触发。
- `upload.onprogress`：监听文件上传字节进度（`e.lengthComputable` 为真时用 `e.loaded / e.total` 计算百分比）。

**`readyState === 4` 只代表请求通信过程结束，不代表业务成功；即使返回 `404` 或 `500` 也会走进 `load`/`loadend`，必须显式检查 `xhr.status >= 200 && xhr.status < 300`。**

把 XHR 用 `Promise` 包一层，就能写出支持查询参数 `params`（通过 `URLSearchParams` 自动编码拼接）、JSON 请求体与完整错误分流的轻量版 `myRequest`：

```javascript
function myRequest(config) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let targetUrl = config.url;

    // 拼接查询参数（避免直接修改调用方传入的 config.url）
    if (config.params) {
      const qs = new URLSearchParams(config.params).toString();
      if (qs) {
        targetUrl += (targetUrl.includes("?") ? "&" : "?") + qs;
      }
    }

    xhr.open((config.method || "GET").toUpperCase(), targetUrl);
    xhr.timeout = config.timeout ?? 15000;

    xhr.addEventListener("loadend", () => {
      if (xhr.status === 0) return; // 交由 error / timeout / abort 分支处理
      let payload = xhr.responseText;
      try {
        if (payload) payload = JSON.parse(payload);
      } catch {
        // 响应非 JSON 时保留原始文本
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText || "Request failed"}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("网络连接失败")));
    xhr.addEventListener("timeout", () => reject(new Error("请求超时")));
    xhr.addEventListener("abort", () => reject(new Error("请求已取消")));

    if (config.data instanceof FormData) {
      xhr.send(config.data); // FormData 由浏览器自动生成 multipart 边界头，禁止手写 Content-Type
    } else if (config.data !== undefined) {
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(config.data));
    } else {
      xhr.send();
    }
  });
}
```

## `fetch` API 与 `AbortController` 请求取消

现代浏览器原生提供的 `fetch(url, options)` 基于 Promise，比 XHR 简洁得多，但有两条极易踩中的工程坑：

1. **HTTP 错误不 reject**：如在 [JavaScript 事件循环、Promise 与 async/await](/posts/js-event-loop-and-async) 中所述，必须先判断 `if (!res.ok) throw new Error(...)` 再调用 `res.json()`。
2. **默认不携带跨域 Cookie**：跨站请求如果需要附带凭证，必须显式传 `credentials: "include"`（同源默认 `"same-origin"`）。

在搜索联想、省市区级联切换等高频操作中，用户连续触发两次请求时，**先发出的旧请求如果比后发出的新请求晚返回，就会把旧结果覆盖到界面上（竞态条件）**。利用标准 `AbortController` 可以在发起新请求前直接中止上一个未完成的请求：

```javascript
let currentController = null;

async function searchCities(keyword) {
  // 中止尚未完成的上一次请求，彻底消除旧响应覆盖新结果的风险
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();

  try {
    const qs = new URLSearchParams({ city: keyword }).toString();
    const res = await fetch(`/api/weather/city?${qs}`, {
      signal: currentController.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    renderCityOptions(list);
  } catch (err) {
    if (err.name === "AbortError") return; // 主动取消属于预期控制流，不提示报错
    showSearchError(err.message);
  }
}
```

## Axios 实战、拦截器与错误分层

在业务项目里，Axios 基于 XHR/Node HTTP 做了统一的 Promise 包装：自动完成请求/响应 JSON 序列化、`params` 序列化、HTTP 非 `2xx` 自动走 `reject`，以及可插拔的请求与响应拦截器。

### 实例配置与拦截器

工程里不要直接用全局裸 `axios`，而是通过 `axios.create()` 抽出统一实例，把公共 `baseURL`、超时、Token 注入和全局错误格式化收进拦截器：

```javascript
import axios from "axios";

const http = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

// 请求拦截器：统一附带鉴权凭证
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一拆解响应体与错误分类
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    if (error.response) {
      // 服务器返回了响应，但状态码非 2xx
      const msg = error.response.data?.message || `服务异常 (${error.response.status})`;
      return Promise.reject(new Error(msg));
    }
    if (error.request) {
      // 请求已发出但未收到响应（断网、超时、CORS 阻断）
      return Promise.reject(new Error("网络连接异常，请检查网络后重试"));
    }
    return Promise.reject(error);
  }
);
```

### 表单提交、CRUD 与数据回显边界

在列表增删改查（如书籍管理或个人设置页）中，围绕“服务器状态为准”的原则守住四条操作边界：

1. **表单收集与清洗**：使用原生 `new FormData(formEl)` 读取具名控件，通过 `Object.fromEntries(fd.entries())` 即可转为普通对象（注意数字字段如 `gender` 需手动转成 `Number`）。
2. **失败回滚与弹框控制**：新增、修改或删除时，**必须等接口返回成功后才重置表单、更新列表和关闭弹框**；一旦请求失败，保留用户输入和弹框让用户修正重试，切忌先删 DOM 再发请求。
3. **详情回显与列表解耦**：点击编辑时应根据 `data-id` 请求详情接口拿到完整字段回显，避免仅靠列表摘要字段漏掉未展示的属性。

```javascript
async function handleDeleteBook(bookId, triggerBtn) {
  triggerBtn.disabled = true;
  try {
    await http.delete(`/books/${bookId}`);
    await refreshBookList();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    triggerBtn.disabled = false;
  }
}
```

## 文件上传与 `FormData` 关键细节

文件上传不能塞进 JSON 请求体，必须使用 `FormData` 构造 `multipart/form-data` 报文。实际工程里通常同时做三步：前置体积与 MIME 类型校验、绑定上传进度回调、只在上报成功后持久化返回 URL：

```javascript
async function uploadAvatar(file, onProgress) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!file || file.size === 0) {
    throw new Error("请选择有效的非空文件");
  }
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`不支持的文件类型：${file.type}`);
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("文件大小不能超过 5MB");
  }

  const fd = new FormData();
  fd.append("avatar", file);
  fd.append("timestamp", String(Date.now()));

  // 使用 Axios 上传时不要手写带 boundary 的 Content-Type，交给浏览器自动生成分隔符
  const data = await http.put("/avatar", fd, {
    onUploadProgress(evt) {
      if (evt.total) {
        onProgress?.(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });

  localStorage.setItem("avatarUrl", data.avatar);
  return data.avatar;
}
```

**使用 `FormData` 提交时，千万不要手动硬编码 `Content-Type: multipart/form-data` 请求头——浏览器需要自动在后面拼接随机 `boundary=...` 分隔符，手写覆盖会导致服务端无法解析出文件字段。**

## 顺序依赖请求与并发控制策略

面对多个请求组合时，先判断它们之间是否存在数据依赖：

- **有先后依赖（如省 → 市 → 区，或先拉一级分类再拉二级分类）**：使用 `async/await` 串行衔接，用 `try/catch` 统一接住任意一步异常。
- **互不依赖（如首屏同时拉取四个城市天气或全部二级分类）**：并发发起后用 `Promise.all` 或 `Promise.allSettled` 汇总结果。

如果一次需要并发处理上百个子请求，直接用 `Promise.all` 瞬间打出上百个连接会打满浏览器同域名并发限制甚至压垮接口。此时需要手写一个简单的并发池控制同时在途请求数：

```javascript
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  const poolSize = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: poolSize }, runWorker));
  return results;
}
```

<details>
<summary>速查：不同网络失败场景在 DevTools Network 与代码层的排查对照</summary>

1. **状态码 `4xx`（`400`/`401`/`403`/`404`）**：先核对 Network 中实际发出的请求 URL、方法、Query 参数与 Payload 字段名是否与接口文档一致；`401` 检查请求头 `Authorization` 是否漏带或过期。
2. **状态码 `5xx`（`500`/`502`/`504`）**：请求已到服务端但后端执行崩溃或网关超时，抓取 Request Payload 与响应体交给后端联调定位。
3. **无 HTTP 状态码（`(failed)` / `net::ERR_FAILED` / CORS 报错）**：检查服务是否启动、浏览器网络是否离线、请求是否被 `AbortController` 取消，或跨域响应是否缺少 `Access-Control-Allow-Origin` 响应头。

</details>

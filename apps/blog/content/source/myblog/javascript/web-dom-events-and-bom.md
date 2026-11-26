---
title: "浏览器 DOM、事件委托、BOM 与表单校验"
slug: "web-dom-events-and-bom"
date: 2025-11-21 12:41:04
categories:
  - "前端开发"
tags:
  - "JavaScript"
  - "DOM"
  - "事件委托"
  - "BOM"
  - "正则表达式"
---

列表里的按钮是接口返回后才动态插进页面的，单独绑定的点击事件全失效了；把字符串直接塞进 `innerHTML` 引入了 XSS 隐患；从 `localStorage` 里读出布尔值 `"false"` 做判断结果走成了真分支。理解 DOM 节点操作、事件传播模型、BOM 状态接口与正则校验规则，就能用原生 Web API 稳妥完成绝大部分页面交互与表单控制。

## DOM 查询、内容更新与节点操作

浏览器将 HTML 文档解析为由元素节点、文本节点、属性节点构成的树形结构（DOM Tree），通过全局对象 `document` 暴露操作入口。

### 精准选择与内容安全

- **查询元素**：统一优先使用 `document.querySelector(selector)`（返回首个匹配元素或 `null`）和 `document.querySelectorAll(selector)`（返回静态 `NodeList` 伪数组，支持 `forEach` 和 `for...of`）。
- **更新内容**：纯文本一律使用 `textContent`（或受样式影响更重的 `innerText`），浏览器会自动转义标签字符；**只有确认需要解析安全 HTML 片段时才用 `innerHTML`**，用户输入内容切勿直接拼进 `innerHTML`。
- **样式与自定义属性**：批量切换外观使用 `el.classList.add/remove/toggle/contains`（避免 `className = "..."` 覆盖掉原有类名）；自定义数据属性统一以 `data-` 前缀声明（如 `data-user-id="42"`），JS 中通过 `el.dataset.userId` 自动按驼峰读取（**`dataset` 取出的值永远是字符串**）。

### 节点创建、插入与关系查找

动态构建列表时，建议先用 `document.createElement` 创建节点并装配属性（或拼好一次批量的 `DocumentFragment`），再一次性挂载到父容器，减少中途重复触发重排：

```javascript
const list = document.querySelector(".task-list");
const fragment = document.createDocumentFragment();

["DOM 查询", "事件委托", "本地存储"].forEach((text, index) => {
  const li = document.createElement("li");
  li.dataset.index = String(index);
  li.textContent = text; // 安全写入纯文本
  fragment.appendChild(li);
});

list.appendChild(fragment);
```

按相对位置遍历 DOM 树时，优先选用仅包含**元素节点**的属性，避开把换行和空格当成空白文本节点的旧属性：

| 查找方向 | 推荐属性（仅元素节点） | 易踩坑属性（含文本/注释节点） |
| --- | --- | --- |
| 所有子元素 | `el.children` | `el.childNodes` |
| 父元素 | `el.parentElement` / `el.closest(".card")` | `el.parentNode`（在根节点可能返回 `document`） |
| 前/后兄弟元素 | `el.previousElementSibling` / `el.nextElementSibling` | `el.previousSibling` / `el.nextSibling` |

删除节点直接调用现代标准的 `el.remove()`（或 `parent.removeChild(child)`），复制节点调用 `el.cloneNode(true)`（传 `true` 深克隆子节点）。

## 事件流、事件委托与尺寸属性

### 捕获、目标与冒泡阶段

DOM2 级事件通过 `el.addEventListener(type, handler, useCapture)` 注册，同一事件可绑定多个监听器而不互相覆盖（旧式 `el.onclick = ...` 后者会覆盖前者）。移除监听器必须传入**同一个具名函数引用**，匿名函数无法被 `removeEventListener` 解绑。

一次点击触发时，事件流依次经过三个阶段：

```text
1. 捕获阶段（useCapture = true）：window -> document -> html -> body -> 父容器
2. 目标阶段：到达实际触发事件的最深层元素
3. 冒泡阶段（默认 false）：目标元素 -> 父容器 -> ... -> window
```

需要拦截向父级继续传播时调用 `e.stopPropagation()`；需要阻止表单提交刷新、链接跳转等浏览器默认行为时调用 `e.preventDefault()`。另外注意悬停事件选择：**`mouseenter`/`mouseleave` 不冒泡**，用来做菜单移入移出比会反复冒泡触发子元素事件的 `mouseover`/`mouseout` 稳定得多。

### 事件委托：动态列表的唯一正解

利用事件冒泡，把整组子元素的监听器统一绑在稳定存在的父容器上，既能把成百上千个监听器压成 1 个，又能自动覆盖后续接口动态渲染出来的新节点。

**事件委托回调里必须严格区分 `e.target`（实际被点击的最内层子节点）和 `e.currentTarget`（绑定监听器的父容器）；如果按钮里套了 `<span>` 或图标，直接判断 `e.target.tagName === "BUTTON"` 会漏判，必须改用 `e.target.closest("[data-action]")`。**

```javascript
const tableBody = document.querySelector(".book-tbody");

tableBody.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn || !tableBody.contains(actionBtn)) return;

  const { action, id } = actionBtn.dataset;
  if (action === "delete") {
    deleteBook(id);
  } else if (action === "edit") {
    openEditModal(id);
  }
});
```

### 元素几何与滚动尺寸速查

处理吸顶导航、回到顶部按钮与弹窗定位时，常用三组只读/可写几何属性（注意：元素设了 `display: none` 时几何返回值均为 `0`）：

- **元素占位宽高与偏移**：`offsetWidth` / `offsetHeight` 包含 `content + padding + border`（不含 `margin`）；`offsetTop` / `offsetLeft` 返回相对最近已定位祖先的偏移量。
- **滚动距离**：`document.documentElement.scrollTop` 读取或直接赋值设置整页垂直滚动距离；监听高频 `scroll` 和 `window` `resize`（读 `window.innerWidth` / `window.innerHeight`）时应搭配节流/防抖函数（实现见 [JavaScript 原型链、继承与常用手写模式](/posts/js-prototypes-oop-and-patterns)）。
- **日期时间戳**：在计算耗时或倒计时时，直接调用 `Date.now()` 获取毫秒时间戳比 `new Date().getTime()` 更轻量。

## BOM 核心对象与本地存储边界

BOM（浏览器对象模型）以 `window` 为顶层对象，暴露定时器、地址栏、历史记录和持久化存储接口：

1. **定时器生命周期管理**：`setTimeout` 与 `setInterval` 均返回一个数字编号，组件销毁或重启轮询前必须调用 `clearTimeout(id)` / `clearInterval(id)`；复杂周期任务优先用“回调执行完毕后再安排下一次 `setTimeout`”替代固定 `setInterval`，避免请求耗时超过间隔导致回调堆积。
2. **`location` 与 `history`**：
   - `location.href` 读写完整 URL（赋值会触发整页跳转）；`location.search` 与 `location.hash` 分别读取 `?` 参数与 `#` 锚点；`location.reload()` 刷新当前页。解析查询参数推荐直接用 `new URLSearchParams(location.search).get("keyword")`。
   - `history.back()` / `history.forward()` / `history.go(n)` 控制会话历史栈；SPA 无刷新路由底层通过 `history.pushState()` 与 `replaceState()` 改写路径。

### `localStorage` vs `sessionStorage` 与序列化坑

| 存储对象 | 生命周期与共享范围 | 存储容量与数据类型 |
| --- | --- | --- |
| `localStorage` | 同源下永久保留（关闭浏览器不丢失），同源多标签页共享 | 约 5MB；**键值仅支持字符串** |
| `sessionStorage` | 仅当前浏览器标签页有效，页面关闭即清除 | 约 5MB；**键值仅支持字符串** |

**`localStorage` 只能存字符串：存入对象或布尔值会隐式转成 `"[object Object]"` 或 `"false"`；读取后必须用 `JSON.parse()` 还原并包在 `try/catch` 里，防止脏数据弄崩整个页面初始化。**

```javascript
const storage = {
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  get(key, fallback = null) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
};
```

此外，本地存储同源内任何脚本均可同步读取，**绝对不要将敏感明文密码或高危凭证直接放进 `localStorage`**，同步写入大体积 JSON 也会阻塞主线程。

## 正则表达式与表单校验实战

正则表达式用于格式校验（`reg.test(str)`）与敏感词/格式替换（`str.replace(reg, replacer)`）。做整串表单校验时，**必须同时加上开头锚点 `^` 与结尾锚点 `$`**，否则 `/\d{11}/` 会把 `"abc13800138000xyz"` 也放行通过。

常用元字符与量词速查：

- **量词**：`*`（0 次或多次）、`+`（至少 1 次）、`?`（0 或 1 次）、`{n}`（精确 `n` 次）、`{n,}`（至少 `n` 次）、`{n,m}`（`n` 到 `m` 次，**逗号两侧绝不能加空格**）。
- **字符集与简写**：`[a-zA-Z0-9_]` 等价于 `\w`；`[0-9]` 等价于 `\d`；`\s` 匹配空白符；`[^...]` 表示字符集取反。
- **修饰符**：`i` 忽略大小写，`g` 全局匹配所有命中项。

**带有 `g` 标志的正则字面量内部会维护 `lastIndex` 游标，连续对多个字符串调用 `reg.test()` 会在第二次莫名返回 `false`；表单字段校验正则不要加 `g`。**

结合输入失去焦点并发生变更时触发的 `change` 事件（或实时 `input` 事件）与 `submit` 终验，可以写出一条清晰的注册表单校验逻辑：

```javascript
const RULES = {
  username: {
    pattern: /^[a-zA-Z0-9_]{6,16}$/,
    message: "用户名需为 6~16 位字母、数字或下划线",
  },
  phone: {
    pattern: /^1[3-9]\d{9}$/,
    message: "请输入有效的 11 位中国大陆手机号",
  },
  password: {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{8,20}$/,
    message: "密码需 8~20 位，且至少包含字母和数字",
  },
};

function validateField(input) {
  const rule = RULES[input.name];
  if (!rule) return true;

  const isValid = rule.pattern.test(input.value.trim());
  const hint = input.parentElement.querySelector(".field-error");

  input.classList.toggle("is-invalid", !isValid);
  if (hint) hint.textContent = isValid ? "" : rule.message;
  return isValid;
}

const form = document.querySelector("#registerForm");
form.addEventListener("change", (e) => {
  if (e.target.matches("input[name]")) validateField(e.target);
});

form.addEventListener("submit", (e) => {
  const inputs = [...form.querySelectorAll("input[name]")];
  const allPassed = inputs.every((el) => validateField(el));
  if (!allPassed) {
    e.preventDefault();
  }
});
```

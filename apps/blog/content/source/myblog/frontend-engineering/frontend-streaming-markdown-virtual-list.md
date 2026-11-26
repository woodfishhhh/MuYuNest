---
title: "前端工程问题复盘：SSE 流式输出、Markdown 容错与虚拟列表"
slug: "frontend-streaming-markdown-virtual-list"
date: 2026-04-22 22:35:00
categories:
  - "前端开发"
tags:
  - "SSE"
  - "流式输出"
  - "Markdown"
  - "虚拟列表"
  - "工程实战"
---

AI 对话和长列表展示里有三类极容易在生产环境炸掉体验的问题：单条 SSE 数据包格式异常导致整条消息流断开；流式吐到一半的 Markdown 因为代码块或表格没闭合导致渲染器崩溃或页面白屏；上万条记录的列表滚动掉帧，盲目套虚拟列表却引入了跳动和空白。三者分别对应**流式协议容错**、**增量解析与安全消毒分层**，以及**动态高度虚拟列表的性能验证边界**。

## SSE 流式接收：分片解析状态机与断流容错

Server-Sent Events（SSE）基于 HTTP 长连接向客户端单向持续推流，相比全双工 WebSocket 更轻量且天然兼容 HTTP 基础设施。如果仅依赖原生 `new EventSource(url)`，会遇到只支持 `GET` 且难以自定义 `Authorization` 请求头的限制；因此在需要携带 POST 请求体和鉴权头的 AI 对话场景里，工程上通常改用 `fetch()` + `ReadableStream` 手写增量解码器。

### 流式分片的两大坑点

1. **TCP/HTTP 分块（Chunk）与消息边界不对齐**：一次 `reader.read()` 返回的字节块可能正好把一个多字节 UTF-8 中文字符劈成两半，也可能在一条 `data: {...}\n\n` 事件中间截断，或者一次粘连多条事件。
2. **单条脏数据中断整条流**：如果直接对单条 `data:` 负载做无保护的 `JSON.parse()`，一旦服务端吐出一条格式不规范的片段或心跳注释，整条流就会抛异常退出，后续有效分片全部丢失。

**流式解码必须维护跨 Chunk 缓冲状态机，用 `TextDecoder({ stream: true })` 拼接不完整字符，并对单条解析异常做原地降级而非中止整个 `while` 读取循环。**

```javascript
async function consumeSseStream(url, payload, { signal, onEvent, onError }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE 连接失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // stream: true 防止跨 chunk 的多字节 UTF-8 字符被解码成乱码
    buffer += decoder.decode(value, { stream: true });

    // SSE 规范以空行（\n\n 或 \r\n\r\n）分隔每条完整事件
    const frames = buffer.split(/\r?\n\r?\n/);
    // 最后一个分片可能不完整，留回 buffer 等下一个 chunk 拼齐
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      if (!frame.trim() || frame.startsWith(":")) continue; // 忽略心跳注释行

      let eventType = "message";
      const dataLines = [];

      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      const rawData = dataLines.join("\n");
      if (rawData === "[DONE]") return;

      try {
        const parsed = JSON.parse(rawData);
        onEvent?.(eventType, parsed);
      } catch (err) {
        // 单帧解析失败时记录异常样本并以纯文本兜底，绝不中断后续流接收
        onError?.(err, rawData);
        onEvent?.(eventType, { text: rawData, degraded: true });
      }
    }
  }
}
```

## 增量 Markdown 渲染：未闭合围栏容错与安全分层

在流式接收期间，Markdown 文本天然长期处于语法不完整的中间态：代码围栏（```` ``` ````）刚吐出前半段还没闭合、表格只收到表头和分隔线、行内加粗 `**` 缺了右半边、甚至底层 HTML 标签只传到 `<div cla`。

### 未闭合结构预处理与终态重算

**中间态解析出错或样式错乱不能中断内容展示，底线是保证文本不丢、危险脚本不入 DOM。**

工程上落地流式 Markdown 渲染按五级流水线隔离职责：

```text
流式增量累加 rawText -> 未闭合围栏/公式补齐预处理 -> Markdown 解析 -> DOMPurify 安全消毒 -> 节流写入 DOM
```

1. **流式中间态自动闭合围栏**：解析前先扫描累积文本中出现的代码围栏 ```` ``` ```` 数量（排除缩进或行内反引号）。如果是奇数个，说明代码块尚未吐完，在副本字符串末尾临时补上一行 ````\n``` ```` 再喂给解析器，避免后面的所有正文全被吞进代码块里。同理，可对未闭合的 `$$` 块级公式做临时闭合或降级为纯文本显示。
2. **渲染频率节流（RAF / 16ms–50ms）**：如果服务端每 10ms 吐出一个 token 就整段重跑一次 Markdown 解析 + 代码高亮（Shiki / highlight.js）+ DOM 更新，主线程会被直接拖垮。按 `requestAnimationFrame` 或固定间隔合并多个 token 做一次增量渲染，既流畅又能把 CPU 占用压下来。
3. **流结束后完整重解析 + 纯文本兜底**：收到结束标记时再用完整 `rawText` 跑一次标准解析，消除流式补全带来的微小差异；万一解析器仍抛出异常，直接回退为转义后的 `<pre>` 纯文本展示。
4. **解析与安全消毒严格分层**：Markdown 允许内嵌原始 HTML，解析成功后必须经过 DOMPurify 白名单消毒（剔除 `<script>`、`<iframe>`、危险 `on*` 事件属性与 `javascript:` 协议链接）才允许挂载进页面。解析失败管纯文本回退，消毒层管 XSS 隔离，两层各自独立 `try/catch`，不要糊成一团。

```javascript
function prepareStreamingMarkdown(rawText) {
  // 统计行首代码围栏数量，若为奇数则在预览副本末尾临时闭合
  const fenceMatches = rawText.match(/^```/gm);
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    return `${rawText}\n\`\`\``;
  }
  return rawText;
}
```

## 虚拟列表：先证明 DOM 是瓶颈，再处理动态高度

当消息流或日志列表滚到几千条时，浏览器要为每个节点维持 DOM 树、样式计算、布局与绘制内存，滚动掉帧很常见。但**上虚拟列表之前必须先做对照实验证明瓶颈确实在 DOM 规模上**——图片未限制解码尺寸、单项里套了重型图表或每次状态变更触发全量列表重渲染，同样会把帧率打到 20fps 以下。

### 对照排查四步法

1. 在 DevTools Performance 里录制一次快速滚动，查看主线程 Long Tasks 究竟卡在 `Scripting`（组件脚本重算）还是 `Layout` / `Paint`（DOM 过多）。
2. 查看 Memory 面板的 DOM Nodes 计数与 Detached DOM 是否持续增长。
3. 做单变量对照实验：临时把数据源截取为 20 条，或把 item 简化成纯文本，观察首屏渲染时间、内存和 FPS 变化。只有裁剪节点数量后指标立竿见影好转，才说明虚拟列表能直接打中瓶颈。
4. 数据总量稳定在几百条且单项结构轻量的页面，优先保持普通列表渲染，省掉虚拟滚动的布局维护成本。

### 动态高度虚拟列表的核心机制

定高虚拟列表（如固定每行 `48px`）计算简单，但对话消息和富文本卡片每项高度都不固定。动态高度虚拟列表靠“预估 + 实测回填 + 二分定位 + 上下缓冲”四步稳住滚动条：

1. **预估高度初始化偏移表**：给每个尚未挂载渲染的 item 分配一个保守预估高度（如 `estimatedHeight = 80px`），建立每项的 `[top, bottom]` 累积位置表，据此算出容器总支撑高度。
2. **`ResizeObserver` 实测回填修正**：当 item 真正挂载到可视区或内部图片/折叠面板展开改变高度时，用 `ResizeObserver` 读取真实高度 `actualHeight`；若与缓存高度存在差值 `delta`，更新当前项高度并顺延修正后续所有项的偏移量，同时按需微调 `scrollTop` 防止可视区内容发生视觉跳动。
3. **二分查找确定视口起止索引**：由于累积高度数组严格单调递增，滚动事件触发时用二分查找 $O(\log N)$ 定位首个 `bottom > scrollTop` 的元素作为起始索引 `startIndex`，再向后累加直到 `top >= scrollTop + viewportHeight` 得到 `endIndex`。
4. **上下 `overscan` 缓冲区**：在 `[startIndex, endIndex]` 上下额外多渲染数条节点（如各多留 3–5 条）。`overscan` 太小在快速猛滑时容易出现短暂白屏，太大则会削弱减少 DOM 节点的收益，通常按可视区条数的 `0.5~1` 倍实测微调。

```javascript
// 基于单调累加位置表二分查找可视区第一条数据索引
function findStartIndex(positions, scrollTop) {
  let low = 0;
  let high = positions.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (positions[mid].bottom > scrollTop) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return result;
}
```

## 工程选型与验证边界

在实际前端项目中落地长连接、持久化或样式方案时，决策必须绑定具体的业务约束与实测代价：

- **SSE vs WebSocket**：AI 打字机、实时日志、站内通知只需服务端单向推送，优先选基于 HTTP 的 SSE；只有聊天室、协同编辑、多人对战等高频双向全双工场景才上 WebSocket（心跳间隔需结合网关空闲超时与服务端连接承载能力调优，不能写死任意经验值）。
- **`localStorage` 持久化边界**：适合保存主题、侧栏折叠等轻量非敏感状态，但存在同步阻塞 I/O、约 5MB 容量上限及同源脚本可读等限制，核心草稿与会话记录仍需落服务端或 IndexedDB。
- **验证留痕**：每一项工程改造上线前，必须留下可复现的对比验证——流式容错验证异常帧不中断连接、Markdown 回退验证无内容丢失且 XSS Payload 被剥离、虚拟列表对比开启前后的 DOM 节点数、堆内存峰值与滚动帧率，而不是用一句模糊的“体验提升”收尾。

---
title: Web 安全与隐私基础
date: 2026-07-13
updated: 2026-07-13
tags:
  - Web 安全
  - 隐私保护
  - Vue 3
  - HTTP
  - 防御工程
source:
  - https://www.bilibili.com/video/BV1dS4y1y7vd/
bvid: BV1dS4y1y7vd
pages: P108-P114
draft: false
---

# Web 安全与隐私基础

> **授权边界**：本篇只讨论自己拥有或已获得明确书面授权的系统、数据和测试环境。不得采集他人的凭据、设备指纹、聊天数据、手机号或位置，不得绕过登录、验证码、访问控制、服务条款或反自动化措施。安全研究的目标是降低风险，不是把风险复现到无关用户身上。

## 1. 先建立威胁模型

安全功能不能从“能不能写出脚本”开始，而要先回答：

1. **资产**：账号、密码、Session、照片、位置、业务数据、日志。
2. **主体**：普通用户、管理员、第三方脚本、浏览器扩展、内部人员。
3. **入口**：表单、上传、依赖、API、自动化工具、日志平台。
4. **信任边界**：浏览器与服务端、应用与第三方、生产与测试。
5. **后果**：身份盗用、隐私泄漏、越权、错误封禁、业务中断。
6. **控制**：最小收集、明确同意、隔离、校验、审计、删除和响应。

```text
外部输入
   ↓ 运行时校验
业务边界
   ↓ 身份认证 + 服务端授权
敏感操作
   ↓ 最小日志 + 告警 + 可撤销
持久化数据
   ↓ 加密、保留期限、删除机制
```

XSS 与 CSRF 是两类问题：

- XSS：不可信内容被当作脚本执行。
- CSRF：浏览器携带用户现有凭据，向目标站点发出用户并未同意的请求。

两者可能组合出现，但不是同义词。

## 2. Canvas 指纹

### 2.1 原理

同一段 Canvas 绘制代码在不同环境中可能产生略有差异的像素结果，影响因素包括：

- 浏览器与图形库版本。
- 操作系统、字体与字体回退。
- GPU、驱动、抗锯齿和色彩管理。
- 缩放、语言和无障碍设置。

站点把渲染结果或其哈希与其他信号组合，得到一个**概率性标识**。它可能关联多次访问，但不是可靠的“设备唯一 ID”。

`canvas.toDataURL()` 返回的 Base64 数据不直接包含设备、系统或浏览器标识。准确的边界是：

- Base64 只是编码，不是加密。
- 数据 URL 保存的是图像字节，不会直接列出 CPU 序列号或系统 ID。
- 环境差异会影响图像字节，因此结果可以成为指纹的一部分。
- 相同环境会碰撞，环境升级也会漂移，不能把它当作强身份凭证。

### 2.2 风险

- 用户未登录也可能被跨会话关联。
- 无法像 Cookie 一样直观查看和删除。
- 容易产生误判，把共享设备或相似环境当成同一人。
- 与账号、广告 ID、IP 等组合后，可形成更敏感的行为画像。

不得用浏览器指纹代替认证、风控结论或封禁证据。高影响决策必须有可解释的多信号策略、人工复核和申诉机制。

### 2.3 隐私友好的替代

只需要当前标签页内关联操作时，使用短期随机 ID，而不是稳定设备指纹：

```ts
// src/composables/useEphemeralSessionId.ts
import { readonly, shallowRef } from 'vue';

const storageKey = 'ephemeral-session-id';

export function useEphemeralSessionId() {
  const existing = sessionStorage.getItem(storageKey);
  const id = shallowRef(existing ?? crypto.randomUUID());

  if (!existing) {
    sessionStorage.setItem(storageKey, id.value);
  }

  return {
    id: readonly(id),
  };
}
```

`sessionStorage` 会在标签页会话结束后清理。若业务确实需要跨会话风控：

1. 完成隐私与法律评估。
2. 说明目的、信号类别、保留期限和用户权利。
3. 只收集解决当前风险所需的最少信号。
4. 不把原始高熵信号长期保存，限制访问和关联范围。
5. 提供退出、删除、纠错与申诉路径。

浏览器的抗指纹能力会降低或随机化这些差异。开发者不应尝试绕过用户的隐私保护。

## 3. 输入与凭据泄漏

### 3.1 “CSS 键盘记录器”的边界

纯 CSS 不能像 JavaScript 的 `input` 事件一样读取任意按键。CSS 属性选择器匹配的是 DOM Attribute；用户输入通常改变表单控件的 Value Property，不会自动同步成可枚举的 HTML Attribute。

某些旧框架行为、把值反射到 Attribute 的自定义组件、恶意第三方样式配合外部资源请求，可能形成字符泄漏通道。但风险不只属于 React，也不能由“换成 Vue”自动消失。

更现实的输入窃取来源是：

- 被注入的第三方 JavaScript。
- 恶意浏览器扩展或被攻陷的终端。
- XSS、供应链依赖和不受控 Tag Manager。
- 把密码写入日志、分析事件、URL、DOM Attribute 或错误报告。

本篇不提供收集或外传按键的实现。防御目标是减少能接触凭据的代码和数据通道。

### 3.2 Vue 登录表单

```vue
<script setup lang="ts">
import { reactive, shallowRef } from 'vue';

const form = reactive({
  username: '',
  password: '',
});
const submitting = shallowRef(false);
const error = shallowRef<string | null>(null);

async function submit() {
  submitting.value = true;
  error.value = null;

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      throw new Error('登录失败');
    }

    form.password = '';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录失败';
  } finally {
    form.password = '';
    submitting.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <label>
      账号
      <input
        v-model.trim="form.username"
        name="username"
        autocomplete="username"
        required
      >
    </label>

    <label>
      密码
      <input
        v-model="form.password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      >
    </label>

    <button type="submit" :disabled="submitting">
      登录
    </button>

    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>
```

注意：

- 不在 `console.log`、埋点、错误监控或 Pinia 持久化插件中记录表单。
- 不把密码放进 Query String、Route Params 或 DOM 的 `data-*` Attribute。
- 不用 `autocomplete="off"` 对抗密码管理器；正确的自动填充语义通常更安全。
- HTTPS 保护传输，服务端仍需限流、抗撞库、密码哈希、会话轮换和统一失败提示。
- 清空前端变量只能缩短暴露时间，不能对抗已控制浏览器或操作系统的恶意程序。

### 3.3 限制第三方代码

```nginx
# /etc/nginx/snippets/security-headers.conf
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
```

这是起点，不应直接照抄到所有站点。先用 Report-Only 收集违反项，移除内联脚本和不必要域名，再逐步强制。CSP 是纵深防御，不替代输出转义和依赖治理。把安全头集中在一个只包含 `add_header` 的 Snippet 中，可以在需要自己设置缓存头的 Location 内再次 Include，避免 Nginx 的继承规则悄悄丢掉 CSP。

## 4. 照片与 EXIF

### 4.1 EXIF 可能包含什么

照片元数据可能包含：

- 拍摄时间、设备厂商和型号。
- 焦距、曝光、方向、缩略图。
- GPS 经纬度、海拔和用户备注。
- 编辑软件与处理时间。

EXIF 常见于 JPEG/TIFF，其他格式也可能通过各自的元数据容器携带信息。不能用文件扩展名武断判断“必然没有位置”。

聊天或社交平台是否在“原图/压缩图”中保留元数据，取决于具体客户端、版本和处理链路。发送前应自行验证，不能把平台行为当成长期保证。

### 4.2 上传前重编码

浏览器可把用户选择的图像解码成像素，再生成新的文件；新的 Blob 通常不携带原始 EXIF：

```ts
export async function reencodeImage(
  source: File,
  type: 'image/jpeg' | 'image/webp' = 'image/jpeg',
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('当前浏览器不支持图像重编码');
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图像重编码失败'));
      },
      type,
      0.9,
    );
  });
}
```

```vue
<script setup lang="ts">
import { shallowRef } from 'vue';
import { reencodeImage } from '@/utils/reencodeImage';

const sanitized = shallowRef<Blob | null>(null);
const error = shallowRef<string | null>(null);

async function onFileChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  error.value = null;

  try {
    sanitized.value = await reencodeImage(file);
  } catch (cause) {
    sanitized.value = null;
    error.value = cause instanceof Error ? cause.message : '处理失败';
  }
}
</script>

<template>
  <label>
    选择准备上传的照片
    <input type="file" accept="image/jpeg,image/webp" @change="onFileChange">
  </label>

  <p v-if="sanitized">已生成去元数据副本</p>
  <p v-if="error" role="alert">{{ error }}</p>
</template>
```

客户端处理只是改善体验，服务端仍要：

1. 校验真实文件类型、尺寸和解码结果。
2. 使用受维护的图像库重新编码。
3. 设置像素、内存和处理时限，防止解压炸弹。
4. 生成新文件名，不信任用户路径。
5. 扫描恶意载荷，并隔离原始文件。
6. 明确是否需要保留方向、版权等必要元数据。

重编码会消耗 CPU、内存并可能改变画质；超大图片应限制尺寸或交给受控后端任务处理。

## 5. 蜜罐与诱饵系统

蜜罐是受控的诱饵资产，用于观察扫描、爆破或攻击行为。合法的防御性蜜罐必须：

- 部署在自己拥有或明确授权的网络。
- 与生产数据、凭据和管理平面隔离。
- 不存真实个人信息，不把用户数据当诱饵。
- 严格限制出站网络，防止被攻陷后攻击第三方。
- 记录访问时遵守通知、最小化和保留要求。
- 有停止、取证、告警和升级流程。
- 绝不“反向入侵”访问者。

Windows 日志和本地聊天目录可能包含账号、手机号等敏感信息。即使文件位于本机，这类数据也可能属于其他个人；未经数据主体和系统所有者授权，不应读取、解析、传输或复现。防御性处理链路应当是：

```text
诱饵被访问
   ↓
安全日志产生事件
   ↓
脱敏、限权、限时存储
   ↓
关联规则与人工复核
   ↓
修复真实系统，不攻击来源
```

### 5.1 表单蜜罐

网站表单中的隐藏字段也常被称为 Honeypot。它只能作为低风险反垃圾信号，不能单独证明用户恶意：

```vue
<script setup lang="ts">
import { reactive } from 'vue';

const form = reactive({
  email: '',
  companyWebsite: '',
});
</script>

<template>
  <form>
    <label>
      邮箱
      <input v-model.trim="form.email" type="email" autocomplete="email">
    </label>

    <label class="honeypot" aria-hidden="true">
      Company website
      <input
        v-model="form.companyWebsite"
        name="companyWebsite"
        tabindex="-1"
        autocomplete="off"
      >
    </label>
  </form>
</template>

<style scoped>
.honeypot {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
```

服务端可把非空 Honeypot 字段与提交速度、限流和信誉信号一起评估。不要把它用于采集额外个人信息，也不要向客户端泄漏内部判定细节。

## 6. 浏览器自动化

浏览器自动化适合：

- 自有应用的 E2E 测试。
- 已授权后台的重复操作。
- 无障碍、兼容性和视觉回归检查。
- 在许可范围内导出自己拥有的数据。

不应用于：

- 绕过验证码、登录、付费墙或反爬策略。
- 未经许可批量抓取第三方站点。
- 伪造流量、抢购、刷票、批量注册或账号接管。
- 收集第三方用户信息。

对第三方站点自动化前，必须确认书面授权、服务条款、robots/公开 API、速率限制、数据权利和删除要求。浏览器能访问不等于允许自动处理。

### 6.1 只测试自己的本地应用

```ts
// tests/login.spec.ts
import { expect, test } from '@playwright/test';

const testUsername = process.env.E2E_USERNAME;
const testPassword = process.env.E2E_PASSWORD;

if (!testUsername || !testPassword) {
  throw new Error('E2E_USERNAME and E2E_PASSWORD are required');
}

test('用户可以登录本地测试环境', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/login');

  await page.getByLabel('账号').fill(testUsername);
  await page.getByLabel('密码').fill(testPassword);
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: '控制台' }),
  ).toBeVisible();
});
```

测试账号只能存在于隔离环境；密码从 CI Secret 注入，不提交仓库。截图、Trace、HAR 和视频可能包含凭据或个人数据，失败产物同样要限权和定期删除。

稳定自动化应使用 Role、Label、Test ID 等语义定位，不依赖脆弱的随机 Class。等待可见状态或网络条件，不写任意 `sleep` 掩盖竞态。

## 7. 输入法与终端可信度

输入法通常拥有较高的输入权限。第三方输入法、键盘扩展和云联想功能可能扩大数据暴露面，但“聊天后看到相关推荐”本身不能证明输入法泄漏，广告推荐还可能来自账号关联、搜索、页面访问或其他数据源。

用户侧：

- 只安装可信来源的输入法，保持系统和应用更新。
- 审查通讯录、麦克风、照片、完全访问等权限。
- 敏感操作使用可信设备，异常时检查扩展、辅助功能和设备管理配置。
- 使用密码管理器、通行密钥和多因素认证，减少手工输入凭据。

开发侧：

- 使用原生 `type="password"`、正确的 `autocomplete` 和平台安全能力。
- 支付与银行卡输入优先接入合规支付 SDK 或 Hosted Fields。
- 不自己设计“加密键盘”替代成熟认证和支付系统。
- 自定义虚拟键盘最多减少普通输入法参与，无法对抗已控制 OS、屏幕录制、恶意扩展或应用内 XSS。

客户端终端一旦失陷，网页无法建立绝对安全边界，因此高风险操作还需要服务端二次确认、设备风险评估和交易限额。

## 8. OSI 与 TCP/IP

OSI 七层是分析模型，真实协议并不总能严格塞进一层：

| OSI 层 | 典型职责/例子 |
| --- | --- |
| 7 应用层 | HTTP、DNS、WebSocket、SMTP |
| 6 表示层 | 编码、序列化、压缩、部分加密概念 |
| 5 会话层 | 会话建立、恢复和管理概念 |
| 4 传输层 | TCP、UDP、QUIC |
| 3 网络层 | IP、ICMP、路由 |
| 2 数据链路层 | Ethernet Frame、MAC、VLAN |
| 1 物理层 | 电信号、光信号、无线介质 |

Web 工程更常用 TCP/IP 四层模型：

```text
应用层       HTTP / DNS / TLS / WebSocket
传输层       TCP / UDP / QUIC
网际层       IP / ICMP
网络接口层   Ethernet / Wi-Fi
```

需要校正的几个概念：

- MAC 地址是链路层地址，不是“12 位十六进制加数据包组成”。
- TCP 通过确认、重传、排序和流量/拥塞控制提供可靠字节流；可靠不等于安全。
- UDP 不建立 TCP 式连接，开销低，但应用可在其上实现可靠性，QUIC 就运行在 UDP 之上。
- TLS 跨越传统分层边界，为应用协议提供机密性、完整性和服务器身份认证。
- 端口属于传输协议的端点标识，不是“完成网络层后才随意开启”的抽象步骤。

## 9. HTTP/1.1 与 HTTP/2

### 9.1 HTTP/1.1

HTTP/1.1 支持持久连接，一个 TCP 连接可以承载多个请求；并不是每个请求都必须重新握手。浏览器通常会建立多个连接并复用。

### 9.2 HTTP/2

HTTP/2 的主要改进：

- 二进制分帧：把消息拆成有类型和长度的 Frame，便于协议解析与调度。
- 多路复用：同一连接上并发多个 Stream。
- HPACK 头部压缩：减少重复 Header 开销。
- Stream 优先级等调度能力。

“二进制比文本快”不是完整原因，因为网络最终本来就传输比特。关键在于明确的 Frame 结构让多路复用和高效解析成为可能。

HTTP/2 不自动加密数据。浏览器中的 HTTP/2 实践通常运行在 TLS 上，但协议能力与加密是两个概念。

HTTP/2 仍会受到单个 TCP 连接丢包的传输层队头阻塞。HTTP/3 基于 QUIC，让不同 Stream 在传输层更独立。

## 10. 浏览器缓存

### 10.1 强缓存

浏览器在新鲜期内直接使用本地副本，不向服务器确认：

```http
Cache-Control: public, max-age=31536000, immutable
```

适合文件名带内容哈希的静态资源。`Cache-Control` 是现代主要控制方式；`Expires` 是绝对时间，受时钟影响，通常作为兼容补充。

### 10.2 协商缓存

资源过期后，浏览器带验证器询问服务器：

```http
If-None-Match: "asset-hash"
If-Modified-Since: Sun, 13 Jul 2026 08:00:00 GMT
```

服务器可返回：

```http
HTTP/1.1 304 Not Modified
ETag: "asset-hash"
```

`ETag / If-None-Match` 通常比秒级时间精度的 `Last-Modified / If-Modified-Since` 更精确。304 不带完整响应体，但仍有网络往返。

### 10.3 敏感内容

认证、支付、个人资料等响应不能套用公共长缓存：

```http
Cache-Control: no-store
```

`no-cache` 表示复用前必须验证，不等于“不存储”；真正禁止存储用 `no-store`。共享缓存还需正确设置 `private`、`Vary`，避免把一个用户的响应交给另一个用户。

Vue 构建常用策略：

```nginx
server {
    include /etc/nginx/snippets/security-headers.conf;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        include /etc/nginx/snippets/security-headers.conf;
    }

    location = /index.html {
        add_header Cache-Control "no-cache" always;
        include /etc/nginx/snippets/security-headers.conf;
    }
}
```

只要某个层级声明了自己的 `add_header`，它默认就不会继承上级的 `add_header`。因此两个缓存 Location 都显式 Include 同一份安全头；修改后用 `nginx -t` 和真实响应头检查共同验证。

## 11. Vue 应用的防御基线

### 11.1 模板与 DOM

- 插值 `{{ value }}` 默认转义文本。
- 不对不可信内容使用 `v-html`。
- 确需富文本时，在受控边界使用成熟 Sanitizer，并配置允许列表。
- 不把用户输入拼进 `href`、`src`、Style、HTML 或脚本字符串。
- 外部链接使用合适的 `rel="noopener noreferrer"`。

```vue
<script setup lang="ts">
const props = defineProps<{
  displayName: string;
}>();
</script>

<template>
  <p>{{ props.displayName }}</p>
</template>
```

### 11.2 身份与请求

- 登录状态由服务端会话或可验证 Token 决定，不信任前端 Route Guard。
- Cookie 使用 `HttpOnly`、`Secure`、合适的 `SameSite`，并按架构配置 CSRF 防护。
- 敏感操作做重新认证、幂等和审计。
- 每个 API 在服务端执行资源级授权，不能只判断“已登录”。
- 错误响应不泄漏密钥、SQL、文件路径和内部堆栈。

### 11.3 依赖与构建

- 提交锁文件，CI 使用 `npm ci`。
- 审查依赖来源、维护状态、安装脚本和安全公告。
- Secret 不进入 `VITE_*`；所有注入前端构建的值最终都能被用户读取。
- Source Map、监控和分析 SDK 按数据敏感度配置。
- 第三方脚本最小化，能自托管时评估自托管，外部静态资源可配合 SRI。

### 11.4 上传、日志与遥测

- 上传文件按不可信二进制处理，限制大小、类型、数量和处理资源。
- 日志默认脱敏，不记录密码、Token、Cookie 和完整个人标识。
- 遥测必须有明确目的、数据字典、保留期限和访问控制。
- 删除账号时同步处理业务库、对象存储、搜索索引和可识别日志。

## 12. 安全事件处理

发现疑似指纹滥用、凭据泄漏或隐私数据外传时：

1. 停止相关采集或第三方脚本，保留最小必要证据。
2. 轮换密钥、撤销 Session/Token，隔离受影响服务。
3. 明确数据类型、用户范围、时间窗口和传播路径。
4. 按法规与组织流程通知安全、隐私、法务和受影响用户。
5. 修复根因并增加可验证的回归测试。
6. 删除不再需要的泄漏副本和临时调查数据。
7. 复盘检测缺口、权限边界和供应链变更流程。

不要为了“取证”继续无边界收集更多个人数据。

Web 安全不是若干“神奇脚本”的集合。可靠的实践是：先确认授权和资产，再缩小数据与执行权限，最后用服务端控制、浏览器策略、日志和测试组成纵深防御。

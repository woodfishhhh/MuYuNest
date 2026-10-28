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

> 授权边界：这一篇只讨论自己拥有、或者拿到了明确书面授权的系统、数据和测试环境。不能采集别人的凭据、设备指纹、聊天数据、手机号或位置，不能绕过登录、验证码、访问控制、服务条款或反自动化措施。做安全研究是为了降低风险，不是把风险复现到无关的用户身上。

## 1. 先建立威胁模型

做安全功能不能从"能不能写出脚本"开始，先回答这几个问题：

1. 资产：账号、密码、Session、照片、位置、业务数据、日志。
2. 主体：普通用户、管理员、第三方脚本、浏览器扩展、内部人员。
3. 入口：表单、上传、依赖、API、自动化工具、日志平台。
4. 信任边界：浏览器和服务端、应用和第三方、生产和测试。
5. 后果：身份被盗用、隐私泄漏、越权、错误封禁、业务中断。
6. 控制：最少收集、明确同意、隔离、校验、审计、删除和响应。

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

XSS 和 CSRF 是两类问题：

- XSS：不可信的内容被当成脚本执行了。
- CSRF：浏览器带着用户现有的凭据，向目标站点发出了用户没同意的请求。

两者可能一起出现，但不是一回事。

## 2. Canvas 指纹

### 2.1 原理

同一段 Canvas 绘制代码，在不同环境里画出来的像素可能有细微差别，影响因素有：

- 浏览器和图形库的版本。
- 操作系统、字体和字体回退。
- GPU、驱动、抗锯齿和色彩管理。
- 缩放、语言和无障碍设置。

站点把渲染结果或它的哈希和别的信号组合起来，得到一个概率性的标识。它可能把多次访问关联起来，但不是可靠的"设备唯一 ID"。

`canvas.toDataURL()` 返回的 Base64 数据里，并不直接包含设备、系统或浏览器的标识。准确的边界是：

- Base64 只是编码，不是加密。
- 数据 URL 存的是图像字节，不会直接列出 CPU 序列号或系统 ID。
- 环境差异会影响图像字节，所以结果能成为指纹的一部分。
- 相同的环境会撞车，环境一升级又会漂移，不能把它当成强身份凭证。

### 2.2 风险

- 用户没登录也可能被跨会话关联起来。
- 没法像 Cookie 那样直观地查看和删除。
- 容易误判，把共用设备或环境相似的人当成同一个人。
- 和账号、广告 ID、IP 这些组合起来，会形成更敏感的行为画像。

不能用浏览器指纹代替认证、风控结论或封禁证据。影响大的决策一定要有能解释的多信号策略、人工复核和申诉机制。

### 2.3 隐私友好的替代

只需要在当前标签页里关联操作的话，用一个短期的随机 ID，别用稳定的设备指纹：

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

`sessionStorage` 会在标签页会话结束后清掉。业务上确实需要跨会话风控的话：

1. 先做隐私和法律评估。
2. 说明目的、信号类别、保留期限和用户的权利。
3. 只收集解决当前风险需要的最少信号。
4. 不长期保存原始的高熵信号，限制访问和关联的范围。
5. 提供退出、删除、纠错和申诉的途径。

浏览器的抗指纹能力会削弱或随机化这些差异。开发者不该去绕过用户的隐私保护。

## 3. 输入与凭据泄漏

### 3.1 “CSS 键盘记录器”的边界

纯 CSS 没法像 JavaScript 的 `input` 事件那样读到任意按键。CSS 属性选择器匹配的是 DOM Attribute；用户输入一般改的是表单控件的 Value Property，不会自动同步成能枚举的 HTML Attribute。

某些旧框架的行为、把值反射到 Attribute 上的自定义组件、恶意的第三方样式配合外部资源请求，可能形成泄漏字符的通道。但这个风险不只属于 React，也不会因为"换成 Vue"就自动消失。

更现实的输入窃取来源是：

- 被注入的第三方 JavaScript。
- 恶意的浏览器扩展，或者被攻陷的终端。
- XSS、供应链依赖和不受控的 Tag Manager。
- 把密码写进了日志、分析事件、URL、DOM Attribute 或错误报告。

这一篇不提供收集或外传按键的实现。防御的目标是减少能碰到凭据的代码和数据通道。

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

- 别在 `console.log`、埋点、错误监控或 Pinia 持久化插件里记录表单。
- 别把密码放进 Query String、Route Params 或 DOM 的 `data-*` Attribute。
- 别用 `autocomplete="off"` 去对抗密码管理器；正确的自动填充语义一般更安全。
- HTTPS 保护的是传输，服务端还是要限流、防撞库、做密码哈希、轮换会话、统一失败提示。
- 清空前端变量只能缩短暴露的时间，对付不了已经控制了浏览器或操作系统的恶意程序。

### 3.3 限制第三方代码

```nginx
# /etc/nginx/snippets/security-headers.conf
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
```

这只是起点，别直接照抄到所有站点。先用 Report-Only 收集违规项，去掉内联脚本和不必要的域名，再逐步强制执行。CSP 是纵深防御的一层，代替不了输出转义和依赖治理。把安全头集中放在一个只含 `add_header` 的 Snippet 里，在需要自己设缓存头的 Location 里可以再 Include 一次，免得 Nginx 的继承规则悄悄把 CSP 丢掉。

## 4. 照片与 EXIF

### 4.1 EXIF 可能包含什么

照片的元数据里可能有：

- 拍摄时间、设备厂商和型号。
- 焦距、曝光、方向、缩略图。
- GPS 经纬度、海拔和用户备注。
- 编辑软件和处理时间。

EXIF 常见于 JPEG/TIFF，其他格式也可能用各自的元数据容器带着信息。不能看文件扩展名就武断地认为"肯定没有位置"。

聊天或社交平台在"原图/压缩图"里会不会保留元数据，取决于具体的客户端、版本和处理链路。发送前自己验证一下，别把平台的行为当成长期的保证。

### 4.2 上传前重编码

浏览器可以把用户选的图片解码成像素，再生成一个新文件；新的 Blob 一般不会带着原始的 EXIF：

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

客户端处理只是改善体验，服务端还是要：

1. 校验真实的文件类型、尺寸和解码结果。
2. 用还在维护的图像库重新编码。
3. 限制像素、内存和处理时间，防解压炸弹。
4. 生成新的文件名，不信任用户给的路径。
5. 扫描恶意载荷，隔离原始文件。
6. 想清楚要不要保留方向、版权这些必要的元数据。

重编码会耗 CPU、内存，还可能改变画质；特别大的图片要限制尺寸，或者交给受控的后端任务处理。

## 5. 蜜罐与诱饵系统

蜜罐是一个受控的诱饵资产，用来观察扫描、爆破或攻击行为。合法的防御性蜜罐必须：

- 部署在自己拥有、或者明确授权的网络里。
- 和生产数据、凭据、管理平面隔离开。
- 不存真实的个人信息，不拿用户数据当诱饵。
- 严格限制出站网络，免得被攻陷后拿去攻击第三方。
- 记录访问时遵守通知、最少化和保留期限的要求。
- 有停止、取证、告警和升级的流程。
- 绝不"反向入侵"访问者。

Windows 日志和本地的聊天目录里可能有账号、手机号这些敏感信息。就算文件在本机上，这些数据也可能属于别人；没有数据主体和系统所有者的授权，不该读取、解析、传输或复现。防御性的处理链路应该是：

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

网站表单里的隐藏字段也常被叫作 Honeypot。它只能当一个低风险的反垃圾信号，单靠它证明不了用户是恶意的：

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

服务端可以把非空的 Honeypot 字段和提交速度、限流、信誉信号放在一起评估。别拿它来采集额外的个人信息，也别向客户端泄漏内部的判定细节。

## 6. 浏览器自动化

浏览器自动化适合：

- 自有应用的 E2E 测试。
- 已授权后台的重复操作。
- 无障碍、兼容性和视觉回归检查。
- 在许可范围内导出自己的数据。

不该用来：

- 绕过验证码、登录、付费墙或反爬策略。
- 没经许可批量抓取第三方站点。
- 伪造流量、抢购、刷票、批量注册或者接管账号。
- 收集第三方用户的信息。

对第三方站点做自动化之前，一定要确认书面授权、服务条款、robots/公开 API、速率限制、数据权利和删除要求。浏览器能访问，不代表允许自动处理。

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

测试账号只能存在于隔离的环境里；密码从 CI Secret 注入，不提交进仓库。截图、Trace、HAR 和视频里可能有凭据或个人数据，失败的产物同样要限制权限、定期删除。

稳定的自动化要用 Role、Label、Test ID 这类语义化的定位，别依赖脆弱的随机 Class。等可见状态或网络条件，别写一个随意的 `sleep` 掩盖竞态。

## 7. 输入法与终端可信度

输入法一般有很高的输入权限。第三方输入法、键盘扩展和云联想功能可能扩大数据的暴露面，但"聊完天就看到相关推荐"本身证明不了是输入法泄漏的，广告推荐也可能来自账号关联、搜索、页面访问或者别的数据源。

用户这边：

- 只装可信来源的输入法，系统和应用保持更新。
- 检查通讯录、麦克风、照片、完全访问这些权限。
- 敏感操作用可信的设备，出现异常时检查扩展、辅助功能和设备管理配置。
- 用密码管理器、通行密钥和多因素认证，少手动输入凭据。

开发这边：

- 用原生的 `type="password"`、正确的 `autocomplete` 和平台的安全能力。
- 支付和银行卡输入优先接合规的支付 SDK 或 Hosted Fields。
- 别自己设计一个"加密键盘"来代替成熟的认证和支付系统。
- 自定义的虚拟键盘最多只能让普通输入法少参与一点，对付不了已经控制了 OS、屏幕录制、恶意扩展或应用内的 XSS。

客户端终端一旦被攻陷，网页就没法建立绝对的安全边界，所以高风险操作还要服务端二次确认、设备风险评估和交易限额。

## 8. OSI 与 TCP/IP

OSI 七层是一个分析模型，真实的协议不一定能严格塞进某一层：

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

要纠正的几个概念：

- MAC 地址是链路层地址，不是"12 位十六进制加数据包组成"。
- TCP 靠确认、重传、排序和流量/拥塞控制提供可靠的字节流；可靠不等于安全。
- UDP 不建立 TCP 那样的连接，开销小，但应用可以在它上面自己实现可靠性，QUIC 就跑在 UDP 上。
- TLS 跨越了传统的分层边界，给应用协议提供机密性、完整性和服务器身份认证。
- 端口是传输协议的端点标识，不是"网络层做完以后随便开启"的抽象步骤。

## 9. HTTP/1.1 与 HTTP/2

### 9.1 HTTP/1.1

HTTP/1.1 支持持久连接，一个 TCP 连接能承载多个请求；不是每个请求都得重新握手。浏览器一般会建好几个连接并复用。

### 9.2 HTTP/2

HTTP/2 的主要改进：

- 二进制分帧：把消息拆成有类型、有长度的 Frame，方便协议解析和调度。
- 多路复用：同一个连接上并发多个 Stream。
- HPACK 头部压缩：减少重复 Header 的开销。
- Stream 优先级这类调度能力。

"二进制比文本快"不是完整的原因，网络最后传的本来就是比特。关键在于明确的 Frame 结构，让多路复用和高效解析成为可能。

HTTP/2 不会自动加密数据。浏览器里的 HTTP/2 一般跑在 TLS 上，但协议能力和加密是两个概念。

HTTP/2 还是会受到单个 TCP 连接丢包带来的传输层队头阻塞。HTTP/3 基于 QUIC，让不同的 Stream 在传输层更独立。

## 10. 浏览器缓存

### 10.1 强缓存

在新鲜期内，浏览器直接用本地的副本，不去问服务器：

```http
Cache-Control: public, max-age=31536000, immutable
```

适合文件名带内容哈希的静态资源。`Cache-Control` 是现代主要的控制方式；`Expires` 是绝对时间，受时钟影响，一般只当兼容的补充。

### 10.2 协商缓存

资源过期以后，浏览器带着验证器去问服务器：

```http
If-None-Match: "asset-hash"
If-Modified-Since: Sun, 13 Jul 2026 08:00:00 GMT
```

服务器可以返回：

```http
HTTP/1.1 304 Not Modified
ETag: "asset-hash"
```

`ETag / If-None-Match` 一般比秒级精度的 `Last-Modified / If-Modified-Since` 更准。304 不带完整的响应体，但还是有一次网络往返。

### 10.3 敏感内容

认证、支付、个人资料这些响应，不能套用公共的长缓存：

```http
Cache-Control: no-store
```

`no-cache` 的意思是复用前必须验证，不等于"不存储"；真要禁止存储得用 `no-store`。共享缓存还要正确设置 `private`、`Vary`，免得把一个用户的响应交给另一个用户。

Vue 构建常用的策略：

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

某一层只要声明了自己的 `add_header`，默认就不会继承上一层的 `add_header`。所以两个缓存 Location 都显式 Include 同一份安全头；改完用 `nginx -t` 加真实的响应头一起验证。

## 11. Vue 应用的防御基线

### 11.1 模板与 DOM

- 插值 `{{ value }}` 默认会转义文本。
- 不可信的内容别用 `v-html`。
- 确实需要富文本时，在受控的边界用成熟的 Sanitizer，并配好允许列表。
- 别把用户输入拼进 `href`、`src`、Style、HTML 或脚本字符串。
- 外部链接加上合适的 `rel="noopener noreferrer"`。

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

- 登录状态由服务端会话或可验证的 Token 决定，不信任前端的 Route Guard。
- Cookie 用 `HttpOnly`、`Secure` 和合适的 `SameSite`，并按架构配好 CSRF 防护。
- 敏感操作要重新认证、做幂等、留审计。
- 每个 API 都在服务端做资源级的授权，不能只判断"登录了没有"。
- 错误响应不泄漏密钥、SQL、文件路径和内部堆栈。

### 11.3 依赖与构建

- 提交锁文件，CI 用 `npm ci`。
- 审查依赖的来源、维护状态、安装脚本和安全公告。
- Secret 不进 `VITE_*`；所有注入前端构建的值，最后用户都能读到。
- Source Map、监控和分析 SDK 按数据的敏感程度配置。
- 第三方脚本尽量少，能自托管的就评估一下自托管，外部的静态资源可以配合 SRI。

### 11.4 上传、日志与遥测

- 上传的文件当成不可信的二进制处理，限制大小、类型、数量和处理资源。
- 日志默认脱敏，不记密码、Token、Cookie 和完整的个人标识。
- 遥测要有明确的目的、数据字典、保留期限和访问控制。
- 删除账号时，业务库、对象存储、搜索索引和能识别出个人的日志都要一起处理。

## 12. 安全事件处理

发现疑似指纹滥用、凭据泄漏或隐私数据外传时：

1. 停掉相关的采集或第三方脚本，保留最少的必要证据。
2. 轮换密钥，撤销 Session/Token，隔离受影响的服务。
3. 搞清楚数据类型、用户范围、时间窗口和传播路径。
4. 按法规和组织流程，通知安全、隐私、法务和受影响的用户。
5. 修掉根因，并加上能验证的回归测试。
6. 删掉不再需要的泄漏副本和临时的调查数据。
7. 复盘检测上的缺口、权限边界和供应链的变更流程。

别为了"取证"继续没有边界地收集更多个人数据。

Web 安全不是几段"神奇脚本"凑起来的。可靠的做法是：先确认授权和资产，再收窄数据和执行权限，最后用服务端控制、浏览器策略、日志和测试组成纵深防御。

---
title: Web 安全与隐私基础：XSS/CSRF、凭据防护、浏览器指纹与 EXIF
slug: web-security-and-privacy
date: 2026-07-13
categories:
  - 工程实践
tags:
  - Web 安全
  - XSS
  - CSRF
  - 浏览器指纹
  - EXIF
---

前端安全与用户隐私往往因为“表面看起来能跑”而被顺手跳过：富文本直接塞进 `v-html`、密码表单混进了前端日志、用户上传的照片原样带着经纬度挂上 CDN，或者用一条 `add_header` 覆盖掉了 Nginx 整站的安全响应头。把常见攻击路径、数据泄露通道和可落地的工程防线拆开看，每一环都能用明确的配置和代码封死。

## XSS 与 CSRF 的攻击路径和纵深防线

做任何防护前先划清这两类高频漏洞的根本差异：

- **XSS（跨站脚本攻击）**：不可信的外部输入绕过转义被浏览器当成脚本执行，攻击者借当前页面的脚本上下文读取 DOM、本地存储并冒充用户发起请求。
- **CSRF（跨站请求伪造）**：攻击站点诱导用户浏览器向目标站点发送请求，浏览器自动附带目标域名下的现有 Cookie 凭据，使服务端误以为是用户本人发起的合法操作。

### 1. 模板转义与 CSP 安全头

现代前端框架的插值语法（如 Vue 的 `{{ value }}` 或 React JSX 文本节点）默认会对文本做 HTML 转义，但只要出现 `v-html`、`dangerouslySetInnerHTML` 或把用户输入直接拼进 `href="javascript:..."`、`src`、内联样式里，XSS 入口就会立刻敞开。外部富文本必须先经过成熟的 HTML Sanitizer 白名单清洗再渲染，站外跳转链接补充 `rel="noopener noreferrer"`。

服务端和网关层还需要叠加上 **Content-Security-Policy（CSP）** 作为纵深防线，把不可信的脚本加载和内联脚本直接掐断在浏览器执行前：

```nginx
# /etc/nginx/snippets/security-headers.conf
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
```

**上线 CSP 时务必先开启 `Content-Security-Policy-Report-Only` 观察线上违规上报、清理掉不必要的内联脚本后再切换为强制拦截；同时在 Nginx 中要小心 `add_header` 的覆盖陷阱。**

Nginx 有一个极易踩中的继承规则：只要某个 `location` 块里自己声明了任何一条 `add_header`（例如给 `/assets/` 配 `Cache-Control`），该 `location` 就**不会继承**外层 `server` 块定义的任何 `add_header`。因此安全头 Snippet 必须在每个单独设置了缓存头的 `location` 里显式 `include` 一次：

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

### 2. 浏览器缓存与凭据安全

对认证、个人资料和支付接口的响应，禁止套用常规静态缓存。**`Cache-Control: no-cache` 的真实语义是“复用缓存前必须回源验证”，仍会落盘存储；涉及敏感数据的接口必须返回 `Cache-Control: no-store` 彻底禁止浏览器或代理留存响应体**，共享缓存还需配合 `private` 和 `Vary` 防止不同用户的响应互相串台。

针对 CSRF 与会话劫持：

- 认证凭据优先存放在带 `HttpOnly`、`Secure` 与合理 `SameSite`（如 `Lax` 或 `Strict`）属性的 Cookie 中，杜绝脚本通过 `document.cookie` 窃取；状态变更类接口配合 CSRF Token 或双重校验机制，不依赖前端路由守卫充当授权判断。
- 每个接口在服务端单独做**资源级归属鉴权**，高风险操作追加二次认证和幂等限制；错误响应禁止回传内部 SQL、文件路径或完整异常堆栈。

## 输入凭据防护与表单反垃圾信号

常有讨论提到“纯 CSS 键盘记录器”能用属性选择器 `input[value$="a"]` 结合背景图片请求偷密码。实际浏览器行为里，用户键入改的是 DOM 元素的 `value` Property，并不会自动同步回 HTML `value` Attribute；只有某些旧框架或把受控输入值显式反射回 DOM Attribute 的自定义组件，叠加恶意第三方 CSS 时才可能形成侧信道。

**现实中窃取输入凭据的主要路径集中在被注入的第三方脚本（XSS/供应链投毒/失控的统计标签）、恶意浏览器扩展，以及开发团队自己把明文密码打进了错误监控、URL 参数或状态持久化插件。**

编写登录表单时守住下面几条基线即可显著收窄暴露面：

```vue
<script setup lang="ts">
import { reactive, shallowRef } from 'vue'

const form = reactive({
  username: '',
  password: '',
})
const submitting = shallowRef(false)
const error = shallowRef<string | null>(null)

async function submit() {
  submitting.value = true
  error.value = null

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(form),
    })
    if (!response.ok) throw new Error('登录失败')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录失败'
  } finally {
    form.password = ''
    submitting.value = false
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
      />
    </label>

    <label>
      密码
      <input
        v-model="form.password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      />
    </label>

    <button type="submit" :disabled="submitting">登录</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>
```

- 保持原生的 `type="password"` 与语义化的 `autocomplete`，不要为了防自动填充去写 `autocomplete="off"` 对抗密码管理器，也不要自行发明“虚拟加密键盘”替代合规支付 SDK（终端 OS 或扩展已被控制时，虚拟键盘同样会被截屏或劫持）。
- 密码变量严禁进入 `console.log`、埋点、错误堆栈、Query String 或 Pinia 持久化白名单。
- 前端清空变量只是缩短内存驻留窗口，防撞库、限流、密码哈希和会话轮换必须由服务端兜底。

对于注册或评论表单中的自动化脚本骚扰，可以加入一个视觉隐藏且带 `aria-hidden="true"` 和 `tabindex="-1"` 的蜜罐字段（如 `companyWebsite`）。正常用户和读屏软件都不会去填它，而盲目填充全字段的脚本会填入值；服务端将其作为一个低风险反垃圾信号，结合提交速率与限流一起判定，不要仅凭单个字段就误杀用户。

## Canvas 浏览器指纹原理与隐私友好替代

同一段 Canvas 绘图代码在不同机器上渲染出的像素字节往往存在细微差异，影响因素包括浏览器引擎版本、系统字体回退、GPU 驱动、抗锯齿算法与屏幕缩放比。`canvas.toDataURL()` 吐出的 Base64 本身只是编码后的像素字节，里面并没有写着 CPU 序列号，但把像素结果求哈希后再结合其他环境特征，就能算出一个概率性的跨会话标识。

**浏览器指纹既可能在不同用户（同款系统硬件）之间发生碰撞，也会随着系统升级发生漂移，因此不能作为强身份凭证或封禁唯一依据；同时主流浏览器的隐私防护会主动对 Canvas 像素加噪随机化。**

如果业务仅仅需要在当前标签页内关联操作链路（如把一次表单多步操作串联到同一条排错轨迹），直接用 `sessionStorage` + `crypto.randomUUID()` 生成临时会话 ID，标签页关闭即自动销毁，无需采集高熵设备指纹：

```ts
// src/composables/useEphemeralSessionId.ts
import { readonly, shallowRef } from 'vue'

const storageKey = 'ephemeral-session-id'

export function useEphemeralSessionId() {
  const existing = sessionStorage.getItem(storageKey)
  const id = shallowRef(existing ?? crypto.randomUUID())

  if (!existing) {
    sessionStorage.setItem(storageKey, id.value)
  }

  return { id: readonly(id) }
}
```

## 图片 EXIF 元数据风险与前端剥离实践

手机拍摄的 JPEG/TIFF 照片通常会携带丰富的 EXIF 元数据：拍摄精确时间、设备厂商与型号、焦距光圈，甚至 **GPS 经纬度与海拔**。很多社交平台对普通压缩图和“原图”的处理策略不一致，直接把用户原图分发到公网 CDN 极易暴露拍摄者行踪。

前端在上传前利用 `createImageBitmap()` 将源文件解码成纯像素画布，再通过 `canvas.toBlob()` 重新编码生成新文件，生成的 Blob 会剥离原始 EXIF 容器：

```ts
export async function reencodeImage(
  source: File,
  type: 'image/jpeg' | 'image/webp' = 'image/jpeg',
): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('当前浏览器不支持图像重编码')
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图像重编码失败'))
      },
      type,
      0.9,
    )
  })
}
```

**客户端重编码只能作为体验与第一道预处理，所有绕过前端直传接口的文件依然不可信；服务端必须在隔离沙箱内校验魔数与真实解码尺寸、限制最大像素防解压炸弹（Decompression Bomb），并用维护中的图像处理库（如 Sharp/libvips）重编码并生成全新随机文件名。**

## 工程安全基线与事件响应顺序

日常构建与运维守住三项基础设施底线即可挡住绝大多数常见隐患：锁死依赖 lockfile、CI 使用 `npm ci` 并定期审计公告；前端环境变量里绝不出现任何 Secret；日志默认对密码、Token、Cookie 和个人敏感字段脱敏，并在账号注销时联动清理业务库、对象存储与检索索引。

一旦监控发现凭据泄露或可疑数据外传，按以下顺序收敛风险：

1. **止血**：立即下线可疑第三方脚本或受影响接口，留存最小必要排查日志（切勿以“取证”为由继续过度采集用户隐私）。
2. **轮换与隔离**：撤销现有 Session/Token、轮换泄露密钥并隔离受影响节点。
3. **定界与修复**：确认影响的时间窗口、数据范围与传播路径，修复根因并补充回归测试，同时按合规流程通知相关方。

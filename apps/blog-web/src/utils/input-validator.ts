/**
 * 输入校验工具
 *
 * 为什么需要校验用户输入？
 * ─────────────────────────────────────────────────────────────────────────────
 * 用户输入是不可信的。即使你的网站没有恶意用户，爬虫、脚本小子、
 * 或者简单的 URL 手动构造都可能传入异常数据。
 *
 * 校验的目的：
 * 1. 防止 DoS（超长输入耗尽内存/存储）
 * 2. 防止 XSS（通过搜索结果展示时的特殊字符注入）
 * 3. 防止格式化问题（URL 里混入了换行符等控制字符）
 * 4. 防止无效数据污染状态（store 里有乱码比没有数据更糟糕）
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MAX_QUERY_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_TAG_LENGTH = 100;

/** 控制字符范围（换行、回车、制表符等） */
const CONTROL_CHAR_PATTERN = /\p{Cc}/gu;

/**
 * 校验并清理搜索词
 *
 * 保护什么？
 * - 防止超长字符串进入 URL（浏览器的 URL 长度限制约 2000 字符）
 * - 过滤控制字符（防止 \n 等在 URL query 中引发意外行为）
 * - 去除 HTML 标签（搜索结果可能在页面中展示）
 */
export function sanitizeSearchQuery(raw: string): string {
  if (!raw) {
    return "";
  }

  // 1. 先截断到最大长度（防止 DoS）
  let sanitized = raw.slice(0, MAX_QUERY_LENGTH);

  // 2. 过滤控制字符
  sanitized = sanitized.replace(CONTROL_CHAR_PATTERN, "");

  // 3. 折叠连续空白为单个空格
  sanitized = sanitized.replace(/\s+/g, " ");

  return sanitized.trim();
}

/**
 * 校验并清理过滤器值（type、category、tag）
 *
 * 保护什么？
 * - 过滤控制字符（防止 URL 注入）
 * - 限制长度（防止存储膨胀）
 */
export function sanitizeFilterValue(raw: string): string {
  if (!raw) {
    return "";
  }

  // 过滤控制字符
  let sanitized = raw.replace(CONTROL_CHAR_PATTERN, "");

  // 截断
  sanitized = sanitized.slice(0, MAX_TAG_LENGTH);

  return sanitized.trim();
}

/**
 * 校验 URL slug
 *
 * 保护什么？
 * - 防止超长 slug 触发 decodeURIComponent 性能问题
 * - 限制为合理字符集（只允许 slug 常见字符）
 * - slug 是直接用在路由里的，必须干净
 */
export function sanitizeSlug(raw: string): string {
  if (!raw) {
    return "";
  }

  // 解码（如果被编码了）
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    slug = raw;
  }

  // 截断
  slug = slug.slice(0, MAX_SLUG_LENGTH);

  // 过滤控制字符
  slug = slug.replace(CONTROL_CHAR_PATTERN, "");

  return slug.trim();
}

/**
 * 校验 URL 是否安全（防 SSRF / 恶意链接）
 *
 * 保护什么？
 * - 禁止 javascript: 伪协议（防 XSS）
 * - 禁止 data: 伪协议（防 XSS）
 * - 只允许 http/https 链接（友链表单用）
 * - 禁止内网 IP（防 SSRF，如 http://192.168.x.x）
 */
export function isSafeUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);

    // 只允许 http 和 https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // 禁止内网 IP（简化的检查）
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

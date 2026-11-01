export interface CardBase {
  id: string;
  title: string;
  date?: string;
}
export interface TextCard extends CardBase {
  type: "text";
  text: string;
  paper: "warm" | "white" | "dark";
  align: "left" | "center";
}
export interface ImageCard extends CardBase {
  type: "image";
  src: string;
  alt: string;
  caption: string;
  description?: string;
  frame: "white" | "black" | "wood";
  fit: "contain" | "cover";
  aspectRatio?: number;
}
export type ContentCard = TextCard | ImageCard;

export function formatCardHeading(card: CardBase) {
  return card.date ? `${card.title} - ${card.date.replaceAll("-", ".")}` : card.title;
}

export function isImageSource(source: string) {
  if (source.startsWith("local:")) return /^local:[\w\u0080-\uffff ./-]+\.(png|jpe?g|webp|avif|gif|svg)$/i.test(source) && !source.includes("..");
  if (source.startsWith("/")) return !source.startsWith("//") && !source.includes("\\");
  try { return ["https:", "http:"].includes(new URL(source).protocol); } catch { return false; }
}

export function parseCardConfig(input: unknown): { cards: ContentCard[]; issues: string[] } {
  const cards: ContentCard[] = [];
  const issues: string[] = [];
  if (!input || typeof input !== "object" || !Array.isArray((input as Record<string, unknown>).cards)) {
    return { cards, issues: ["home-cards.json 必须包含 cards 数组。"] };
  }
  if ((input as Record<string, unknown>).version !== 1) return { cards, issues: ["卡片配置 version 必须为 1。"] };
  const ids = new Set<string>();
  for (const [index, value] of (input as { cards: unknown[] }).cards.entries()) {
    try {
      if (!value || typeof value !== "object") throw new Error("必须是一个卡片对象");
      const item = value as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id.trim()) throw new Error("缺少唯一 id");
      if (ids.has(item.id)) throw new Error(`id 重复：${item.id}`);
      ids.add(item.id);
      if (item.enabled !== undefined && typeof item.enabled !== "boolean") throw new Error("enabled 必须为 true 或 false");
      if (item.enabled === false) continue;
      const title = item.title === undefined ? "无题" : item.title;
      if (typeof title !== "string" || !title.trim()) throw new Error("title 必须为文字；无题时填“无题”或省略");
      const date = item.date;
      if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("date 必须是有效的 YYYY-MM-DD 日期");
      const base: CardBase = { id: item.id, title, ...(date ? { date: date as string } : {}) };
      const choice = <T extends string>(key: string, allowed: T[], fallback: T): T => {
        const value = item[key] ?? fallback;
        if (!allowed.includes(value as T)) throw new Error(`${key} 只能是 ${allowed.join(" / ")}`);
        return value as T;
      };
      if (item.type === "text") {
        const text = Array.isArray(item.text) && item.text.every(line => typeof line === "string") ? item.text.join("\n") : item.text;
        if (typeof text !== "string" || !text.trim()) throw new Error("文字卡片需要 text 字符串或逐行数组");
        cards.push({ ...base, type: "text", text, paper: choice("paper", ["warm", "white", "dark"], "warm"),
          align: choice("align", ["left", "center"], "center") });
      } else if (item.type === "image") {
        if (typeof item.src !== "string" || !isImageSource(item.src)) throw new Error("图片 src 需要 local:文件名、站内 /路径或 http(s) 地址");
        for (const key of ["alt", "caption", "description"]) if (item[key] !== undefined && typeof item[key] !== "string") throw new Error(`${key} 必须是文字`);
        if (item.aspectRatio !== undefined && (typeof item.aspectRatio !== "number" || !Number.isFinite(item.aspectRatio) || item.aspectRatio < 0.4 || item.aspectRatio > 2.5)) throw new Error("aspectRatio 范围为 0.4～2.5");
        cards.push({ ...base, type: "image", src: item.src, alt: (item.alt as string) ?? title,
          caption: (item.caption as string) ?? "", description: (item.description as string) ?? (item.caption as string) ?? "", frame: choice("frame", ["white", "black", "wood"], "white"),
          fit: choice("fit", ["contain", "cover"], "contain"), ...(item.aspectRatio ? { aspectRatio: item.aspectRatio as number } : {}) });
      } else throw new Error("type 必须是 text 或 image");
    } catch (error) {
      issues.push(`第 ${index + 1} 张卡片：${(error as Error).message}`);
    }
  }
  return { cards, issues };
}

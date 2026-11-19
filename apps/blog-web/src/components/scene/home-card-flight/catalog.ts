import { getBaseUrl } from "@/utils/base-url";
import config from "@/content/home-cards.json";
import { parseCardConfig } from "./card-config";

const parsed = parseCardConfig(config);
export const catalog = parsed.cards;
export const catalogIssues = parsed.issues;
const localPhotos = import.meta.glob<string>("../../../assets/home-flight/photos/**/*.{jpg,jpeg,png,webp,avif,gif,svg}", {
  eager: true, query: "?url", import: "default",
});

export function resolveImageSource(source: string) {
  if (source.startsWith("local:")) {
    const url = localPhotos[`../../../assets/home-flight/photos/${source.slice(6)}`];
    if (!url) throw new Error(`找不到本地图片：${source.slice(6)}`);
    return url;
  }
  if (source.startsWith("/")) return `${getBaseUrl().replace(/\/$/, "")}${source}`;
  return source;
}

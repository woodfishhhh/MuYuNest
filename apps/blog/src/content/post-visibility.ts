import seriesConfig from "./docs-series.json";
import type { PostSummary } from "@/types/content";

const hiddenSlugs = new Set(seriesConfig.filter((series) => series.hidden).flatMap((series) => series.slugs));

// Hide from discovery, while preserving article URLs and alias resolution.
export function visiblePostSummaries(posts: PostSummary[]): PostSummary[] {
  return posts.filter((post) => !hiddenSlugs.has(post.canonicalSlug));
}

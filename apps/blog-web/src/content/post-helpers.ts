import type { PostSummary } from "@/types/content";

export function resolvePostSlugFromIndex(
  posts: readonly PostSummary[],
  slug: string,
): string | null {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return null;
  }

  for (const post of posts) {
    if (post.canonicalSlug === normalizedSlug) {
      return post.canonicalSlug;
    }

    if (post.aliases.includes(normalizedSlug)) {
      return post.canonicalSlug;
    }
  }

  return null;
}

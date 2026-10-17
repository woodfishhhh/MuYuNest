import type { PostArticle, PostSummary } from "@/types/content";
import { getBaseUrl } from "@/utils/base-url";
import { normalizeContentPayload } from "./content-url-normalizer";
import { resolvePostSlugFromIndex } from "./post-helpers";
import { visiblePostSummaries } from "./post-visibility";

const postModules = import.meta.glob<{ default: PostArticle }>("../generated/posts/*.json");
const articlePromiseCache = new Map<string, Promise<PostArticle>>();
let postIndexPromise: Promise<PostSummary[]> | null = null;

function toPostSummary(article: PostArticle): PostSummary {
  const { html: _html, toc: _toc, ...summary } = article;
  return summary;
}

async function loadPostIndexFromPublicFile() {
  const indexUrl = `${getBaseUrl()}post-index.json`;
  const response = await fetch(indexUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load post index: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/json")) {
    throw new Error(`Failed to load post index: expected JSON, got ${contentType}`);
  }

  return normalizeContentPayload((await response.json()) as PostSummary[]).filter(
    (post) => !!postModules[`../generated/posts/${post.canonicalSlug}.json`],
  );
}

async function loadPostIndexFromGeneratedPosts() {
  const posts = await Promise.all(
    Object.values(postModules).map(async (loadPost) => {
      const module = await loadPost();
      return toPostSummary(normalizeContentPayload(module.default));
    }),
  );

  return posts.sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

async function loadPostIndex() {
  if (!postIndexPromise) {
    postIndexPromise = loadPostIndexFromPublicFile()
      .catch(() => loadPostIndexFromGeneratedPosts())
      .catch((error) => {
        postIndexPromise = null;
        throw error;
      });
  }

  return postIndexPromise;
}

export async function getPostSummaries() {
  return visiblePostSummaries(await loadPostIndex());
}

export function warmPostSummaries() {
  void loadPostIndex();
}

export async function resolvePostSlug(slug: string) {
  const postIndex = await loadPostIndex();
  return resolvePostSlugFromIndex(postIndex, decodeURIComponent(slug));
}

export async function loadPostArticle(slug: string): Promise<PostArticle | null> {
  const canonicalSlug = await resolvePostSlug(slug);

  if (!canonicalSlug) {
    return null;
  }

  const loader = postModules[`../generated/posts/${canonicalSlug}.json`];
  if (!loader) {
    return null;
  }

  const cachedPromise = articlePromiseCache.get(canonicalSlug);
  if (cachedPromise) {
    return cachedPromise;
  }

  const nextPromise = loader()
    .then((module) => normalizeContentPayload(module.default))
    .catch((error) => {
      articlePromiseCache.delete(canonicalSlug);
      throw error;
    });

  articlePromiseCache.set(canonicalSlug, nextPromise);
  return nextPromise;
}

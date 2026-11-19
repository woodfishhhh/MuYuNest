import type { PostArticle, PostSummary } from "@/types/content";
import { getBaseUrl } from "@/utils/base-url";
import { normalizeContentPayload } from "./content-url-normalizer";
import { visiblePostSummaries } from "./post-visibility";

const articlePromiseCache = new Map<string, Promise<PostArticle>>();
let postIndexPromise: Promise<PostSummary[]> | null = null;
let visibleIndexPromise: Promise<PostSummary[]> | null = null;
let slugIndexPromise: Promise<Map<string, string>> | null = null;

async function fetchContent<T>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return normalizeContentPayload((await response.json()) as T);
}

function loadPostIndex(): Promise<PostSummary[]> {
  postIndexPromise ??= fetchContent<PostSummary[]>("post-index.json").catch((error) => {
    postIndexPromise = null;
    throw error;
  });
  return postIndexPromise;
}

export function getPostSummaries(): Promise<PostSummary[]> {
  visibleIndexPromise ??= loadPostIndex().then(visiblePostSummaries).catch((error) => {
    visibleIndexPromise = null;
    throw error;
  });
  return visibleIndexPromise;
}

export async function resolvePostSlug(slug: string): Promise<string | null> {
  slugIndexPromise ??= loadPostIndex().then((posts) => {
    const index = new Map<string, string>();
    for (const post of posts) {
      for (const alias of post.aliases) {
        if (!index.has(alias)) index.set(alias, post.canonicalSlug);
      }
    }
    for (const post of posts) index.set(post.canonicalSlug, post.canonicalSlug);
    return index;
  }).catch((error) => {
    slugIndexPromise = null;
    throw error;
  });
  return (await slugIndexPromise).get(decodeURIComponent(slug).trim()) ?? null;
}

export async function loadPostArticle(slug: string): Promise<PostArticle | null> {
  const canonicalSlug = await resolvePostSlug(slug);
  if (!canonicalSlug) return null;

  let article = articlePromiseCache.get(canonicalSlug);
  if (!article) {
    article = fetchContent<PostArticle>(`articles/${encodeURIComponent(canonicalSlug)}.json`)
      .catch((error) => {
        articlePromiseCache.delete(canonicalSlug);
        throw error;
      });
    articlePromiseCache.set(canonicalSlug, article);
  }
  return article;
}

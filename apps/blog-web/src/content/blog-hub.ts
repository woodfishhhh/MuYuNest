import type { PostSummary } from "@/types/content";

export type BlogSortKey = "latest" | "oldest" | "reading-time" | "alphabetical";

export interface BlogFacet {
  value: string;
  count: number;
}

export interface BlogFacets {
  types: BlogFacet[];
  categories: BlogFacet[];
  tags: BlogFacet[];
}

export interface BlogFilters {
  query?: string;
  type?: string;
  category?: string;
  tag?: string;
}

// Generated summaries are immutable. Cache normalization per object, not per keystroke.
const searchDocuments = new WeakMap<PostSummary, { summary: string; full: string }>();
const publishedTimes = new WeakMap<PostSummary, number>();
const titleCollator = new Intl.Collator("zh-Hans-CN");

function searchDocument(post: PostSummary) {
  let document = searchDocuments.get(post);
  if (!document) {
    const summary = normalizeQuery(
      [post.title, post.excerpt, post.type, ...post.categories, ...post.tags].join(" "),
    );
    document = { summary, full: `${summary} ${normalizeQuery(post.searchText)}` };
    searchDocuments.set(post, document);
  }
  return document;
}

function publishedTime(post: PostSummary) {
  let time = publishedTimes.get(post);
  if (time === undefined) {
    time = Date.parse(post.publishedAt);
    publishedTimes.set(post, time);
  }
  return time;
}

export function filterBlogPosts(posts: PostSummary[], filters: BlogFilters = {}) {
  const query = normalizeQuery(filters.query);
  const selectedType = normalizeFilterValue(filters.type);
  const selectedCategory = normalizeFilterValue(filters.category);
  const selectedTag = normalizeFilterValue(filters.tag);
  const terms = query.split(" ");
  const useFullText = query.length >= 8 || terms.length >= 2;

  return posts.filter((post) => {
    if (selectedType && post.type !== selectedType) {
      return false;
    }

    if (selectedCategory && !post.categories.includes(selectedCategory)) {
      return false;
    }

    if (selectedTag && !post.tags.includes(selectedTag)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const document = searchDocument(post);
    const fullHaystack = useFullText ? document.full : document.summary;

    return terms.every((term) => fullHaystack.includes(term));
  });
}

export function sortBlogPosts(posts: PostSummary[], sortKey: BlogSortKey = "latest") {
  const sortedPosts = [...posts];

  sortedPosts.sort((left, right) => {
    if (sortKey === "oldest") {
      return publishedTime(left) - publishedTime(right);
    }

    if (sortKey === "reading-time") {
      return (
        right.readingMinutes - left.readingMinutes ||
        publishedTime(right) - publishedTime(left)
      );
    }

    if (sortKey === "alphabetical") {
      return titleCollator.compare(left.title, right.title);
    }

    return publishedTime(right) - publishedTime(left);
  });

  return sortedPosts;
}

export function buildBlogFacets(posts: PostSummary[]): BlogFacets {
  return {
    types: toFacets(posts.map((post) => post.type)),
    categories: toFacets(posts.flatMap((post) => post.categories)),
    tags: toFacets(posts.flatMap((post) => post.tags)),
  };
}

function toFacets(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalizedValue = normalizeFilterValue(value);
    if (!normalizedValue) {
      continue;
    }

    counts.set(normalizedValue, (counts.get(normalizedValue) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count);
}

function normalizeFilterValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeQuery(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

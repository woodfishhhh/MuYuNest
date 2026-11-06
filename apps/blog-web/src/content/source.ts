import type { AuthorProfileData, FriendLinkData, PostArticle, PostSummary, WorkProjectData } from "@/types/content";
import type seriesConfig from "./docs-series.json";
import { staticSource } from "./static-source";

export type Series = (typeof seriesConfig)[number];
export type SearchHit = PostSummary;

export interface ContentSource {
  listPosts(): Promise<PostSummary[]>;
  resolveSlug(slug: string): Promise<string | null>;
  getPost(slug: string): Promise<{ article: PostArticle; canonicalSlug: string } | null>;
  search(query: string): Promise<SearchHit[]>;
  getProfile(): Promise<AuthorProfileData>;
  listFriends(): Promise<FriendLinkData[]>;
  listWorks(): Promise<WorkProjectData[]>;
  listSeries(): Promise<Series[]>;
}

const mode = import.meta.env.VITE_CONTENT_SOURCE || "static";
if (mode !== "static") throw new Error(`Content source is not available yet: ${mode}`);
export const contentSource: ContentSource = staticSource;

import type { ContentSource } from "./source";
import { getPostSummaries, loadPostArticle, resolvePostSlug } from "./static-posts";
import { loadAuthorProfile } from "./static-author";
import { loadFriendLinks } from "./static-friends";
import { getWorkProjects } from "./works";
import { filterBlogPosts } from "./blog-hub";
import series from "./docs-series.json";

export const staticSource: ContentSource = {
  listPosts: getPostSummaries,
  resolveSlug: resolvePostSlug,
  async getPost(slug) {
    const article = await loadPostArticle(slug);
    return article ? { article, canonicalSlug: article.canonicalSlug } : null;
  },
  async search(query) { return filterBlogPosts(await getPostSummaries(), { query }); },
  getProfile: loadAuthorProfile,
  listFriends: loadFriendLinks,
  async listWorks() { return getWorkProjects(); },
  async listSeries() { return series; },
};

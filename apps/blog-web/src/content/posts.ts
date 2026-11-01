import { contentSource } from "./source";

export const getPostSummaries = () => contentSource.listPosts();
export const resolvePostSlug = (slug: string) => contentSource.resolveSlug(slug);
export async function loadPostArticle(slug: string) {
  return (await contentSource.getPost(slug))?.article ?? null;
}

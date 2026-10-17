/**
 * resolve-post-slug.ts
 *
 * Replaces the router beforeEnter guard on the /posts/:slug route.
 * If an alias slug is used, redirects to the canonical slug URL.
 */
import { resolvePostSlug } from "@/content/posts";
import { sanitizeSlug } from "@/utils/input-validator";

export default defineNuxtRouteMiddleware(async (to) => {
  const incomingSlug = sanitizeSlug(String(to.params.slug ?? ""));
  if (!incomingSlug) return;

  const canonicalSlug = await resolvePostSlug(incomingSlug).catch(() => null);
  if (canonicalSlug && canonicalSlug !== incomingSlug) {
    return navigateTo({ name: "post", params: { slug: canonicalSlug }, query: to.query, hash: to.hash, replace: true });
  }
});

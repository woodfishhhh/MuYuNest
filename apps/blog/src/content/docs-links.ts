import { findDocsPlacement, type DocsTopic } from "./docs-navigation";
import { getBaseUrl } from "@/utils/base-url";

/** Resolve authored course links using the current series before global aliases. */
export function normalizeDocsLinks(html: string, currentSlug: string, topics: DocsTopic[]) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const local = findDocsPlacement(topics, currentSlug)?.group.posts ?? [];
  const all = topics.flatMap((topic) => topic.groups.flatMap((group) => group.posts));
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = link.getAttribute("href")!;
    if (/^https:\/\/blog\.woodfish\.site\/posts\//i.test(href)) {
      const url = new URL(href);
      link.setAttribute("href", `${getBaseUrl().replace(/\/$/, "")}${url.pathname}${url.search}${url.hash}`);
      continue;
    }
    if (/^(?:[a-z]+:|\/\/|#)/i.test(href)) continue;
    const path = href.split(/[?#]/)[0];
    if (!path.endsWith(".md")) continue;
    let alias = "";
    try {
      alias = decodeURIComponent(path.split("/").pop()!.slice(0, -3));
    } catch {
      continue;
    }
    const matches = (posts: typeof all) => posts.filter((post) => post.aliases.includes(alias) || post.title === alias);
    const nearby = matches(local);
    const candidates = nearby.length === 1 ? nearby : matches(all);
    if (candidates.length !== 1) continue;
    const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    link.setAttribute("href", `${getBaseUrl()}posts/${candidates[0].canonicalSlug}${hash}`);
  }
  return document.body.innerHTML;
}

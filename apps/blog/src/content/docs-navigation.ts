import seriesConfig from "./docs-series.json";
import type { PostSummary } from "@/types/content";

export const docsTopics = [
  { id: "frontend", title: "前端开发", description: "从页面基础到框架、工程化与交互。" },
  { id: "backend", title: "后端开发", description: "理解服务、接口、数据与应用架构。" },
  { id: "languages", title: "编程语言", description: "掌握语言基础，深入运行机制。" },
  { id: "fundamentals", title: "计算机基础", description: "网络、组成原理与计算机系统。" },
  { id: "database", title: "数据库", description: "从数据建模到 SQL 与数据库原理。" },
  { id: "engineering", title: "工程实践", description: "开发工具、部署和日常问题记录。" },
  { id: "algorithms", title: "算法竞赛", description: "算法思路、题解与实现。" },
  { id: "other", title: "其他笔记", description: "课程复习、随笔与其他记录。" },
] as const;
export type DocsTopicId = (typeof docsTopics)[number]["id"];
export interface DocsGroup {
  id: string;
  title: string;
  posts: PostSummary[];
}
export interface DocsTopic {
  id: DocsTopicId;
  title: string;
  description: string;
  groups: DocsGroup[];
  count: number;
}
export interface DocsPlacement {
  topic: DocsTopic;
  group: DocsGroup;
  index: number;
}

function inferTopic(post: PostSummary): DocsTopicId {
  const category = post.categories.join(" ");
  if (/前端|全栈/.test(category)) return "frontend";
  if (/后端/.test(category)) return "backend";
  if (/编程语言|Go语言|^Go$/.test(category)) return "languages";
  if (/计算机/.test(category)) return "fundamentals";
  if (/数据库/.test(category)) return "database";
  if (/工程|系统与工具/.test(category)) return "engineering";
  if (/算法/.test(category)) return "algorithms";
  return "other";
}

export function buildDocsNavigation(posts: PostSummary[]): DocsTopic[] {
  const bySlug = new Map(posts.map((post) => [post.canonicalSlug, post]));
  const assigned = new Set<string>();
  const topics: DocsTopic[] = docsTopics.map((topic) => ({ ...topic, groups: [], count: 0 }));
  for (const series of seriesConfig) {
    const topic = topics.find((topic) => topic.id === series.topic);
    if (!topic) continue;
    const members = series.slugs.flatMap((slug) => {
      const post = bySlug.get(slug);
      if (!post || assigned.has(slug)) return [];
      assigned.add(slug);
      return [post];
    });
    if (members.length) topic.groups.push({ id: series.id, title: series.title, posts: members });
  }
  for (const topic of topics) {
    const loose = posts.filter((post) => !assigned.has(post.canonicalSlug) && inferTopic(post) === topic.id);
    loose.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.canonicalSlug.localeCompare(b.canonicalSlug));
    if (loose.length) topic.groups.push({ id: `${topic.id}-notes`, title: "专题与笔记", posts: loose });
    topic.count = topic.groups.reduce((sum, group) => sum + group.posts.length, 0);
  }
  return topics.filter((topic) => topic.count > 0);
}

export function findDocsPlacement(topics: DocsTopic[], slug: string): DocsPlacement | undefined {
  for (const topic of topics)
    for (const group of topic.groups) {
      const index = group.posts.findIndex((post) => post.canonicalSlug === slug);
      if (index >= 0) return { topic, group, index };
    }
}

export function getDocsNeighbors(placement?: DocsPlacement) {
  return {
    previous: placement?.group.posts[placement.index - 1] ?? null,
    next: placement?.group.posts[placement.index + 1] ?? null,
  };
}

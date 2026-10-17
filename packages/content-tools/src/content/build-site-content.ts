import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import MarkdownIt from "markdown-it";
import matter from "gray-matter";
import yaml from "js-yaml";
import { renderArticleMarkdown, type RenderDiagnostic } from "./markdown-renderer.js";


import {
  buildLegacySlugIndex,
  normalizeMarkdownBody,
  resolveAssetReference,
  resolveCanonicalSlug,
  toSitePublicUrl,
  rewriteMarkdownAssetPaths,
} from "./generator-core.js";
import {
  getFriendLinkStatusPath,
  normalizeFriendLinkUrl,
  readFriendLinkStatus,
} from "./friend-link-status.js";

export interface GeneratedPostIndexEntry {
  canonicalSlug: string;
  aliases: string[];
  title: string;
  publishedAt: string;
  publishedLabel: string;
  excerpt: string;
  type: string;
  searchText: string;
  readingMinutes: number;
  coverImage: string | null;
  categories: string[];
  tags: string[];
}

export interface GeneratedTocItem {
  id: string;
  level: 2 | 3 | 4;
  text: string;
  html?: string;
}

export interface GeneratedPostArticle extends GeneratedPostIndexEntry {
  html: string;
  toc: GeneratedTocItem[];
}

export interface GeneratedAuthorProfile {
  name: string;
  title: string;
  heroImage: string;
  postsCount: number;
  tagsCount: number;
  categoriesCount: number;
  skills: { title: string; color: string; img: string; officialUrl: string }[];
  poem: {
    title: string;
    author: string;
    lines: string[];
  };
  oneself: {
    location: string;
    birthDate: string;
    university: string;
    major: string;
  };
  tenyear: {
    tips: string;
    title: string;
    text: string;
    start: string;
    end: string;
  };
  contacts: {
    github: string;
    bilibili: string;
    qq: string;
    wechat: string;
    email: string;
    douyin: string;
  };
}

export interface GeneratedFriendLink {
  name: string;
  link: string;
  avatar?: string;
  descr?: string;
  className?: string;
  offline?: boolean;
}

export interface SiteContentBuildResult {
  renderDiagnostics: RenderDiagnostic[];
  postIndex: GeneratedPostIndexEntry[];
  postsBySlug: Record<string, GeneratedPostArticle>;
  author: GeneratedAuthorProfile;
  friendLinks: GeneratedFriendLink[];
}

export interface BuildSiteContentOptions {
  contentRoot?: string;
  sourceProjectRoot: string;
  targetPublicDir?: string;
  siteBasePath?: string;
  reuseGeneratedAssets?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;


export async function buildSiteContent(
  options: BuildSiteContentOptions,
): Promise<SiteContentBuildResult> {
  const sourceProjectRoot = options.sourceProjectRoot;
  const contentRoot = options.contentRoot ?? path.join(sourceProjectRoot, "content");
  const myblogRoot = path.join(contentRoot, "source", "myblog");
  const legacyPostsRoot = path.join(contentRoot, "posts");
  const aboutPath = path.join(
    contentRoot,
    "source",
    "blog",
    "source",
    "_data",
    "about.yml",
  );
  const linkPath = path.join(
    contentRoot,
    "source",
    "blog",
    "source",
    "_data",
    "link.yml",
  );
  const statusPath = getFriendLinkStatusPath(linkPath);
  const configPath = path.join(contentRoot, "source", "blog", "_config.yml");
  const targetPublicDir = options.targetPublicDir ?? path.join(sourceProjectRoot, "public");
  const siteBasePath = options.siteBasePath;
  const reuseGeneratedAssets = options.reuseGeneratedAssets ?? false;
  const renderDiagnostics: RenderDiagnostic[] = [];

  const legacyIndex = buildLegacySlugIndex(await readLegacyEntries(legacyPostsRoot));
  const markdownFiles = await collectMarkdownFiles(myblogRoot);
  const postsBySlug: Record<string, GeneratedPostArticle> = {};
  const postIndex: GeneratedPostIndexEntry[] = [];

  for (const filePath of markdownFiles) {
    const rawMarkdown = await readFile(filePath, "utf8");
    const parsed = matter(rawMarkdown);
    const title = readString(parsed.data.title) || path.basename(filePath, ".md");
    const date = readString(parsed.data.date) || "2026-01-01 00:00:00";
    const sourceRelativePath = path.relative(myblogRoot, filePath);
    const slugResult = resolveCanonicalSlug({
      title,
      date,
      rawMarkdown,
      sourceRelativePath,
      preferredSlug: readString(parsed.data.slug),
      legacyIndex,
    });

    const normalizedBody = normalizeMarkdownBody(rawMarkdown, title);
    const rewritten = await rewriteMarkdownAssetPaths(normalizedBody, {
      sourceFilePath: filePath,
      canonicalSlug: slugResult.canonicalSlug,
      publicDir: targetPublicDir,
      siteBasePath,
      sourceProjectRoot,
      reuseGeneratedAssets,
    });
    const sourceOffset = rawMarkdown.indexOf(normalizedBody);
    const renderedArticle = await renderArticleMarkdown(rewritten.markdown, {
      sourceFile: path.relative(contentRoot, filePath).split(path.sep).join("/"),
      slug: slugResult.canonicalSlug,
      lineOffset: sourceOffset >= 0 ? rawMarkdown.slice(0, sourceOffset).split("\n").length - 1 : 0,
    });
    renderDiagnostics.push(...renderedArticle.diagnostics);
    await assertReferencedArticleAssetsExist({
      articleHtml: renderedArticle.html,
      coverImage: null,
      publicDir: targetPublicDir,
      slug: slugResult.canonicalSlug,
    });
    const publishedAt = toIsoDate(date);
    const postType = resolvePostType(parsed.data.type);
    const categories = toStringArray(parsed.data.categories);
    const tags = toStringArray(parsed.data.tags);
    const searchText = createSearchText({
      title,
      type: postType,
      categories,
      tags,
      markdown: rewritten.markdown,
    });
    const readingMinutes = estimateReadingMinutes(rewritten.markdown);
    const coverImage = await resolveContentAssetValue(readString(parsed.data.cover), {
      sourceFilePath: filePath,
      canonicalSlug: slugResult.canonicalSlug,
      targetPublicDir,
      siteBasePath,
      sourceProjectRoot,
      reuseGeneratedAssets,
    });
    await assertReferencedArticleAssetsExist({
      articleHtml: renderedArticle.html,
      coverImage,
      publicDir: targetPublicDir,
      slug: slugResult.canonicalSlug,
    });
    const entry: GeneratedPostArticle = {
      canonicalSlug: slugResult.canonicalSlug,
      aliases: slugResult.aliases,
      title,
      publishedAt,
      publishedLabel: formatPublishedDate(publishedAt),
      excerpt: createExcerpt(rewritten.markdown, title),
      type: postType,
      searchText,
      readingMinutes,
      coverImage,
      categories,
      tags,
      html: addLazyImageAttributes(renderedArticle.html),
      toc: renderedArticle.toc,
    };

    postsBySlug[entry.canonicalSlug] = entry;
    postIndex.push({
      canonicalSlug: entry.canonicalSlug,
      aliases: entry.aliases,
      title: entry.title,
      publishedAt: entry.publishedAt,
      publishedLabel: entry.publishedLabel,
      excerpt: entry.excerpt,
      type: entry.type,
      searchText: entry.searchText,
      readingMinutes: entry.readingMinutes,
      coverImage: entry.coverImage,
      categories: entry.categories,
      tags: entry.tags,
    });
  }

  postIndex.sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  return {
    renderDiagnostics,
    postIndex,
    postsBySlug,
    author: await buildAuthorProfile({
      aboutPath,
      configPath,
      posts: postIndex,
      targetPublicDir,
      siteBasePath,
      reuseGeneratedAssets,
    }),
    friendLinks: await readFriendLinks(
      linkPath,
      targetPublicDir,
      siteBasePath,
      reuseGeneratedAssets,
      statusPath,
    ),
  };
}

async function readLegacyEntries(legacyPostsRoot: string) {
  try {
    const directories = await readdir(legacyPostsRoot, { withFileTypes: true });
    const entries = [];

    for (const directory of directories) {
      if (!directory.isDirectory()) {
        continue;
      }

      const filePath = path.join(legacyPostsRoot, directory.name, "index.md");
      const rawMarkdown = await readFile(filePath, "utf8");
      const parsed = matter(rawMarkdown);
      entries.push({
        slug: directory.name,
        title: readString(parsed.data.title) || directory.name,
        date: readString(parsed.data.date) || "2026-01-01 00:00:00",
        rawMarkdown,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const resolvedPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(resolvedPath);
        continue;
      }

      if (entry.isFile() && resolvedPath.endsWith(".md")) {
        files.push(resolvedPath);
      }
    }
  }

  try {
    await walk(root);
  } catch {
    return [];
  }

  return files;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function stripInlineMarkdown(value: string) {
  return stripHtml(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]{1,2}(.*?)[*_]{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function stripFencedCodeBlocks(markdown: string) {
  const output: string[] = [];
  let activeFence: { marker: "`" | "~"; length: number } | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (!activeFence) {
      const openingFence = line.match(/^[ \t]*(`{3,}|~{3,})/);

      if (!openingFence) {
        output.push(line);
        continue;
      }

      activeFence = {
        marker: openingFence[1][0] as "`" | "~",
        length: openingFence[1].length,
      };
      output.push("");
      continue;
    }

    const closingFence = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
    if (
      closingFence &&
      closingFence[1][0] === activeFence.marker &&
      closingFence[1].length >= activeFence.length
    ) {
      activeFence = null;
      output.push("");
    }
  }

  return output.join("\n");
}

function createExcerpt(markdown: string, title: string) {
  const tokens = MarkdownIt({ html: true }).parse(markdown, {});
  const paragraphs = tokens.flatMap((token, index) => {
    if (token.type !== "paragraph_open" || tokens[index + 1]?.type !== "inline") {
      return [];
    }

    const plainText = toExcerptPlainText(tokens[index + 1].content);
    return plainText && !/^\[toc\]$/i.test(plainText) ? [plainText] : [];
  });

  const plainText = paragraphs[0] ?? `A deep dive into ${title}.`;
  return `${plainText.slice(0, 150)}${plainText.length > 150 ? "..." : ""}`;
}

function toExcerptPlainText(block: string) {
  return stripInlineMarkdown(
    block.replace(/!\[[^\]]*\]\([^)]+\)/g, " ").replace(/<img\b[^>]*>/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function resolvePostType(value: unknown) {
  return readString(value).trim() || "Notes";
}

function createSearchText(options: {
  title: string;
  type: string;
  categories: string[];
  tags: string[];
  markdown: string;
}) {
  return [
    options.title,
    options.type,
    options.categories.join(" "),
    options.tags.join(" "),
    toSearchablePlainText(options.markdown),
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadingMinutes(markdown: string) {
  const plainText = toSearchablePlainText(markdown);

  if (!plainText) {
    return 1;
  }

  const cjkCount = (
    plainText.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ??
    []
  ).length;
  const nonCjkText = plainText.replace(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    " ",
  );
  const wordCount = nonCjkText.split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.ceil((cjkCount + wordCount) / 220));
}

function toSearchablePlainText(markdown: string) {
  return stripFencedCodeBlocks(markdown)
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveContentAssetValue(
  rawValue: string,
  options: {
    sourceFilePath: string;
    targetPublicDir: string;
    siteBasePath?: string;
    canonicalSlug?: string;
    sourceProjectRoot?: string;
    reuseGeneratedAssets?: boolean;
  },
) {
  if (!rawValue) {
    return options.canonicalSlug ? null : "";
  }

  const resolved = await resolveAssetReference(rawValue, {
    sourceFilePath: options.sourceFilePath,
    publicDir: options.targetPublicDir,
    siteBasePath: options.siteBasePath,
    canonicalSlug: options.canonicalSlug,
    sourceProjectRoot: options.sourceProjectRoot,
    reuseGeneratedAssets: options.reuseGeneratedAssets,
  });

  if (resolved) {
    return resolved;
  }

  const normalized = toSitePublicUrl(rawValue, options.siteBasePath);
  if (normalized !== rawValue) {
    return normalized;
  }

  return options.canonicalSlug ? null : rawValue;
}

async function resolveContentAssetText(
  rawValue: string,
  options: {
    sourceFilePath: string;
    targetPublicDir: string;
    siteBasePath?: string;
    canonicalSlug?: string;
    sourceProjectRoot?: string;
    reuseGeneratedAssets?: boolean;
  },
) {
  return (await resolveContentAssetValue(rawValue, options)) ?? "";
}

async function buildAuthorProfile(options: {
  aboutPath: string;
  configPath: string;
  posts: GeneratedPostIndexEntry[];
  targetPublicDir: string;
  siteBasePath?: string;
  reuseGeneratedAssets?: boolean;
}): Promise<GeneratedAuthorProfile> {
  const tagsSet = new Set<string>();
  const categoriesSet = new Set<string>();
  for (const post of options.posts) {
    for (const tag of post.tags) tagsSet.add(tag);
    for (const category of post.categories) categoriesSet.add(category);
  }

  const configText = await safeReadFile(options.configPath);
  const configData =
    (yaml.load(configText) as { author?: unknown; subtitle?: unknown } | undefined) ?? {};
  const aboutText = await safeReadFile(options.aboutPath);
  const aboutData = (yaml.load(aboutText) as Record<string, any> | undefined) ?? {};
  const rawHeroImage = readString(aboutData.hero?.image) || readString(aboutData.authorinfo?.image);
  const heroImage = await resolveContentAssetText(rawHeroImage, {
    sourceFilePath: options.aboutPath,
    targetPublicDir: options.targetPublicDir,
    siteBasePath: options.siteBasePath,
    reuseGeneratedAssets: options.reuseGeneratedAssets,
  });

  const poemRaw = aboutData.poem || {};
  const poem = {
    title: readString(poemRaw.title),
    author: readString(poemRaw.author) || readString(aboutData.contentinfo?.name),
    lines: toStringArray(poemRaw.lines),
  };

  const oneselfRaw = aboutData.oneself || {};
  const oneself = {
    location: readString(oneselfRaw.location),
    birthDate: readString(oneselfRaw.birthDate) || readString(oneselfRaw.birthYear),
    university: readString(oneselfRaw.university),
    major: readString(oneselfRaw.major),
  };

  const tenyearRaw = aboutData.tenyear || {};
  const tenyear = {
    tips: readString(tenyearRaw.tips),
    title: readString(tenyearRaw.title),
    text: readString(tenyearRaw.text),
    start: readString(tenyearRaw.start),
    end: readString(tenyearRaw.end),
  };

  const contactsRaw = aboutData.contacts || {};
  const contacts = {
    github: readString(contactsRaw.github),
    bilibili: readString(contactsRaw.bilibili),
    qq: readString(contactsRaw.qq),
    wechat: readString(contactsRaw.wechat),
    email: readString(contactsRaw.email),
    douyin: readString(contactsRaw.douyin),
  };

  return {
    name: readString(aboutData.contentinfo?.name) || readString(configData.author) || "Woodfish",
    title: readString(aboutData.contentinfo?.title) || "Developer",
    heroImage,
    postsCount: options.posts.length,
    tagsCount: tagsSet.size,
    categoriesCount: categoriesSet.size,
    skills: await normalizeSkills(
      aboutData.skills?.tags,
      options.aboutPath,
      options.targetPublicDir,
      options.siteBasePath,
      options.reuseGeneratedAssets,
    ),
    poem,
    oneself,
    tenyear,
    contacts,
  };
}

async function readFriendLinks(
  linkPath: string,
  targetPublicDir: string,
  siteBasePath?: string,
  reuseGeneratedAssets?: boolean,
  statusPath = getFriendLinkStatusPath(linkPath),
): Promise<GeneratedFriendLink[]> {
  const raw = await safeReadFile(linkPath);
  const data = (yaml.load(raw) as { links?: unknown } | undefined) ?? {};
  const offlineLinks = await readFriendLinkStatus(statusPath);
  const result: GeneratedFriendLink[] = [];
  const groups = Array.isArray(data.links) ? data.links : [];

  for (const group of groups) {
    const typedGroup =
      typeof group === "object" && group !== null
        ? (group as { class_name?: unknown; link_list?: unknown })
        : null;
    const className = readString(typedGroup?.class_name);
    const linkList = Array.isArray(typedGroup?.link_list) ? typedGroup.link_list : [];

    for (const item of linkList) {
      const typedItem =
        typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
      const name = readString(typedItem?.name);
      const link = readString(typedItem?.link);
      if (!name || !link) {
        continue;
      }

      const rawAvatar = readString(typedItem?.avatar);
      const avatar = rawAvatar
        ? ((await resolveContentAssetValue(rawAvatar, {
            sourceFilePath: linkPath,
            targetPublicDir,
            siteBasePath,
            reuseGeneratedAssets,
          })) ?? undefined)
        : undefined;

      result.push({
        name,
        link,
        avatar,
        descr: readString(typedItem?.descr) || undefined,
        className: className || undefined,
        ...(offlineLinks.has(normalizeFriendLinkUrl(link)) ? { offline: true } : {}),
      });
    }
  }

  return result;
}

async function safeReadFile(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function normalizeSkills(
  value: unknown,
  sourceFilePath: string,
  targetPublicDir: string,
  siteBasePath?: string,
  reuseGeneratedAssets?: boolean,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = await Promise.all(
    value.map(async (item) => {
      const typedItem =
        typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
      const title = readString(typedItem?.title);
      if (!title) {
        return null;
      }

      const rawImage = readString(typedItem?.img);
      const image = rawImage
        ? await resolveContentAssetText(rawImage, {
            sourceFilePath,
            targetPublicDir,
            siteBasePath,
            reuseGeneratedAssets,
          })
        : "";

      return {
        title,
        color: readString(typedItem?.color),
        img: image,
        officialUrl: readString(typedItem?.officialUrl),
      };
    }),
  );

  return normalized.filter(
    (item): item is { title: string; color: string; img: string; officialUrl: string } =>
      item !== null,
  );
}

function readString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readString).filter(Boolean);
}

function toIsoDate(value: string) {
  const parsedTimestamp = value.match(timestampPattern);

  if (parsedTimestamp) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = parsedTimestamp;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    ).toISOString();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? new Date("2026-01-01T00:00:00.000Z").toISOString()
    : parsedDate.toISOString();
}

function formatPublishedDate(value: string) {
  const parsedTimestamp = value.match(timestampPattern);

  if (parsedTimestamp) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = parsedTimestamp;
    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );

    return dateFormatter.format(date);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function addLazyImageAttributes(html: string) {
  return html.replace(/<img\b([^>]*?)>/g, (_match, attributes) => {
    let nextAttributes = attributes;

    if (!/\sloading=/.test(nextAttributes)) {
      nextAttributes += ' loading="lazy"';
    }

    if (!/\sdecoding=/.test(nextAttributes)) {
      nextAttributes += ' decoding="async"';
    }

    return `<img${nextAttributes}>`;
  });
}

async function assertReferencedArticleAssetsExist(options: {
  articleHtml: string;
  coverImage: string | null;
  publicDir: string;
  slug: string;
}) {
  const references = [
    ...Array.from(options.articleHtml.matchAll(/<img\b[^>]*?\bsrc=(["'])([^"']+)\1/gi)).map(
      (match) => match[2] ?? "",
    ),
    options.coverImage ?? "",
  ].filter((reference) => isGeneratedLocalAssetReference(reference));
  const missingAssets: string[] = [];

  for (const reference of references) {
    const expectedPath = generatedAssetPath(reference, options.publicDir);
    if (!(await fileExists(expectedPath))) {
      missingAssets.push(`${reference} -> ${expectedPath}`);
    }
  }

  if (missingAssets.length > 0) {
    throw new Error(
      `Post "${options.slug}" references missing generated image(s): ${missingAssets.join(", ")}`,
    );
  }
}

function isGeneratedLocalAssetReference(reference: string) {
  const withoutBase = stripSiteBasePath(reference);
  return (
    withoutBase.startsWith("/remote-assets/") ||
    withoutBase.startsWith("/content-assets/") ||
    withoutBase.startsWith("/imported-assets/")
  );
}

function generatedAssetPath(reference: string, publicDir: string) {
  return path.join(publicDir, ...stripSiteBasePath(reference).replace(/^\/+/, "").split("/"));
}

function stripSiteBasePath(reference: string) {
  try {
    const parsed = new URL(reference, "https://local.invalid");
    const match = parsed.pathname.match(/\/(?:remote-assets|content-assets|imported-assets)\/.+$/);
    return match?.[0] ?? parsed.pathname;
  } catch {
    const match = reference.match(/\/(?:remote-assets|content-assets|imported-assets)\/.+$/);
    return match?.[0] ?? reference;
  }
}

async function fileExists(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

import { createHash } from "node:crypto";
import http, { type IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const REMOTE_ASSET_DIR = "remote-assets";
const IMPORTED_ASSET_DIR = "imported-assets";
const CONTENT_ASSET_DIR = "content-assets";
const MAX_REMOTE_REDIRECTS = 5;
const MAX_REMOTE_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_REMOTE_DOWNLOAD_ATTEMPTS = 3;
const INSECURE_TLS_HOSTS = new Set([
  "www.woodfishhhh.xyz",
  "woodfishhhh.xyz",
  "www.woodfish.site",
  "woodfish.site",
  "img.woodfish.site",
]);
const LOCAL_MIRROR_HOSTS = new Set([
  "www.woodfishhhh.xyz",
  "woodfishhhh.xyz",
  "www.woodfish.site",
  "woodfish.site",
  "img.woodfish.site",
]);
const LOCAL_MIRROR_ENV = "VUECUBEBLOG_LOCAL_ASSET_MIRROR_DIRS";
const DEFAULT_LOCAL_MIRROR_RELATIVE_DIRS = [
  "public/content",
  "../Blog/public/images",
  "../Blog/images",
  "../Blog/source/images",
  "../3Dblog/public/images",
  "../3Dblog/public/content",
  "../3Dblog/.netlify/static/content",
  "../3Dblog/content/source/blog/source/images",
];
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });
let localMirrorAssetIndexPromise: Promise<Map<string, string[]>> | null = null;
let localMirrorAssetIndexKey = "";
const codeRangeParser = new MarkdownIt({
  breaks: false,
  html: true,
  linkify: false,
  typographer: false,
});

type RemoteAssetDownload = {
  bytes: Buffer;
  contentType: string;
  finalUrl: string;
};

export interface LegacySlugSource {
  slug: string;
  title: string;
  date: string;
  rawMarkdown: string;
}

export interface CanonicalSlugOptions {
  title: string;
  date: string;
  rawMarkdown: string;
  sourceRelativePath: string;
  legacyIndex: ReadonlyMap<string, string>;
}

export interface CanonicalSlugResult {
  canonicalSlug: string;
  aliases: string[];
}

export interface RewriteMarkdownAssetOptions {
  sourceFilePath: string;
  canonicalSlug: string;
  publicDir: string;
  siteBasePath?: string;
  sourceProjectRoot?: string;
  reuseGeneratedAssets?: boolean;
}

export interface RewriteMarkdownAssetResult {
  markdown: string;
  warnings: string[];
}

export interface ResolveAssetReferenceOptions {
  sourceFilePath: string;
  publicDir: string;
  siteBasePath?: string;
  canonicalSlug?: string;
  sourceProjectRoot?: string;
  reuseGeneratedAssets?: boolean;
}

export function buildLegacySlugIndex(entries: readonly LegacySlugSource[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const entry of entries) {
    index.set(buildContentFingerprint(entry.title, entry.date, entry.rawMarkdown), entry.slug);
  }

  return index;
}

export function resolveCanonicalSlug(options: CanonicalSlugOptions): CanonicalSlugResult {
  const fingerprint = buildContentFingerprint(options.title, options.date, options.rawMarkdown);
  const legacySlug = options.legacyIndex.get(fingerprint);
  const sourceStem = path.basename(
    options.sourceRelativePath,
    path.extname(options.sourceRelativePath),
  );

  if (legacySlug) {
    return {
      canonicalSlug: legacySlug,
      aliases: uniqueStrings([sourceStem]),
    };
  }

  const asciiStem = slugifyAsciiStem(sourceStem) || slugifyAsciiStem(options.title) || "post";
  const shortHash = sha1(options.sourceRelativePath).slice(0, 8);

  return {
    canonicalSlug: `${asciiStem}-${shortHash}`,
    aliases: uniqueStrings([sourceStem]),
  };
}

export function normalizeMarkdownBody(rawMarkdown: string, title: string): string {
  const parsed = matter(rawMarkdown);
  const body = parsed.content.trimStart();
  const match = body.match(/^#\s+(.+?)\r?\n+/);

  if (!match) {
    return body.trim();
  }

  if (match[1].trim() !== title.trim()) {
    return body.trim();
  }

  return body.slice(match[0].length).trim();
}

export async function rewriteMarkdownAssetPaths(
  markdown: string,
  options: RewriteMarkdownAssetOptions,
): Promise<RewriteMarkdownAssetResult> {
  const warnings: string[] = [];
  let nextMarkdown = markdown;
  const originalFenceRanges = findCodeBlockRanges(markdown);

  const markdownImageMatches = Array.from(markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g));

  for (const match of markdownImageMatches) {
    if (isOffsetInRanges(match.index ?? -1, originalFenceRanges)) {
      continue;
    }

    const rawReference = match[1];
    const matchedExpression = match[0];
    const originalReference = rawReference.trim();

    if (shouldSkipAssetReference(originalReference)) {
      continue;
    }

    const rewrittenUrl = await resolveAssetReference(originalReference, options);

    if (!rewrittenUrl) {
      if (shouldRemoveUnresolvedLocalAsset(originalReference)) {
        throw new Error(formatMissingLocalAssetError(originalReference, options));
      }

      warnings.push(`Failed to localize remote asset: ${originalReference}`);
      continue;
    }

    nextMarkdown = replaceMarkdownImageReference(
      nextMarkdown,
      matchedExpression,
      rawReference,
      originalReference,
      rewrittenUrl,
    );
  }

  const nextFenceRanges = findCodeBlockRanges(nextMarkdown);
  const htmlImageMatches = Array.from(
    nextMarkdown.matchAll(/<img\b[^>]*?\bsrc=(["'])([^"']+)\1[^>]*>/gi),
  );

  for (const match of htmlImageMatches) {
    if (isOffsetInRanges(match.index ?? -1, nextFenceRanges)) {
      continue;
    }

    const matchedExpression = match[0];
    const originalReference = match[2]?.trim() ?? "";

    if (shouldSkipAssetReference(originalReference)) {
      continue;
    }

    const rewrittenUrl = await resolveAssetReference(originalReference, options);
    if (!rewrittenUrl) {
      if (shouldRemoveUnresolvedLocalAsset(originalReference)) {
        throw new Error(formatMissingLocalAssetError(originalReference, options));
      }

      warnings.push(`Failed to localize remote asset: ${originalReference}`);
      continue;
    }

    nextMarkdown = replaceHtmlImageReference(
      nextMarkdown,
      matchedExpression,
      originalReference,
      rewrittenUrl,
    );
  }

  return {
    markdown: nextMarkdown,
    warnings,
  };
}

export async function resolveAssetReference(
  reference: string,
  options: ResolveAssetReferenceOptions,
): Promise<string | null> {
  const originalReference = reference.trim();

  if (!originalReference || shouldSkipAssetReference(originalReference)) {
    return null;
  }

  const sourceDir = path.dirname(options.sourceFilePath);

  if (isRemoteAssetReference(originalReference)) {
    return localizeRemoteAsset(
      originalReference,
      options.publicDir,
      options.siteBasePath,
      options.sourceProjectRoot,
      options.reuseGeneratedAssets,
    );
  }

  if (originalReference.startsWith("/")) {
    const projectRootedPath = resolveProjectRootAssetPath(
      originalReference,
      options.sourceProjectRoot,
    );
    if (projectRootedPath && (await fileExists(projectRootedPath))) {
      if (options.canonicalSlug) {
        return copyRelativeAsset(
          projectRootedPath,
          originalReference,
          options.publicDir,
          options.canonicalSlug,
          options.siteBasePath,
          options.reuseGeneratedAssets,
        );
      }

      return copyAbsoluteAsset(
        projectRootedPath,
        options.publicDir,
        options.siteBasePath,
        options.reuseGeneratedAssets,
      );
    }

    const rootedAbsolutePath = path.resolve(sourceDir, originalReference);
    if (await fileExists(rootedAbsolutePath)) {
      return copyAbsoluteAsset(
        rootedAbsolutePath,
        options.publicDir,
        options.siteBasePath,
        options.reuseGeneratedAssets,
      );
    }

    return toSitePublicUrl(originalReference, options.siteBasePath);
  }

  const resolvedPath = path.isAbsolute(originalReference)
    ? originalReference
    : path.resolve(sourceDir, originalReference);

  if (!(await fileExists(resolvedPath))) {
    const sharedMyblogAssetPath = resolveSharedMyblogAssetPath(
      originalReference,
      options.sourceProjectRoot,
    );
    if (
      sharedMyblogAssetPath &&
      (await fileExists(sharedMyblogAssetPath)) &&
      options.canonicalSlug
    ) {
      return copyRelativeAsset(
        sharedMyblogAssetPath,
        originalReference,
        options.publicDir,
        options.canonicalSlug,
        options.siteBasePath,
        options.reuseGeneratedAssets,
      );
    }

    return localizeMissingLocalAsset(originalReference, options);
  }

  if (path.isAbsolute(originalReference)) {
    return copyAbsoluteAsset(
      resolvedPath,
      options.publicDir,
      options.siteBasePath,
      options.reuseGeneratedAssets,
    );
  }

  if (!options.canonicalSlug) {
    return null;
  }

  return copyRelativeAsset(
    resolvedPath,
    originalReference,
    options.publicDir,
    options.canonicalSlug,
    options.siteBasePath,
    options.reuseGeneratedAssets,
  );
}

async function localizeMissingLocalAsset(reference: string, options: ResolveAssetReferenceOptions) {
  if (options.reuseGeneratedAssets && options.canonicalSlug) {
    const reusedAsset = await reuseExistingContentAsset(
      reference,
      options.publicDir,
      options.siteBasePath,
    );
    if (reusedAsset) {
      return reusedAsset;
    }
  }

  const mirrorSourcePath = await resolveLocalMirrorSource(reference, options.sourceProjectRoot);
  if (mirrorSourcePath && (isLegacyAbsoluteAssetReference(reference) || !options.canonicalSlug)) {
    return copyAbsoluteAsset(
      mirrorSourcePath,
      options.publicDir,
      options.siteBasePath,
      options.reuseGeneratedAssets,
    );
  }

  if (mirrorSourcePath && options.canonicalSlug) {
    return copyRelativeAsset(
      mirrorSourcePath,
      reference,
      options.publicDir,
      options.canonicalSlug,
      options.siteBasePath,
      options.reuseGeneratedAssets,
    );
  }

  return createMissingImagePlaceholder(reference, options.publicDir, options.siteBasePath);
}

async function reuseExistingContentAsset(
  reference: string,
  publicDir: string,
  siteBasePath?: string,
) {
  const safeRelativePath = toSafeRelativeAssetPath(reference);
  if (!safeRelativePath) {
    return null;
  }

  const contentAssetsRoot = path.join(publicDir, CONTENT_ASSET_DIR);
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await readdir(contentAssetsRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidateEntries = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of candidateEntries) {
    if (
      await fileExists(path.join(contentAssetsRoot, entry.name, ...safeRelativePath.split("/")))
    ) {
      return toPublicAssetUrl(siteBasePath, CONTENT_ASSET_DIR, entry.name, safeRelativePath);
    }
  }

  return null;
}

async function createMissingImagePlaceholder(
  reference: string,
  publicDir: string,
  siteBasePath?: string,
) {
  const assetFileName = `${sha1(reference)}.svg`;
  const targetPath = path.join(publicDir, IMPORTED_ASSET_DIR, assetFileName);
  const basename = path.basename(reference.replaceAll("\\", "/"));
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img">',
    '<rect width="960" height="540" rx="28" fill="#111827"/>',
    '<rect x="24" y="24" width="912" height="492" rx="22" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="12 14"/>',
    '<text x="480" y="252" text-anchor="middle" fill="#e5e7eb" font-family="Arial, sans-serif" font-size="34" font-weight="700">Image unavailable</text>',
    `<text x="480" y="304" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="20">${escapeSvgText(basename || "legacy local path")}</text>`,
    "</svg>",
  ].join("");

  if (!(await fileExists(targetPath))) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, svg, "utf8");
  }

  return toPublicAssetUrl(siteBasePath, IMPORTED_ASSET_DIR, assetFileName);
}

function isLegacyAbsoluteAssetReference(reference: string) {
  return path.isAbsolute(reference) || /^[A-Za-z]:[\\/]/.test(reference);
}

function escapeSvgText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function findCodeBlockRanges(markdown: string) {
  const lineStarts = Array.from(markdown.matchAll(/^.*(?:\r?\n|$)/gm)).map(
    (match) => match.index ?? 0,
  );
  const tokens = codeRangeParser.parse(markdown, {});
  const ranges: { start: number; end: number }[] = [];

  for (const token of tokens) {
    if ((token.type !== "fence" && token.type !== "code_block") || !token.map) {
      continue;
    }

    const [startLine, endLine] = token.map;
    const start = lineStarts[startLine] ?? 0;
    const end = lineStarts[endLine] ?? markdown.length;
    ranges.push({ start, end });
  }

  return ranges;
}

function isOffsetInRanges(offset: number, ranges: readonly { start: number; end: number }[]) {
  return offset >= 0 && ranges.some((range) => offset >= range.start && offset < range.end);
}

function replaceMarkdownImageReference(
  markdown: string,
  matchedExpression: string,
  rawReference: string,
  originalReference: string,
  rewrittenReference: string,
) {
  const escapedRawReference = escapeRegExp(rawReference);
  const rewrittenExpression = matchedExpression.replace(
    new RegExp(`\\(${escapedRawReference}\\)`),
    `(${rewrittenReference})`,
  );

  if (rewrittenExpression !== matchedExpression) {
    return markdown.replace(matchedExpression, rewrittenExpression);
  }

  return markdown.replace(`(${originalReference})`, `(${rewrittenReference})`);
}

function replaceHtmlImageReference(
  markdown: string,
  matchedExpression: string,
  originalReference: string,
  rewrittenReference: string,
) {
  const escapedReference = escapeRegExp(originalReference);
  const rewrittenExpression = matchedExpression.replace(
    new RegExp(escapedReference, "g"),
    rewrittenReference,
  );
  return markdown.replace(matchedExpression, rewrittenExpression);
}

function buildContentFingerprint(title: string, date: string, rawMarkdown: string) {
  return sha1(`${title}\n${date}\n${normalizeMarkdownBody(rawMarkdown, title)}`);
}

function slugifyAsciiStem(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldSkipAssetReference(reference: string) {
  return (
    reference.startsWith("//") ||
    reference.startsWith("data:") ||
    reference.startsWith("mailto:") ||
    reference.startsWith("tel:") ||
    reference.startsWith("#")
  );
}

async function fileExists(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function copyRelativeAsset(
  resolvedPath: string,
  originalReference: string,
  publicDir: string,
  canonicalSlug: string,
  siteBasePath?: string,
  reuseGeneratedAssets = false,
) {
  const safeRelativePath = toSafeRelativeAssetPath(originalReference);
  const targetPath = path.join(
    publicDir,
    CONTENT_ASSET_DIR,
    canonicalSlug,
    ...safeRelativePath.split("/"),
  );

  if (!reuseGeneratedAssets || !(await fileExists(targetPath))) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(resolvedPath, targetPath);
  }

  return toPublicAssetUrl(siteBasePath, CONTENT_ASSET_DIR, canonicalSlug, safeRelativePath);
}

async function copyAbsoluteAsset(
  resolvedPath: string,
  publicDir: string,
  siteBasePath?: string,
  reuseGeneratedAssets = false,
) {
  const extension = path.extname(resolvedPath) || ".bin";
  const assetFileName = `${sha1(resolvedPath)}${extension}`;
  const targetPath = path.join(publicDir, IMPORTED_ASSET_DIR, assetFileName);

  if (!reuseGeneratedAssets || !(await fileExists(targetPath))) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(resolvedPath, targetPath);
  }

  return toPublicAssetUrl(siteBasePath, IMPORTED_ASSET_DIR, assetFileName);
}

function toSafeRelativeAssetPath(originalReference: string) {
  const normalized = originalReference.replaceAll("\\", "/").split(/[?#]/)[0] ?? "";
  const segments = normalized.split("/");
  const safeSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      safeSegments.push("__up__");
      continue;
    }

    safeSegments.push(segment);
  }

  return safeSegments.join("/");
}

function isRemoteAssetReference(reference: string) {
  try {
    const url = new URL(reference);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function shouldRemoveUnresolvedLocalAsset(reference: string) {
  return !isRemoteAssetReference(reference);
}

function formatMissingLocalAssetError(reference: string, options: ResolveAssetReferenceOptions) {
  return `Missing local image for post ${options.canonicalSlug ?? "(unknown)"}: ${reference} -> ${expectedLocalAssetPath(reference, options)}`;
}

function expectedLocalAssetPath(reference: string, options: ResolveAssetReferenceOptions) {
  const projectRootedPath = reference.startsWith("/")
    ? resolveProjectRootAssetPath(reference, options.sourceProjectRoot)
    : null;
  if (projectRootedPath) {
    return projectRootedPath;
  }

  const normalizedReference = safeDecodeAssetReference(reference);
  if (path.isAbsolute(normalizedReference)) {
    return normalizedReference;
  }

  return path.resolve(path.dirname(options.sourceFilePath), normalizedReference);
}

function safeDecodeAssetReference(reference: string) {
  try {
    return decodeURIComponent(reference);
  } catch {
    return reference;
  }
}

function resolveSharedMyblogAssetPath(reference: string, sourceProjectRoot?: string) {
  if (!sourceProjectRoot || path.isAbsolute(reference) || reference.startsWith("/")) {
    return null;
  }

  const normalizedReference = safeDecodeAssetReference(reference)
    .replaceAll("\\", "/")
    .split(/[?#]/)[0];

  if (!normalizedReference) {
    return null;
  }

  return path.resolve(sourceProjectRoot, "content", "source", "myblog", normalizedReference);
}

function resolveProjectRootAssetPath(reference: string, sourceProjectRoot?: string) {
  if (!sourceProjectRoot) {
    return null;
  }

  const relativePath = reference.replaceAll("\\", "/").split(/[?#]/)[0]?.replace(/^\/+/, "");

  if (!relativePath) {
    return null;
  }

  return path.resolve(sourceProjectRoot, relativePath);
}

export async function localizeRemoteAsset(
  reference: string,
  publicDir: string,
  siteBasePath?: string,
  sourceProjectRoot?: string,
  reuseGeneratedAssets = false,
): Promise<string | null> {
  if (!isRemoteAssetReference(reference)) {
    return null;
  }

  const parsed = new URL(reference);
  const knownExtension = getPathExtensionFromUrl(reference);
  const baseName = sha1(reference);

  const existingAssetFileName = await findExistingLocalizedRemoteAssetFileName(
    publicDir,
    baseName,
    knownExtension,
  );
  if (existingAssetFileName) {
    return toPublicAssetUrl(siteBasePath, REMOTE_ASSET_DIR, existingAssetFileName);
  }

  if (LOCAL_MIRROR_HOSTS.has(parsed.hostname)) {
    const mirroredAsset = await localizeAssetFromLocalMirror(
      reference,
      publicDir,
      knownExtension,
      siteBasePath,
      sourceProjectRoot,
    );
    if (mirroredAsset) {
      return mirroredAsset;
    }
  }

  if (reuseGeneratedAssets) {
    return toSitePublicUrl(reference, siteBasePath);
  }

  const downloaded = await downloadRemoteAsset(reference);
  if (!downloaded) {
    const mirroredAsset = await localizeAssetFromLocalMirror(
      reference,
      publicDir,
      knownExtension,
      siteBasePath,
      sourceProjectRoot,
    );
    if (mirroredAsset) {
      return mirroredAsset;
    }
    return null;
  }

  const finalExtension =
    knownExtension ||
    getPathExtensionFromUrl(downloaded.finalUrl) ||
    extensionFromContentType(downloaded.contentType);
  const assetFileName = `${baseName}${finalExtension || ".bin"}`;
  const targetPath = path.join(publicDir, REMOTE_ASSET_DIR, assetFileName);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, downloaded.bytes);

  return toPublicAssetUrl(siteBasePath, REMOTE_ASSET_DIR, assetFileName);
}

async function localizeAssetFromLocalMirror(
  reference: string,
  publicDir: string,
  knownExtension: string,
  siteBasePath?: string,
  sourceProjectRoot?: string,
): Promise<string | null> {
  const sourcePath = await resolveLocalMirrorSource(reference, sourceProjectRoot);
  if (!sourcePath) {
    return null;
  }

  const extension = knownExtension || path.extname(sourcePath).toLowerCase();
  const safeExtension = /^[.][a-z0-9]{1,8}$/i.test(extension) ? extension : ".bin";
  const targetFileName = `${sha1(reference)}${safeExtension}`;
  const targetPath = path.join(publicDir, REMOTE_ASSET_DIR, targetFileName);

  if (await fileExists(targetPath)) {
    return toPublicAssetUrl(siteBasePath, REMOTE_ASSET_DIR, targetFileName);
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);

  return toPublicAssetUrl(siteBasePath, REMOTE_ASSET_DIR, targetFileName);
}

async function findExistingLocalizedRemoteAssetFileName(
  publicDir: string,
  baseName: string,
  knownExtension: string,
) {
  const remoteAssetsRoot = path.join(publicDir, REMOTE_ASSET_DIR);

  if (knownExtension) {
    const exactFileName = `${baseName}${knownExtension}`;
    const exactPath = path.join(remoteAssetsRoot, exactFileName);
    if (await fileExists(exactPath)) {
      return exactFileName;
    }
  }

  let entries: { name: string; isFile: () => boolean }[];
  try {
    entries = await readdir(remoteAssetsRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const prefix = `${baseName}.`;
  const matchedEntry = entries.find((entry) => entry.isFile() && entry.name.startsWith(prefix));
  return matchedEntry?.name ?? null;
}

export function toSitePublicUrl(reference: string, siteBasePath?: string) {
  if (!reference) {
    return "";
  }

  if (
    shouldSkipAssetReference(reference) ||
    reference.startsWith("//") ||
    isRemoteAssetReference(reference) ||
    !reference.startsWith("/")
  ) {
    return reference;
  }

  return toPublicAssetUrl(siteBasePath, reference);
}

function normalizeSiteBasePath(siteBasePath?: string) {
  if (!siteBasePath) {
    return "/";
  }

  const trimmed = siteBasePath.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function toPublicAssetUrl(siteBasePath: string | undefined, ...segments: string[]) {
  const normalizedBase = normalizeSiteBasePath(siteBasePath);
  const normalizedPath = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter((segment) => segment.length > 0)
    .join("/");

  if (!normalizedPath) {
    return normalizedBase;
  }

  return normalizedBase === "/" ? `/${normalizedPath}` : `${normalizedBase}${normalizedPath}`;
}

async function resolveLocalMirrorSource(
  reference: string,
  sourceProjectRoot?: string,
): Promise<string | null> {
  const fileName = getFileNameFromUrl(reference);
  if (!fileName) {
    return null;
  }

  const index = await getLocalMirrorAssetIndex(sourceProjectRoot);
  const candidates = index.get(fileName.toLowerCase()) ?? [];
  const normalizedReference = normalizeMirrorLookupPath(reference);
  const suffixMatchedCandidates = normalizedReference
    ? candidates.filter((candidate) =>
      normalizeMirrorLookupPath(candidate).endsWith(`/${normalizedReference}`),
    )
    : [];

  for (const candidate of suffixMatchedCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizeMirrorLookupPath(reference: string) {
  return (
    safeDecodeAssetReference(reference)
      .replaceAll("\\", "/")
      .split(/[?#]/)[0]
      ?.replace(/^\/+/, "")
      .toLowerCase() ?? ""
  );
}

function getFileNameFromUrl(reference: string) {
  try {
    const url = new URL(reference);
    const basename = path.basename(decodeURIComponent(url.pathname));
    return basename.trim();
  } catch {
    return path
      .basename(safeDecodeAssetReference(reference).replaceAll("\\", "/").split(/[?#]/)[0] ?? "")
      .trim();
  }
}

async function getLocalMirrorAssetIndex(sourceProjectRoot?: string) {
  const directories = getLocalMirrorDirectories(sourceProjectRoot);
  const indexKey = `${sourceProjectRoot ?? "<cwd>"}|${directories.join("|")}`;

  if (!localMirrorAssetIndexPromise || localMirrorAssetIndexKey !== indexKey) {
    localMirrorAssetIndexKey = indexKey;
    localMirrorAssetIndexPromise = buildLocalMirrorAssetIndex(directories);
  }

  return localMirrorAssetIndexPromise;
}

function getLocalMirrorDirectories(sourceProjectRoot?: string) {
  const baseRoot = path.resolve(sourceProjectRoot ?? process.cwd());
  const fromEnv = parseLocalMirrorEnv(process.env[LOCAL_MIRROR_ENV], baseRoot);
  const defaults = DEFAULT_LOCAL_MIRROR_RELATIVE_DIRS.map((relativePath) =>
    path.resolve(baseRoot, relativePath),
  );
  return uniquePaths([...fromEnv, ...defaults]);
}

function parseLocalMirrorEnv(raw: string | undefined, baseRoot: string) {
  if (!raw) {
    return [];
  }

  return raw
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (path.isAbsolute(item) ? path.resolve(item) : path.resolve(baseRoot, item)));
}

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.map((item) => path.resolve(item))));
}

async function buildLocalMirrorAssetIndex(directories: string[]) {
  const index = new Map<string, string[]>();

  for (const directory of directories) {
    if (!(await directoryExists(directory))) {
      continue;
    }

    await indexDirectoryAssets(directory, index);
  }

  return index;
}

async function indexDirectoryAssets(directory: string, index: Map<string, string[]>) {
  let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await indexDirectoryAssets(resolvedPath, index);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const key = entry.name.toLowerCase();
    if (!index.has(key)) {
      index.set(key, [resolvedPath]);
      continue;
    }

    index.get(key)!.push(resolvedPath);
  }
}

async function directoryExists(directoryPath: string) {
  try {
    const fileStat = await stat(directoryPath);
    return fileStat.isDirectory();
  } catch {
    return false;
  }
}

async function downloadRemoteAsset(
  initialUrl: string,
  redirectCount = 0,
  attempt = 1,
): Promise<RemoteAssetDownload | null> {
  if (redirectCount > MAX_REMOTE_REDIRECTS) {
    return null;
  }

  const parsedUrl = new URL(initialUrl);
  const response = await requestRemoteAsset(parsedUrl);
  const statusCode = response.statusCode;

  if (
    [301, 302, 303, 307, 308].includes(statusCode) &&
    typeof response.headers.location === "string"
  ) {
    const nextUrl = new URL(response.headers.location, parsedUrl).toString();
    return downloadRemoteAsset(nextUrl, redirectCount + 1);
  }

  if (statusCode < 200 || statusCode >= 300) {
    if (attempt < MAX_REMOTE_DOWNLOAD_ATTEMPTS && shouldRetryRemoteAssetDownload(statusCode)) {
      await waitBeforeRetry(attempt);
      return downloadRemoteAsset(initialUrl, redirectCount, attempt + 1);
    }

    return null;
  }

  return {
    bytes: response.body,
    contentType: contentTypeFromHeaders(response.headers),
    finalUrl: parsedUrl.toString(),
  };
}

function shouldRetryRemoteAssetDownload(statusCode: number) {
  return (
    statusCode === 0 ||
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

async function waitBeforeRetry(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, attempt * 400));
}

async function requestRemoteAsset(url: URL) {
  return new Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: Buffer }>(
    (resolve, reject) => {
      const useHttps = url.protocol === "https:";
      const client = useHttps ? https : http;
      const request = client.get(
        url,
        {
          agent: useHttps && INSECURE_TLS_HOSTS.has(url.hostname) ? insecureHttpsAgent : undefined,
          headers: {
            accept: "*/*",
            "user-agent": "VueCubeBlog-Asset-Localizer/1.0",
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let totalBytes = 0;

          response.on("data", (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_REMOTE_ASSET_BYTES) {
              request.destroy(new Error(`Remote asset too large: ${url.toString()}`));
              return;
            }
            chunks.push(chunk);
          });

          response.on("end", () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks),
            });
          });
        },
      );

      request.on("error", reject);
      request.setTimeout(15000, () => {
        request.destroy(new Error(`Remote asset timeout: ${url.toString()}`));
      });
    },
  ).catch(() => ({
    statusCode: 0,
    headers: {} as IncomingHttpHeaders,
    body: Buffer.alloc(0),
  }));
}

function contentTypeFromHeaders(headers: IncomingHttpHeaders) {
  const contentType = headers["content-type"];
  if (typeof contentType !== "string") {
    return "";
  }
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function getPathExtensionFromUrl(urlText: string) {
  try {
    const parsed = new URL(urlText);
    const extension = path.extname(decodeURIComponent(parsed.pathname)).toLowerCase();
    return /^[.][a-z0-9]{1,8}$/i.test(extension) ? extension : "";
  } catch {
    return "";
  }
}

function extensionFromContentType(contentType: string) {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/svg+xml") return ".svg";
  if (contentType === "image/avif") return ".avif";
  return "";
}

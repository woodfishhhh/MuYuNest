#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import yaml from "js-yaml";

import { resolveAssetReference, toSitePublicUrl } from "./content/generator-core.js";
import { resolveBlogPaths, type BlogPathOverrides } from "./paths.js";

const execFileAsync = promisify(execFile);

export interface FriendLinkIssueData {
  siteName: string;
  siteUrl: string;
  friendPageUrl: string;
  avatarUrl: string;
  description: string;
  contact: string;
}

export interface FriendLinkData {
  name: string;
  link: string;
  avatar?: string;
  descr?: string;
  className?: string;
}

export interface GitHubIssue {
  body?: string | null;
  comments_url?: string;
  created_at: string;
  html_url?: string;
  number: number;
  pull_request?: unknown;
  state?: string;
  title: string;
}

export interface OwnFriendLink {
  avatar: string;
  descr: string;
  link: string;
  name: string;
}

export interface ReciprocalLinkCheckResult {
  checkedUrls: string[];
  found: boolean;
  matchedUrl?: string;
}

export const WOODFISH_FRIEND_LINK: OwnFriendLink = {
  name: "woodfish",
  link: "https://blog.woodfish.site/",
  avatar: "https://pic1.imgdb.cn/item/682f3d1658cb8da5c807b704.jpg",
  descr: "我喜欢你",
};

const FRIEND_LINK_TITLE_PREFIX = "[Friend Link]";
const INITIAL_COMMENT_MARKER = "<!-- woodfish-friend-bot:initial -->";
const SUCCESS_COMMENT_MARKER = "<!-- woodfish-friend-bot:accepted -->";
const REJECT_COMMENT_MARKER = "<!-- woodfish-friend-bot:rejected -->";
const DEFAULT_WAIT_MS = 60 * 60 * 1000;

export function parseFriendLinkIssueBody(body: string): FriendLinkIssueData | null {
  const fields = new Map<string, string>();

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*([^:]+):\s*(.*)\s*$/);
    if (!match) {
      continue;
    }
    fields.set(match[1]!.trim().toLowerCase(), match[2]!.trim());
  }

  const parsed = {
    siteName: fields.get("site name") ?? "",
    siteUrl: fields.get("site url") ?? "",
    friendPageUrl: fields.get("friend page url") ?? "",
    avatarUrl: fields.get("avatar url") ?? "",
    description: fields.get("short description") ?? "",
    contact: fields.get("your name / contact") ?? "",
  };

  if (
    !parsed.siteName ||
    !parsed.siteUrl ||
    !parsed.friendPageUrl ||
    !parsed.description ||
    !parsed.contact
  ) {
    return null;
  }

  return parsed;
}

export function buildInitialFriendLinkComment(ownLink: OwnFriendLink) {
  return [
    INITIAL_COMMENT_MARKER,
    "收到友链申请啦！这个友链将会在 1 小时后被自动检验；检测不到反链会自动关闭。",
    "",
    "请先在您的博客友链中加入 woodfish 的友链喔：",
    "",
    `- 名字：${ownLink.name}`,
    `- 链接：${ownLink.link}`,
    `- 头像：${ownLink.avatar}`,
    `- 描述：${ownLink.descr}`,
    "",
    "请确认 issue 里的友链页链接可以直接访问，并且该页面能看到 woodfish 的友链信息。",
    "",
    "如果到时检测到反链，我会自动把你的站点加入这里的友链并关闭 issue。",
  ].join("\n");
}

export function shouldReviewIssue(
  createdAt: string,
  now = new Date(),
  waitMs = DEFAULT_WAIT_MS,
) {
  const createdTime = Date.parse(createdAt);
  return Number.isFinite(createdTime) && now.getTime() - createdTime >= waitMs;
}

export async function verifyReciprocalLink(
  friendPageUrl: string,
  ownLink: OwnFriendLink,
  options: {
    fetchText?: (url: string) => Promise<string>;
  } = {},
): Promise<ReciprocalLinkCheckResult> {
  const fetchText = options.fetchText ?? fetchPageText;
  const targetUrl = normalizeFetchUrl(friendPageUrl);
  const checkedUrls = [targetUrl ?? friendPageUrl.trim()].filter(Boolean);

  if (!targetUrl) {
    return {
      checkedUrls,
      found: false,
    };
  }

  let html = "";
  try {
    html = await fetchText(targetUrl);
  } catch {
    return {
      checkedUrls,
      found: false,
    };
  }

  if (containsOwnFriendLink(html, ownLink)) {
    return {
      checkedUrls,
      found: true,
      matchedUrl: targetUrl,
    };
  }

  return {
    checkedUrls,
    found: false,
  };
}

export function mergeFriendLinkIntoYaml(rawYaml: string, friend: FriendLinkIssueData) {
  const existing = readFriendLinksFromYaml(rawYaml);
  const normalizedSiteUrl = normalizeComparableUrl(friend.siteUrl);

  if (
    existing.some(
      (item) =>
        normalizeComparableUrl(item.link) === normalizedSiteUrl ||
        item.name.trim().toLowerCase() === friend.siteName.trim().toLowerCase(),
    )
  ) {
    return {
      changed: false,
      content: rawYaml,
    };
  }

  const suffix = rawYaml.endsWith("\n") ? "" : "\n";
  return {
    changed: true,
    content: `${rawYaml}${suffix}${formatFriendLinkYamlEntry(friend)}\n`,
  };
}

export async function buildFriendLinksFromYaml(options: {
  appRoot: string;
  linkPath: string;
  publicRoot: string;
  siteBasePath?: string;
}) {
  const raw = await readFile(options.linkPath, "utf8");
  const groups = readFriendGroups(raw);
  const result: FriendLinkData[] = [];

  for (const group of groups) {
    const className = readString(group.class_name);
    const linkList = Array.isArray(group.link_list) ? group.link_list : [];

    for (const item of linkList) {
      const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const name = readString(record.name);
      const link = readString(record.link);
      if (!name || !link) {
        continue;
      }

      const rawAvatar = readString(record.avatar);
      const avatar = rawAvatar
        ? await resolveFriendAvatar(rawAvatar, {
            appRoot: options.appRoot,
            linkPath: options.linkPath,
            publicRoot: options.publicRoot,
            siteBasePath: options.siteBasePath,
          })
        : "";

      result.push({
        name,
        link,
        ...(avatar ? { avatar } : {}),
        ...(readString(record.descr) ? { descr: readString(record.descr) } : {}),
        ...(className ? { className } : {}),
      });
    }
  }

  return result;
}

export async function syncFriendLinksJson(options: BlogPathOverrides = {}) {
  const paths = resolveBlogPaths(options);
  const linkPath = getFriendLinkYamlPath(paths.appRoot);
  const generatedPath = path.join(paths.generatedRoot, "friends.json");
  const friendLinks = await buildFriendLinksFromYaml({
    appRoot: paths.appRoot,
    linkPath,
    publicRoot: paths.publicRoot,
  });

  await writeFile(generatedPath, `${JSON.stringify(friendLinks, null, 2)}\n`, "utf8");
  return {
    friendLinks,
    generatedPath,
    linkPath,
  };
}

function containsOwnFriendLink(html: string, ownLink: OwnFriendLink) {
  const normalizedHtml = normalizeHtmlForSearch(html);
  const targetUrls = [
    ownLink.link,
    ownLink.link.replace(/\/+$/, ""),
    ownLink.avatar,
    ownLink.avatar.replace(/\/+$/, ""),
  ].map((item) => item.toLowerCase());

  if (targetUrls.some((item) => item && normalizedHtml.includes(item))) {
    return true;
  }

  return (
    normalizedHtml.includes(ownLink.name.toLowerCase()) &&
    normalizedHtml.includes(ownLink.descr.toLowerCase())
  );
}

function normalizeHtmlForSearch(html: string) {
  return decodeHtmlEntities(html)
    .replaceAll("\\/", "/")
    .replace(/\/+("|'|\s|>|<)/g, "$1")
    .toLowerCase();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeFetchUrl(siteUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl.trim());
  } catch {
    return null;
  }

  if (!isSafePublicHttpUrl(parsed)) {
    return null;
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "/";
  }
  return parsed.toString();
}

function isSafePublicHttpUrl(parsed: URL) {
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname) {
    return false;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }

  if (isUnsafeIpv4Host(hostname) || isUnsafeIpv6Host(hostname)) {
    return false;
  }

  return true;
}

function isUnsafeIpv4Host(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const [first, second] = octets as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isUnsafeIpv6Host(hostname: string) {
  return (
    hostname === "::1" ||
    hostname === "0:0:0:0:0:0:0:1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80:")
  );
}

function normalizeComparableUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/+$/, "").toLowerCase();
  }
}

async function fetchPageText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "WoodfishFriendLinkBot/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  return response.text();
}

function readFriendLinksFromYaml(rawYaml: string) {
  return readFriendGroups(rawYaml).flatMap((group) => {
    const linkList = Array.isArray(group.link_list) ? group.link_list : [];
    return linkList
      .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}))
      .map((item) => ({
        name: readString(item.name),
        link: readString(item.link),
      }))
      .filter((item) => item.name && item.link);
  });
}

function readFriendGroups(rawYaml: string) {
  const data = (yaml.load(rawYaml) as { links?: unknown } | undefined) ?? {};
  return Array.isArray(data.links)
    ? data.links
        .map((group) =>
          typeof group === "object" && group !== null ? (group as Record<string, unknown>) : {},
        )
        .filter((group) => Array.isArray(group.link_list))
    : [];
}

function formatFriendLinkYamlEntry(friend: FriendLinkIssueData) {
  const lines = [
    `      - name: ${yamlScalar(friend.siteName)}`,
    `        link: ${yamlScalar(friend.siteUrl)}`,
  ];

  if (friend.avatarUrl.trim()) {
    lines.push(`        avatar: ${yamlScalar(friend.avatarUrl)}`);
  }

  lines.push(`        descr: ${yamlScalar(friend.description)}`);
  return lines.join("\n");
}

function yamlScalar(value: string) {
  return JSON.stringify(value.trim());
}

async function resolveFriendAvatar(
  rawAvatar: string,
  options: {
    appRoot: string;
    linkPath: string;
    publicRoot: string;
    siteBasePath?: string;
  },
) {
  const resolved = await resolveAssetReference(rawAvatar, {
    sourceFilePath: options.linkPath,
    publicDir: options.publicRoot,
    siteBasePath: options.siteBasePath,
    sourceProjectRoot: options.appRoot,
    reuseGeneratedAssets: true,
  });

  return resolved ?? toSitePublicUrl(rawAvatar, options.siteBasePath);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFriendLinkYamlPath(appRoot: string) {
  return path.join(appRoot, "content/source/blog/source/_data/link.yml");
}

class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly owner: string,
    private readonly repo: string,
  ) {}

  async listOpenFriendIssues() {
    const issues = await this.request<GitHubIssue[]>(
      `/repos/${this.owner}/${this.repo}/issues?state=open&per_page=100`,
    );

    return issues.filter(
      (issue) => !issue.pull_request && issue.title.startsWith(FRIEND_LINK_TITLE_PREFIX),
    );
  }

  async listComments(issueNumber: number) {
    return this.request<{ body?: string | null }[]>(
      `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments?per_page=100`,
    );
  }

  async addComment(issueNumber: number, body: string) {
    await this.request(`/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`, {
      body: { body },
      method: "POST",
    });
  }

  async closeIssue(issueNumber: number, stateReason: "completed" | "not_planned") {
    await this.request(`/repos/${this.owner}/${this.repo}/issues/${issueNumber}`, {
      body: {
        state: "closed",
        state_reason: stateReason,
      },
      method: "PATCH",
    });
  }

  private async request<T = unknown>(
    apiPath: string,
    options: {
      body?: unknown;
      method?: string;
    } = {},
  ): Promise<T> {
    const response = await fetch(`https://api.github.com${apiPath}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "user-agent": "WoodfishFriendLinkBot/1.0",
        "x-github-api-version": "2022-11-28",
      },
      method: options.method ?? "GET",
    });

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

async function runOpenedMode() {
  const issue = await readEventIssue();
  if (!issue || !issue.title.startsWith(FRIEND_LINK_TITLE_PREFIX)) {
    console.log("No friend-link issue in event; skipping.");
    return;
  }

  const github = createGitHubClient();
  const comments = await github.listComments(issue.number);
  if (comments.some((comment) => comment.body?.includes(INITIAL_COMMENT_MARKER))) {
    console.log(`Initial friend-link comment already exists for #${issue.number}.`);
    return;
  }

  const ownLink = await readOwnFriendLink();
  await github.addComment(issue.number, buildInitialFriendLinkComment(ownLink));
  console.log(`Posted initial friend-link comment to #${issue.number}.`);
}

async function runReviewMode() {
  const github = createGitHubClient();
  const issues = await github.listOpenFriendIssues();
  const now = new Date();

  for (const issue of issues) {
    if (!shouldReviewIssue(issue.created_at, now)) {
      console.log(`Skipping #${issue.number}: still waiting for one-hour window.`);
      continue;
    }

    await reviewIssue(issue, github);
  }
}

async function reviewIssue(issue: GitHubIssue, github: GitHubClient) {
  const parsed = parseFriendLinkIssueBody(issue.body ?? "");

  if (!parsed) {
    await rejectIssue(
      github,
      issue.number,
      "到检验时间啦，但这个 issue 里的友链信息不完整，暂时无法自动处理。本 issue 先关闭，可以补齐信息后重新提交。",
    );
    return;
  }

  const ownLink = await readOwnFriendLink();
  const reciprocal = await verifyReciprocalLink(parsed.friendPageUrl, ownLink);
  if (!reciprocal.found) {
    await rejectIssue(
      github,
      issue.number,
      [
        "到检验时间啦，但暂时没有在你的站点检测到 woodfish 的友链。",
        "",
        `我检查过你填写的友链页链接：${reciprocal.checkedUrls.join(", ") || parsed.friendPageUrl}`,
        "",
        "如果你的友链是客户端懒加载出来的，请确认这个链接返回的 HTML 中也能直接包含 woodfish 的友链信息，或重新提交一个可直接抓取的友链页链接。",
        "",
        "本 issue 先关闭；加好反链后欢迎重新提交。",
      ].join("\n"),
    );
    return;
  }

  const paths = resolveBlogPaths();
  const linkPath = getFriendLinkYamlPath(paths.appRoot);
  const rawYaml = await readFile(linkPath, "utf8");
  const merged = mergeFriendLinkIntoYaml(rawYaml, parsed);
  if (merged.changed) {
    await writeFile(linkPath, merged.content, "utf8");
    await syncFriendLinksJson({
      repoRoot: paths.repoRoot,
    });
  }

  const commitSha = await commitAndPushFriendLink(paths.repoRoot, parsed, issue.number);
  await github.addComment(
    issue.number,
    [
      SUCCESS_COMMENT_MARKER,
      "检测到你已经加入 woodfish 友链，申请已自动通过。",
      commitSha ? `已提交到 main：${commitSha}` : "友链数据之前已经存在，这次没有产生新的提交。",
    ].join("\n\n"),
  );
  await github.closeIssue(issue.number, "completed");
  console.log(`Accepted friend link issue #${issue.number}.`);
}

async function rejectIssue(github: GitHubClient, issueNumber: number, message: string) {
  await github.addComment(issueNumber, `${REJECT_COMMENT_MARKER}\n${message}`);
  await github.closeIssue(issueNumber, "not_planned");
  console.log(`Rejected friend link issue #${issueNumber}.`);
}

async function commitAndPushFriendLink(repoRoot: string, friend: FriendLinkIssueData, issueNumber: number) {
  await git(repoRoot, [
    "add",
    "apps/blog/content/source/blog/source/_data/link.yml",
    "apps/blog/src/generated/friends.json",
    "apps/blog/public/remote-assets",
  ]);

  const staged = await git(repoRoot, ["diff", "--cached", "--name-only"]);
  if (!staged.trim()) {
    return "";
  }

  await git(repoRoot, [
    "commit",
    "-m",
    `feat(blog): add friend link ${friend.siteName} (#${issueNumber})`,
  ]);
  const sha = (await git(repoRoot, ["rev-parse", "--short", "HEAD"])).trim();
  await git(repoRoot, ["push", "origin", "HEAD:main"]);
  return sha;
}

async function git(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  return stdout;
}

async function readOwnFriendLink(): Promise<OwnFriendLink> {
  try {
    const paths = resolveBlogPaths();
    const rawYaml = await readFile(getFriendLinkYamlPath(paths.appRoot), "utf8");
    const links = readFriendGroups(rawYaml).flatMap((group) =>
      Array.isArray(group.link_list) ? group.link_list : [],
    );
    const own = links
      .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}))
      .find((item) => readString(item.name).toLowerCase() === WOODFISH_FRIEND_LINK.name);

    if (own) {
      return {
        name: readString(own.name) || WOODFISH_FRIEND_LINK.name,
        link: readString(own.link) || WOODFISH_FRIEND_LINK.link,
        avatar: readString(own.avatar) || WOODFISH_FRIEND_LINK.avatar,
        descr: readString(own.descr) || WOODFISH_FRIEND_LINK.descr,
      };
    }
  } catch {
    // Fall back to the canonical public data below.
  }

  return WOODFISH_FRIEND_LINK;
}

async function readEventIssue() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return null;
  }
  const event = JSON.parse(await readFile(eventPath, "utf8")) as { issue?: GitHubIssue };
  return event.issue ?? null;
}

function createGitHubClient() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required.");
  }
  if (!repository || !repository.includes("/")) {
    throw new Error("GITHUB_REPOSITORY must be owner/repo.");
  }
  const [owner, repo] = repository.split("/", 2) as [string, string];
  return new GitHubClient(token, owner, repo);
}

export async function runFriendLinkBotCli(argv: string[]) {
  const [mode] = argv;
  if (mode === "opened") {
    await runOpenedMode();
    return 0;
  }
  if (mode === "review") {
    await runReviewMode();
    return 0;
  }

  console.error("usage: friend-link-bot <opened|review>");
  return 2;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile && path.resolve(currentFile) === invokedFile) {
  runFriendLinkBotCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

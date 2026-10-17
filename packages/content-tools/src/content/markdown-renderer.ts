import { randomUUID } from "node:crypto";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import markdownItAnchor from "markdown-it-anchor";
import GithubSlugger from "github-slugger";
import mathjax from "markdown-it-mathjax3";
import cjkFriendly from "markdown-it-cjk-friendly";
import { fromHighlighter } from "@shikijs/markdown-it";
import {
  bundledLanguages,
  bundledLanguagesAlias,
  createHighlighter,
  type BundledLanguage,
} from "shiki";
import {
  sanitizeArticleHtml,
  sanitizeRenderedFragment,
} from "./render-sanitizer.js";
import type { GeneratedTocItem } from "./build-site-content.js";

export interface RenderDiagnostic {
  sourceFile: string;
  slug: string;
  line: number;
  formula: string;
  message: string;
}
interface RenderContext {
  sourceFile?: string;
  slug?: string;
  lineOffset?: number;
}
const highlighterPromise = createHighlighter({
  themes: ["github-light", "github-dark"],
  langs: [],
});
const languageLoads = new Map<string, Promise<unknown>>();
const options = {
  html: true,
  linkify: true,
  breaks: false,
  typographer: false,
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

// CJS plugins and ESM plugins expose distinct MarkdownIt declarations under NodeNext.
// They operate on the same runtime instance; adapt that module boundary once.
function applyPlugin(md: MarkdownIt, plugin: unknown, config?: unknown) {
  (plugin as (instance: MarkdownIt, options?: unknown) => void)(md, config);
  return md;
}

function languageOf(info: string) {
  const name = info.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (["", "text", "plaintext", "txt"].includes(name)) return "text";
  return name in bundledLanguages || name in bundledLanguagesAlias
    ? name
    : "text";
}

/** The legacy parser owns anchors: adding math tokens must not change shared URLs. */
function legacyHeadings(markdown: string) {
  const slugger = new GithubSlugger();
  const md = applyPlugin(new MarkdownIt(options), markdownItAnchor, {
    level: [2, 3, 4],
    tabIndex: false,
    getTokensText: (tokens: Token[]) =>
      tokens
        .filter((token) => token.type !== "image")
        .map((token) => token.content.replace(/<[^>]+>/g, ""))
        .join(""),
    slugify: (text: string) =>
      slugger.slug(
        text
          .replace(/<[^>]+>/g, "")
          .replace(/[&+]/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ),
  });
  const tokens = md.parse(markdown, {});
  const headings = new Map<number, GeneratedTocItem>();
  tokens.forEach((token, index) => {
    if (token.type !== "heading_open" || !token.attrGet("id")) return;
    const text = (tokens[index + 1]?.children ?? [])
      .filter((child) => child.type !== "image")
      .map((child) => child.content.replace(/<[^>]+>/g, ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    headings.set(token.map![0], {
      id: token.attrGet("id")!,
      level: Number(token.tag.slice(1)) as 2 | 3 | 4,
      text,
    });
  });
  return { headings, tokens };
}

export async function renderArticleMarkdown(
  markdown: string,
  context: RenderContext = {},
) {
  const { headings: oldHeadings, tokens: oldTokens } = legacyHeadings(markdown);
  const highlighter = await highlighterPromise;
  for (const token of oldTokens) {
    if (token.type !== "fence") continue;
    const language = languageOf(token.info);
    if (
      language === "text" ||
      highlighter.getLoadedLanguages().includes(language)
    )
      continue;
    if (!languageLoads.has(language))
      languageLoads.set(
        language,
        highlighter.loadLanguage(language as BundledLanguage),
      );
    await languageLoads.get(language);
  }
  const diagnostics: RenderDiagnostic[] = [];
  const fragments = new Map<string, string>();
  const prefix = `render-${randomUUID()}-`;
  function protect(html: string, block = false) {
    const tag = block ? "div" : "span";
    const marker = `<${tag} id="${prefix}${fragments.size}"></${tag}>`;
    fragments.set(marker, sanitizeRenderedFragment(html));
    return marker;
  }
  function finish(html: string) {
    let sanitized = sanitizeArticleHtml(html);
    for (const [marker, fragment] of fragments)
      sanitized = sanitized.replaceAll(marker, fragment);
    return sanitized;
  }
  const md = new MarkdownIt(options);
  applyPlugin(md, cjkFriendly);
  applyPlugin(
    md,
    fromHighlighter(highlighter, {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      trimEndingNewline: false,
    }),
  );
  applyPlugin(md, mathjax, {
    tex: {
      // No HTML, remote autoloading, or silent undefined-command expansion.
      packages: [
        "base",
        "ams",
        "newcommand",
        "boldsymbol",
        "mathtools",
        "cases",
        "cancel",
        "color",
        "unicode",
        "extpfeil",
        "textmacros",
      ],
      maxMacros: 1000,
      maxBuffer: 20 * 1024,
      formatError: (_jax: unknown, error: Error) => {
        throw error;
      },
    },
    svg: { fontCache: "none" },
  });

  for (const type of ["math_inline", "math_block"]) {
    const render = md.renderer.rules[type]!;
    md.renderer.rules[type] = (tokens, index, renderOptions, env, renderer) => {
      const token = tokens[index];
      if (token.meta?.renderedMarker) return token.meta.renderedMarker;
      const block = type === "math_block";
      let html: string;
      try {
        const output = render(tokens, index, renderOptions, env, renderer);
        const error = /data-mjx-error="([^"]+)"/.exec(output);
        if (error) throw new Error(error[1]);
        html = `<${block ? "div" : "span"} class="render-math${block ? " render-math--block" : ""}">${output}</${block ? "div" : "span"}>`;
      } catch (error) {
        diagnostics.push({
          sourceFile: context.sourceFile ?? "",
          slug: context.slug ?? "",
          line: (token.meta?.sourceLine ?? 0) + (context.lineOffset ?? 0) + 1,
          formula: token.content,
          message:
            error && typeof error === "object" && "message" in error
              ? String(error.message)
              : String(error),
        });
        const raw = `${token.markup}${token.content}${token.markup}`;
        html = `<${block ? "div" : "span"} class="render-math-error" role="note" title="公式无法解析，保留原式">${escapeHtml(raw)}</${block ? "div" : "span"}>`;
      }
      token.meta = { ...token.meta, renderedMarker: protect(html, block) };
      return token.meta.renderedMarker;
    };
  }
  const renderFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, renderOptions, env, renderer) => {
    const token = tokens[index];
    const label = token.info.trim().split(/\s+/)[0] || "text";
    const originalInfo = token.info;
    token.info = [
      languageOf(originalInfo),
      ...originalInfo.trim().split(/\s+/).slice(1),
    ].join(" ");
    try {
      const html = renderFence(
        tokens,
        index,
        renderOptions,
        env,
        renderer,
      ).replace("<pre ", `<pre data-language="${escapeHtml(label)}" `);
      return protect(html, true);
    } finally {
      token.info = originalInfo;
    }
  };

  const env = {};
  const tokens = md.parse(markdown, env);
  const toc: GeneratedTocItem[] = [];
  const headingTokens: { item: GeneratedTocItem; children: Token[] }[] = [];
  tokens.forEach((token, index) => {
    token.meta = { ...token.meta, sourceLine: token.map?.[0] ?? 0 };
    let cursor = 0;
    for (const child of token.children ?? []) {
      if (child.type !== "math_inline") continue;
      const start = token.content.indexOf(`$${child.content}$`, cursor);
      child.meta = {
        ...child.meta,
        sourceLine:
          (token.map?.[0] ?? 0) +
          (start >= 0
            ? token.content.slice(0, start).split("\n").length - 1
            : 0),
      };
      if (start >= 0) cursor = start + child.content.length + 2;
    }
    if (token.type !== "heading_open") return;
    const item = oldHeadings.get(token.map?.[0] ?? -1);
    if (!item) return;
    token.attrSet("id", item.id);
    toc.push(item);
    const children = tokens[index + 1]?.children ?? [];
    if (children.some((child) => child.type === "math_inline"))
      headingTokens.push({ item, children });
  });
  const rawHtml = md.renderer.render(tokens, md.options, env);
  for (const { item, children } of headingTokens) {
    item.html = finish(
      md.renderer.renderInline(
        children.filter((token) => token.type !== "image"),
        md.options,
        env,
      ),
    ).replace(/<\/?a\b[^>]*>/gi, "");
  }
  return { html: finish(rawHtml), toc, diagnostics };
}

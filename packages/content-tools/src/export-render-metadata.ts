import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import matter from "gray-matter";
import { createExcerpt, createSearchText, estimateReadingMinutes, readString, stripFencedCodeBlocks, toSearchablePlainText, toStringArray } from "./content/build-site-content.js";
import { legacyHeadings } from "./content/markdown-renderer.js";
import { normalizeMarkdownBody } from "./content/generator-core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const paths = execFileSync("git", ["ls-files", "-z", "--", "apps/blog/content/source/myblog"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(file => file.endsWith(".md")).sort();
const cases: { name: string; input: { title: string; type: string; categories: string[]; tags: string[]; markdown: string }; stripped: string; plain: string; reading: number; search: string; excerpt: string; headings: { id: string; level: number; text: string; line: number }[] }[] = [];
function add(name: string, markdown: string, title: string, metadata: Record<string, unknown> = {}) {
  const input = { title, type: readString(metadata.type) || "Notes", categories: toStringArray(metadata.categories), tags: toStringArray(metadata.tags), markdown };
  const headings = [...legacyHeadings(markdown).headings].map(([line, item]) => ({ ...item, line }));
  cases.push({ name, input, stripped: stripFencedCodeBlocks(markdown), plain: toSearchablePlainText(markdown), reading: estimateReadingMinutes(markdown), search: createSearchText(input), excerpt: createExcerpt(markdown, title), headings });
}
for (const file of paths) {
  const raw = await readFile(path.join(root, file), "utf8");
  const parsed = matter(raw);
  const title = readString(parsed.data.title) || path.basename(file, ".md");
  add(file, normalizeMarkdownBody(raw, title), title, parsed.data);
}
for (const [name, markdown] of Object.entries({
  empty: "",
  fences: "before\r\n````ts\r\n```\r\nhidden\r\n`````\r\nafter\n~~~text\nignored\n~~~~",
  unclosed: "before\n```text\nnever included",
  mixed: "before\n```\n~~~\nhidden\n```\nafter",
  markup: "## 标题\n![image](x.png) [link **label**](url) <b>bold</b> `code` &amp; ~word~",
  whitespace: "\ufeff Han\u00a0汉字\u0085word\u2028한국어\u3000カタカナ\nひらがな ",
  cjkBoundary: "汉".repeat(220),
  cjkOverflow: "汉".repeat(220) + " word",
  supplementary: "𠮷".repeat(221) + "🙂",
  wordBoundary: "word ".repeat(221),
  headingMarkup: "## **Strong** [link](https://x.test) ![ignored](x) <em>HTML</em> `code <T>` &amp; $a+b$\n\n## **Strong**\n\nSetext `code`\n---\n\n> ### Nested heading\n",
  excerptList: "# Heading\n\n[toc]\n\n- **First** list paragraph\n- second\n",
  excerptImages: "![x](image.png)\n\n<img src=\"x\">\n\nA [link](dest) &amp; `code` paragraph.",
  headingBreaks: "first\nsecond\n---\n\n## backslash \\* &lt;b&gt;literal&lt;/b&gt;\n",
  emptyHeadings: "##\n\n##\n\n## !!!\n\n## !!!\n",
  headingContainers: "- ## list heading\n\n> line one\n> line two\n> ---\n\n```md\n## hidden\n```\n",
  referenceLinks: "## [label][ref] and <https://example.com>\n\n[ref]: https://example.com\n\n[label][ref] first paragraph",
})) add(`edge/${name}`, markdown, "Fixture title", { categories: ["parity", " 中文 "], tags: ["Go", " TypeScript "] });
const destination = path.join(root, "services/api/internal/render/testdata/metadata.json.gz");
const serialized = JSON.stringify(cases);
if (process.argv.includes("--check")) {
  if (gunzipSync(await readFile(destination)).toString("utf8") !== serialized) {
    throw new Error("Metadata oracle differs from the current TypeScript output; regenerate it.");
  }
} else {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, gzipSync(serialized, { level: 9 }));
}
console.log(JSON.stringify({ articles: paths.length, edgeCases: cases.length - paths.length, destination }));

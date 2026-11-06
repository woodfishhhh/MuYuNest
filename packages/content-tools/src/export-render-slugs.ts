import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import GithubSlugger, { slug } from "github-slugger";
import matter from "gray-matter";
import { legacyHeadings } from "./content/markdown-renderer.js";
import { normalizeMarkdownBody } from "./content/generator-core.js";
import { readString } from "./content/build-site-content.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const destination = path.join(root, "services/api/internal/render");
const ranges: [number, number][] = [];
const caseInputs: string[] = [];
let start = -1;
for (let code = 0; code <= 0x110000; code++) {
  const value = code < 0x110000 ? String.fromCodePoint(code) : "";
  const removed = code < 0x110000 && !(code >= 0xd800 && code <= 0xdfff) && slug(value, true) === "";
  if (removed && start < 0) start = code;
  if (!removed && start >= 0) { ranges.push([start, code - 1]); start = -1; }
  if (value && value.toLowerCase() !== value) caseInputs.push(value);
}
const table = `// Code generated from github-slugger 2.0.0 by export-render-slugs.ts; DO NOT EDIT.\n// See github-slugger.LICENSE for the upstream license.\npackage render\n\nvar slugRemovedRanges = [...]struct{ lo, hi rune }{\n${ranges.map(([lo, hi]) => `\t{0x${lo.toString(16)}, 0x${hi.toString(16)}},`).join("\n")}\n}\n`;
const tablePath = path.join(destination, "slug_ranges.gen.go");
const formattedTable = execFileSync("gofmt", [], { input: table, encoding: "utf8" });
if (process.argv.includes("--check")) {
  if (await readFile(tablePath, "utf8") !== formattedTable) throw new Error("Slug character table drift; regenerate it.");
} else {
  await writeFile(tablePath, formattedTable);
}
const sequences: { name: string; heading: boolean; inputs: string[]; expected: string[] }[] = [];
function add(name: string, inputs: string[]) {
  const slugger = new GithubSlugger();
  sequences.push({ name, heading: false, inputs, expected: inputs.map(value => slugger.slug(value)) });
}
add("duplicates", ["foo", "foo", "foo-1", "foo", "foo-1", "", "", "-1", "__proto__", "constructor", "__proto__"]);
add("unicode", ["İ I i", "ΟΣ ΟΣΑ Σ", "ΣΣ", "AΣ\u0301", "Σ\u0301A", "中文 & C++", "a🙂b", "𠮷", "é e\u0301", "ＡＢＣ", "\tHello  WORLD\n", "\u0085\ufeff", "\ua7cb"]);
add("lowercase", caseInputs);
const files = execFileSync("git", ["ls-files", "-z", "--", "apps/blog/content/source/myblog"], { cwd: root, encoding: "utf8" }).split("\0").filter(file => file.endsWith(".md")).sort();
let headings = 0;
for (const file of files) {
  const raw = await readFile(path.join(root, file), "utf8");
  const title = readString(matter(raw).data.title) || path.basename(file, ".md");
  const { tokens } = legacyHeadings(normalizeMarkdownBody(raw, title));
  const inputs: string[] = [], expected: string[] = [];
  tokens.forEach((token, index) => {
    if (token.type !== "heading_open" || token.attrGet("id") === null) return;
    inputs.push((tokens[index + 1]?.children ?? []).filter(child => child.type !== "image").map(child => child.content.replace(/<[^>]+>/g, "")).join(""));
    expected.push(token.attrGet("id")!);
  });
  headings += inputs.length;
  sequences.push({ name: file, heading: true, inputs, expected });
}
const oraclePath = path.join(destination, "testdata/slugs.json.gz");
const serialized = JSON.stringify(sequences);
if (process.argv.includes("--check")) {
  if (gunzipSync(await readFile(oraclePath)).toString("utf8") !== serialized) throw new Error("Slug oracle drift; regenerate it.");
} else {
  await mkdir(path.join(destination, "testdata"), { recursive: true });
  await writeFile(oraclePath, gzipSync(serialized, { level: 9 }));
}
console.log(JSON.stringify({ articles: files.length, headings, ranges: ranges.length, lowercaseCases: caseInputs.length }));

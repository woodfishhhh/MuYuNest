import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const appRoot = new URL("../apps/blog/", import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, appRoot), "utf8"));
const index = read("public/post-index.json");
const series = read("src/content/docs-series.json");
const slugs = new Set(index.map((post) => post.canonicalSlug));
assert.equal(slugs.size, index.length, "Duplicate canonical article URLs");
const missing = series.flatMap((group) =>
  group.slugs.filter((slug) => !slugs.has(slug)),
);
assert.deepEqual(
  missing,
  [],
  "Docs navigation references missing canonical articles",
);
for (const slug of slugs) {
  assert.ok(
    existsSync(new URL(`src/generated/posts/${slug}.json`, appRoot)),
    `Missing article body: ${slug}`,
  );
}
console.log(
  `Verified ${slugs.size} article bodies and all ${series.length} configured series`,
);

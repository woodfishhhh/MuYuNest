import { mkdir, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSiteContent } from "./content/build-site-content.js";
import { resolveBlogPaths, type BlogPathOverrides } from "./paths.js";

export interface GenerateContentOptions extends BlogPathOverrides {
  reuseGeneratedAssets?: boolean;
  siteBasePath?: string;
}

export interface GenerateContentResult {
  generatedRoot: string;
  postCount: number;
  publicRoot: string;
  renderDiagnosticsPath: string;
  renderWarningCount: number;
}

export async function generateContent(options: GenerateContentOptions = {}): Promise<GenerateContentResult> {
  const paths = resolveBlogPaths(options);
  const generatedPostsRoot = path.join(paths.generatedRoot, "posts");
  const siteBasePath = options.siteBasePath;
  const reuseGeneratedAssets = options.reuseGeneratedAssets ?? false;

  await mkdir(paths.generatedRoot, { recursive: true });
  await rm(generatedPostsRoot, { force: true, recursive: true });
  await mkdir(generatedPostsRoot, { recursive: true });
  if (!reuseGeneratedAssets) {
    await rm(path.join(paths.publicRoot, "content-assets"), { force: true, recursive: true });
    await rm(path.join(paths.publicRoot, "imported-assets"), { force: true, recursive: true });
  }
  await mkdir(path.join(paths.publicRoot, "remote-assets"), { recursive: true });

  const siteContent = await buildSiteContent({
    sourceProjectRoot: paths.appRoot,
    targetPublicDir: paths.publicRoot,
    siteBasePath,
    reuseGeneratedAssets,
  });

  const renderDiagnosticsPath = path.join(paths.generatedRoot, "render-diagnostics.json");
  await writeJson(renderDiagnosticsPath, {
    postCount: siteContent.postIndex.length,
    errors: siteContent.renderDiagnostics,
  });
  await writeJson(path.join(paths.publicRoot, "post-index.json"), siteContent.postIndex);
  await rm(path.join(paths.generatedRoot, "post-index.json"), { force: true });
  await writeJson(path.join(paths.generatedRoot, "author.json"), siteContent.author);
  await writeJson(path.join(paths.generatedRoot, "friends.json"), siteContent.friendLinks);

  for (const [slug, article] of Object.entries(siteContent.postsBySlug)) {
    await writeJson(path.join(generatedPostsRoot, `${slug}.json`), article);
  }

  await pruneUnusedRemoteAssets(paths.publicRoot, siteContent);

  return {
    renderDiagnosticsPath,
    renderWarningCount: siteContent.renderDiagnostics.length,
    generatedRoot: paths.generatedRoot,
    postCount: siteContent.postIndex.length,
    publicRoot: paths.publicRoot,
  };
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function pruneUnusedRemoteAssets(publicRoot: string, siteContent: unknown) {
  const remoteAssetsRoot = path.join(publicRoot, "remote-assets");
  const referencedAssets = collectReferencedRemoteAssetFileNames(siteContent);
  const entries = await readdir(remoteAssetsRoot, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && !referencedAssets.has(entry.name))
      .map((entry) => unlink(path.join(remoteAssetsRoot, entry.name))),
  );
}

function collectReferencedRemoteAssetFileNames(siteContent: unknown) {
  const referencedAssets = new Set<string>();
  const serializedContent = JSON.stringify(siteContent);

  for (const match of serializedContent.matchAll(/remote-assets\/([A-Za-z0-9._-]+)/g)) {
    const fileName = match[1];
    if (fileName) {
      referencedAssets.add(fileName);
    }
  }

  return referencedAssets;
}

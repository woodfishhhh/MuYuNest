#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { generateContent } from "./generate-content.js";
import { migrateImages } from "./migrate.js";
import { optimizeImages } from "./optimize-images.js";
import { resolveBlogPaths, resolveDefaultRepoRoot, type BlogPathOverrides } from "./paths.js";
import { scanImageUrls, summarizeFindings, toCsvReport, toMarkdownReport } from "./report.js";
import { verifyDist } from "./verify-dist.js";

export async function runCli(argv: string[]) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  if (command === "generate") {
    return runGenerate(rest);
  }
  if (command === "optimize-images") {
    return runOptimizeImages(rest);
  }
  if (command === "verify-dist") {
    return runVerifyDist(rest);
  }
  if (command === "image-report") {
    return runImageReport(rest);
  }
  if (command === "migrate-images") {
    return runMigrateImages(rest);
  }

  console.error(`unknown command: ${command}`);
  printHelp();
  return 2;
}

async function runGenerate(args: string[]) {
  const parsed = parsePathFlags(args);
  const appPaths = resolveBlogPaths(parsed.paths);
  const options = {
    ...parsed.paths,
    reuseGeneratedAssets: parsed.rest.includes("--reuse-assets"),
    siteBasePath:
      getFlagValue(parsed.rest, "--site-base-path") ??
      getFlagValue(parsed.rest, "--base-path") ??
      process.env.CONTENT_BASE_PATH,
  };
  const result = await generateContent(options);
  console.log(`Generated ${result.postCount} posts into ${result.generatedRoot}`);
  console.log(`public root: ${appPaths.publicRoot}`);
  return 0;
}

async function runOptimizeImages(args: string[]) {
  const parsed = parsePathFlags(args);
  const result = await optimizeImages(parsed.paths);
  console.log(result.summaryLine);
  for (const failed of result.failed) {
    console.warn(`[images] failed ${failed.filePath}: ${failed.errorMessage ?? "unknown error"}`);
  }
  return 0;
}

async function runVerifyDist(args: string[]) {
  const parsed = parsePathFlags(args);
  const appPaths = resolveBlogPaths(parsed.paths);
  const distDirRaw =
    getFlagValue(parsed.rest, "--dist-dir") ?? getFlagValue(parsed.rest, "--output-root");
  const distDir = distDirRaw ? resolveFromRepo(parsed.paths.repoRoot, distDirRaw) : path.join(appPaths.appRoot, "dist");
  const basePath = getFlagValue(parsed.rest, "--base-path") ?? process.env.VITE_BASE_PATH ?? "/";
  const result = await verifyDist(distDir, basePath);
  console.log(
    `dist ok: base=${result.basePath}, assets=${result.assetRefs.length}, manifest=${result.manifestRefs[0]}`,
  );
  return 0;
}

async function runImageReport(args: string[]) {
  const parsed = parsePathFlags(args);
  let format: "markdown" | "json" | "csv" = "markdown";
  let contentRoot = resolveBlogPaths(parsed.paths).contentRoot;
  let outputPath = "";
  const rest = parsed.rest;

  for (let idx = 0; idx < rest.length; idx += 1) {
    const token = rest[idx];
    if ((token === "--format" || token === "-f") && idx + 1 < rest.length) {
      const value = rest[idx + 1];
      if (value === "markdown" || value === "json" || value === "csv") {
        format = value;
      }
      idx += 1;
      continue;
    }
    if (token.startsWith("--format=")) {
      const value = token.slice("--format=".length);
      if (value === "markdown" || value === "json" || value === "csv") {
        format = value;
      }
      continue;
    }
    if (token === "--content-root" && idx + 1 < rest.length) {
      contentRoot = resolveFromRepo(parsed.paths.repoRoot, rest[idx + 1]);
      idx += 1;
      continue;
    }
    if (token.startsWith("--content-root=")) {
      contentRoot = resolveFromRepo(parsed.paths.repoRoot, token.slice("--content-root=".length));
      continue;
    }
    if ((token === "--output" || token === "-o") && idx + 1 < rest.length) {
      outputPath = rest[idx + 1];
      idx += 1;
      continue;
    }
    if (token.startsWith("--output=")) {
      outputPath = token.slice("--output=".length);
    }
  }

  const findings = await scanImageUrls(contentRoot);
  const summary = summarizeFindings(findings);
  const payload = {
    summary,
    findings,
  };

  let output = "";
  if (format === "json") {
    output = JSON.stringify(payload, null, 2);
  } else if (format === "csv") {
    output = toCsvReport(findings);
  } else {
    output = toMarkdownReport(findings);
  }

  if (outputPath) {
    const finalPath = resolveFromRepo(parsed.paths.repoRoot, outputPath);
    await mkdir(path.dirname(finalPath), { recursive: true });
    await writeFile(finalPath, output, "utf8");
    console.log(`report written: ${finalPath}`);
  } else {
    console.log(output);
  }

  return 0;
}

async function runMigrateImages(args: string[]) {
  const parsed = parsePathFlags(args);
  const appPaths = resolveBlogPaths(parsed.paths);
  const rest = parsed.rest;
  let contentRoot = appPaths.contentRoot;
  let mode: "dry-run" | "write" = "dry-run";
  let endpoint = process.env.MUYU_ENDPOINT ?? "";
  let token = process.env.MUYU_TOKEN ?? "";
  let source = "migration";
  let manifestPath = "docs/muyu-image-migration-manifest.json";
  let includeExternal = false;

  for (let idx = 0; idx < rest.length; idx += 1) {
    const tokenArg = rest[idx];
    if (tokenArg === "--write") {
      mode = "write";
      continue;
    }
    if (tokenArg === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (tokenArg === "--include-external") {
      includeExternal = true;
      continue;
    }
    if (tokenArg === "--content-root" && idx + 1 < rest.length) {
      contentRoot = resolveFromRepo(parsed.paths.repoRoot, rest[idx + 1]);
      idx += 1;
      continue;
    }
    if (tokenArg.startsWith("--content-root=")) {
      contentRoot = resolveFromRepo(parsed.paths.repoRoot, tokenArg.slice("--content-root=".length));
      continue;
    }
    if (tokenArg === "--endpoint" && idx + 1 < rest.length) {
      endpoint = rest[idx + 1];
      idx += 1;
      continue;
    }
    if (tokenArg.startsWith("--endpoint=")) {
      endpoint = tokenArg.slice("--endpoint=".length);
      continue;
    }
    if (tokenArg === "--token" && idx + 1 < rest.length) {
      token = rest[idx + 1];
      idx += 1;
      continue;
    }
    if (tokenArg.startsWith("--token=")) {
      token = tokenArg.slice("--token=".length);
      continue;
    }
    if (tokenArg === "--source" && idx + 1 < rest.length) {
      source = rest[idx + 1];
      idx += 1;
      continue;
    }
    if (tokenArg.startsWith("--source=")) {
      source = tokenArg.slice("--source=".length);
      continue;
    }
    if (tokenArg === "--manifest" && idx + 1 < rest.length) {
      manifestPath = rest[idx + 1];
      idx += 1;
      continue;
    }
    if (tokenArg.startsWith("--manifest=")) {
      manifestPath = tokenArg.slice("--manifest=".length);
    }
  }

  const result = await migrateImages({
    contentRoot,
    endpoint: endpoint.trim(),
    includeExternal,
    manifestPath: resolveFromRepo(parsed.paths.repoRoot, manifestPath),
    mode,
    source: source.trim() || "migration",
    token: token.trim(),
  });

  console.log(JSON.stringify(result.summary, null, 2));
  console.log(`manifest written: ${result.manifestPath}`);
  return mode === "write" && result.summary.failedCount > 0 ? 1 : 0;
}

function parsePathFlags(args: string[]) {
  const paths: BlogPathOverrides = {
    repoRoot: resolveDefaultRepoRoot(),
  };
  const rest: string[] = [];

  for (let idx = 0; idx < args.length; idx += 1) {
    const token = args[idx];
    if (token === "--repo-root" && idx + 1 < args.length) {
      paths.repoRoot = args[idx + 1];
      idx += 1;
      continue;
    }
    if (token.startsWith("--repo-root=")) {
      paths.repoRoot = token.slice("--repo-root=".length);
      continue;
    }
    if (token === "--app-root" && idx + 1 < args.length) {
      paths.appRoot = args[idx + 1];
      idx += 1;
      continue;
    }
    if (token.startsWith("--app-root=")) {
      paths.appRoot = token.slice("--app-root=".length);
      continue;
    }
    if (token === "--public-root" && idx + 1 < args.length) {
      paths.publicRoot = args[idx + 1];
      idx += 1;
      continue;
    }
    if (token.startsWith("--public-root=")) {
      paths.publicRoot = token.slice("--public-root=".length);
      continue;
    }
    if (token === "--generated-root" && idx + 1 < args.length) {
      paths.generatedRoot = args[idx + 1];
      idx += 1;
      continue;
    }
    if (token.startsWith("--generated-root=")) {
      paths.generatedRoot = token.slice("--generated-root=".length);
      continue;
    }
    if (token === "--content-root" && idx + 1 < args.length) {
      paths.contentRoot = args[idx + 1];
      rest.push(token, args[idx + 1]);
      idx += 1;
      continue;
    }
    if (token.startsWith("--content-root=")) {
      const value = token.slice("--content-root=".length);
      paths.contentRoot = value;
      rest.push(token);
      continue;
    }

    rest.push(token);
  }

  if (paths.repoRoot) {
    paths.repoRoot = path.resolve(paths.repoRoot);
  }

  return { paths, rest };
}

function getFlagValue(args: string[], name: string) {
  for (let idx = 0; idx < args.length; idx += 1) {
    const token = args[idx];
    if (token === name && idx + 1 < args.length) {
      return args[idx + 1];
    }
    if (token.startsWith(`${name}=`)) {
      return token.slice(name.length + 1);
    }
  }
  return "";
}

function resolveFromRepo(repoRoot: string | undefined, value: string) {
  if (!value) {
    return value;
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(repoRoot ?? resolveDefaultRepoRoot(), value);
}

function printHelp() {
  console.log(`woodfish-content

commands:
  woodfish-content generate [--reuse-assets] [--site-base-path /] [--repo-root path] [--app-root path] [--content-root path] [--public-root path] [--generated-root path]
  woodfish-content optimize-images [--repo-root path] [--app-root path] [--public-root path]
  woodfish-content verify-dist [--dist-dir path] [--base-path /] [--repo-root path] [--app-root path]
  woodfish-content image-report [--content-root path] [--format markdown|json|csv] [--output file] [--repo-root path]
  woodfish-content migrate-images [--dry-run|--write] [--content-root path] [--manifest file] [--endpoint url] [--token value] [--include-external] [--repo-root path]
`);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile && path.resolve(currentFile) === invokedFile) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}

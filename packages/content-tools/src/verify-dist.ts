import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface DistPathVerification {
  basePath: string;
  assetRefs: string[];
  manifestRefs: string[];
}

export function normalizeDeployBasePath(value: string | undefined): string {
  if (!value || value.trim() === "" || value.trim() === "/") {
    return "/";
  }

  const trimmed = value.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function verifyIndexHtmlPaths(html: string, basePath = "/"): DistPathVerification {
  const normalizedBase = normalizeDeployBasePath(basePath);
  const refs = Array.from(html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)).map(
    (match) => match[1] ?? "",
  );

  const assetRefs = refs.filter((ref) => ref.includes("/assets/"));
  const manifestRefs = refs.filter((ref) => ref.endsWith("manifest.webmanifest"));

  if (assetRefs.length === 0) {
    throw new Error("dist/index.html has no asset references");
  }

  if (normalizedBase !== "/") {
    const rootScopedRefs = refs.filter(
      (ref) =>
        ref.startsWith("/assets/") || ref === "/registerSW.js" || ref === "/manifest.webmanifest",
    );

    if (rootScopedRefs.length > 0) {
      throw new Error(
        `dist/index.html contains root-scoped refs for subpath deploy: ${rootScopedRefs.join(", ")}`,
      );
    }
  }

  const wrongAssetRefs = assetRefs.filter((ref) => !ref.startsWith(`${normalizedBase}assets/`));
  if (wrongAssetRefs.length > 0) {
    throw new Error(
      `dist/index.html asset refs do not use ${normalizedBase}: ${wrongAssetRefs.join(", ")}`,
    );
  }

  if (normalizedBase !== "/") {
    // If a manifest ref appears in the HTML, ensure it's not root-scoped (would break subpath deploy)
    if (manifestRefs.includes("/manifest.webmanifest")) {
      throw new Error(
        `dist/index.html has root-scoped /manifest.webmanifest for subpath deploy: use ${normalizedBase}manifest.webmanifest or a relative path`,
      );
    }
    // Accept: no ref (injected at runtime by PWA JS), relative ref, or correctly base-prefixed ref
  } else {
    // Root deploy: any manifest ref is fine (no base prefix needed)
  }

  return {
    basePath: normalizedBase,
    assetRefs,
    manifestRefs,
  };
}

export async function verifyDist(distDir: string, basePath = "/") {
  await Promise.all([
    access(path.join(distDir, "index.html")),
    access(path.join(distDir, "sw.js")),
    access(path.join(distDir, "manifest.webmanifest")),
    access(path.join(distDir, "assets")),
  ]);

  const html = await readFile(path.join(distDir, "index.html"), "utf8");
  return verifyIndexHtmlPaths(html, basePath);
}

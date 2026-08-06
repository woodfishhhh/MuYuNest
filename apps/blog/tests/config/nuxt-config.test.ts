import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readBlogPackageJson() {
  return JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
}

function readNuxtConfigSource() {
  return readFileSync(resolve(process.cwd(), "nuxt.config.ts"), "utf8");
}

describe("Nuxt app config", () => {
  it("keeps the blog in SPA mode with a runtime-configurable base URL", () => {
    const configSource = readNuxtConfigSource();

    expect(configSource).toContain("ssr: false");
    expect(configSource).toContain('baseURL: process.env.NUXT_APP_BASE_URL || "/"');
    expect(configSource).toContain('buildAssetsDir: "assets"');
    expect(configSource).toContain("__APP_BASE_URL__");
  });

  it("uses the Nuxt nightly stack with PostCSS Tailwind and manual Pinia wiring", () => {
    const packageJson = readBlogPackageJson();
    const configSource = readNuxtConfigSource();

    expect(packageJson.dependencies).toHaveProperty("pinia");
    expect(packageJson.dependencies).toHaveProperty("vue");
    expect(packageJson.devDependencies.nuxt).toMatch(/^npm:nuxt-nightly@/);
    expect(configSource).toContain('modules: ["@vite-pwa/nuxt"]');
    expect(configSource).toContain('"@tailwindcss/postcss": {}');
    expect(configSource).toContain('from: "pinia"');
  });

  it("allows the liquid-gl snapshot worker without broadening script sources", () => {
    const configSource = readNuxtConfigSource();

    expect(configSource).toContain("worker-src 'self' blob:");
    expect(configSource).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("keeps CI/deploy scripts on Nuxt generation plus dist verification", () => {
    const packageJson = readBlogPackageJson();

    expect(packageJson.scripts.typecheck).toContain("nuxt typecheck");
    expect(packageJson.scripts.build).toBe("nuxt generate");
    expect(packageJson.scripts["build:deploy:dist"]).toContain("NUXT_APP_BASE_URL=/");
    expect(packageJson.scripts["build:deploy:dist"]).toContain("verify-dist --base-path /");
  });
});

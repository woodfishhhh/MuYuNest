import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const series = JSON.parse(readFileSync("src/content/docs-series.json", "utf8")) as { hidden?: boolean; slugs: string[] }[];

test.use({ serviceWorkers: "block" });
test("hidden guides stay out of navigation and search while existing URLs work", async ({ page }, info) => {
  const hidden = series.filter(s => s.hidden).flatMap(s => s.slugs);
  await page.goto("/blog");
  for (const id of ["nestjs-guide", "react19"]) {
    await expect(page.locator(`a[href*="series=${id}"]`)).toHaveCount(0);
  }
  for (const query of ["NestJS", "React"]) {
    await page.goto(`/blog?q=${query}`);
    await expect(page.locator(".docs-search-panel")).toBeVisible();
    for (const slug of hidden) await expect(page.locator(`a[href^="/posts/${slug}"]`)).toHaveCount(0);
  }
  await page.goto("/blog?topic=frontend");
  await expect(page.getByRole("heading", { name: "React 学习笔记", exact: true })).toBeVisible();
  await expect(page.locator(".docs-sidebar .docs-tree")).toHaveCSS("font-weight", "600");
  await expect(page.locator(".docs-sidebar .docs-tree")).toHaveCSS("font-size", "16px");
  await expect(page.locator(".docs-chapter-link").first()).toHaveCSS("font-size", "16px");
  expect(await page.locator(".docs-app").evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/^Consolas/);
  expect(await page.getByTestId("site-nav").getByRole("link", { name: "WOODFISH", exact: true }).evaluate(el => getComputedStyle(el).fontFamily)).toContain("Avenir Next");
  await expect(page.getByRole("heading", { name: "React 学习笔记", exact: true })).toHaveCSS("font-weight", "700");
  await page.screenshot({ animations: "disabled", path: info.outputPath("blog-fonts.png") });
  await page.goto("/blog?topic=backend");
  await expect(page.getByRole("heading", { name: "NestJS 全家桶", exact: true })).toBeVisible();
  await page.goto("/posts/01-nestjs-5c3aebe1");
  await expect(page.locator("#article-container")).toBeVisible();
});

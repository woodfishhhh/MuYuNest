import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", video: { mode: "on", size: { width: 1440, height: 900 } } });
const root = ".docs-app";
const nav = (page: import("@playwright/test").Page, item: string) =>
  page.locator(`[data-nav-group="desktop"] [data-nav-item="${item}"]`);

test("Blog entrance is choreographed and interruption leaves no hidden surfaces", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await nav(page, "blog").click();
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "entering");
  await expect(page.locator(root)).toHaveAttribute("data-docs-entry", "full");
  await page.waitForTimeout(180); // Sample the actual in-flight animation for visual review.
  await page.screenshot({ path: info.outputPath("entrance-mid.png") });
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  await expect(page.locator(".docs-sidebar")).toHaveCSS("transform", "none");
  await expect(page.locator(".docs-intro")).toHaveCSS("clip-path", "none");
  await page.screenshot({ path: info.outputPath("entrance-complete.png") });
  await page.waitForTimeout(800); // Hold the completed view in the review recording.
  await nav(page, "home").click();
  await nav(page, "blog").click();
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "entering");
  await nav(page, "friend").click();
  await expect(page.locator(root)).toHaveCount(0);
  await nav(page, "blog").click();
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  expect(errors).toEqual([]);
});

test("query changes, sorting, article entry and back preserve usable navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/blog");
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  await page.getByRole("searchbox", { name: "搜索文章", exact: true }).fill("JavaScript");
  await expect(page.locator(".docs-article-row").first()).toBeVisible();
  await page.locator(".docs-filters select").last().selectOption("oldest");
  await page.locator(".docs-filters select").last().selectOption("alphabetical");
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  await expect(page.locator(".docs-article-row").first()).toHaveCSS("opacity", "1");
  await page.locator(".docs-article-row").first().click();
  await expect(page.locator(root)).toHaveAttribute("data-docs-entry", "brief");
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  await expect(page.locator("#article-container")).toBeVisible();
  await page.goBack();
  await expect(page.locator(root)).toHaveAttribute("data-docs-entry", "brief");
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  await expect(page.getByRole("searchbox", { name: "搜索文章", exact: true })).toHaveValue("JavaScript");
});

test("mobile drawer and nested accordion support reversal and reduced motion", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/blog");
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  const menu = page.getByRole("button", { name: "☰ 文档目录" });
  await menu.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "展开前端开发", exact: true }).click();
  await dialog.getByRole("button", { name: "收起前端开发", exact: true }).click();
  await dialog.getByRole("button", { name: "展开前端开发", exact: true }).click();
  await expect(dialog.getByRole("link", { name: "Vue 3 完全开发指南", exact: true })).toBeVisible();
  await expect(dialog.locator(".docs-tree__groups > section").first()).toHaveCSS("opacity", "1");
  await page.screenshot({ path: info.outputPath("mobile-drawer.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await menu.click();
  await expect(dialog).toHaveCSS("transform", "none");
  await expect(dialog.getByRole("link", { name: "Vue 3 完全开发指南", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
  await expect(page.locator(".docs-main")).toHaveCSS("opacity", "1");
});

test("slow content remains understandable before entry starts", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/post-index.json", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/blog");
  try {
    await expect(page.getByRole("status")).toHaveText("正在载入知识库…");
    await expect(page.getByRole("status")).toBeVisible();
  } finally {
    release();
  }
  await expect(page.locator(root)).toHaveAttribute("data-docs-motion", "idle");
});

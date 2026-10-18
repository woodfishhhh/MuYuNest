import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("home defers the archive and opening a result requests one article", async ({ page }, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const avatar = page.getByAltText("木鱼的头像");
  await expect(avatar).toBeVisible();
  await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(256);
  // The removed warmup used to run after 1.2 seconds.
  await page.waitForTimeout(1500);
  expect(requests.filter(url => /\/(post-index\.json|articles\/)/.test(url))).toEqual([]);
  await page.screenshot({ path: info.outputPath("home-avatar.png") });
  await page.getByTestId("site-nav-wide").getByRole("link", { name: "Blog", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索文章", exact: true }).fill("输入与输出");
  await expect(page.locator(".docs-article-row")).toHaveCount(1);
  await page.locator(".docs-article-row").click();
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  expect(requests.filter(url => url.endsWith("/post-index.json"))).toHaveLength(1);
  expect(requests.filter(url => url.startsWith("/articles/"))).toEqual(["/articles/go-basics-02-input-output.json"]);
  await page.getByTestId("post-view-back-link").click();
  await expect(page.getByRole("searchbox", { name: "搜索文章", exact: true })).toHaveValue("输入与输出");
  await page.locator(".docs-article-row").click();
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  expect(requests.filter(url => url.startsWith("/articles/"))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("failed archive exposes retry without downloading the corpus", async ({ page }) => {
  let attempts = 0;
  const articles: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/articles/")) articles.push(request.url());
  });
  await page.route("**/post-index.json", route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue();
  });
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "知识库暂时无法加载" })).toBeVisible();
  expect(articles).toEqual([]);
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.locator(".docs-topic-card")).toHaveCount(8);
  expect(attempts).toBe(2);
});

test("failed article retries without refetching the archive", async ({ page }) => {
  let attempts = 0;
  let indexes = 0;
  page.on("request", request => {
    if (request.url().endsWith("/post-index.json")) indexes++;
  });
  await page.route("**/articles/go-basics-02-input-output.json", route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue();
  });
  await page.goto("/posts/go-basics-02-input-output");
  await expect(page.getByRole("heading", { name: "文章暂时无法加载" })).toBeVisible();
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  expect(attempts).toBe(2);
  expect(indexes).toBe(1);
});

test("avatar and navigation fit a 320px screen", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.getByAltText("木鱼的头像")).toBeVisible();
  await page.getByRole("button", { name: "Toggle Menu" }).click();
  await page.locator("#site-navigation-menu").getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page.locator(".docs-topic-card")).toHaveCount(8);
  await page.getByRole("button", { name: "☰ 文档目录" }).click();
  await expect(page.getByRole("dialog", { name: "文档目录" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "文档目录" })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("blog-mobile-avatar.png") });
});

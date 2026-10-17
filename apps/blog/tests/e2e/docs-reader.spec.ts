import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("knowledge base, topic navigation, search and return context", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blog");
  await expect(page.locator(".docs-topic-card")).toHaveCount(8);
  await page.locator(".docs-topic-card").filter({ hasText: "编程语言" }).click();
  await expect(page).toHaveURL(/topic=languages/);
  await expect(page.locator('.docs-sidebar .docs-tree__row button[aria-label="收起编程语言"]')).toBeVisible();
  await page
    .getByRole("textbox", { name: "搜索文章" })
    .or(page.getByRole("searchbox", { name: "搜索文章", exact: true }))
    .fill("输入与输出");
  const result = page.locator(".docs-article-row");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("Go 基础课程");
  await result.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("输入与输出");
  await expect(page.locator('.docs-sidebar [aria-current="page"]')).toContainText("输入与输出");
  await page.getByTestId("post-view-back-link").click();
  await expect(page.getByRole("searchbox", { name: "搜索文章", exact: true })).toHaveValue("输入与输出");
  await expect(page.locator(".docs-article-row")).toHaveCount(1);
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page).toHaveURL(/series=go-basics/);
  await expect(page.getByRole("searchbox", { name: "搜索文章", exact: true })).toHaveValue("");
});

test("outline anchors, syntax colors, clipboard and curriculum neighbors", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/posts/go-basics-02-input-output");
  const code = page.locator("#article-container pre code").first();
  await expect(code).toBeVisible();
  await expect.poll(() => page.locator(".article-toc--desktop [aria-current=location]").textContent()).toBe("变量定义");
  const original = await code.textContent();
  await page.getByRole("button", { name: "复制 Go 代码", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "复制 Go 代码", exact: true }).first()).toHaveText("已复制");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(
    original?.replace(/\r\n/g, "\n"),
  );
  const colors = await code.evaluate((el) => ({
    plain: getComputedStyle(el).color,
    keyword: getComputedStyle(el.querySelector(".hljs-keyword")!).color,
  }));
  expect(colors.keyword).not.toBe(colors.plain);
  await page.locator(".article-toc--desktop").getByRole("button", { name: "输出", exact: true }).click();
  await expect(page).toHaveURL(/#%E8%BE%93%E5%87%BA$/);
  await expect.poll(() => page.locator('.article-toc--desktop [aria-current="location"]').textContent()).toBe("输出");
  await page.reload();
  await expect.poll(() => page.locator(".docs-main").evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
  await expect.poll(() => page.locator("#输出").evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(80);
  await page.getByTestId("post-view-next-link").click();
  await expect(page).toHaveURL(/go-basics-03-data-types/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("基本数据类型");
  await page.getByTestId("post-view-previous-link").click();
  await expect(page).toHaveURL(/go-basics-02-input-output/);
});

for (const width of [1440, 1024, 390]) {
  test(`readable day and night layouts at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/posts/golang-context-internals");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Go Context");
    await expect(page.locator(".docs-sidebar")).toBeVisible({ visible: width >= 960 });
    await expect(page.locator(".article-shell__rail")).toBeVisible({ visible: width >= 1280 });
    for (const theme of ["night", "day"]) {
      const current = await page.locator("html").getAttribute("data-theme");
      if (current !== theme)
        await page
          .getByTestId("site-nav")
          .getByRole("button", { name: /切换到/ })
          .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--theme-switch-radius"));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(await page.locator(".docs-main").evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`reader-${width}-${theme}.png`) });
    }
    if (width < 960) {
      const menu = page.getByRole("button", { name: "☰ 文档目录" });
      await menu.click();
      await expect(page.getByRole("dialog", { name: "文档目录" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "文档目录" })).not.toBeVisible();
      await expect(menu).toBeFocused();
    }
    if (width < 1280) {
      await page.getByTestId("article-toc-mobile-toggle").click();
      await page.locator(".article-toc--mobile").getByRole("button").filter({ hasText: "timerCtx" }).first().click();
      await expect(page.getByTestId("article-toc-mobile-toggle")).toHaveAttribute("aria-expanded", "false");
      await expect.poll(() => page.locator(".docs-main").evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
    }
  });
}

test("empty search and unknown article remain navigable", async ({ page }) => {
  await page.goto("/blog?q=does-not-exist-xyz");
  await expect(page.getByText("没有找到相关笔记", { exact: false })).toBeVisible();
  await page.goto("/posts/does-not-exist-xyz");
  await expect(page.getByRole("heading", { name: "文章不存在" })).toBeVisible();
  await page.getByTestId("post-view-back-link").click();
  await expect(page.locator(".docs-topic-card")).toHaveCount(8);
});

test("site navigation still reaches home, works, author and friends", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [name, path] of [
    ["Home", "/"],
    ["Works", "/works"],
    ["Author", "/author"],
    ["Friend", "/friend"],
  ]) {
    await page.goto("/blog");
    await page
      .getByRole("navigation", { name: "站点导航", exact: true })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}\\/?$`));
    await expect(page.locator('[data-panel-active="true"]')).toBeVisible();
  }
});

test("course overview Markdown links open local canonical articles", async ({ page }) => {
  await page.goto("/posts/readme-fd3ae1bb");
  const link = page.locator('#article-container a[href="/posts/01-vue3-ce7a3dbf"]');
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(/\/posts\/01-vue3-ce7a3dbf/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Vue");
});

test("one persistent site navigation connects Home, Blog and articles", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByTestId("site-nav");
  await expect(nav).toHaveCount(1);
  await nav.evaluate((element) => element.setAttribute("data-instance-marker", "shared"));
  await page.getByTestId("site-nav-wide").getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page.locator(".docs-topic-card")).toHaveCount(8);
  await expect(nav).toHaveAttribute("data-instance-marker", "shared");
  await expect(page.getByTestId("site-nav-wide").locator('[data-nav-item="blog"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("THE KNOWLEDGE GARDEN", { exact: true })).toHaveCount(0);
  await expect(page.getByText("不必一次读完。", { exact: false })).toHaveCount(0);
  await page.locator('.docs-sidebar input[aria-label="搜索知识库"]').fill("输入与输出");
  await page.locator('.docs-sidebar button[aria-label="提交搜索"]').click();
  await page.locator(".docs-article-row").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("输入与输出");
  await expect(nav).toHaveAttribute("data-instance-marker", "shared");
  await expect(page.getByTestId("site-nav-wide").locator('[data-nav-item="blog"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByTestId("site-nav-wide").getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("WoodFishNest | 木鱼的鱼窝");
  await expect(nav).toHaveAttribute("data-instance-marker", "shared");
  await expect(page.getByTestId("site-nav-wide").locator('[data-nav-item="home"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("mobile site menu keeps the original navigation on Blog and article pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/posts/go-basics-02-input-output");
  await expect(page.getByTestId("site-nav")).toHaveCount(1);
  await page.getByRole("button", { name: "Toggle Menu" }).click();
  const menu = page.locator("#site-navigation-menu");
  await expect(menu.locator('[data-nav-item="blog"]')).toHaveAttribute("aria-current", "page");
  await menu.getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page.locator(".docs-topic-card")).toHaveCount(8);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "☰ 文档目录" })).toBeVisible();
});

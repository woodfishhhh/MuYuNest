import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const article = "/posts/2-fab0b7c6?topic=database&series=database-foundations";

test("reading surfaces share one palette in both themes", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(article);
  await expect(page.locator("#article-container")).toBeVisible();
  for (const theme of ["day", "night"]) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page
        .getByTestId("site-nav")
        .getByRole("button", { name: /切换到/ })
        .click();
    await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--theme-switch-radius"));
    for (const selector of [".article-view", ".article-prose-shell", ".article-hero__body", ".article-toc__card"]) {
      await expect(page.locator(selector).first()).toHaveCSS("background-image", "none");
      await expect(page.locator(selector).first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
    const headingColor = await page
      .locator("#article-container h2")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    await expect(page.locator("#article-container p").first()).toHaveCSS("color", headingColor);
    await expect(page.locator(".article-toc__item.is-active").first()).toHaveCSS("background-image", "none");
    await page.screenshot({ animations: "disabled", path: info.outputPath(`reader-${theme}.png`) });
  }
  await page.goto("/blog");
  await expect(page.locator(".docs-topic-card").first()).toBeVisible();
  await page.screenshot({ animations: "disabled", path: info.outputPath("knowledge-base.png") });
});

test("drawer and collapsible navigation survive interruption and reduced motion", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(article);
  const menu = page.getByRole("button", { name: "☰ 文档目录" });
  await menu.click();
  const drawer = page.getByRole("dialog");
  const topic = drawer.getByRole("button", { name: "展开前端开发", exact: true });
  await topic.click();
  await drawer.getByRole("button", { name: "收起前端开发", exact: true }).click();
  await expect(drawer.getByRole("link", { name: "Vue 3 完全开发指南", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(menu).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await menu.click();
  await expect(drawer).toHaveCSS("transition-duration", "0s");
  await page.keyboard.press("Escape");
  await page.getByTestId("article-toc-mobile-toggle").click();
  await page
    .locator(".article-toc--mobile")
    .getByRole("button", { name: "三、关系代数怎样表达查询", exact: true })
    .click();
  await expect(page).toHaveURL(/#%E4%B8%89/);
  await expect(page.getByTestId("article-toc-mobile-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({ animations: "disabled", path: info.outputPath("mobile-reader.png") });
});


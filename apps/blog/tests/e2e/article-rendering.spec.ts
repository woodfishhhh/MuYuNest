import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const articlePath = "/posts/2-fab0b7c6?topic=database&series=database-foundations";
const joinId = "3连接joinr-bowtie_atheta-b-s";

for (const width of [1440, 390]) {
  test(`math, Chinese emphasis and formula outlines at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(articlePath);
    const paragraph = page.locator("#article-container p").filter({ hasText: "保留重复属性列" });
    await expect(paragraph.locator("mjx-container")).toHaveCount(3);
    await expect(paragraph.locator("strong").first()).toContainText("等号");
    await expect(paragraph.locator("strong").first().locator("svg")).toHaveCount(1);
    expect(await paragraph.textContent()).not.toMatch(/\\theta|\*\*|\$A=B\$/);

    if (width < 1280) await page.getByTestId("article-toc-mobile-toggle").click();
    const outline = page.locator(width < 1280 ? ".article-toc--mobile" : ".article-toc--desktop");
    const target = outline.locator(`[data-toc-id="${joinId}"]`);
    await expect(target.locator("svg")).toHaveCount(1);
    await target.click();
    await expect.poll(() => page.locator(".docs-main").evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
    await expect(page).toHaveURL(new RegExp(encodeURIComponent(joinId)));
    await expect
      .poll(() =>
        page.locator(`[id="${joinId}"]`).evaluate((el) => {
          const root = document.querySelector(".docs-main")!;
          return Math.abs(el.getBoundingClientRect().top - root.getBoundingClientRect().top - 104);
        }),
      )
      .toBeLessThanOrEqual(3);
    for (const theme of ["night", "day"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await page
          .getByTestId("site-nav")
          .getByRole("button", { name: /切换到/ })
          .click();
      }
      await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--theme-switch-radius"));
      expect(await page.locator(".docs-main").evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const inlineMath = paragraph.locator("mjx-container").first();
      expect(await inlineMath.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const math = paragraph.locator("svg").first();
      expect(await math.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(5);
      expect(
        await paragraph
          .locator("mjx-assistive-mml")
          .first()
          .evaluate((el) => el.getBoundingClientRect().height),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`math-${width}-${theme}.png`) });
    }
    await page.reload();
    await expect.poll(() => page.locator(".docs-main").evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
    expect(errors).toEqual([]);
  });
}

test("Shiki switches token colors with the site theme while keeping source copying intact", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/posts/go-basics-02-input-output");
  const code = page.locator("#article-container pre.shiki code").first();
  await expect(code).toBeVisible();
  const source = await code.textContent();
  const token = code.locator('span[style*="--shiki"]').first();
  const before = await token.evaluate((el) => getComputedStyle(el).color);
  await page
    .getByTestId("site-nav")
    .getByRole("button", { name: /切换到/ })
    .click();
  await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--theme-switch-radius"));
  expect(await token.evaluate((el) => getComputedStyle(el).color)).not.toBe(before);
  await page.getByRole("button", { name: "复制 Go 代码", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "复制 Go 代码", exact: true }).first()).toHaveText("已复制");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(source);
});

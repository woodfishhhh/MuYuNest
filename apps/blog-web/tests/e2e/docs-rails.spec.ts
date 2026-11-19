import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const article = "/posts/2-fab0b7c6?topic=database&series=database-foundations";

for (const width of [1280, 1651, 1920]) {
  test(`outline fills the right rail without horizontal scrollers at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 871 });
    await page.goto(article);
    const rail = page.locator(".article-toc--desktop");
    await expect(rail).toBeVisible();
    const bounds = await rail.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(220);
    expect(width - bounds!.x - bounds!.width).toBeLessThanOrEqual(42);
    expect(await page.locator(".article-view__column").evaluate((el) => el.clientWidth)).toBeLessThanOrEqual(760);
    // Check every label/math wrapper, not just the outer page width.
    const overflowing = await rail.evaluate((el) =>
      Array.from(el.querySelectorAll<HTMLElement>("div, button, span, mjx-container"))
        .filter((node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1)
        .map((node) => ({ tag: node.tagName, className: node.className, excess: node.scrollWidth - node.clientWidth })),
    );
    expect(overflowing).toEqual([]);
    await expect(page.locator(".docs-sidebar")).toHaveCSS("scroll-behavior", "smooth");
    expect(await page.locator(".docs-sidebar").evaluate(el => getComputedStyle(el, "::-webkit-scrollbar").width)).toBe("6px");
    expect(await page.locator(".docs-sidebar").evaluate(el => getComputedStyle(el, "::-webkit-scrollbar-button").display)).toBe("none");
    await expect(rail.locator(".article-toc__scroll")).toHaveCSS("scroll-behavior", "smooth");
    await rail.getByRole("button", { name: /连接（Join）/ }).click();
    await expect(page).toHaveURL(/#3/);
    await expect.poll(() => rail.locator(".is-active").getAttribute("data-toc-id")).toContain("join");
    await expect.poll(() => page.locator(".docs-main").evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
    await expect.poll(() => page.locator('[id="3连接joinr-bowtie_atheta-b-s"]').evaluate(el =>
      Math.abs(el.getBoundingClientRect().top - document.querySelector(".docs-main")!.getBoundingClientRect().top - 104)
    )).toBeLessThanOrEqual(3);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`rails-${width}.png`) });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".docs-sidebar")).toHaveCSS("scroll-behavior", "auto");
    await page.goto("/blog");
    await expect(page.locator(".docs-index-toc")).toBeVisible();
    const indexBounds = await page.locator(".docs-index-toc").boundingBox();
    expect(width - indexBounds!.x - indexBounds!.width).toBeLessThanOrEqual(42);
  });
}

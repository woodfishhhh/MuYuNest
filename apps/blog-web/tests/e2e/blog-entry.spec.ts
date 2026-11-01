import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", video: { mode: "on", size: { width: 1440, height: 900 } } });
const nav = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`[data-nav-group="desktop"] [data-nav-item="${id}"]`);

for (const layout of ["orbit", "case"]) {
  test(`Works ${layout} cards leave while Blog opens and return after undocking`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 1651, height: 871 });
    await page.goto("/works");
    await expect(page.getByTestId("works-view-toggle")).toBeVisible();
    await page.getByTestId(`works-view-toggle-${layout}`).click();
    await page.waitForTimeout(1800); // Settle camera and card layout for the visual comparison.
    await page.screenshot({ path: info.outputPath(`${layout}-before.png`) });
    await nav(page, "blog").click();
    await expect(page.locator('[data-blog-entry="shrinking"]')).toBeVisible();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.locator(".docs-app")).toHaveCount(1);
    await page.waitForTimeout(200);
    await page.screenshot({ path: info.outputPath(`${layout}-shrinking.png`) });
    await nav(page, "works").click();
    await expect(page.locator('[data-blog-entry="shrinking"]')).toHaveCount(0);
    await page.waitForTimeout(1000); // Let the interrupted dock return fully before restoring cards.
    await expect(page).toHaveURL(/\/works$/);
    await expect(page.getByTestId("works-view-toggle-orbit")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".docs-app")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${layout}-restored.png`) });
    await nav(page, "blog").click();
    await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
    await nav(page, "works").click();
    await expect(page.getByTestId("works-view-toggle")).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: info.outputPath(`${layout}-returned.png`) });
    expect(errors).toEqual([]);
  });
}

test("Blog opens while the geometry is still shrinking", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(2000); // Let the camera entrance settle before capturing the departure.
  await page.screenshot({ path: info.outputPath("01-home.png") });
  await nav(page, "blog").click();
  await expect(page.locator('[data-blog-entry="shrinking"]')).toBeVisible();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "entering");
  await expect(page.locator('[data-blog-entry="shrinking"]')).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: info.outputPath("02-shrinking.png") });
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator('[data-blog-entry="shrinking"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("03-blog.png") });
});

test("Home interrupts the concurrent entry and repeated Blog clicks complete cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await nav(page, "blog").click();
  await expect(page.locator('[data-blog-entry="shrinking"]')).toBeVisible();
  await nav(page, "home").click();
  await expect(page.locator('[data-blog-entry="shrinking"]')).toHaveCount(0);
  await page.waitForTimeout(1000); // A cancelled animation must not navigate later.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".docs-app")).toHaveCount(0);
  await nav(page, "blog").click();
  await nav(page, "blog").click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  expect(errors).toEqual([]);
});

test("reduced motion and a direct Blog visit skip the shrink", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await nav(page, "blog").click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator('[data-blog-entry="shrinking"]')).toHaveCount(0);
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  await expect(page.locator('[data-blog-entry="shrinking"]')).toHaveCount(0);
});

test("transparent rails expose the scene and keep navigation usable", async ({ page }, info) => {
  await page.setViewportSize({ width: 1651, height: 871 });
  await page.goto("/blog");
  await expect(page.locator(".docs-app")).toHaveAttribute("data-docs-motion", "idle");
  for (const theme of ["night", "day"]) {
    if (await page.locator("html").getAttribute("data-theme") !== theme) {
      await page.getByTestId("site-nav").getByRole("button", { name: /切换到/ }).click();
      await page.waitForFunction(() => !document.documentElement.style.getPropertyValue("--theme-switch-radius"));
    }
    await expect(page.locator(".docs-sidebar")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".docs-index-toc")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".docs-main")).toHaveCSS("background-image", "none");
    await expect(page.locator(".docs-main")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(await page.locator(".docs-app").evaluate(el => getComputedStyle(el, "::before").display)).toBe("none");
    await page.screenshot({ path: info.outputPath(`rails-${theme}.png`) });
  }
  await page.locator(".docs-index-toc").getByRole("button", { name: "算法竞赛", exact: true }).click();
  await expect.poll(() => page.locator(".docs-main").evaluate(el => el.scrollTop)).toBeGreaterThan(500);
  await page.locator(".docs-sidebar").getByRole("link", { name: /前端开发/ }).click();
  await expect(page).toHaveURL(/topic=frontend/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("前端开发");
});

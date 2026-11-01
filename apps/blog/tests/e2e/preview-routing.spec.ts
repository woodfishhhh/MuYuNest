import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });
test.skip(!process.env.PWA_PREVIEW_INTEGRATION, "Requires production legacy and /next/ builds on one origin.");

test("an installed legacy worker lets the Vue preview own its routes", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.locator(".docs-index-grid")).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/sw\.js$/);
  await page.goto("/next/blog");
  await expect(page.locator(".docs-index-grid")).toBeVisible();
  await expect(page.locator('script[src^="/next/assets/"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/next\/sw\.js$/);
  await page.reload();
  await expect(page.locator(".docs-index-grid")).toBeVisible();
});

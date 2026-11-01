import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });
test.skip(!process.env.ANALYTICS_INTEGRATION, "Requires the metrics service and dashboard authentication when deployed.");

test("a PWA-controlled blog opens the real analytics dashboard without caching it", async ({ page }, testInfo) => {
  // This browser was already counted; verification must not add a visitor.
  await page.addInitScript(() => localStorage.setItem("vuecubeblog:visitor-counted:v1", "1"));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByTestId("visitor-count-badge").click();
  await expect(page.getByRole("heading", { name: "博客数据概览" })).toBeVisible();
  await expect(page.locator("#status")).toHaveText("统计范围：近 30 天");
  await page.screenshot({ path: testInfo.outputPath("analytics-dashboard.png"), fullPage: true });
  const cachedPrivateUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const entry of await (await caches.open(name)).keys()) {
        if (/\/(analytics|api)\//.test(new URL(entry.url).pathname)) urls.push(entry.url);
      }
    }
    return urls;
  });
  expect(cachedPrivateUrls).toEqual([]);
});

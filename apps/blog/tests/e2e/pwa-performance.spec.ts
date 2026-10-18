import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });
test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Requires a production build served at PLAYWRIGHT_BASE_URL.");

test("PWA caches only visited articles and can reopen them offline", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const precacheUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const name = names.find(name => name.includes("precache"))!;
    return (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname);
  });
  expect(precacheUrls).toContain("/");
  expect(precacheUrls.some(url => url.startsWith("/articles/"))).toBe(false);
  expect(requests.filter(url => /\/(post-index\.json|articles\/)/.test(url))).toEqual([]);

  await page.goto("/posts/go-basics-02-input-output");
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  await expect.poll(() => page.evaluate(async () =>
    (await (await caches.open("article-content-cache")).keys()).map(request => new URL(request.url).pathname),
  )).toEqual(["/articles/go-basics-02-input-output.json"]);
  await expect.poll(() => page.evaluate(async () =>
    (await (await caches.open("post-index-cache")).keys()).length,
  )).toBe(1);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("post-view-article")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("输入与输出");
});

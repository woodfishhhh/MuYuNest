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

test("PWA collection reaches the real backend and appears in its summary", async ({ page, request }) => {
  test.skip(!process.env.COUNTER_INTEGRATION, "Synthetic writes require the isolated metrics backend.");
  const before = await (await request.get("/api/analytics/summary?days=1")).json();
  await page.goto("/blog");
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const sessionId = `e2e-${Date.now()}`;
  const responses = await page.evaluate(async (sessionId) => {
    const results = [];
    for (const payload of [
      { type: "pageview", sessionId, path: "/blog", title: "Metrics integration" },
      { type: "event", sessionId, path: "/blog", name: "metrics-e2e" },
    ]) {
      const response = await fetch("/api/analytics/collect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      results.push({ status: response.status, body: await response.json() });
    }
    return results;
  }, sessionId);
  expect(responses).toEqual([
    { status: 202, body: { accepted: true } },
    { status: 202, body: { accepted: true } },
  ]);
  const after = await (await request.get("/api/analytics/summary?days=1")).json();
  expect(after.totals.pageviews).toBe(before.totals.pageviews + 1);
  expect(after.totals.events).toBe(before.totals.events + 1);
  const previousEvents = before.customEvents.find((event: { label: string; value: number }) => event.label === "metrics-e2e")?.value ?? 0;
  expect(after.customEvents).toContainEqual({ label: "metrics-e2e", value: previousEvents + 1 });
});

test("anonymous requests cannot read the analytics dashboard or summary", async ({ playwright, baseURL }) => {
  test.skip(!process.env.COUNTER_INTEGRATION, "Requires the isolated authenticated metrics fixture.");
  const anonymous = await playwright.request.newContext({ baseURL, httpCredentials: undefined });
  try {
    expect((await anonymous.get("/analytics/")).status()).toBe(401);
    expect((await anonymous.get("/api/analytics/summary")).status()).toBe(401);
    expect((await anonymous.fetch("/api/analytics/collect", { method: "OPTIONS" })).status()).toBe(204);
  } finally {
    await anonymous.dispose();
  }
});
